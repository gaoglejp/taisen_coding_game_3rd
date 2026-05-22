import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/me
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
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
      memberships: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          status: true,
          createdAt: true,
          room: {
            select: {
              id: true,
              name: true,
              roomNumber: true,
              kind: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
