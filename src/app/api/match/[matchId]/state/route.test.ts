import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const matchFindUniqueMock = vi.fn();
const matchUpdateMock = vi.fn();
const roomFindFirstMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    match: {
      findUnique: (...a: unknown[]) => matchFindUniqueMock(...a),
      update: (...a: unknown[]) => matchUpdateMock(...a),
    },
    room: { findFirst: (...a: unknown[]) => roomFindFirstMock(...a) },
  },
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ matchId: "m-1" }) };
const req = {} as Parameters<typeof GET>[0];

const baseMatch = {
  id: "m-1",
  matchNumber: 1,
  roomId: "room-1",
  status: "CODING",
  endReason: null,
  winnerId: null,
  round: 1,
  isPublicWatch: false,
  codingDeadlineAt: new Date("2026-05-24T11:00:00Z"),
  startedAt: null,
  endedAt: null,
  createdAt: new Date("2026-05-24T10:00:00Z"),
  player1: { id: "p1", username: "u1", displayName: "P1" },
  player2: { id: "p2", username: "u2", displayName: "P2" },
  room: { id: "room-1", name: "R", roomNumber: "ROOM-1" },
};

beforeEach(() => {
  getSessionMock.mockReset();
  matchFindUniqueMock.mockReset();
  matchUpdateMock.mockReset();
  roomFindFirstMock.mockReset();
});

describe("GET /api/match/:matchId/state", () => {
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

  it("403 for non-participant non-admin when match is not public", async () => {
    getSessionMock.mockResolvedValue({ id: "outsider", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue(baseMatch);
    roomFindFirstMock.mockResolvedValue(null);
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("allows participant and returns room/players/codingDeadlineAt", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    // Use a future deadline so the lazy-refresh path doesn't fire here.
    matchFindUniqueMock.mockResolvedValue({
      ...baseMatch,
      codingDeadlineAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.match.player1.id).toBe("p1");
    expect(json.match.player2.id).toBe("p2");
    expect(json.match.room).toEqual({ id: "room-1", name: "R", roomNumber: "ROOM-1" });
    expect(json.match.codingDeadlineAt).toBeTruthy();
    expect(matchUpdateMock).not.toHaveBeenCalled();
  });

  it("refreshes a past codingDeadlineAt when a participant enters a CODING match", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue({
      ...baseMatch,
      // Hours in the past — exactly the seed-aging scenario the user reported.
      codingDeadlineAt: new Date(Date.now() - 60 * 60 * 1000),
    });
    matchUpdateMock.mockResolvedValue({});

    const before = Date.now();
    const res = await GET(req, ctx);
    const after = Date.now();

    expect(res.status).toBe(200);
    expect(matchUpdateMock).toHaveBeenCalledTimes(1);
    const call = matchUpdateMock.mock.calls[0][0] as { where: { id: string }; data: { codingDeadlineAt: Date } };
    expect(call.where.id).toBe("m-1");
    const ms = call.data.codingDeadlineAt.getTime();
    expect(ms).toBeGreaterThanOrEqual(before + 5 * 60 * 1000 - 1000);
    expect(ms).toBeLessThanOrEqual(after + 5 * 60 * 1000 + 1000);
    const json = await res.json();
    expect(new Date(json.match.codingDeadlineAt).getTime()).toBe(ms);
  });

  it("does NOT refresh deadline for an admin viewer (only participants extend it)", async () => {
    getSessionMock.mockResolvedValue({ id: "admin-1", role: "ROOM_ADMIN" });
    matchFindUniqueMock.mockResolvedValue({
      ...baseMatch,
      isPublicWatch: true,
      codingDeadlineAt: new Date(Date.now() - 60 * 60 * 1000),
    });

    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(matchUpdateMock).not.toHaveBeenCalled();
  });

  it("does NOT refresh when codingDeadlineAt is null (unlimited mode)", async () => {
    getSessionMock.mockResolvedValue({ id: "p1", role: "ROOM_USER" });
    matchFindUniqueMock.mockResolvedValue({ ...baseMatch, codingDeadlineAt: null });

    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    expect(matchUpdateMock).not.toHaveBeenCalled();
  });
});
