import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userCreateMock = vi.fn();
const membershipCreateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isAdmin: (role: string) => role === "SYSTEM_ADMIN" || role === "ROOM_ADMIN",
  isSystemAdmin: (role: string) => role === "SYSTEM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      create: (...a: unknown[]) => userCreateMock(...a),
    },
    roomMembership: { create: (...a: unknown[]) => membershipCreateMock(...a) },
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
  for (const m of [getSessionMock, roomFindFirstMock, roomFindUniqueMock, userFindUniqueMock, userCreateMock, membershipCreateMock, logAuditMock]) m.mockReset();
  roomFindUniqueMock.mockResolvedValue({ id: ROOM_ID, name: "Room" });
  userFindUniqueMock.mockResolvedValue(null); // username/email available
  userCreateMock.mockResolvedValue({ id: "user-new" });
  membershipCreateMock.mockResolvedValue({ id: "mem-new" });
});

describe("POST /api/admin/rooms/:id/members", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req({ displayName: "A" }), ctx)).status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_USER" });
    expect((await POST(req({ displayName: "A" }), ctx)).status).toBe(403);
  });

  it("403 for a ROOM_ADMIN that does not own the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    roomFindFirstMock.mockResolvedValue(null);
    expect((await POST(req({ displayName: "A" }), ctx)).status).toBe(403);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await POST(req({ displayName: "A" }), ctx)).status).toBe(404);
  });

  it("400 for a single issue with no displayName", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    expect((await POST(req({}), ctx)).status).toBe(400);
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("single issue creates a user + membership and returns a code", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ displayName: "Alice", username: "alice" }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.issueCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(userCreateMock).toHaveBeenCalledTimes(1);
    expect(membershipCreateMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toBe("MEMBER_ISSUE");
  });

  it("bulk issue creates one membership per row", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ members: [
      { displayName: "A", username: "a1" },
      { displayName: "B", username: "b1" },
    ] }), ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.members).toHaveLength(2);
    expect(membershipCreateMock).toHaveBeenCalledTimes(2);
  });
});
