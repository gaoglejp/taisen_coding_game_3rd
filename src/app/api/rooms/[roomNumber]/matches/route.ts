import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ roomNumber: string }> };

// GET /api/rooms/:roomNumber/matches — open/live matches for players
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { roomNumber } = await params;

  const room = await prisma.room.findUnique({
    where: { roomNumber },
    select: {
      id: true,
      status: true,
      kind: true,
      watchingPublic: true,
    },
  });

  if (!room || room.status === "DELETED") {
    return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });
  }

  // Check access
  const isPrivileged =
    session.role === "SYSTEM_ADMIN" ||
    (session.role === "ROOM_ADMIN" &&
      !!(await prisma.room.findFirst({
        where: { id: room.id, admins: { some: { id: session.id } } },
      })));

  if (!isPrivileged && room.kind !== "PUBLIC_LOBBY") {
    const membership = await prisma.roomMembership.findFirst({
      where: { userId: session.id, roomId: room.id, status: "ACTIVE" },
    });
    if (!membership) {
      return NextResponse.json({ error: "このルームへのアクセス権がありません" }, { status: 403 });
    }
  }

  // Return open/live matches (WAITING, CODING, BATTLING)
  const matches = await prisma.match.findMany({
    where: {
      roomId: room.id,
      status: { in: ["WAITING", "CODING", "BATTLING"] },
      ...(room.watchingPublic === "MEMBERS_ONLY" && !isPrivileged
        ? { isPublicWatch: true }
        : {}),
    },
    orderBy: { matchNumber: "asc" },
    select: {
      id: true,
      matchNumber: true,
      status: true,
      round: true,
      isPublicWatch: true,
      codingDeadlineAt: true,
      startedAt: true,
      createdAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
    },
  });

  return NextResponse.json({ matches });
}
