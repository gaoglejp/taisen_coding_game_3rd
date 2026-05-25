import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const matchFindUniqueMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({
  prisma: { match: { findUnique: (...a: unknown[]) => matchFindUniqueMock(...a) } },
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ matchId: "m-1" }) };
const req = {} as Parameters<typeof GET>[0];

beforeEach(() => {
  getSessionMock.mockReset();
  matchFindUniqueMock.mockReset();
});

describe("GET /api/match/:matchId/result", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("404 when match is missing", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("400 when match is not finished", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue({ status: "BATTLING" });
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it("aggregates replay stats exactly from per-turn damaged/hp/action", async () => {
    getSessionMock.mockResolvedValue({ id: "viewer", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue({
      id: "m-1",
      matchNumber: 8,
      roomId: "room-1",
      status: "FINISHED",
      endReason: "HP_ZERO",
      winnerId: "p1",
      replayData: {
        turns: [
          { turn: 1, p1: { hp: 100, damaged: 0, action: "SHOOT_FORWARD", shoot_result: "HIT" }, p2: { hp: 95, damaged: 5, action: "MOVE_FORWARD" } },
          { turn: 2, p1: { hp: 90, damaged: 10, action: "SCAN" }, p2: { hp: 95, damaged: 0, action: "SHOOT_FORWARD", shoot_result: "MISS" } },
          { turn: 3, p1: { hp: 90, damaged: 0, action: "MOVE_FORWARD" }, p2: { hp: 80, damaged: 15, action: "WAIT" } },
        ],
      },
      round: 2,
      isPublicWatch: true,
      startedAt: new Date("2026-05-24T10:00:00Z"),
      endedAt: new Date("2026-05-24T10:01:00Z"),
      createdAt: new Date("2026-05-24T09:50:00Z"),
      player1: { id: "p1", username: "a", displayName: "A" },
      player2: { id: "p2", username: "b", displayName: "B" },
      room: { id: "room-1", name: "Room", roomNumber: "ROOM-1" },
    });

    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats.totalTurns).toBe(3);
    expect(json.stats.p1).toEqual({
      finalHp: 90,
      damageDealt: 20,
      damageTaken: 10,
      shoots: 1,
      hits: 1,
      hitRate: 100,
      scans: 1,
      moves: 1,
    });
    expect(json.stats.p2).toEqual({
      finalHp: 80,
      damageDealt: 10,
      damageTaken: 20,
      shoots: 1,
      hits: 0,
      hitRate: 0,
      scans: 0,
      moves: 1,
    });
    expect(json.stats.firstDamageTurn).toBe(1);
    expect(json.stats.firstDamageBy).toBe("p1");
    expect(json.stats.hpTimeline).toEqual([[100, 100], [100, 95], [90, 95], [90, 80]]);
    expect(json.winnerSide).toBe("p1");
    expect(json.isDraw).toBe(false);
  });
});
