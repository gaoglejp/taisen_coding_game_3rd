import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const matchFindFirstMock = vi.fn();
const matchCreateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isAdmin: (role: string) => role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
    },
    match: {
      findFirst: (...a: unknown[]) => matchFindFirstMock(...a),
      create: (...a: unknown[]) => matchCreateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { POST } from "./route";

const ROOM_ID = "room-1";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ id: ROOM_ID }) };

beforeEach(() => {
  getSessionMock.mockReset();
  roomFindFirstMock.mockReset();
  roomFindUniqueMock.mockReset();
  matchFindFirstMock.mockReset();
  matchCreateMock.mockReset();
  logAuditMock.mockReset();
  // Sensible defaults for the happy path; individual tests override the session/body.
  roomFindUniqueMock.mockResolvedValue({ id: ROOM_ID, name: "Room" });
  matchFindFirstMock.mockResolvedValue(null); // → next match number 1
  matchCreateMock.mockResolvedValue({ id: "m", matchNumber: 1 });
});

describe("POST /api/admin/rooms/:id/matches", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req({ mode: "MANUAL" }), ctx)).status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_USER" });
    expect((await POST(req({ mode: "MANUAL" }), ctx)).status).toBe(403);
  });

  it("403 for a ROOM_ADMIN that does not own the room (before any room load)", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    roomFindFirstMock.mockResolvedValue(null);
    const res = await POST(req({ mode: "MANUAL" }), ctx);
    expect(res.status).toBe(403);
    expect(roomFindUniqueMock).not.toHaveBeenCalled();
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await POST(req({ mode: "MANUAL" }), ctx)).status).toBe(404);
  });

  it("400 for an unknown mode", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    expect((await POST(req({ mode: "NOPE" }), ctx)).status).toBe(400);
    expect(matchCreateMock).not.toHaveBeenCalled();
  });

  it("MANUAL creates exactly one match and logs MATCH_CREATE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ mode: "MANUAL", player1Id: "p1", player2Id: "p2" }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.matches).toHaveLength(1);
    expect(matchCreateMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock).toHaveBeenCalledWith("MATCH_CREATE", "admin", "Room", ROOM_ID, expect.any(String), expect.anything(), expect.anything(), ROOM_ID);
  });

  it("400 for RANDOM with fewer than two players", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ mode: "RANDOM", playerIds: ["only-one"] }), ctx);
    expect(res.status).toBe(400);
    expect(matchCreateMock).not.toHaveBeenCalled();
  });

  it("ROUND_ROBIN creates every pairing (n·(n-1)/2)", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ mode: "ROUND_ROBIN", playerIds: ["a", "b", "c", "d"] }), ctx);
    expect(res.status).toBe(201);
    expect(matchCreateMock).toHaveBeenCalledTimes(6); // 4·3/2
  });

  it("TOURNAMENT creates floor(n/2) first-round matches tagged round 1", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ mode: "TOURNAMENT", playerIds: ["a", "b", "c", "d"] }), ctx);
    expect(res.status).toBe(201);
    expect(matchCreateMock).toHaveBeenCalledTimes(2);
    const firstCreate = matchCreateMock.mock.calls[0][0] as { data: { round: number } };
    expect(firstCreate.data.round).toBe(1);
  });
});
