import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomMembershipFindFirstMock = vi.fn();

vi.mock("@/lib/auth", () => ({
  getSession: () => getSessionMock(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
    },
    roomMembership: {
      findFirst: (...a: unknown[]) => roomMembershipFindFirstMock(...a),
    },
  },
}));

import { GET } from "./route";

const ctx = { params: Promise.resolve({ roomNumber: "ROOM-1" }) };
function req() {
  return {} as unknown as Parameters<typeof GET>[0];
}

beforeEach(() => {
  getSessionMock.mockReset();
  roomFindUniqueMock.mockReset();
  roomFindFirstMock.mockReset();
  roomMembershipFindFirstMock.mockReset();
});

describe("GET /api/rooms/:roomNumber", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
  });

  it("404 when room status is DELETED", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({ status: "DELETED" });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(404);
  });

  it("403 for non-member on non-public room", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({ id: "r1", status: "ACTIVE", kind: "CLASSROOM" });
    roomMembershipFindFirstMock.mockResolvedValue(null);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(403);
  });

  it("200 for active member", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });
    roomFindUniqueMock.mockResolvedValue({
      id: "r1",
      roomNumber: "ROOM-1",
      name: "Room 1",
      description: "desc",
      kind: "CLASSROOM",
      status: "ACTIVE",
      expiresAt: null,
      watchingPublic: "MEMBERS_ONLY",
      rankingPublic: "MEMBERS_ONLY",
      replayShareEnabled: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      _count: { memberships: 2, matches: 8 },
    });
    roomMembershipFindFirstMock.mockResolvedValue({ id: "m1" });

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.room.activeMemberCount).toBe(2);
    expect(json.room.totalMatches).toBe(8);
  });

  it("200 for public lobby without membership", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({
      id: "r1",
      roomNumber: "ROOM-1",
      name: "Public",
      description: null,
      kind: "PUBLIC_LOBBY",
      status: "ACTIVE",
      expiresAt: null,
      watchingPublic: "PUBLIC",
      rankingPublic: "PUBLIC",
      replayShareEnabled: true,
      createdAt: new Date(),
      _count: { memberships: 0, matches: 1 },
    });

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(roomMembershipFindFirstMock).not.toHaveBeenCalled();
  });

  it("200 for system admin", async () => {
    getSessionMock.mockResolvedValue({ id: "admin", role: "SYSTEM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue({
      id: "r1",
      roomNumber: "ROOM-1",
      name: "Room",
      description: null,
      kind: "CLASSROOM",
      status: "ACTIVE",
      expiresAt: null,
      watchingPublic: "MEMBERS_ONLY",
      rankingPublic: "MEMBERS_ONLY",
      replayShareEnabled: true,
      createdAt: new Date(),
      _count: { memberships: 1, matches: 1 },
    });

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    expect(roomMembershipFindFirstMock).not.toHaveBeenCalled();
  });
});
