import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ matchId: string }> };

// GET /api/match/:matchId/state
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { matchId } = await params;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      matchNumber: true,
      roomId: true,
      status: true,
      endReason: true,
      winnerId: true,
      round: true,
      isPublicWatch: true,
      codingDeadlineAt: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      player1: { select: { id: true, username: true, displayName: true } },
      player2: { select: { id: true, username: true, displayName: true } },
      room: { select: { id: true, name: true, roomNumber: true, rulePreset: true } },
    },
  });

  if (!match) return NextResponse.json({ error: "マッチが見つかりません" }, { status: 404 });

  // Check access: participants, room admins, or public watch
  const isParticipant =
    match.player1?.id === session.id || match.player2?.id === session.id;

  if (!match.isPublicWatch && !isParticipant) {
    // Check if user is admin of the room
    const isAdmin = await prisma.room.findFirst({
      where: {
        id: match.roomId,
        admins: { some: { id: session.id } },
      },
    });
    if (!isAdmin && session.role !== "SYSTEM_ADMIN") {
      return NextResponse.json({ error: "このマッチは非公開です" }, { status: 403 });
    }
  }

  // Lazy initialization of the coding deadline. If a participant enters a
  // CODING-phase match whose deadline has already passed (e.g. seed data set
  // the deadline N minutes after seed time, then nobody opened it for hours),
  // refresh the deadline to NOW + 5 minutes so the player isn't greeted with
  // an instant 時間切れ. Unlimited mode (codingDeadlineAt === null) is preserved
  // — only stale, past timestamps get refreshed. Admin viewers don't extend.
  if (
    isParticipant &&
    match.status === "CODING" &&
    match.codingDeadlineAt &&
    new Date(match.codingDeadlineAt) < new Date()
  ) {
    const refreshed = new Date(Date.now() + 5 * 60 * 1000);
    await prisma.match.update({
      where: { id: match.id },
      data: { codingDeadlineAt: refreshed },
    });
    match.codingDeadlineAt = refreshed;
  }

  return NextResponse.json({ match });
}
