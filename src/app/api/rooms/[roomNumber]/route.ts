import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ roomNumber: string }> };

// GET /api/rooms/:roomNumber — room info for players
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { roomNumber } = await params;

  const room = await prisma.room.findUnique({
    where: { roomNumber },
    select: {
      id: true,
      roomNumber: true,
      name: true,
      description: true,
      kind: true,
      status: true,
      expiresAt: true,
      watchingPublic: true,
      rankingPublic: true,
      replayShareEnabled: true,
      createdAt: true,
      _count: {
        select: {
          memberships: { where: { status: "ACTIVE" } },
          matches: true,
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });
  if (room.status === "DELETED") return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  // Check if user has access to this room
  const isSystemAdmin = session.role === "SYSTEM_ADMIN";
  const isRoomAdmin =
    session.role === "ROOM_ADMIN" &&
    !!(await prisma.room.findFirst({
      where: { id: room.id, admins: { some: { id: session.id } } },
    }));

  if (!isSystemAdmin && !isRoomAdmin) {
    // General users and ROOM_USERs: check membership or PUBLIC_LOBBY
    if (room.kind !== "PUBLIC_LOBBY") {
      const membership = await prisma.roomMembership.findFirst({
        where: { userId: session.id, roomId: room.id, status: "ACTIVE" },
      });
      if (!membership) {
        return NextResponse.json({ error: "このルームへのアクセス権がありません" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({
    room: {
      ...room,
      activeMemberCount: room._count.memberships,
      totalMatches: room._count.matches,
      _count: undefined,
    },
  });
}
