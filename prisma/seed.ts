import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // System admin
  const sysAdmin = await prisma.user.upsert({
    where: { username: "sysadmin" },
    update: {},
    create: {
      username: "sysadmin",
      displayName: "システム管理者",
      email: "admin@example.com",
      passwordHash: await bcrypt.hash("password123!", 10),
      role: "SYSTEM_ADMIN",
      status: "ACTIVE",
    },
  });

  // Room admin
  const roomAdmin = await prisma.user.upsert({
    where: { username: "teacher01" },
    update: {},
    create: {
      username: "teacher01",
      displayName: "田中先生",
      email: "teacher@example.com",
      passwordHash: await bcrypt.hash("password123!", 10),
      role: "ROOM_ADMIN",
      status: "ACTIVE",
    },
  });

  // General users
  const user1 = await prisma.user.upsert({
    where: { username: "taro_student" },
    update: {},
    create: {
      username: "taro_student",
      displayName: "たろう",
      email: "taro@example.com",
      passwordHash: await bcrypt.hash("password123!", 10),
      role: "ROOM_USER",
      status: "ACTIVE",
    },
  });

  const user2 = await prisma.user.upsert({
    where: { username: "hanako_student" },
    update: {},
    create: {
      username: "hanako_student",
      displayName: "はなこ",
      email: "hanako@example.com",
      passwordHash: await bcrypt.hash("password123!", 10),
      role: "ROOM_USER",
      status: "ACTIVE",
    },
  });

  // Create classroom room
  const room = await prisma.room.upsert({
    where: { roomNumber: "ROOM-2026-0001" },
    update: {},
    create: {
      roomNumber: "ROOM-2026-0001",
      name: "プログラミング入門クラス",
      description: "Blocklyでコーディングを学ぶクラスです",
      kind: "CLASSROOM",
      status: "ACTIVE",
      expiresAt: new Date("2026-07-31"),
      rulePreset: {
        boardWidth: 10,
        boardHeight: 10,
        maxTurns: 20,
        ap: 2,
        scanRange: 3,
        obstacleCount: 5,
        codingTimeLimitSec: 300,
        items: {
          CROSS_ATTACK: { enabled: true, spawnStartTurn: 5, spawnChance: 0.2, maxOnBoard: 2 },
          BARRIER: { enabled: true, spawnStartTurn: 3, spawnChance: 0.15, maxOnBoard: 2 },
          REPEAT_ACTIONS: { enabled: false, spawnStartTurn: 8, spawnChance: 0.1, maxOnBoard: 1 },
        },
      },
      admins: { connect: { id: roomAdmin.id } },
    },
  });

  // Add members
  await prisma.roomMembership.upsert({
    where: { userId_roomId: { userId: user1.id, roomId: room.id } },
    update: {},
    create: {
      userId: user1.id,
      roomId: room.id,
      status: "ACTIVE",
      issueCode: "ABC12345",
      issueCodeUsed: true,
      expiresAt: new Date("2026-07-31"),
    },
  });

  await prisma.roomMembership.upsert({
    where: { userId_roomId: { userId: user2.id, roomId: room.id } },
    update: {},
    create: {
      userId: user2.id,
      roomId: room.id,
      status: "ACTIVE",
      issueCode: "DEF67890",
      issueCodeUsed: true,
      expiresAt: new Date("2026-07-31"),
    },
  });

  // Create a match
  const match = await prisma.match.upsert({
    where: { roomId_matchNumber: { roomId: room.id, matchNumber: 1 } },
    update: {},
    create: {
      matchNumber: 1,
      roomId: room.id,
      player1Id: user1.id,
      player2Id: user2.id,
      status: "FINISHED",
      endReason: "HP_ZERO",
      winnerId: user1.id,
      round: 1,
      isPublicWatch: true,
      startedAt: new Date(Date.now() - 3600000),
      endedAt: new Date(Date.now() - 3000000),
    },
  });

  // Active coding match for realtime testing
  const codingMatch = await prisma.match.upsert({
    where: { roomId_matchNumber: { roomId: room.id, matchNumber: 2 } },
    update: {
      status: "CODING",
      strategy1: Prisma.DbNull,
      strategy2: Prisma.DbNull,
      startedAt: null,
      endedAt: null,
      winnerId: null,
      endReason: null,
    },
    create: {
      matchNumber: 2,
      roomId: room.id,
      player1Id: user1.id,
      player2Id: user2.id,
      status: "CODING",
      round: 1,
      isPublicWatch: true,
      codingDeadlineAt: new Date(Date.now() + 300000),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: "ROOM_CREATE",
      actorId: sysAdmin.id,
      targetType: "ROOM",
      targetId: room.id,
      targetRoomId: room.id,
      summary: `ルーム "${room.name}" を作成`,
      ipAddress: "127.0.0.1",
      userAgent: "seed-script",
    },
  });

  console.log("Seed complete!");
  console.log(`  System admin: sysadmin / password123!`);
  console.log(`  Room admin: teacher01 / password123!`);
  console.log(`  Student 1: taro_student / password123!`);
  console.log(`  Student 2: hanako_student / password123!`);
  console.log(`  Room: ROOM-2026-0001`);
  console.log(`  Match ID (finished): ${match.id}`);
  console.log(`  Match ID (coding):   ${codingMatch.id}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
