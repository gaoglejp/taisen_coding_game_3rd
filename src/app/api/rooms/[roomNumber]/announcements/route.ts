import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ roomNumber: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  const { roomNumber } = await params;

  const room = await prisma.room.findUnique({ where: { roomNumber }, select: { id: true, kind: true, status: true } });
  if (!room || room.status === "DELETED") return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const isSystemAdmin = session.role === "SYSTEM_ADMIN";
  const isRoomAdmin = session.role === "ROOM_ADMIN" && !!(await prisma.room.findFirst({ where: { id: room.id, admins: { some: { id: session.id } } } }));
  if (!isSystemAdmin && !isRoomAdmin && room.kind !== "PUBLIC_LOBBY") {
    const membership = await prisma.roomMembership.findFirst({ where: { userId: session.id, roomId: room.id, status: "ACTIVE" } });
    if (!membership) return NextResponse.json({ error: "このルームへのアクセス権がありません" }, { status: 403 });
  }

  const announcements = await prisma.announcement.findMany({ where: { roomId: room.id }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  const authorIds = [...new Set(announcements.map((a) => a.authorId).filter((v): v is string => !!v))];
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, displayName: true, username: true } }) : [];
  const authorMap = new Map(authors.map((u) => [u.id, u.displayName ?? u.username]));

  return NextResponse.json({ announcements: announcements.map((a) => ({ ...a, authorName: a.authorId ? authorMap.get(a.authorId) ?? "不明" : "システム" })) });
}
