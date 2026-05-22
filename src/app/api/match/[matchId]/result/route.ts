import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ matchId: string }> };

// GET /api/match/:matchId/result
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { matchId } = await params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchNumber: true,
      roomId: true,
      status: true,
      endReason: true,
      winnerId: true,
      round: true,
      isPublicWatch: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });

  if (match.status !== "FINISHED") {
    return NextResponse.json({ error: "まだ終了していません" }, { status: 400 });
  }

  // Determine winner/loser
  const winner =
    match.winnerId === match.player1?.id
      ? match.player1
      : match.winnerId === match.player2?.id
      ? match.player2
      : null;

  const loser =
    match.winnerId === match.player1?.id
      ? match.player2
      : match.winnerId === match.player2?.id
      ? match.player1
      : null;

  const durationMs =
    match.startedAt && match.endedAt
      ? match.endedAt.getTime() - match.startedAt.getTime()
      : null;

  return NextResponse.json({
    matchId: match.id,
    matchNumber: match.matchNumber,
    status: match.status,
    endReason: match.endReason,
    winner,
    loser,
    isDraw: !match.winnerId,
    player1: match.player1,
    player2: match.player2,
    durationMs,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    round: match.round,
  });
}
