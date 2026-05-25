import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const roomUpdateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isSystemAdmin: (role: string) => role === "SYSTEM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
      update: (...a: unknown[]) => roomUpdateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { DELETE, PATCH } from "./route";

function req(body?: unknown) {
  return { json: async () => body ?? {} } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = { params: Promise.resolve({ id: "room-1" }) };

beforeEach(() => {
  for (const m of [getSessionMock, roomFindUniqueMock, roomUpdateMock, logAuditMock]) m.mockReset();
  roomFindUniqueMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "ROOM-2026-0001", status: "ACTIVE" });
  roomUpdateMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "ROOM-2026-0001", status: "DELETED" });
});

describe("DELETE /api/admin/rooms/:id", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await DELETE(req(), ctx)).status).toBe(401);
  });

  it("403 for a non-system-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await DELETE(req(), ctx)).status).toBe(403);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await DELETE(req(), ctx)).status).toBe(404);
  });

  it("soft-deletes (status → DELETED) and logs ROOM_DELETE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    expect((roomUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("DELETED");
    expect(logAuditMock.mock.calls[0][0]).toBe("ROOM_DELETE");
  });
});

describe("PATCH /api/admin/rooms/:id", () => {
  it("403 for a non-system-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await PATCH(req({ name: "New" }), ctx)).status).toBe(403);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await PATCH(req({ name: "New" }), ctx)).status).toBe(404);
  });

  it("updates fields and logs ROOM_UPDATE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    roomUpdateMock.mockResolvedValue({ id: "room-1", name: "New" });
    const res = await PATCH(req({ name: "New" }), ctx);
    expect(res.status).toBe(200);
    expect((roomUpdateMock.mock.calls[0][0] as { data: { name?: string } }).data.name).toBe("New");
    expect(logAuditMock.mock.calls[0][0]).toBe("ROOM_UPDATE");
  });
});
