import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/rooms/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      admins: {
        select: { id: true, username: true, displayName: true, email: true, role: true },
      },
      _count: {
        select: {
          memberships: true,
          matches: true,
        },
      },
    },
  });

  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  return NextResponse.json({ room });
}

// PATCH /api/admin/rooms/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const body = await req.json();
  const {
    name,
    description,
    kind,
    expiresAt,
    rulePreset,
    watchingPublic,
    rankingPublic,
    replayShareEnabled,
  } = body as Record<string, unknown>;

  const room = await prisma.room.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name: name as string } : {}),
      ...(description !== undefined ? { description: description as string | null } : {}),
      ...(kind !== undefined ? { kind: kind as import("@prisma/client").RoomKind } : {}),
      ...(expiresAt !== undefined
        ? { expiresAt: expiresAt ? new Date(expiresAt as string) : null }
        : {}),
      ...(rulePreset !== undefined && rulePreset !== null ? { rulePreset: rulePreset as unknown as object } : {}),
      ...(watchingPublic !== undefined ? { watchingPublic: watchingPublic as string } : {}),
      ...(rankingPublic !== undefined ? { rankingPublic: rankingPublic as string } : {}),
      ...(replayShareEnabled !== undefined
        ? { replayShareEnabled: replayShareEnabled as boolean }
        : {}),
    },
  });

  await logAudit(
    "ROOM_UPDATE",
    session.id,
    "Room",
    id,
    `Room "${room.name}" updated`,
    { changes: body },
    req,
    id
  );

  return NextResponse.json({ room });
}

// DELETE /api/admin/rooms/:id — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const room = await prisma.room.update({
    where: { id },
    data: { status: "DELETED" },
  });

  await logAudit(
    "ROOM_DELETE",
    session.id,
    "Room",
    id,
    `Room "${room.name}" (${room.roomNumber}) deleted`,
    null,
    req,
    id
  );

  return NextResponse.json({ ok: true });
}
