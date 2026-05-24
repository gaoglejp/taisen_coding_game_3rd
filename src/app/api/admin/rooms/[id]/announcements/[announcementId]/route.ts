import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; announcementId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id, announcementId } = await params;
  if (session.role === "ROOM_ADMIN") {
    const own = await prisma.room.findFirst({ where: { id, admins: { some: { id: session.id } } } });
    if (!own) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const existing = await prisma.announcement.findFirst({ where: { id: announcementId, roomId: id } });
  if (!existing) return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });

  const body = await req.json();
  const data: { pinned?: boolean; title?: string; body?: string } = {};
  if (typeof body?.pinned === "boolean") data.pinned = body.pinned;
  if (typeof body?.title === "string") data.title = body.title.trim();
  if (typeof body?.body === "string") data.body = body.body.trim();
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新内容がありません" }, { status: 400 });
  }
  if (("title" in data && !data.title) || ("body" in data && !data.body)) {
    return NextResponse.json({ error: "title / body は空文字にできません" }, { status: 400 });
  }
  const updated = await prisma.announcement.update({ where: { id: announcementId }, data });
  return NextResponse.json({ announcement: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role)) return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id, announcementId } = await params;
  if (session.role === "ROOM_ADMIN") {
    const own = await prisma.room.findFirst({ where: { id, admins: { some: { id: session.id } } } });
    if (!own) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const existing = await prisma.announcement.findFirst({ where: { id: announcementId, roomId: id } });
  if (!existing) return NextResponse.json({ error: "お知らせが見つかりません" }, { status: 404 });

  await prisma.announcement.delete({ where: { id: announcementId } });
  await logAudit("ROOM_UPDATE", session.id, "Room", id, `Deleted announcement ${announcementId}`, { announcementId }, req, id);
  return NextResponse.json({ ok: true });
}
