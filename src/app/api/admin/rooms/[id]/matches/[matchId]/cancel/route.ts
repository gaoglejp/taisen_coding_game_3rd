import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { MatchEndReason } from "@prisma/client";

type Params = { params: Promise<{ id: string; matchId: string }> };

const VALID_REASONS: MatchEndReason[] = ["NO_SHOW", "CANCELED", "DISCONNECT", "LEAVE"];

// POST /api/admin/rooms/:id/matches/:matchId/cancel
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id, matchId } = await params;

  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match || match.roomId !== id) {
    return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });
  }
  if (match.status === "FINISHED" || match.status === "CANCELED") {
    return NextResponse.json(
      { error: "終了済み・キャンセル済みのマッチは操作できません" },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { reason } = body as { reason?: MatchEndReason };
  const endReason: MatchEndReason =
    reason && VALID_REASONS.includes(reason) ? reason : "CANCELED";

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: { status: "CANCELED", endReason, endedAt: new Date() },
  });

  await logAudit(
    "MATCH_CANCEL",
    session.id,
    "Match",
    matchId,
    `Match #${match.matchNumber} canceled (${endReason})`,
    { reason: endReason, prevStatus: match.status },
    req,
    id
  );

  return NextResponse.json({ match: updated });
}
