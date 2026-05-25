import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const matchFindUniqueMock = vi.fn();
const roomFindFirstMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    match: { findUnique: (...a: unknown[]) => matchFindUniqueMock(...a) },
    room: { findFirst: (...a: unknown[]) => roomFindFirstMock(...a) },
  },
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ matchId: "m-1" }) };
const req = {} as Parameters<typeof GET>[0];
const finished = {
  id: "m-1",
  matchNumber: 1,
  roomId: "room-1",
  status: "FINISHED",
  endReason: "HP_ZERO",
  winnerId: "p1",
  replayData: { turns: [{ turn: 1 }] },
  isPublicWatch: false,
  codingDeadlineAt: null,
  startedAt: null,
  endedAt: null,
  player1: { id: "p1", username: "u1", displayName: "P1" },
  player2: { id: "p2", username: "u2", displayName: "P2" },
  room: { replayShareEnabled: false, rankingPublic: false },
};

beforeEach(() => {
  getSessionMock.mockReset();
  matchFindUniqueMock.mockReset();
  roomFindFirstMock.mockReset();
});

describe("GET /api/match/:matchId/replay", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(401);
  });

  it("404 when match missing", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("400 for unfinished match", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue({ ...finished, status: "BATTLING" });
    const res = await GET(req, ctx);
    expect(res.status).toBe(400);
  });

  it("403 for outsider when replay sharing disabled", async () => {
    getSessionMock.mockResolvedValue({ id: "x", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue(finished);
    roomFindFirstMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns replayData for participant even when sharing disabled", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue(finished);
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matchId).toBe("m-1");
    expect(json.replayData).toEqual({ turns: [{ turn: 1 }] });
  });
});
