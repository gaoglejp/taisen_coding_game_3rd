import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

type ReplayPlayerTurn = { hp?: number; damaged?: number };
type ReplayTurn = { p1?: ReplayPlayerTurn; p2?: ReplayPlayerTurn };
type ReplayData = { turns?: ReplayTurn[] } | null;

// GET /api/admin/rooms/:id/standings?from=&to=
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, name: true, roomNumber: true },
  });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter =
    from || to
      ? {
          ...(from ? { endedAt: { gte: new Date(from) } } : {}),
          ...(to ? { endedAt: { lte: new Date(to) } } : {}),
        }
      : {};

  const matches = await prisma.match.findMany({
    where: {
      roomId: id,
      status: "FINISHED",
      ...dateFilter,
    },
    select: {
      matchNumber: true,
      player1Id: true,
      player2Id: true,
      winnerId: true,
      endReason: true,
      replayData: true,
    },
    orderBy: { matchNumber: "desc" },
  });

  interface PlayerAgg {
    wins: number;
    losses: number;
    draws: number;
    played: number;
    damageDealt: number;
    damageTaken: number;
    turns: number;
    history: {
      matchNumber: number;
      opponentId: string | null;
      result: "W" | "L" | "D";
      endReason: string | null;
      turns: number;
    }[];
  }

  const statsMap = new Map<string, PlayerAgg>();
  function ensurePlayer(pid: string): PlayerAgg {
    let agg = statsMap.get(pid);
    if (!agg) {
      agg = { wins: 0, losses: 0, draws: 0, played: 0, damageDealt: 0, damageTaken: 0, turns: 0, history: [] };
      statsMap.set(pid, agg);
    }
    return agg;
  }

  // Per-turn `damaged` is damage *taken* that turn, so a player's damage dealt
  // equals the opponent's `damaged` summed over the match.
  const sumDamaged = (turns: ReplayTurn[], who: "p1" | "p2") =>
    turns.reduce((acc, t) => acc + (t[who]?.damaged ?? 0), 0);

  // Room-level end-reason breakdown for the donut.
  const endReasonCounts: Record<string, number> = {};
  let totalTurns = 0;
  // First-damage → win correlation across decisive matches.
  let firstDamageDecisive = 0;
  let firstDamageWins = 0;

  for (const match of matches) {
    const p1 = match.player1Id;
    const p2 = match.player2Id;
    if (!p1 || !p2) continue;

    const turns = ((match.replayData as ReplayData)?.turns ?? []) as ReplayTurn[];
    const turnCount = turns.length;
    const p1Taken = sumDamaged(turns, "p1");
    const p2Taken = sumDamaged(turns, "p2");

    totalTurns += turnCount;
    if (match.endReason) endReasonCounts[match.endReason] = (endReasonCounts[match.endReason] ?? 0) + 1;

    const s1 = ensurePlayer(p1);
    const s2 = ensurePlayer(p2);
    s1.played++;
    s2.played++;
    s1.turns += turnCount;
    s2.turns += turnCount;
    // p1 deals what p2 took, and vice versa.
    s1.damageDealt += p2Taken;
    s1.damageTaken += p1Taken;
    s2.damageDealt += p1Taken;
    s2.damageTaken += p2Taken;

    let r1: "W" | "L" | "D";
    let r2: "W" | "L" | "D";
    if (!match.winnerId) {
      s1.draws++;
      s2.draws++;
      r1 = r2 = "D";
    } else if (match.winnerId === p1) {
      s1.wins++;
      s2.losses++;
      r1 = "W";
      r2 = "L";
    } else {
      s2.wins++;
      s1.losses++;
      r1 = "L";
      r2 = "W";
    }

    s1.history.push({ matchNumber: match.matchNumber, opponentId: p2, result: r1, endReason: match.endReason, turns: turnCount });
    s2.history.push({ matchNumber: match.matchNumber, opponentId: p1, result: r2, endReason: match.endReason, turns: turnCount });

    // Who landed the first hit? (first turn where a player took damage)
    if (match.winnerId) {
      const firstHitTurn = turns.find((t) => (t.p1?.damaged ?? 0) > 0 || (t.p2?.damaged ?? 0) > 0);
      if (firstHitTurn) {
        // The dealer is the side whose opponent took damage this turn.
        const dealer = (firstHitTurn.p2?.damaged ?? 0) > 0 ? p1 : p2;
        firstDamageDecisive++;
        if (dealer === match.winnerId) firstDamageWins++;
      }
    }
  }

  const playerIds = Array.from(statsMap.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, username: true, displayName: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));
  const nameOf = (pid: string | null) =>
    pid ? userMap.get(pid)?.displayName ?? userMap.get(pid)?.username ?? pid : "—";

  const round1 = (n: number) => Math.round(n * 10) / 10;

  const standings = playerIds
    .map((pid) => {
      const s = statsMap.get(pid)!;
      const user = userMap.get(pid);
      const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) / 100 : 0;
      const recentSorted = [...s.history].sort((a, b) => b.matchNumber - a.matchNumber);
      return {
        userId: pid,
        username: user?.username ?? pid,
        displayName: user?.displayName ?? null,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        played: s.played,
        winRate,
        points: s.wins * 3 + s.draws,
        avgDamageDealt: s.played > 0 ? round1(s.damageDealt / s.played) : 0,
        avgDamageTaken: s.played > 0 ? round1(s.damageTaken / s.played) : 0,
        avgTurns: s.played > 0 ? Math.round(s.turns / s.played) : 0,
        recent: recentSorted.slice(0, 5).map((h) => h.result),
        recentMatches: recentSorted.slice(0, 8).map((h) => ({
          matchNumber: h.matchNumber,
          opponentName: nameOf(h.opponentId),
          result: h.result,
          endReason: h.endReason,
          turns: h.turns,
        })),
      };
    })
    .sort((a, b) => b.points - a.points || b.winRate - a.winRate || b.wins - a.wins)
    .map((s, i) => ({ rank: i + 1, ...s }));

  const totalMatches = matches.length;
  const avgWinRate =
    standings.length > 0
      ? round1((standings.reduce((acc, s) => acc + s.winRate, 0) / standings.length) * 100)
      : 0;

  const summary = {
    totalMatches,
    avgTurns: totalMatches > 0 ? round1(totalTurns / totalMatches) : 0,
    avgWinRate,
    firstDamageWinRate: firstDamageDecisive > 0 ? round1((firstDamageWins / firstDamageDecisive) * 100) : 0,
    endReasonCounts,
  };

  return NextResponse.json({ room, standings, total: standings.length, summary });
}
