"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socket",
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(matchId: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
    s.once("connect", () => {
      s.emit("join_match", { matchId });
    });
  } else {
    s.emit("join_match", { matchId });
  }
  return s;
}

export function lockCoding(
  matchId: string,
  strategy: unknown,
  blocklyXml?: string
): void {
  const s = getSocket();
  s.emit("coding_lock", { matchId, strategy, blocklyXml });
}

// Signal to the server that the local battle page has finished mounting and
// is ready to receive turn_event payloads. The server waits for both
// participants' battle_ready before kicking off the turn loop — see
// server.ts pendingBattles for the handshake.
export function emitBattleReady(matchId: string): void {
  const s = getSocket();
  if (s.connected) {
    s.emit("battle_ready", { matchId });
  } else {
    s.once("connect", () => s.emit("battle_ready", { matchId }));
  }
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = undefined;
}
