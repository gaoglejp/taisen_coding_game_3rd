import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ matchId: string }> };

// GET /api/match/:matchId/replay
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
      replayData: true,
      isPublicWatch: true,
      codingDeadlineAt: true,
      startedAt: true,
      endedAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
      room: { select: { replayShareEnabled: true, rankingPublic: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });

  if (match.status !== "FINISHED") {
    return NextResponse.json({ error: "まだ終了していないマッチのリプレイは利用できません" }, { status: 400 });
  }

  if (!match.room.replayShareEnabled) {
    const isParticipant =
      match.player1?.id === session.id || match.player2?.id === session.id;
    if (!isParticipant && session.role !== "SYSTEM_ADMIN") {
      const isAdmin = await prisma.room.findFirst({
        where: { id: match.roomId, admins: { some: { id: session.id } } },
      });
      if (!isAdmin) {
        return NextResponse.json({ error: "リプレイの共有が無効です" }, { status: 403 });
      }
    }
  }

  return NextResponse.json({
    matchId: match.id,
    matchNumber: match.matchNumber,
    player1: match.player1,
    player2: match.player2,
    winnerId: match.winnerId,
    endReason: match.endReason,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    replayData: match.replayData,
  });
}
