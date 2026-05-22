import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { RoomKind, RoomStatus } from "@prisma/client";

// GET /api/admin/rooms?kind=&status=&q=&page=1&limit=20
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const kind = searchParams.get("kind") as RoomKind | null;
  const status = searchParams.get("status") as RoomStatus | null;
  const q = searchParams.get("q") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(kind ? { kind } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { roomNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        roomNumber: true,
        name: true,
        description: true,
        kind: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            admins: true,
            memberships: true,
            matches: { where: { status: { in: ["WAITING", "CODING", "BATTLING"] } } },
          },
        },
      },
    }),
  ]);

  const formatted = rooms.map((r) => ({
    ...r,
    adminCount: r._count.admins,
    memberCount: r._count.memberships,
    activeMatchCount: r._count.matches,
    _count: undefined,
  }));

  return NextResponse.json({
    rooms: formatted,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

// POST /api/admin/rooms
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const body = await req.json();
  const { name, kind, expiresAt, initialAdminId, rulePreset } = body as {
    name?: string;
    kind?: RoomKind;
    expiresAt?: string;
    initialAdminId?: string;
    rulePreset?: Record<string, unknown>;
  };

  if (!name || !kind) {
    return NextResponse.json({ error: "name と kind は必須です" }, { status: 400 });
  }

  const validKinds: RoomKind[] = ["CLASSROOM", "TOURNAMENT", "PUBLIC_LOBBY"];
  if (!validKinds.includes(kind)) {
    return NextResponse.json({ error: "無効な kind です" }, { status: 400 });
  }

  // Generate sequential room number: ROOM-YYYY-NNNN
  const year = new Date().getFullYear();
  const prefix = `ROOM-${year}-`;
  const lastRoom = await prisma.room.findFirst({
    where: { roomNumber: { startsWith: prefix } },
    orderBy: { roomNumber: "desc" },
    select: { roomNumber: true },
  });

  let seq = 1;
  if (lastRoom) {
    const parts = lastRoom.roomNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  const roomNumber = `${prefix}${String(seq).padStart(4, "0")}`;

  const room = await prisma.room.create({
    data: {
      roomNumber,
      name,
      kind,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      rulePreset: (rulePreset ?? {}) as unknown as object,
      ...(initialAdminId
        ? { admins: { connect: { id: initialAdminId } } }
        : {}),
    },
  });

  await logAudit(
    "ROOM_CREATE",
    session.id,
    "Room",
    room.id,
    `Room "${name}" (${roomNumber}) created`,
    { kind, initialAdminId },
    req,
    room.id
  );

  return NextResponse.json({ room }, { status: 201 });
}
