import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
      select: { id: true },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const room = await prisma.room.findUnique({
    where: { id },
    select: { id: true, name: true, roomNumber: true },
  });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const take = Number.isFinite(limitParam)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(limitParam)))
    : DEFAULT_LIMIT;

  const activities = await prisma.auditLog.findMany({
    where: { targetRoomId: id },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      summary: true,
      actorId: true,
      targetType: true,
      targetId: true,
      createdAt: true,
    },
  });

  const actorIds = Array.from(new Set(activities.map((a) => a.actorId).filter((v): v is string => Boolean(v))));
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, username: true, displayName: true },
        })
      : [];
  const actorMap = new Map(actors.map((u) => [u.id, u.displayName ?? u.username]));

  return NextResponse.json({
    activities: activities.map((a) => ({
      id: a.id,
      action: a.action,
      summary: a.summary,
      actorName: a.actorId ? (actorMap.get(a.actorId) ?? "不明ユーザー") : "システム",
      targetType: a.targetType,
      targetId: a.targetId,
      createdAt: a.createdAt,
    })),
  });
}
