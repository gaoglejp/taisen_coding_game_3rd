import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

async function assertRoomAdmin(roomId: string, userId: string): Promise<boolean> {
  const room = await prisma.room.findFirst({ where: { id: roomId, admins: { some: { id: userId } } } });
  return !!room;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  if (session.role === "ROOM_ADMIN" && !(await assertRoomAdmin(id, session.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const room = await prisma.room.findUnique({ where: { id }, select: { id: true, name: true, roomNumber: true } });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const announcements = await prisma.announcement.findMany({ where: { roomId: id }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  const authorIds = [...new Set(announcements.map((a) => a.authorId).filter((v): v is string => !!v))];
  const authors = authorIds.length ? await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, displayName: true, username: true } }) : [];
  const authorMap = new Map(authors.map((u) => [u.id, u.displayName ?? u.username]));

  return NextResponse.json({ room, announcements: announcements.map((a) => ({ ...a, authorName: a.authorId ? authorMap.get(a.authorId) ?? "不明" : "システム" })) });
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;
  if (session.role === "ROOM_ADMIN" && !(await assertRoomAdmin(id, session.id))) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const body = await req.json();
  const title = String(body?.title ?? "").trim();
  const content = String(body?.body ?? "").trim();
  if (!title || !content) return NextResponse.json({ error: "title と body は必須です" }, { status: 400 });

  const created = await prisma.announcement.create({ data: { roomId: id, title, body: content, pinned: !!body?.pinned, authorId: session.id } });
  await logAudit("ROOM_UPDATE", session.id, "Room", id, `Created announcement in room \"${room.name}\"`, { announcementId: created.id }, req, id);

  return NextResponse.json({ announcement: { ...created, authorName: session.displayName ?? session.username } }, { status: 201 });
}
