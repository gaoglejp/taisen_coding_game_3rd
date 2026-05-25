import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const auditFindManyMock = vi.fn();
const userFindManyMock = vi.fn();

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
    auditLog: { findMany: (...a: unknown[]) => auditFindManyMock(...a) },
    user: { findMany: (...a: unknown[]) => userFindManyMock(...a) },
  },
}));

import { GET } from "./route";

function req(qs = "") {
  return { nextUrl: { searchParams: new URLSearchParams(qs) } } as unknown as Parameters<typeof GET>[0];
}
const ctx = { params: Promise.resolve({ id: "room-1" }) };

beforeEach(() => {
  for (const m of [getSessionMock, roomFindFirstMock, roomFindUniqueMock, auditFindManyMock, userFindManyMock]) m.mockReset();
  roomFindFirstMock.mockResolvedValue({ id: "room-1" });
  roomFindUniqueMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "R-1" });
  auditFindManyMock.mockResolvedValue([
    { id: "a1", action: "MEMBER_ISSUE", summary: "issued", actorId: "admin", targetType: "Room", targetId: "room-1", createdAt: new Date() },
  ]);
  userFindManyMock.mockResolvedValue([{ id: "admin", username: "sys", displayName: "管理者" }]);
});

describe("GET /api/admin/rooms/:id/activity", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "GENERAL_USER" });
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it("403 for a ROOM_ADMIN that does not own the room", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    roomFindFirstMock.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it("returns audit-derived activities with resolved actor names", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activities).toHaveLength(1);
    expect(json.activities[0].action).toBe("MEMBER_ISSUE");
    expect(json.activities[0].actorName).toBe("管理者");
    // default limit 12
    expect((auditFindManyMock.mock.calls[0][0] as { take: number }).take).toBe(12);
  });

  it("clamps the limit to 50", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    await GET(req("limit=999"), ctx);
    expect((auditFindManyMock.mock.calls[0][0] as { take: number }).take).toBe(50);
  });
});
