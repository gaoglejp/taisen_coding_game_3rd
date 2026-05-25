import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const matchFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({ prisma: { match: { findMany: (...a: unknown[]) => matchFindManyMock(...a) } } }));

import { GET } from "./route";

beforeEach(() => {
  getSessionMock.mockReset();
  matchFindManyMock.mockReset();
});

describe("GET /api/me/stats", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("aggregates result/turns/damage/firstDamage from replayData", async () => {
    getSessionMock.mockResolvedValue({ id: "self", role: "ROOM_USER" });
    matchFindManyMock.mockResolvedValue([
      {
        player1Id: "self",
        player2Id: "opp1",
        winnerId: "self",
        endedAt: new Date("2026-01-01T00:00:00.000Z"),
        replayData: { turns: [{ p1: { damaged: 0 }, p2: { damaged: 10 } }, { p1: { damaged: 5 }, p2: { damaged: 0 } }] },
      },
      {
        player1Id: "opp2",
        player2Id: "self",
        winnerId: null,
        endedAt: new Date("2026-01-02T00:00:00.000Z"),
        replayData: { turns: [{ p1: { damaged: 6 }, p2: { damaged: 0 } }] },
      },
      {
        player1Id: "self",
        player2Id: "opp3",
        winnerId: "opp3",
        endedAt: new Date("2026-01-03T00:00:00.000Z"),
        replayData: null,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.stats).toMatchObject({
      wins: 1,
      losses: 1,
      draws: 1,
      total: 3,
      winRate: 33,
      avgTurns: 1.5,
      avgDamageDealt: 5,
      avgDamageTaken: 2,
      firstDamageRate: 100,
      sparkline: [100, 50, 33],
    });
  });
});
