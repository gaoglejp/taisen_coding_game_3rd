import { Server as SocketIOServer } from "socket.io";

let io: SocketIOServer | undefined;

export function getSocketServer(): SocketIOServer | undefined {
  return io;
}

export function setSocketServer(server: SocketIOServer): void {
  io = server;
}

export function emitToMatch(
  matchId: string,
  event: string,
  data: unknown
): void {
  io?.to(`match:${matchId}`).emit(event, data);
}

export function emitCodingLocked(
  matchId: string,
  playerId: string,
  autoLocked: boolean
): void {
  io?.to(`match:${matchId}`).emit("coding_locked", { playerId, autoLocked });
}

export function emitMatchStarted(matchId: string): void {
  io?.to(`match:${matchId}`).emit("match_started", { matchId });
}

export function emitTurnEvent(matchId: string, turnData: unknown): void {
  io?.to(`match:${matchId}`).emit("turn_event", turnData);
}

export function emitMatchResult(matchId: string, result: unknown): void {
  io?.to(`match:${matchId}`).emit("match_result", result);
}
