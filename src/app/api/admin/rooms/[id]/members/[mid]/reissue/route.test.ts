import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const membershipFindFirstMock = vi.fn();
const membershipUpdateMock = vi.fn();
const userUpdateMock = vi.fn();
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
    user: { update: (...a: unknown[]) => userUpdateMock(...a) },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { POST } from "./route";

const ROOM_ID = "room-1";
const MID = "mem-1";
const ctx = { params: Promise.resolve({ id: ROOM_ID, mid: MID }) };
const req = () => ({} as unknown as Parameters<typeof POST>[0]);

beforeEach(() => {
  for (const m of [getSessionMock, roomFindFirstMock, membershipFindFirstMock, membershipUpdateMock, userUpdateMock, logAuditMock]) m.mockReset();
  membershipFindFirstMock.mockResolvedValue({ id: MID, roomId: ROOM_ID, userId: "user-1", user: { username: "bob", displayName: "Bob" } });
  membershipUpdateMock.mockResolvedValue({ id: MID });
  userUpdateMock.mockResolvedValue({ id: "user-1" });
});

describe("POST /api/admin/rooms/:id/members/:mid/reissue", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("404 when the membership is not in the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    membershipFindFirstMock.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("reissues a fresh code, resets the user to PENDING, and logs MEMBER_REISSUE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.issueCode).toMatch(/^[A-Z0-9]{8}$/);
    // new code stored + code marked unused
    const updateArg = membershipUpdateMock.mock.calls[0][0] as { data: { issueCode: string; issueCodeUsed: boolean } };
    expect(updateArg.data.issueCodeUsed).toBe(false);
    // linked user reset to PENDING
    expect((userUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("PENDING");
    expect(logAuditMock.mock.calls[0][0]).toBe("MEMBER_REISSUE");
  });
});
