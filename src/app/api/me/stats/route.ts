import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ReplayPlayerTurn = { damaged?: number };
type ReplayTurn = { p1?: ReplayPlayerTurn; p2?: ReplayPlayerTurn };
type ReplayData = { turns?: ReplayTurn[] } | null;

interface FinishedMatch {
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  replayData: ReplayData;
  endedAt: Date | null;
}

interface PerMatchStats {
  result: "WIN" | "LOSE" | "DRAW";
  turns: number;
  damageDealt: number;
  damageTaken: number;
  firstDamageBy: "self" | "opponent" | null;
}

function summarize(match: FinishedMatch, userId: string): PerMatchStats {
  const isP1 = match.player1Id === userId;
  const result: PerMatchStats["result"] =
    match.winnerId === null ? "DRAW" : match.winnerId === userId ? "WIN" : "LOSE";

  const turns = match.replayData?.turns ?? [];
  let damageDealt = 0;
  let damageTaken = 0;
  let firstDamageBy: PerMatchStats["firstDamageBy"] = null;

  for (const t of turns) {
    const selfDamaged = (isP1 ? t.p1?.damaged : t.p2?.damaged) ?? 0;
    const oppDamaged = (isP1 ? t.p2?.damaged : t.p1?.damaged) ?? 0;
    damageTaken += selfDamaged;
    damageDealt += oppDamaged;
    if (firstDamageBy === null) {
      if (oppDamaged > 0) firstDamageBy = "self";
      else if (selfDamaged > 0) firstDamageBy = "opponent";
    }
  }

  return { result, turns: turns.length, damageDealt, damageTaken, firstDamageBy };
}

// GET /api/me/stats
// Aggregates the authenticated user's match history into the shape the
// dashboard expects. Damage and turn counts are read from `Match.replayData`,
// which the server-side simulator writes when a match finishes.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  }

  const matches = (await prisma.match.findMany({
    where: {
      OR: [{ player1Id: session.id }, { player2Id: session.id }],
      status: "FINISHED",
    },
    orderBy: { endedAt: "asc" },
    select: {
      player1Id: true,
      player2Id: true,
      winnerId: true,
      replayData: true,
      endedAt: true,
    },
  })) as FinishedMatch[];

  const summaries = matches.map((m) => summarize(m, session.id));
  const wins = summaries.filter((s) => s.result === "WIN").length;
  const losses = summaries.filter((s) => s.result === "LOSE").length;
  const draws = summaries.filter((s) => s.result === "DRAW").length;
  const total = summaries.length;

  const matchesWithTurns = summaries.filter((s) => s.turns > 0);
  const avgTurns = matchesWithTurns.length
    ? matchesWithTurns.reduce((a, s) => a + s.turns, 0) / matchesWithTurns.length
    : 0;
  const avgDamageDealt = total
    ? Math.round(summaries.reduce((a, s) => a + s.damageDealt, 0) / total)
    : 0;
  const avgDamageTaken = total
    ? Math.round(summaries.reduce((a, s) => a + s.damageTaken, 0) / total)
    : 0;
  const decidedFirstDamage = summaries.filter((s) => s.firstDamageBy !== null);
  const firstDamageRate = decidedFirstDamage.length
    ? Math.round(
        (decidedFirstDamage.filter((s) => s.firstDamageBy === "self").length /
          decidedFirstDamage.length) *
          100
      )
    : 0;

  // Sparkline: cumulative win rate over the last 12 matches in chronological
  // order. Older matches before the window are folded into the baseline so
  // index 0 isn't always 0% or 100% after a single match.
  const windowSize = 12;
  const windowStart = Math.max(0, summaries.length - windowSize);
  const baseWins = summaries.slice(0, windowStart).filter((s) => s.result === "WIN").length;
  const baseTotal = windowStart;
  const sparkline: number[] = [];
  let runningWins = baseWins;
  let runningTotal = baseTotal;
  for (const s of summaries.slice(windowStart)) {
    if (s.result === "WIN") runningWins++;
    runningTotal++;
    sparkline.push(runningTotal ? Math.round((runningWins / runningTotal) * 100) : 0);
  }

  return NextResponse.json({
    stats: {
      wins,
      losses,
      draws,
      total,
      winRate: total ? Math.round((wins / total) * 100) : 0,
      avgTurns: Math.round(avgTurns * 10) / 10,
      avgDamageDealt,
      avgDamageTaken,
      firstDamageRate,
      sparkline,
    },
  });
}
