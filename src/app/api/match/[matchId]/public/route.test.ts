import { beforeEach, describe, expect, it, vi } from "vitest";

const matchFindUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    match: { findUnique: (...a: unknown[]) => matchFindUniqueMock(...a) },
  },
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ matchId: "m-1" }) };
const req = {} as Parameters<typeof GET>[0];

beforeEach(() => {
  matchFindUniqueMock.mockReset();
});

describe("GET /api/match/:matchId/public", () => {
  it("404 when match does not exist", async () => {
    matchFindUniqueMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns public watch metadata without authentication", async () => {
    matchFindUniqueMock.mockResolvedValue({
      id: "m-1",
      matchNumber: 12,
      status: "BATTLING",
      isPublicWatch: true,
      round: 3,
      startedAt: new Date("2026-05-24T10:00:00Z"),
      endedAt: null,
      createdAt: new Date("2026-05-24T09:50:00Z"),
      player1: { id: "p1", username: "a", displayName: "Alice" },
      player2: { id: "p2", username: "b", displayName: "Bob" },
      room: {
        name: "Room A",
        roomNumber: "ROOM-2026-0001",
        watchingPublic: true,
        rankingPublic: false,
        replayShareEnabled: true,
      },
    });

    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      matchId: "m-1",
      matchNumber: 12,
      isPublicWatch: true,
      player1: { id: "p1" },
      player2: { id: "p2" },
      room: {
        name: "Room A",
        roomNumber: "ROOM-2026-0001",
        watchingPublic: true,
        replayShareEnabled: true,
      },
    });
    expect(json.room.rankingPublic).toBeUndefined();
  });
});
