import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode } = body as { mode: "A" | "B" | "C" };

    // ── Mode A: username/email + password ────────────────────────────────────
    if (mode === "A") {
      const { identifier, password } = body as {
        identifier: string;
        password: string;
      };

      if (!identifier || !password) {
        return NextResponse.json(
          { error: "identifier と password は必須です" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findFirst({
        where: {
          OR: [{ username: identifier }, { email: identifier }],
          status: "ACTIVE",
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          passwordHash: true,
        },
      });

      if (!user || !user.passwordHash) {
        return NextResponse.json(
          { error: "ユーザー名またはパスワードが違います" },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "ユーザー名またはパスワードが違います" },
          { status: 401 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = createSessionToken(user.id);
      const res = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
      res.cookies.set("session", token, sessionCookieOptions());
      return res;
    }

    // ── Mode B: roomNumber + username + issueCode ─────────────────────────────
    if (mode === "B") {
      const { roomNumber, username, issueCode } = body as {
        roomNumber: string;
        username: string;
        issueCode: string;
      };

      if (!roomNumber || !username || !issueCode) {
        return NextResponse.json(
          { error: "roomNumber, username, issueCode は必須です" },
          { status: 400 }
        );
      }

      const room = await prisma.room.findUnique({
        where: { roomNumber, status: "ACTIVE" },
      });

      if (!room) {
        return NextResponse.json(
          { error: "ルームが見つかりません" },
          { status: 404 }
        );
      }

      const membership = await prisma.roomMembership.findFirst({
        where: {
          roomId: room.id,
          issueCode,
          issueCodeUsed: false,
          status: "ACTIVE",
        },
        include: { user: true },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "入室コードが無効です" },
          { status: 401 }
        );
      }

      // Mark code as used and update user's username if needed
      await prisma.roomMembership.update({
        where: { id: membership.id },
        data: { issueCodeUsed: true },
      });

      const user = membership.user;
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = createSessionToken(user.id);
      const res = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
      res.cookies.set("session", token, sessionCookieOptions());
      return res;
    }

    // ── Mode C: guest / quick-token ───────────────────────────────────────────
    if (mode === "C") {
      const { username } = body as { username: string };

      if (!username) {
        return NextResponse.json(
          { error: "username は必須です" },
          { status: 400 }
        );
      }

      const quickToken = Buffer.from(
        `${username}:${Date.now()}:${Math.random()}`
      ).toString("base64");

      // Find or create a GENERAL_USER guest account
      let user = await prisma.user.findFirst({
        where: { username, role: "GENERAL_USER" },
        select: { id: true, username: true, displayName: true, role: true },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            username,
            displayName: username,
            role: "GENERAL_USER",
            status: "ACTIVE",
            quickToken,
          },
          select: { id: true, username: true, displayName: true, role: true },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { quickToken, lastLoginAt: new Date() },
        });
      }

      const token = createSessionToken(user.id);
      const res = NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
        },
      });
      res.cookies.set("session", token, sessionCookieOptions());
      return res;
    }

    return NextResponse.json({ error: "無効な mode です" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
