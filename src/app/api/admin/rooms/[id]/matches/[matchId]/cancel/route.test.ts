import { beforeEach, describe, expect, it, vi } from "vitest";

// The route depends on the session, the Prisma client, and the audit logger.
// Mock all three; isAdmin is reimplemented (stable 2-role check) so we don't
// have to load the real auth module (which imports next/headers).
const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const matchFindUniqueMock = vi.fn();
const matchUpdateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isAdmin: (role: string) => role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: { findFirst: (...a: unknown[]) => roomFindFirstMock(...a) },
    match: {
      findUnique: (...a: unknown[]) => matchFindUniqueMock(...a),
      update: (...a: unknown[]) => matchUpdateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: (...a: unknown[]) => logAuditMock(...a),
}));

import { POST } from "./route";

const ROOM_ID = "room-1";
const MATCH_ID = "match-1";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}
function ctx(id = ROOM_ID, matchId = MATCH_ID) {
  return { params: Promise.resolve({ id, matchId }) };
}

beforeEach(() => {
  getSessionMock.mockReset();
  roomFindFirstMock.mockReset();
  matchFindUniqueMock.mockReset();
  matchUpdateMock.mockReset();
  logAuditMock.mockReset();
});

describe("POST /api/admin/rooms/:id/matches/:matchId/cancel", () => {
  it("401 when there is no session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await POST(req({}), ctx());
    expect(res.status).toBe(401);
  });

  it("403 when the session is not an admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    const res = await POST(req({}), ctx());
    expect(res.status).toBe(403);
  });

  it("403 when a ROOM_ADMIN does not own the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_ADMIN" });
    roomFindFirstMock.mockResolvedValue(null);
    const res = await POST(req({}), ctx());
    expect(res.status).toBe(403);
    expect(matchFindUniqueMock).not.toHaveBeenCalled();
  });

  it("404 when the match is not in the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "SYSTEM_ADMIN" });
    matchFindUniqueMock.mockResolvedValue({ id: MATCH_ID, roomId: "other-room", status: "WAITING" });
    const res = await POST(req({}), ctx());
    expect(res.status).toBe(404);
  });

  it("409 when the match is already finished", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "SYSTEM_ADMIN" });
    matchFindUniqueMock.mockResolvedValue({ id: MATCH_ID, roomId: ROOM_ID, status: "FINISHED", matchNumber: 3 });
    const res = await POST(req({ reason: "CANCELED" }), ctx());
    expect(res.status).toBe(409);
    expect(matchUpdateMock).not.toHaveBeenCalled();
  });

  it("cancels a live match with the given reason and logs the audit", async () => {
    getSessionMock.mockResolvedValue({ id: "admin-1", role: "SYSTEM_ADMIN" });
    matchFindUniqueMock.mockResolvedValue({ id: MATCH_ID, roomId: ROOM_ID, status: "BATTLING", matchNumber: 7 });
    matchUpdateMock.mockResolvedValue({ id: MATCH_ID, status: "CANCELED", endReason: "DISCONNECT" });

    const res = await POST(req({ reason: "DISCONNECT" }), ctx());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.match.status).toBe("CANCELED");

    expect(matchUpdateMock).toHaveBeenCalledTimes(1);
    const updateArg = matchUpdateMock.mock.calls[0][0] as {
      where: { id: string };
      data: { status: string; endReason: string; endedAt: Date };
    };
    expect(updateArg.where).toEqual({ id: MATCH_ID });
    expect(updateArg.data.status).toBe("CANCELED");
    expect(updateArg.data.endReason).toBe("DISCONNECT");
    expect(updateArg.data.endedAt).toBeInstanceOf(Date);

    expect(logAuditMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toBe("MATCH_CANCEL");
  });

  it("falls back to CANCELED for a missing/invalid reason", async () => {
    getSessionMock.mockResolvedValue({ id: "admin-1", role: "SYSTEM_ADMIN" });
    matchFindUniqueMock.mockResolvedValue({ id: MATCH_ID, roomId: ROOM_ID, status: "WAITING", matchNumber: 1 });
    matchUpdateMock.mockResolvedValue({ id: MATCH_ID, status: "CANCELED" });

    await POST(req({ reason: "NOT_A_REAL_REASON" }), ctx());
    const updateArg = matchUpdateMock.mock.calls[0][0] as { data: { endReason: string } };
    expect(updateArg.data.endReason).toBe("CANCELED");
  });
});
