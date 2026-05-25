import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomMembershipFindFirstMock = vi.fn();
const matchFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
    },
    roomMembership: { findFirst: (...a: unknown[]) => roomMembershipFindFirstMock(...a) },
    match: { findMany: (...a: unknown[]) => matchFindManyMock(...a) },
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
  matchFindManyMock.mockReset();
});

describe("GET /api/rooms/:roomNumber/matches", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
  });

  it("403 for non-member on non-public room", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({ id: "r1", status: "ACTIVE", kind: "CLASSROOM", watchingPublic: "MEMBERS_ONLY" });
    roomMembershipFindFirstMock.mockResolvedValue(null);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(403);
  });

  it("200 for room admin of room", async () => {
    getSessionMock.mockResolvedValue({ id: "ra1", role: "ROOM_ADMIN" });
    roomFindUniqueMock.mockResolvedValue({ id: "r1", status: "ACTIVE", kind: "CLASSROOM", watchingPublic: "MEMBERS_ONLY" });
    roomFindFirstMock.mockResolvedValue({ id: "r1" });
    matchFindManyMock.mockResolvedValue([{ id: "m1", matchNumber: 1 }]);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.matches).toHaveLength(1);
  });
});
