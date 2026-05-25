import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomCreateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isSystemAdmin: (role: string) => role === "SYSTEM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
      create: (...a: unknown[]) => roomCreateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { POST } from "./route";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  for (const m of [getSessionMock, roomFindFirstMock, roomCreateMock, logAuditMock]) m.mockReset();
  roomFindFirstMock.mockResolvedValue(null); // no prior room → sequence 1
  roomCreateMock.mockResolvedValue({ id: "room-new", name: "X", roomNumber: "ROOM-2026-0001" });
});

describe("POST /api/admin/rooms", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req({ name: "A", kind: "CLASSROOM" }))).status).toBe(401);
  });

  it("403 for a non-system-admin (ROOM_ADMIN is not enough)", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await POST(req({ name: "A", kind: "CLASSROOM" }))).status).toBe(403);
  });

  it("400 when name or kind is missing", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    expect((await POST(req({ name: "A" }))).status).toBe(400);
    expect((await POST(req({ kind: "CLASSROOM" }))).status).toBe(400);
    expect(roomCreateMock).not.toHaveBeenCalled();
  });

  it("400 for an invalid kind", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    expect((await POST(req({ name: "A", kind: "NOPE" }))).status).toBe(400);
    expect(roomCreateMock).not.toHaveBeenCalled();
  });

  it("creates a room and logs ROOM_CREATE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ name: "Class B", kind: "CLASSROOM" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.room.id).toBe("room-new");
    expect(roomCreateMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock.mock.calls[0][0]).toBe("ROOM_CREATE");
  });
});
