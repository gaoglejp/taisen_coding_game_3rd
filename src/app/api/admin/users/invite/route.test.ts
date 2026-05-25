import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const userFindUniqueMock = vi.fn();
const userCreateMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
  isSystemAdmin: (role: string) => role === "SYSTEM_ADMIN",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => userFindUniqueMock(...a),
      create: (...a: unknown[]) => userCreateMock(...a),
    },
  },
}));

vi.mock("@/lib/audit", () => ({ logAudit: (...a: unknown[]) => logAuditMock(...a) }));

import { POST } from "./route";

function req(body: unknown) {
  return { json: async () => body, nextUrl: { origin: "http://localhost:3000" } } as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
  for (const m of [getSessionMock, userFindUniqueMock, userCreateMock, logAuditMock]) m.mockReset();
  userFindUniqueMock.mockResolvedValue(null);
  userCreateMock.mockResolvedValue({ id: "user-new" });
});

describe("POST /api/admin/users/invite", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await POST(req({ email: "a@b.com" }))).status).toBe(401);
  });

  it("403 for a non-system-admin", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "ROOM_ADMIN" });
    expect((await POST(req({ email: "a@b.com" }))).status).toBe(403);
  });

  it("400 when email is missing", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    expect((await POST(req({}))).status).toBe(400);
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("409 when the email already exists", async () => {
    getSessionMock.mockResolvedValue({ id: "u", role: "SYSTEM_ADMIN" });
    userFindUniqueMock.mockResolvedValue({ id: "existing" });
    expect((await POST(req({ email: "a@b.com" }))).status).toBe(409);
    expect(userCreateMock).not.toHaveBeenCalled();
  });

  it("creates a PENDING user and returns an invite link", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    const res = await POST(req({ email: "a@b.com", role: "ROOM_ADMIN" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inviteLink).toContain("/auth/invite?token=");
    expect(json.userId).toBe("user-new");
    const createArg = userCreateMock.mock.calls[0][0] as { data: { status: string; role: string } };
    expect(createArg.data.status).toBe("PENDING");
    expect(createArg.data.role).toBe("ROOM_ADMIN");
    expect(logAuditMock.mock.calls[0][0]).toBe("USER_INVITE");
  });
});
