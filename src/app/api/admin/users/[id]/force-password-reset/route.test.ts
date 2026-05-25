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

import { POST } from "./route";

const req = () => ({ nextUrl: { origin: "http://localhost:3000" } } as unknown as Parameters<typeof POST>[0]);
const ctx = { params: Promise.resolve({ id: "user-1" }) };

beforeEach(() => {
  for (const m of [getSessionMock, userFindUniqueMock, userUpdateMock, logAuditMock]) m.mockReset();
  userFindUniqueMock.mockResolvedValue({ id: "user-1", username: "bob" });
  userUpdateMock.mockResolvedValue({ id: "user-1" });
});

describe("POST /api/admin/users/:id/force-password-reset", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(401);
  });

  it("403 for a non-system-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await POST(req(), ctx)).status).toBe(403);
  });

  it("404 when the user does not exist", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
  });

  it("clears the password, returns a reset link, and logs the action", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.resetLink).toContain("/auth/reset-password?token=");
    const updateArg = userUpdateMock.mock.calls[0][0] as { data: { passwordHash: null } };
    expect(updateArg.data.passwordHash).toBeNull();
    expect(logAuditMock.mock.calls[0][0]).toBe("USER_FORCE_PASSWORD_RESET");
  });
});
