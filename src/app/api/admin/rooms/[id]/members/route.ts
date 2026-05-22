import { NextRequest, NextResponse } from "next/server";
import { getSession, isSystemAdmin, isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// Adjective + noun word lists for username generation
const ADJECTIVES = [
  "swift", "brave", "calm", "dark", "eager", "fair", "glad", "hazy",
  "idle", "jolly", "keen", "lazy", "mild", "neat", "odd", "pure",
  "quick", "rare", "sage", "tall", "vast", "warm", "wry", "zany",
];
const NOUNS = [
  "hawk", "wolf", "bear", "fox", "lynx", "deer", "crow", "frog",
  "pike", "rook", "wren", "dove", "kite", "mole", "newt", "puma",
  "slug", "toad", "vole", "wasp", "yak", "zebu", "bison", "crane",
];

function generateUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${adj}-${noun}-${num}`;
}

function generateIssueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET /api/admin/rooms/:id/members?status=&q=
export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  // ROOM_ADMIN can only access their own rooms
  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const status = searchParams.get("status");
  const q = searchParams.get("q") ?? "";

  const memberships = await prisma.roomMembership.findMany({
    where: {
      roomId: id,
      ...(status ? { status: status as "ACTIVE" | "DISABLED" | "EXPIRED" } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { username: { contains: q, mode: "insensitive" } },
                { displayName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ members: memberships });
}

// POST /api/admin/rooms/:id/members
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  if (!isAdmin(session.role))
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });

  const { id } = await params;

  // ROOM_ADMIN can only manage their own rooms
  if (session.role === "ROOM_ADMIN") {
    const isRoomAdmin = await prisma.room.findFirst({
      where: { id, admins: { some: { id: session.id } } },
    });
    if (!isRoomAdmin) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return NextResponse.json({ error: "ルームが見つかりません" }, { status: 404 });

  const body = await req.json();

  // Bulk issue
  if (Array.isArray(body.members)) {
    const { members, expiresAt } = body as {
      members: Array<{ displayName: string; username?: string }>;
      expiresAt?: string;
    };

    if (!members.length) {
      return NextResponse.json({ error: "メンバーが空です" }, { status: 400 });
    }

    const results: Array<{
      username: string;
      displayName: string;
      issueCode: string;
      userId: string;
      membershipId: string;
    }> = [];

    for (const m of members) {
      if (!m.displayName) continue;

      let username = m.username?.trim();
      if (!username) {
        // Generate unique username
        let attempts = 0;
        do {
          username = generateUsername();
          attempts++;
          if (attempts > 20) break;
          const exists = await prisma.user.findUnique({ where: { username } });
          if (!exists) break;
          username = undefined;
        } while (!username);
      }
      if (!username) continue;

      const issueCode = generateIssueCode();

      const user = await prisma.user.create({
        data: {
          username,
          displayName: m.displayName,
          role: "ROOM_USER",
          status: "PENDING",
        },
      });

      const membership = await prisma.roomMembership.create({
        data: {
          userId: user.id,
          roomId: id,
          issueCode,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        },
      });

      results.push({
        username,
        displayName: m.displayName,
        issueCode,
        userId: user.id,
        membershipId: membership.id,
      });
    }

    await logAudit(
      "MEMBER_ISSUE",
      session.id,
      "Room",
      id,
      `Bulk issued ${results.length} members to room "${room.name}"`,
      { count: results.length },
      req,
      id
    );

    return NextResponse.json({ members: results }, { status: 201 });
  }

  // Single issue
  const { displayName, username: rawUsername, expiresAt } = body as {
    displayName?: string;
    username?: string;
    expiresAt?: string;
  };

  if (!displayName) {
    return NextResponse.json({ error: "displayName は必須です" }, { status: 400 });
  }

  let username = rawUsername?.trim();
  if (!username) {
    let attempts = 0;
    do {
      username = generateUsername();
      attempts++;
      const exists = await prisma.user.findUnique({ where: { username } });
      if (!exists) break;
      if (attempts >= 20) {
        return NextResponse.json({ error: "ユーザー名の生成に失敗しました" }, { status: 500 });
      }
      username = undefined;
    } while (!username);
  }

  if (!username) {
    return NextResponse.json({ error: "ユーザー名の生成に失敗しました" }, { status: 500 });
  }

  // Check username availability if explicitly provided
  if (rawUsername?.trim()) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "このユーザー名は既に使用されています" }, { status: 409 });
    }
  }

  const issueCode = generateIssueCode();

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      role: "ROOM_USER",
      status: "PENDING",
    },
  });

  const membership = await prisma.roomMembership.create({
    data: {
      userId: user.id,
      roomId: id,
      issueCode,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
  });

  await logAudit(
    "MEMBER_ISSUE",
    session.id,
    "Room",
    id,
    `Issued member "${displayName}" (${username}) to room "${room.name}"`,
    { userId: user.id, membershipId: membership.id },
    req,
    id
  );

  return NextResponse.json(
    { username, displayName, issueCode, userId: user.id, membershipId: membership.id },
    { status: 201 }
  );
}
