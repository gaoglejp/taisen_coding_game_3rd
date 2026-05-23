import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { setSocketServer } from "./src/lib/socket-server";
import { prisma } from "./src/lib/db";

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
      socket.join(`match:${matchId}`);
      console.log(`Socket ${socket.id} joined match:${matchId}`);
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
        }
      }
    );

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
