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

describe("GET /api/me/matches", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const req = { url: "http://localhost/api/me/matches" } as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("formats matches and clamps limit", async () => {
    getSessionMock.mockResolvedValue({ id: "self", role: "ROOM_USER" });
    matchFindManyMock.mockResolvedValue([
      {
        id: "m1",
        matchNumber: 3,
        winnerId: "self",
        endReason: "HP_ZERO",
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        endedAt: new Date("2026-01-01T00:10:00.000Z"),
        player1Id: "self",
        player2Id: "opp",
        player1: { id: "self", username: "me", displayName: "Me" },
        player2: { id: "opp", username: "opp", displayName: "Opponent" },
        room: { id: "r1", name: "Room", roomNumber: "ROOM-1" },
      },
    ]);

    const req = { url: "http://localhost/api/me/matches?limit=999" } as Parameters<typeof GET>[0];
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matches[0]).toMatchObject({
      id: "m1",
      matchNumber: 3,
      result: "WIN",
      opponent: { id: "opp", username: "opp", displayName: "Opponent" },
    });

    expect(matchFindManyMock).toHaveBeenCalledTimes(1);
    const arg = matchFindManyMock.mock.calls[0][0] as { take: number };
    expect(arg.take).toBe(50);
  });
});
