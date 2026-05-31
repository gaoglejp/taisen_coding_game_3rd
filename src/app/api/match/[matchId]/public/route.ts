import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ matchId: string }> };

// GET /api/match/:matchId/public — public visibility info (no auth required)
export async function GET(_req: NextRequest, { params }: Params) {
  const { matchId } = await params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchNumber: true,
      roomId: true,
      status: true,
      isPublicWatch: true,
      round: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
      room: {
        select: {
          watchingPublic: true,
          rankingPublic: true,
          replayShareEnabled: true,
          rulePreset: true,
          name: true,
          roomNumber: true,
        },
      },
    },
  });

  if (!match) return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });

  return NextResponse.json({
    matchId: match.id,
    matchNumber: match.matchNumber,
    status: match.status,
    isPublicWatch: match.isPublicWatch,
    round: match.round,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    createdAt: match.createdAt,
    player1: match.player1,
    player2: match.player2,
    room: {
      name: match.room.name,
      roomNumber: match.room.roomNumber,
      watchingPublic: match.room.watchingPublic,
      replayShareEnabled: match.room.replayShareEnabled,
      rulePreset: match.room.rulePreset,
    },
  });
}
