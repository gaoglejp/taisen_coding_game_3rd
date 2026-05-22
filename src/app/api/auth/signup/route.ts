import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

// POST /api/auth/signup — register a new full account
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      username,
      email,
      password,
      inviteCode,
    } = body as {
      username: string;
      email: string;
      password: string;
      inviteCode?: string;
    };

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "username, email, password は必須です" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "パスワードは8文字以上にしてください" },
        { status: 400 }
      );
    }

    // Username: alphanumeric + underscore only
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "username は英数字とアンダースコアのみ、3〜32文字" },
        { status: 400 }
      );
    }

    // Check uniqueness
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return NextResponse.json(
        { error: "このユーザー名は既に使われています" },
        { status: 409 }
      );
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    // TODO: validate inviteCode against a future InviteCode model
    void inviteCode;

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        username,
        displayName: username,
        email,
        passwordHash,
        role: "GENERAL_USER",
        status: "PENDING",
      },
    });

    // TODO: send confirmation email
    return NextResponse.json(
      { message: "confirmation email sent" },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/auth/signup]", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}

// POST /api/auth/signup/promote — upgrade quick (guest) account to full account
// Handled in /api/auth/signup/promote/route.ts — this export is a no-op placeholder
// so that Next.js resolves the parent segment correctly.
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "未ログインです" }, { status: 401 });
    }

    const body = await req.json();
    const { email, password } = body as { email: string; password: string };

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

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail && existingEmail.id !== session.id) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: session.id },
      data: {
        email,
        passwordHash,
        status: "PENDING",
        quickToken: null,
      },
    });

    return NextResponse.json({ message: "confirmation email sent" });
  } catch (err) {
    console.error("[PUT /api/auth/signup promote]", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
