import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/rooms/visible
// ROOM_USER  → their active memberships
// GENERAL_USER / unauthenticated → PUBLIC_LOBBY rooms with status=ACTIVE
export async function GET() {
  const session = await getSession();

  if (session && session.role === "ROOM_USER") {
    // Return rooms the user is a member of
    const memberships = await prisma.roomMembership.findMany({
      where: { userId: session.id, status: "ACTIVE" },
      select: {
        id: true,
        createdAt: true,
        room: {
          select: {
            id: true,
            name: true,
            roomNumber: true,
            kind: true,
            status: true,
            description: true,
            expiresAt: true,
            createdAt: true,
            _count: { select: { matches: true } },
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rooms = (memberships as any[]).map((m) => ({
      ...m.room,
      matchCount: m.room._count.matches,
      membershipId: m.id,
      memberSince: m.createdAt,
    }));

    return NextResponse.json({ rooms });
  }

  // GENERAL_USER or unauthenticated: show PUBLIC_LOBBY rooms
  const publicRooms = await prisma.room.findMany({
    where: { kind: "PUBLIC_LOBBY", status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      roomNumber: true,
      kind: true,
      status: true,
      description: true,
      expiresAt: true,
      createdAt: true,
      _count: { select: { matches: true } },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rooms = (publicRooms as any[]).map((r) => ({
    ...r,
    matchCount: r._count.matches,
  }));

  return NextResponse.json({ rooms });
}
