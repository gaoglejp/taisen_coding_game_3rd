import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userUpdateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isSystemAdmin: (role: string) => role === "SYSTEM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      update: (...a: unknown[]) => userUpdateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { PATCH } from "./route";

function req(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}
const ctx = (id = "u2") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  getSessionMock.mockReset();
  userFindUniqueMock.mockReset();
  userUpdateMock.mockReset();
  logAuditMock.mockReset();
  userUpdateMock.mockResolvedValue({ id: "u2", username: "bob", status: "DISABLED" });
});

describe("PATCH /api/admin/users/:id", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await PATCH(req({ status: "DISABLED" }), ctx())).status).toBe(401);
  });

  it("403 for a non-system-admin (ROOM_ADMIN is not enough)", async () => {
    getSessionMock.mockResolvedValue({ id: "a", role: "ROOM_ADMIN" });
    expect((await PATCH(req({ status: "DISABLED" }), ctx())).status).toBe(403);
  });

  it("404 when the target user does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "a", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue(null);
    expect((await PATCH(req({ status: "DISABLED" }), ctx())).status).toBe(404);
  });

  it("400 when an admin tries to change their own account", async () => {
    getSessionMock.mockResolvedValue({ id: "self", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue({ id: "self", username: "me", status: "ACTIVE" });
    const res = await PATCH(req({ status: "DISABLED" }), ctx("self"));
    expect(res.status).toBe(400);
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("disables a user and logs USER_DISABLE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue({ id: "u2", username: "bob", status: "ACTIVE" });
    const res = await PATCH(req({ status: "DISABLED" }), ctx());
    expect(res.status).toBe(200);
    expect((userUpdateMock.mock.calls[0][0] as { data: { status: string } }).data.status).toBe("DISABLED");
    expect(logAuditMock.mock.calls[0][0]).toBe("USER_DISABLE");
  });

  it("re-enabling a disabled user logs USER_ENABLE", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue({ id: "u2", username: "bob", status: "DISABLED" });
    await PATCH(req({ status: "ACTIVE" }), ctx());
    expect(logAuditMock.mock.calls[0][0]).toBe("USER_ENABLE");
  });

  it("does not log an audit when no status change is requested", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue({ id: "u2", username: "bob", status: "ACTIVE" });
    await PATCH(req({ displayName: "New Name" }), ctx());
    expect(userUpdateMock).toHaveBeenCalledTimes(1);
    expect(logAuditMock).not.toHaveBeenCalled();
  });
});
