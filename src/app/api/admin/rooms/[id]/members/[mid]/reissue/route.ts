import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; mid: string }> };

function generateIssueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// POST /api/admin/rooms/:id/members/:mid/reissue
export async function POST(req: NextRequest, { params }: Params) {
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

  const newIssueCode = generateIssueCode();

  await prisma.roomMembership.update({
    where: { id: mid },
    data: {
      issueCode: newIssueCode,
      issueCodeUsed: false,
    },
  });

  // Reset the linked user back to PENDING so they must re-activate
  await prisma.user.update({
    where: { id: membership.userId },
    data: { status: "PENDING" },
  });

  await logAudit(
    "MEMBER_REISSUE",
    session.id,
    "RoomMembership",
    mid,
    `Reissued code for member "${membership.user.displayName ?? membership.user.username}"`,
    { membershipId: mid },
    req,
    id
  );

  return NextResponse.json({ issueCode: newIssueCode });
}
