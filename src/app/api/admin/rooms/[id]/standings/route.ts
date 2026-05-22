import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

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
      player1Id: true,
      player2Id: true,
      winnerId: true,
      endReason: true,
    },
  });

  // Aggregate stats per player
  const statsMap = new Map<
    string,
    { wins: number; losses: number; draws: number; played: number }
  >();

  function ensurePlayer(pid: string) {
    if (!statsMap.has(pid)) {
      statsMap.set(pid, { wins: 0, losses: 0, draws: 0, played: 0 });
    }
    return statsMap.get(pid)!;
  }

  for (const match of matches) {
    const p1 = match.player1Id;
    const p2 = match.player2Id;
    if (!p1 || !p2) continue;

    const s1 = ensurePlayer(p1);
    const s2 = ensurePlayer(p2);
    s1.played++;
    s2.played++;

    if (!match.winnerId) {
      s1.draws++;
      s2.draws++;
    } else if (match.winnerId === p1) {
      s1.wins++;
      s2.losses++;
    } else if (match.winnerId === p2) {
      s2.wins++;
      s1.losses++;
    }
  }

  // Fetch user info for all players
  const playerIds = Array.from(statsMap.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: playerIds } },
    select: { id: true, username: true, displayName: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const standings = playerIds
    .map((pid) => {
      const s = statsMap.get(pid)!;
      const user = userMap.get(pid);
      const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) / 100 : 0;
      return {
        userId: pid,
        username: user?.username ?? pid,
        displayName: user?.displayName ?? null,
        wins: s.wins,
        losses: s.losses,
        draws: s.draws,
        played: s.played,
        winRate,
        // Points: 3 per win, 1 per draw
        points: s.wins * 3 + s.draws,
      };
    })
    .sort((a, b) => b.points - a.points || b.winRate - a.winRate || b.wins - a.wins)
    .map((s, i) => ({ rank: i + 1, ...s }));

  return NextResponse.json({ standings, total: standings.length });
}
