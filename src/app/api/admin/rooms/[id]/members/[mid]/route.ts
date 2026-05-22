import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MemberStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string; mid: string }> };

// PATCH /api/admin/rooms/:id/members/:mid
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id, mid } = await params;

  // ROOM_ADMIN can only manage their own rooms
  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const membership = await prisma.roomMembership.findFirst({
    where: { id: mid, roomId: id },
    include: { user: { select: { username: true, displayName: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "メンバーシップが見つかりません" }, { status: 404 });
  }

  const body = await req.json();
  const { status, expiresAt } = body as { status?: MemberStatus; expiresAt?: string | null };

  const updated = await prisma.roomMembership.update({
    where: { id: mid },
    data: {
      ...(status ? { status } : {}),
      ...(expiresAt !== undefined
        ? { expiresAt: expiresAt ? new Date(expiresAt) : null }
        : {}),
    },
  });

  const auditAction =
    status === "DISABLED"
      ? ("MEMBER_DISABLE" as const)
      : status === "ACTIVE"
      ? ("MEMBER_ISSUE" as const)
      : ("MEMBER_ISSUE" as const);

  await logAudit(
    auditAction,
    session.id,
    "RoomMembership",
    mid,
    `Member "${membership.user.displayName ?? membership.user.username}" updated in room`,
    { status, expiresAt },
    req,
    id
  );

  return NextResponse.json({ membership: updated });
}
