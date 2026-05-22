"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      path: "/api/socket",
      autoConnect: false,
    });
  }
  return socket;
}

export function connectSocket(matchId: string): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  s.emit("join_match", { matchId });
  return s;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = undefined;
}
