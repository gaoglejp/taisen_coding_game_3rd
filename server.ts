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
// How long the server will wait for both players' `battle_ready` before
// starting the match anyway. Protects against a disconnect / stuck client
// keeping the other player frozen at "starting…" forever.
const BATTLE_READY_TIMEOUT_MS = 20000;

interface PendingBattle {
  p1Id: string | null;
  p2Id: string | null;
  strategy1: unknown;
  strategy2: unknown;
  rulePreset: unknown;
  ready: Set<string>;
  timeout: NodeJS.Timeout;
  started: boolean;
}

// matchId → pending battle waiting for both players' battle_ready signal.
// Cleared once the simulation kicks off (or the timeout fires).
const pendingBattles = new Map<string, PendingBattle>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMaxTurns(rulePreset: unknown): number | undefined {
  if (!rulePreset || typeof rulePreset !== "object" || Array.isArray(rulePreset)) return undefined;
  const maxTurns = (rulePreset as { maxTurns?: unknown }).maxTurns;
  if (typeof maxTurns === "number" && Number.isFinite(maxTurns)) return maxTurns;
  return undefined;
}

async function runMatch(
  matchId: string,
  player1Id: string | null,
  player2Id: string | null,
  strategy1: unknown,
  strategy2: unknown,
  rulePreset?: unknown
): Promise<void> {
  const maxTurns = resolveMaxTurns(rulePreset);
  const result =
    maxTurns === undefined
      ? simulate(strategy1 as Strategy, strategy2 as Strategy)
      : simulate(strategy1 as Strategy, strategy2 as Strategy, { maxTurns });

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
    // Anonymous sockets are allowed so public spectating (`/watch`) works
    // without a login — they get viewer_count / turn_event but no identity.
    // Write actions (coding_lock) still require socket.data.userId below.
    const token = readSessionCookie(socket.handshake.headers.cookie);
    const userId = userIdFromToken(token);
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId, status: "ACTIVE" },
        select: { id: true, username: true, displayName: true, role: true },
      });
      if (user) {
        socket.data.userId = user.id;
        socket.data.username = user.username;
        socket.data.role = user.role;
      }
    }
    next();
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected: ${socket.id} (user=${socket.data.username ?? "anonymous"})`
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
          // so re-read both fields and stage the pending battle. The actual
          // turn loop kicks off in the `battle_ready` handshake below once both
          // participants have signalled that their battle page is ready.
          const fresh = await prisma.match.findUnique({
            where: { id: matchId },
            select: {
              player1Id: true,
              player2Id: true,
              strategy1: true,
              strategy2: true,
              room: { select: { rulePreset: true } },
            },
          });
          if (fresh) {
            const pending: PendingBattle = {
              p1Id: fresh.player1Id,
              p2Id: fresh.player2Id,
              strategy1: fresh.strategy1,
              strategy2: fresh.strategy2,
              rulePreset: fresh.room?.rulePreset,
              ready: new Set(),
              started: false,
              timeout: setTimeout(() => {
                const stale = pendingBattles.get(matchId);
                if (!stale || stale.started) return;
                stale.started = true;
                pendingBattles.delete(matchId);
                runMatch(
                  matchId,
                  stale.p1Id,
                  stale.p2Id,
                  stale.strategy1,
                  stale.strategy2,
                  stale.rulePreset
                ).catch((err) =>
                  console.error(`Match ${matchId} simulation failed:`, err)
                );
              }, BATTLE_READY_TIMEOUT_MS),
            };
            pendingBattles.set(matchId, pending);
          }
        }
      }
    );

    // Battle page handshake. Both participants signal `battle_ready` once
    // their replay UI has mounted; only then does the server start emitting
    // turn_events. Prevents the "pieces already moving" race where the slower
    // client misses early turns. Spectators do nothing here.
    socket.on("battle_ready", ({ matchId }: { matchId: string }) => {
      const userId = socket.data.userId as string | undefined;
      if (!userId || !matchId) return;
      const pending = pendingBattles.get(matchId);
      if (!pending || pending.started) return;
      const isParticipant = userId === pending.p1Id || userId === pending.p2Id;
      if (!isParticipant) return;
      pending.ready.add(userId);
      const bothReady =
        (!pending.p1Id || pending.ready.has(pending.p1Id)) &&
        (!pending.p2Id || pending.ready.has(pending.p2Id));
      if (!bothReady) return;
      pending.started = true;
      clearTimeout(pending.timeout);
      pendingBattles.delete(matchId);
      runMatch(
        matchId,
        pending.p1Id,
        pending.p2Id,
        pending.strategy1,
        pending.strategy2,
        pending.rulePreset
      ).catch((err) =>
        console.error(`Match ${matchId} simulation failed:`, err)
      );
    });

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
