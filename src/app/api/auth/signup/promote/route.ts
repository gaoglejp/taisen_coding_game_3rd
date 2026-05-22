import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/auth/signup/promote
// Upgrade a guest (quickToken) account to a full account with email + password
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未ログインです" }, { status: 401 });
    }

    const body = await req.json();
    const { email, password, username } = body as {
      email: string;
      password: string;
      username?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: "email と password は必須です" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上にしてください" },
        { status: 400 }
      );
    }

    // Ensure target user is still a quick-token guest (no passwordHash)
    const currentUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, passwordHash: true, email: true },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "ユーザーが見つかりません" },
        { status: 404 }
      );
    }

    if (currentUser.passwordHash) {
      return NextResponse.json(
        { error: "このアカウントは既にフルアカウントです" },
        { status: 409 }
      );
    }

    // Check email uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== session.id) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // Optionally update username
    if (username) {
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
        return NextResponse.json(
          { error: "username は英数字とアンダースコアのみ、3〜32文字" },
          { status: 400 }
        );
      }
      const existingUsername = await prisma.user.findUnique({ where: { username } });
      if (existingUsername && existingUsername.id !== session.id) {
        return NextResponse.json(
          { error: "このユーザー名は既に使われています" },
          { status: 409 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: session.id },
      data: {
        email,
        passwordHash,
        status: "PENDING",
        quickToken: null,
        ...(username ? { username, displayName: username } : {}),
      },
    });

    // TODO: send confirmation email
    return NextResponse.json({ message: "confirmation email sent" });
  } catch (err) {
    console.error("[POST /api/auth/signup/promote]", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
