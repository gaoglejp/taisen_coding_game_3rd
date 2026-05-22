import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/rooms/:id/archive
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.room.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  // Determine action from URL path
  const url = req.nextUrl.pathname;
  const isRestore = url.endsWith("/restore");

  const newStatus = isRestore ? "ACTIVE" : "ARCHIVED";
  const action = isRestore ? ("ROOM_RESTORE" as const) : ("ROOM_ARCHIVE" as const);
  const verb = isRestore ? "restored" : "archived";

  const room = await prisma.room.update({
    where: { id },
    data: { status: newStatus },
  });

  await logAudit(
    action,
    session.id,
    "Room",
    id,
    `Room "${room.name}" (${room.roomNumber}) ${verb}`,
    null,
    req,
    id
  );

  return NextResponse.json({ room });
}
