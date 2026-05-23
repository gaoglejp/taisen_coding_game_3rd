import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRole } from "@prisma/client";

// getSession reaches out to next/headers cookies() and the Prisma client, so
// both are mocked. The pure helpers (createSessionToken / isAdmin /
// isSystemAdmin) need no mocking.
const cookiesMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("./db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
    },
  },
}));

import { getSession, createSessionToken, isAdmin, isSystemAdmin } from "./auth";

function mockCookie(token: string | undefined) {
  cookiesMock.mockResolvedValue({
    get: (name: string) => (name === "session" && token !== undefined ? { value: token } : undefined),
  });
}

beforeEach(() => {
  cookiesMock.mockReset();
  findUniqueMock.mockReset();
});

describe("createSessionToken", () => {
  it("encodes the user id so getSession's decode recovers it", () => {
    const token = createSessionToken("user-123");
    const decoded = Buffer.from(token, "base64").toString();
    const [userId] = decoded.split(":");
    expect(userId).toBe("user-123");
  });

  it("includes a timestamp segment", () => {
    const token = createSessionToken("u1");
    const [, ts] = Buffer.from(token, "base64").toString().split(":");
    expect(Number(ts)).toBeGreaterThan(0);
  });

  it("produces distinct tokens for different users", () => {
    expect(createSessionToken("a")).not.toBe(createSessionToken("b"));
  });
});

describe("isAdmin", () => {
  it.each([
    ["SYSTEM_ADMIN", true],
    ["ROOM_ADMIN", true],
    ["GENERAL_USER", false],
    ["ROOM_USER", false],
  ] as [UserRole, boolean][])("%s → %s", (role, expected) => {
    expect(isAdmin(role)).toBe(expected);
  });
});

describe("isSystemAdmin", () => {
  it.each([
    ["SYSTEM_ADMIN", true],
    ["ROOM_ADMIN", false],
    ["GENERAL_USER", false],
    ["ROOM_USER", false],
  ] as [UserRole, boolean][])("%s → %s", (role, expected) => {
    expect(isSystemAdmin(role)).toBe(expected);
  });
});

describe("getSession", () => {
  it("returns null when no session cookie is present", async () => {
    mockCookie(undefined);
    expect(await getSession()).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("returns the active user for a valid token", async () => {
    const user = {
      id: "user-123",
      username: "taro",
      displayName: "たろう",
      email: null,
      role: "ROOM_USER" as UserRole,
    };
    mockCookie(createSessionToken("user-123"));
    findUniqueMock.mockResolvedValue(user);

    const result = await getSession();
    expect(result).toEqual(user);
    // Decoded user id must drive the lookup, scoped to ACTIVE status.
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-123", status: "ACTIVE" } })
    );
  });

  it("returns null when the user is not found (e.g. disabled)", async () => {
    mockCookie(createSessionToken("ghost"));
    findUniqueMock.mockResolvedValue(null);
    expect(await getSession()).toBeNull();
  });

  it("returns null and swallows the error when the lookup throws", async () => {
    mockCookie(createSessionToken("user-123"));
    findUniqueMock.mockRejectedValue(new Error("db down"));
    expect(await getSession()).toBeNull();
  });
});
