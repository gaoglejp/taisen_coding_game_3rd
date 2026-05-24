import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setSocketServer, getSocketServer } from "./src/lib/socket-server";
import { prisma } from "./src/lib/db";
import { simulate, type Strategy } from "./src/lib/match-simulator";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === "session") return decodeURIComponent(rest.join("="));
  }
  return null;
}

function userIdFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const [userId] = Buffer.from(token, "base64").toString().split(":");
    return userId || null;
  } catch {
    return null;
  }
}

const TURN_DELAY_MS = 1200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMatch(
  matchId: string,
  player1Id: string | null,
  player2Id: string | null,
  strategy1: unknown,
  strategy2: unknown
): Promise<void> {
  const result = simulate(strategy1 as Strategy, strategy2 as Strategy);

  for (const snapshot of result.turns) {
    // Emit before sleeping so a late-joining client doesn't desync; the
    // delay is purely visual pacing on the receiving page.
    getSocketServer()?.to(`match:${matchId}`).emit("turn_event", snapshot);
    await sleep(TURN_DELAY_MS);
  }

  const winnerId =
    result.winner === "p1" ? player1Id : result.winner === "p2" ? player2Id : null;

  await prisma.match.update({
    where: { id: matchId },
    data: {
      status: "FINISHED",
      endReason: result.endReason,
      winnerId,
      endedAt: new Date(),
      replayData: { turns: result.turns, finalHp: result.finalHp } as object,
    },
  });

  getSocketServer()?.to(`match:${matchId}`).emit("match_result", {
    matchId,
    winnerId,
    endReason: result.endReason,
    finalHp: result.finalHp,
    totalTurns: result.totalTurns,
  });
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url!, true);
    await handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    path: "/api/socket",
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? process.env.NEXT_PUBLIC_APP_URL
          : "http://localhost:3000",
      credentials: true,
    },
  });

  setSocketServer(io);

  io.use(async (socket, next) => {
    const token = readSessionCookie(socket.handshake.headers.cookie);
    const userId = userIdFromToken(token);
    if (!userId) {
      return next(new Error("unauthorized"));
    }
    const user = await prisma.user.findUnique({
      where: { id: userId, status: "ACTIVE" },
      select: { id: true, username: true, displayName: true, role: true },
    });
    if (!user) return next(new Error("unauthorized"));
    socket.data.userId = user.id;
    socket.data.username = user.username;
    socket.data.role = user.role;
    next();
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id} (user=${socket.data.username})`
    );

    socket.on("join_match", ({ matchId }: { matchId: string }) => {
      const room = `match:${matchId}`;
      socket.join(room);
      const count = io.sockets.adapter.rooms.get(room)?.size ?? 0;
      io.to(room).emit("viewer_count", { matchId, count });
      console.log(`Socket ${socket.id} joined ${room}`);
    });

    socket.on(
      "coding_lock",
      async ({
        matchId,
        strategy,
      }: {
        matchId: string;
        strategy: unknown;
        blocklyXml?: string;
      }) => {
        const userId = socket.data.userId as string | undefined;
        if (!userId || !matchId) return;

        const match = await prisma.match.findUnique({
          where: { id: matchId },
          select: {
            id: true,
            player1Id: true,
            player2Id: true,
            strategy1: true,
            strategy2: true,
            status: true,
          },
        });
        if (!match) {
          socket.emit("error_message", { reason: "match_not_found" });
          return;
        }

        const isP1 = match.player1Id === userId;
        const isP2 = match.player2Id === userId;
        if (!isP1 && !isP2) {
          socket.emit("error_message", { reason: "not_a_participant" });
          return;
        }

        const data = isP1
          ? { strategy1: strategy as object }
          : { strategy2: strategy as object };

        await prisma.match.update({
          where: { id: matchId },
          data: {
            ...data,
            status: match.status === "WAITING" ? "CODING" : match.status,
          },
        });

        io.to(`match:${matchId}`).emit("coding_locked", {
          playerId: userId,
          autoLocked: false,
        });

        const otherLocked = isP1 ? match.strategy2 != null : match.strategy1 != null;
        if (otherLocked) {
          await prisma.match.update({
            where: { id: matchId },
            data: { status: "BATTLING", startedAt: new Date() },
          });
          io.to(`match:${matchId}`).emit("match_started", { matchId });

          // Strategy on `match` is stale — it was fetched before this update —
          // so re-read both fields and run the turn loop.
          const fresh = await prisma.match.findUnique({
            where: { id: matchId },
            select: {
              player1Id: true,
              player2Id: true,
              strategy1: true,
              strategy2: true,
            },
          });
          if (fresh) {
            runMatch(matchId, fresh.player1Id, fresh.player2Id, fresh.strategy1, fresh.strategy2).catch(
              (err) => console.error(`Match ${matchId} simulation failed:`, err)
            );
          }
        }
      }
    );

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (!room.startsWith("match:")) continue;
        const matchId = room.slice("match:".length);
        const currentCount = io.sockets.adapter.rooms.get(room)?.size ?? 0;
        io.to(room).emit("viewer_count", { matchId, count: Math.max(currentCount - 1, 0) });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Ready on http://${hostname}:${port} (${dev ? "dev" : "prod"})`
    );
  });
});
