import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/me/matches?limit=5
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5", 10), 50);

  const matches = await prisma.match.findMany({
    where: {
      OR: [{ player1Id: session.id }, { player2Id: session.id }],
      status: "FINISHED",
    },
    orderBy: { endedAt: "desc" },
    take: limit,
    select: {
      id: true,
      matchNumber: true,
      status: true,
      endReason: true,
      winnerId: true,
      startedAt: true,
      endedAt: true,
      player1Id: true,
      player2Id: true,
      player1: {
        select: { id: true, username: true, displayName: true },
      },
      player2: {
        select: { id: true, username: true, displayName: true },
      },
      room: {
        select: { id: true, name: true, roomNumber: true },
      },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedMatches = (matches as any[]).map((m) => {
    const isP1 = m.player1Id === session.id;
    const opponent = isP1 ? m.player2 : m.player1;
    const result: "WIN" | "LOSE" | "DRAW" =
      m.winnerId === null
        ? "DRAW"
        : m.winnerId === session.id
        ? "WIN"
        : "LOSE";

    return {
      id: m.id,
      matchNumber: m.matchNumber,
      result,
      endReason: m.endReason,
      startedAt: m.startedAt,
      endedAt: m.endedAt,
      opponent: opponent
        ? {
            id: opponent.id,
            username: opponent.username,
            displayName: opponent.displayName,
          }
        : null,
      room: m.room,
    };
  });

  return NextResponse.json({ matches: formattedMatches });
}
