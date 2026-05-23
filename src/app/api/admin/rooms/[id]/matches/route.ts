import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MatchStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/rooms/:id/matches?status=&q=
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
  const status = searchParams.get("status") as MatchStatus | null;
  const q = searchParams.get("q") ?? "";

  const matches = await prisma.match.findMany({
    where: {
      roomId: id,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { player1: { username: { contains: q, mode: "insensitive" } } },
              { player1: { displayName: { contains: q, mode: "insensitive" } } },
              { player2: { username: { contains: q, mode: "insensitive" } } },
              { player2: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { matchNumber: "desc" },
  });

  return NextResponse.json({ room, matches });
}

// POST /api/admin/rooms/:id/matches
export async function POST(req: NextRequest, { params }: Params) {
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

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const body = await req.json();
  const { mode = "MANUAL" } = body as { mode?: string };

  // Helper: get next match number for this room
  async function nextMatchNumber(): Promise<number> {
    const last = await prisma.match.findFirst({
      where: { roomId: id },
      orderBy: { matchNumber: "desc" },
      select: { matchNumber: true },
    });
    return (last?.matchNumber ?? 0) + 1;
  }

  const createdMatches: Array<{ id: string; matchNumber: number }> = [];

  if (mode === "MANUAL") {
    const { player1Id, player2Id, startDeadline, isPublicWatch } = body as {
      player1Id?: string;
      player2Id?: string;
      startDeadline?: string;
      isPublicWatch?: boolean;
    };

    const matchNumber = await nextMatchNumber();
    const match = await prisma.match.create({
      data: {
        roomId: id,
        matchNumber,
        player1Id: player1Id ?? null,
        player2Id: player2Id ?? null,
        codingDeadlineAt: startDeadline ? new Date(startDeadline) : undefined,
        isPublicWatch: isPublicWatch ?? true,
      },
    });
    createdMatches.push({ id: match.id, matchNumber: match.matchNumber });
  } else if (mode === "RANDOM") {
    const { playerIds, count = 1, isPublicWatch } = body as {
      playerIds: string[];
      count?: number;
      isPublicWatch?: boolean;
    };

    if (!playerIds || playerIds.length < 2) {
      return NextResponse.json({ error: "playerIds は2名以上必要です" }, { status: 400 });
    }

    // Shuffle and pair randomly
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < Math.min(count, Math.floor(shuffled.length / 2)); i++) {
      pairs.push([shuffled[i * 2], shuffled[i * 2 + 1]]);
    }

    for (const [p1, p2] of pairs) {
      const matchNumber = await nextMatchNumber();
      const match = await prisma.match.create({
        data: {
          roomId: id,
          matchNumber,
          player1Id: p1,
          player2Id: p2,
          isPublicWatch: isPublicWatch ?? true,
        },
      });
      createdMatches.push({ id: match.id, matchNumber: match.matchNumber });
    }
  } else if (mode === "ROUND_ROBIN") {
    const { playerIds, isPublicWatch } = body as {
      playerIds: string[];
      isPublicWatch?: boolean;
    };

    if (!playerIds || playerIds.length < 2) {
      return NextResponse.json({ error: "playerIds は2名以上必要です" }, { status: 400 });
    }

    // Generate all pairings
    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const matchNumber = await nextMatchNumber();
        const match = await prisma.match.create({
          data: {
            roomId: id,
            matchNumber,
            player1Id: playerIds[i],
            player2Id: playerIds[j],
            isPublicWatch: isPublicWatch ?? true,
          },
        });
        createdMatches.push({ id: match.id, matchNumber: match.matchNumber });
      }
    }
  } else if (mode === "TOURNAMENT") {
    const { playerIds, seeds, isPublicWatch } = body as {
      playerIds: string[];
      seeds?: string[];
      isPublicWatch?: boolean;
    };

    if (!playerIds || playerIds.length < 2) {
      return NextResponse.json({ error: "playerIds は2名以上必要です" }, { status: 400 });
    }

    // Order by seeds if provided, else use original order
    const ordered =
      seeds && seeds.length === playerIds.length
        ? seeds
        : [...playerIds].sort(() => Math.random() - 0.5);

    // Create first-round bracket pairs
    const round = 1;
    for (let i = 0; i < Math.floor(ordered.length / 2); i++) {
      const matchNumber = await nextMatchNumber();
      const match = await prisma.match.create({
        data: {
          roomId: id,
          matchNumber,
          player1Id: ordered[i * 2],
          player2Id: ordered[i * 2 + 1],
          round,
          isPublicWatch: isPublicWatch ?? true,
        },
      });
      createdMatches.push({ id: match.id, matchNumber: match.matchNumber });
    }
  } else {
    return NextResponse.json({ error: "無効な mode です" }, { status: 400 });
  }

  await logAudit(
    "MATCH_CREATE",
    session.id,
    "Room",
    id,
    `Created ${createdMatches.length} match(es) in room "${room.name}" (mode: ${mode})`,
    { mode, count: createdMatches.length, matchIds: createdMatches.map((m) => m.id) },
    req,
    id
  );

  return NextResponse.json({ matches: createdMatches }, { status: 201 });
}
