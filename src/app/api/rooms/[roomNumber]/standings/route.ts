import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ roomNumber: string }> };

// GET /api/rooms/:roomNumber/standings — public standings for players
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { roomNumber } = await params;

  const room = await prisma.room.findUnique({
    where: { roomNumber },
    select: {
      id: true,
      status: true,
      kind: true,
      rankingPublic: true,
    },
  });

  if (!room || room.status === "DELETED") {
    return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });
  }

  // Check access
  const isPrivileged =
    session.role === "SYSTEM_ADMIN" ||
    (session.role === "ROOM_ADMIN" &&
      !!(await prisma.room.findFirst({
        where: { id: room.id, admins: { some: { id: session.id } } },
      })));

  if (!isPrivileged) {
    if (room.rankingPublic === "DISABLED") {
      return NextResponse.json({ error: "このルームのランキングは非公開です" }, { status: 403 });
    }

    if (room.kind !== "PUBLIC_LOBBY" && room.rankingPublic !== "PUBLIC") {
      const membership = await prisma.roomMembership.findFirst({
        where: { userId: session.id, roomId: room.id, status: "ACTIVE" },
      });
      if (!membership) {
        return NextResponse.json({ error: "このルームへのアクセス権がありません" }, { status: 403 });
      }
    }
  }

  const matches = await prisma.match.findMany({
    where: { roomId: room.id, status: "FINISHED" },
    select: {
      player1Id: true,
      player2Id: true,
      winnerId: true,
    },
  });

  const statsMap = new Map<string, { wins: number; losses: number; draws: number; played: number }>();

  function ensurePlayer(pid: string) {
    if (!statsMap.has(pid)) statsMap.set(pid, { wins: 0, losses: 0, draws: 0, played: 0 });
    return statsMap.get(pid)!;
  }

  for (const m of matches) {
    if (!m.player1Id || !m.player2Id) continue;
    const s1 = ensurePlayer(m.player1Id);
    const s2 = ensurePlayer(m.player2Id);
    s1.played++;
    s2.played++;
    if (!m.winnerId) {
      s1.draws++;
      s2.draws++;
    } else if (m.winnerId === m.player1Id) {
      s1.wins++;
      s2.losses++;
    } else {
      s2.wins++;
      s1.losses++;
    }
  }

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
        points: s.wins * 3 + s.draws,
      };
    })
    .sort((a, b) => b.points - a.points || b.winRate - a.winRate || b.wins - a.wins)
    .map((s, i) => ({ rank: i + 1, ...s }));

  return NextResponse.json({ standings, total: standings.length });
}
