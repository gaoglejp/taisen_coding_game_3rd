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

import { POST } from "./route";

function req(pathname: string) {
  return { nextUrl: { pathname } } as unknown as Parameters<typeof POST>[0];
}
const ctx = { params: Promise.resolve({ id: "room-1" }) };
const ARCHIVE_PATH = "/api/admin/rooms/room-1/archive";

beforeEach(() => {
  for (const m of [getSessionMock, roomFindUniqueMock, roomUpdateMock, logAuditMock]) m.mockReset();
  roomFindUniqueMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "R-1", status: "ACTIVE" });
  roomUpdateMock.mockResolvedValue({ id: "room-1", name: "Room", roomNumber: "R-1", status: "ARCHIVED" });
});

describe("POST /api/admin/rooms/:id/archive", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req(ARCHIVE_PATH), ctx)).status).toBe(401);
  });

  it("403 for a non-system-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await POST(req(ARCHIVE_PATH), ctx)).status).toBe(403);
  });

  it("404 when the room does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue(null);
    expect((await POST(req(ARCHIVE_PATH), ctx)).status).toBe(404);
  });

  it("archives (status → ARCHIVED) and logs ROOM_ARCHIVE on the archive path", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req(ARCHIVE_PATH), ctx);
    expect(res.status).toBe(200);
    expect((roomUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("ARCHIVED");
    expect(logAuditMock.mock.calls[0][0]).toBe("ROOM_ARCHIVE");
  });

  it("restores (status → ACTIVE) and logs ROOM_RESTORE when the path ends in /restore", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req("/api/admin/rooms/room-1/restore"), ctx);
    expect(res.status).toBe(200);
    expect((roomUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("ACTIVE");
    expect(logAuditMock.mock.calls[0][0]).toBe("ROOM_RESTORE");
  });
});
