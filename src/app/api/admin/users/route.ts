import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole, UserStatus } from "@prisma/client";

// GET /api/admin/users?q=&role=&status=&scope=
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q") ?? "";
  const role = searchParams.get("role") as UserRole | null;
  const status = searchParams.get("status") as UserStatus | null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { username: { contains: q, mode: "insensitive" as const } },
            { displayName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { memberships: true } },
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            status: true,
            room: { select: { id: true, name: true, roomNumber: true, kind: true } },
          },
          take: 5,
        },
      },
    }),
  ]);

  const formatted = users.map((u) => ({
    ...u,
    membershipCount: u._count.memberships,
    _count: undefined,
  }));

  return NextResponse.json({
    users: formatted,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}
