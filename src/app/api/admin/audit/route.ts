import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditAction } from "@prisma/client";

// GET /api/admin/audit?from=&to=&action=&actor=&target=&q=&cursor=
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const action = searchParams.get("action") as AuditAction | null;
  const actor = searchParams.get("actor"); // actorId or username
  const target = searchParams.get("target"); // targetId
  const q = searchParams.get("q") ?? "";
  const cursor = searchParams.get("cursor"); // id for cursor-based pagination
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  // Resolve actor by username if it looks like a username (not a cuid)
  let actorId: string | undefined;
  if (actor) {
    if (actor.startsWith("c") && actor.length > 20) {
      actorId = actor;
    } else {
      const actorUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: actor },
            { username: { equals: actor, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      actorId = actorUser?.id;
    }
  }

  const where = {
    ...(action ? { action } : {}),
    ...(actorId ? { actorId } : {}),
    ...(target ? { targetId: target } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { summary: { contains: q, mode: "insensitive" as const } },
            { targetId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    take: limit + 1, // fetch one extra to determine if there's a next page
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1, // skip the cursor row itself
        }
      : {}),
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: { id: true, username: true, displayName: true, role: true },
      },
    },
  });

  const hasNextPage = logs.length > limit;
  const items = hasNextPage ? logs.slice(0, limit) : logs;
  const nextCursor = hasNextPage ? items[items.length - 1].id : null;

  return NextResponse.json({
    logs: items,
    pagination: {
      limit,
      hasNextPage,
      nextCursor,
    },
  });
}
