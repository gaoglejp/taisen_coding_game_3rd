import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const roomFindUniqueMock = vi.fn();
const roomFindFirstMock = vi.fn();
const roomMembershipFindFirstMock = vi.fn();
const matchFindManyMock = vi.fn();
const userFindManyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    room: {
      findUnique: (...a: unknown[]) => roomFindUniqueMock(...a),
      findFirst: (...a: unknown[]) => roomFindFirstMock(...a),
    },
    roomMembership: { findFirst: (...a: unknown[]) => roomMembershipFindFirstMock(...a) },
    match: { findMany: (...a: unknown[]) => matchFindManyMock(...a) },
    user: { findMany: (...a: unknown[]) => userFindManyMock(...a) },
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
  userFindManyMock.mockReset();
});

describe("GET /api/rooms/:roomNumber/standings", () => {
  it("401 without session", async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(401);
  });

  it("403 for non-member when ranking is MEMBERS_ONLY", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({ id: "r1", status: "ACTIVE", kind: "CLASSROOM", rankingPublic: "MEMBERS_ONLY" });
    roomMembershipFindFirstMock.mockResolvedValue(null);
    const res = await GET(req(), ctx);
    expect(res.status).toBe(403);
  });

  it("200 for PUBLIC ranking without membership", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "GENERAL_USER" });
    roomFindUniqueMock.mockResolvedValue({ id: "r1", status: "ACTIVE", kind: "CLASSROOM", rankingPublic: "PUBLIC" });
    matchFindManyMock.mockResolvedValue([
      { player1Id: "p1", player2Id: "p2", winnerId: "p1" },
      { player1Id: "p1", player2Id: "p2", winnerId: null },
    ]);
    userFindManyMock.mockResolvedValue([
      { id: "p1", username: "alice", displayName: "Alice" },
      { id: "p2", username: "bob", displayName: "Bob" },
    ]);

    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.total).toBe(2);
    expect(json.standings[0]).toMatchObject({ userId: "p1", wins: 1, draws: 1, points: 4, rank: 1 });
    expect(json.standings[1]).toMatchObject({ userId: "p2", losses: 1, draws: 1, points: 1, rank: 2 });
  });
});
