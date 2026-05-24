import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const matchFindManyMock = vi.fn();
const userFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isAdmin: (role: string) => role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
      findFirst: vi.fn(),
    },
    match: { findMany: (...a: unknown[]) => matchFindManyMock(...a) },
    user: { findMany: (...a: unknown[]) => userFindManyMock(...a) },
  },
}));

import { GET } from "./route";

function req() {
  return { nextUrl: { searchParams: new URLSearchParams() } } as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ id: "room-1" }) };

beforeEach(() => {
  getSessionMock.mockReset();
  roomFindUniqueMock.mockReset();
  matchFindManyMock.mockReset();
  userFindManyMock.mockReset();
});

describe("GET /api/admin/rooms/:id/standings", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "a", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
  });

  it("aggregates damage, turns, recent form, and first-damage win rate from replayData", async () => {
    getSessionMock.mockResolvedValue({ id: "a", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "ROOM-2026-0001" });
    // p1 beats p2. Per-turn `damaged` is damage TAKEN that turn.
    matchFindManyMock.mockResolvedValue([
      {
        matchNumber: 1,
        player1Id: "p1",
        player2Id: "p2",
        winnerId: "p1",
        endReason: "HP_ZERO",
        replayData: {
          turns: [
            { p1: { damaged: 0 }, p2: { damaged: 5 } },
            { p1: { damaged: 3 }, p2: { damaged: 5 } },
          ],
        },
      },
    ]);
    userFindManyMock.mockResolvedValue([
      { id: "p1", username: "alice", displayName: "Alice" },
      { id: "p2", username: "bob", displayName: "Bob" },
    ]);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();

    const p1 = json.standings.find((s: { userId: string }) => s.userId === "p1");
    const p2 = json.standings.find((s: { userId: string }) => s.userId === "p2");

    // p1 dealt what p2 took (5+5=10), took what its own rows show (0+3=3).
    expect(p1.rank).toBe(1);
    expect(p1.wins).toBe(1);
    expect(p1.avgDamageDealt).toBe(10);
    expect(p1.avgDamageTaken).toBe(3);
    expect(p1.avgTurns).toBe(2);
    expect(p1.recent).toEqual(["W"]);

    expect(p2.rank).toBe(2);
    expect(p2.losses).toBe(1);
    expect(p2.avgDamageDealt).toBe(3);
    expect(p2.avgDamageTaken).toBe(10);
    expect(p2.recent).toEqual(["L"]);

    expect(json.summary.totalMatches).toBe(1);
    expect(json.summary.avgTurns).toBe(2);
    // mean of win rates (1.0 and 0.0) → 50%
    expect(json.summary.avgWinRate).toBe(50);
    // p1 landed the first hit (p2 took damage on turn 1) and won → 100%
    expect(json.summary.firstDamageWinRate).toBe(100);
    expect(json.summary.endReasonCounts).toEqual({ HP_ZERO: 1 });
  });
});
