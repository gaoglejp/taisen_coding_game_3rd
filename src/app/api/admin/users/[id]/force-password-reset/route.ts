import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ id: string }> };

// POST /api/admin/users/:id/force-password-reset
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  // Generate a reset token stored as quickToken
  const resetToken = randomBytes(32).toString("hex");

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: null,
      quickToken: resetToken,
    },
  });

  await logAudit(
    "USER_FORCE_PASSWORD_RESET",
    session.id,
    "User",
    id,
    `Forced password reset for user "${user.username}"`,
    null,
    req
  );

  const baseUrl = req.nextUrl.origin;
  const resetLink = `${baseUrl}/auth/reset-password?token=${resetToken}`;

  return NextResponse.json({ resetLink, userId: id });
}
