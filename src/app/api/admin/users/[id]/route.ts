import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { UserStatus } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  // Prevent disabling self
  if (id === session.id) {
    return NextResponse.json({ error: "自分自身のアカウントは変更できません" }, { status: 400 });
  }

  const body = await req.json();
  const { status, displayName, email } = body as {
    status?: UserStatus;
    displayName?: string;
    email?: string;
  };

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(displayName !== undefined ? { displayName } : {}),
      ...(email !== undefined ? { email } : {}),
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });

  // Determine audit action based on status change
  let auditAction: "USER_DISABLE" | "USER_ENABLE" | "USER_INVITE" = "USER_INVITE";
  if (status === "DISABLED" && existing.status !== "DISABLED") {
    auditAction = "USER_DISABLE";
  } else if (status === "ACTIVE" && existing.status === "DISABLED") {
    auditAction = "USER_ENABLE";
  }

  if (status && status !== existing.status) {
    await logAudit(
      auditAction,
      session.id,
      "User",
      id,
      `User "${existing.username}" status changed from ${existing.status} to ${status}`,
      { prevStatus: existing.status, newStatus: status },
      req
    );
  }

  return NextResponse.json({ user: updated });
}
