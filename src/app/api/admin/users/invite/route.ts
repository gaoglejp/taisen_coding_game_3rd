import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { UserRole } from "@prisma/client";
import { randomBytes } from "crypto";

// POST /api/admin/users/invite
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isSystemAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const body = await req.json();
  const { email, role, message } = body as {
    email?: string;
    role?: UserRole;
    message?: string;
  };

  if (!email) {
    return NextResponse.json({ error: "email は必須です" }, { status: 400 });
  }

  const validRoles: UserRole[] = ["SYSTEM_ADMIN", "ROOM_ADMIN", "GENERAL_USER"];
  const assignedRole: UserRole = role && validRoles.includes(role) ? role : "GENERAL_USER";

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
  }

  // Generate invite token (32-byte hex)
  const inviteToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Generate a temporary username from email
  const emailLocal = email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase();
  const suffix = randomBytes(3).toString("hex");
  const username = `${emailLocal.slice(0, 16)}-${suffix}`;

  const user = await prisma.user.create({
    data: {
      username,
      email,
      role: assignedRole,
      status: "PENDING",
      quickToken: inviteToken,
    },
  });

  await logAudit(
    "USER_INVITE",
    session.id,
    "User",
    user.id,
    `Invited user "${email}" with role ${assignedRole}`,
    { email, role: assignedRole, message },
    req
  );

  const baseUrl = req.nextUrl.origin;
  const inviteLink = `${baseUrl}/auth/invite?token=${inviteToken}`;

  return NextResponse.json(
    {
      inviteLink,
      expiresAt,
      userId: user.id,
    },
    { status: 201 }
  );
}
