import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const membershipFindFirstMock = vi.fn();
const membershipUpdateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isAdmin: (role: string) => role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: { findFirst: (...a: unknown[]) => roomFindFirstMock(...a) },
    roomMembership: {
      findFirst: (...a: unknown[]) => membershipFindFirstMock(...a),
      update: (...a: unknown[]) => membershipUpdateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { PATCH } from "./route";

const ROOM_ID = "room-1";
const MID = "mem-1";
function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = { params: Promise.resolve({ id: ROOM_ID, mid: MID }) };

beforeEach(() => {
  for (const m of [getSessionMock, roomFindFirstMock, membershipFindFirstMock, membershipUpdateMock, logAuditMock]) m.mockReset();
  membershipFindFirstMock.mockResolvedValue({ id: MID, roomId: ROOM_ID, user: { username: "bob", displayName: "Bob" } });
  membershipUpdateMock.mockResolvedValue({ id: MID, status: "DISABLED" });
});

describe("PATCH /api/admin/rooms/:id/members/:mid", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await PATCH(req({ status: "DISABLED" }), ctx)).status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "GENERAL_USER" });
    expect((await PATCH(req({ status: "DISABLED" }), ctx)).status).toBe(403);
  });

  it("403 for a ROOM_ADMIN that does not own the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    roomFindFirstMock.mockResolvedValue(null);
    expect((await PATCH(req({ status: "DISABLED" }), ctx)).status).toBe(403);
    expect(membershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("404 when the membership is not in the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    membershipFindFirstMock.mockResolvedValue(null);
    expect((await PATCH(req({ status: "DISABLED" }), ctx)).status).toBe(404);
  });

  it("disables a member and logs MEMBER_DISABLE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await PATCH(req({ status: "DISABLED" }), ctx);
    expect(res.status).toBe(200);
    expect((membershipUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("DISABLED");
    expect(logAuditMock.mock.calls[0][0]).toBe("MEMBER_DISABLE");
  });
});
