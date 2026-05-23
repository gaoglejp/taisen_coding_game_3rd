import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ReplayPlayerTurn = {
  hp?: number;
  damaged?: number;
  shoot_result?: "HIT" | "MISS" | null;
  action?: string;
};
type ReplayTurn = { turn?: number; p1?: ReplayPlayerTurn; p2?: ReplayPlayerTurn };
type ReplayData = { turns?: ReplayTurn[] } | null;

interface PlayerStats {
  finalHp: number;
  damageDealt: number;
  damageTaken: number;
  shoots: number;
  hits: number;
  hitRate: number;
  scans: number;
  moves: number;
}

function statsFor(
  player: "p1" | "p2",
  turns: ReplayTurn[]
): PlayerStats {
  const opponent: "p1" | "p2" = player === "p1" ? "p2" : "p1";
  let damageDealt = 0;
  let damageTaken = 0;
  let shoots = 0;
  let hits = 0;
  let scans = 0;
  let moves = 0;
  let finalHp = 100;

  for (const t of turns) {
    const me = t[player];
    const them = t[opponent];
    if (typeof me?.hp === "number") finalHp = me.hp;
    if (typeof me?.damaged === "number") damageTaken += me.damaged;
    if (typeof them?.damaged === "number") damageDealt += them.damaged;
    if (me?.action === "SHOOT_FORWARD") {
      shoots++;
      if (me.shoot_result === "HIT") hits++;
    } else if (me?.action === "SCAN") {
      scans++;
    } else if (me?.action === "MOVE_FORWARD") {
      moves++;
    }
  }

  return {
    finalHp,
    damageDealt,
    damageTaken,
    shoots,
    hits,
    hitRate: shoots > 0 ? Math.round((hits / shoots) * 100) : 0,
    scans,
    moves,
  };
}

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
      replayData: true,
      round: true,
      isPublicWatch: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
      room: { select: { id: true, name: true, roomNumber: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });

  if (match.status !== "FINISHED") {
    return NextResponse.json({ error: "まだ終了していません" }, { status: 400 });
  }

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

  const turns = ((match.replayData as ReplayData)?.turns ?? []) as ReplayTurn[];
  const p1Stats = statsFor("p1", turns);
  const p2Stats = statsFor("p2", turns);

  // First damage: first turn where either player took damage. Attribution goes
  // to whichever side dealt it (i.e. whoever didn't take damage that turn).
  let firstDamageTurn: number | null = null;
  let firstDamageBy: "p1" | "p2" | null = null;
  for (const t of turns) {
    if ((t.p1?.damaged ?? 0) > 0) {
      firstDamageTurn = t.turn ?? null;
      firstDamageBy = "p2";
      break;
    }
    if ((t.p2?.damaged ?? 0) > 0) {
      firstDamageTurn = t.turn ?? null;
      firstDamageBy = "p1";
      break;
    }
  }

  const hpTimeline: Array<[number, number]> = [[100, 100]];
  for (const t of turns) {
    hpTimeline.push([t.p1?.hp ?? 100, t.p2?.hp ?? 100]);
  }

  return NextResponse.json({
    matchId: match.id,
    matchNumber: match.matchNumber,
    status: match.status,
    endReason: match.endReason,
    winner,
    loser,
    winnerSide: match.winnerId === match.player1?.id ? "p1" : match.winnerId === match.player2?.id ? "p2" : null,
    isDraw: !match.winnerId,
    player1: match.player1,
    player2: match.player2,
    room: match.room,
    durationMs,
    startedAt: match.startedAt,
    endedAt: match.endedAt,
    round: match.round,
    stats: {
      totalTurns: turns.length,
      p1: p1Stats,
      p2: p2Stats,
      firstDamageTurn,
      firstDamageBy,
      hpTimeline,
    },
  });
}
