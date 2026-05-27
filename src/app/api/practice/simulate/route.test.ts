import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Strategy } from "@/lib/match-simulator";

const getSessionMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));

import { POST } from "./route";

const validStrategy: Strategy = {
  version: "1.0",
  rules: [{ conditions: [{ type: "can_move_forward", value: true }], actions: [{ type: "MOVE_FORWARD", ap: 1 }] }],
  fallbackActions: [{ type: "SHOOT_FORWARD", ap: 1 }],
};

function request(body: unknown): Parameters<typeof POST>[0] {
  return new Request("http://localhost/api/practice/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("POST /api/practice/simulate", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const res = await POST(request({ strategy: validStrategy }));

    expect(res.status).toBe(401);
  });

  it("simulates a valid strategy against a bot", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });

    const res = await POST(request({ strategy: validStrategy, difficulty: "normal" }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.bot).toEqual({ difficulty: "normal", name: "巡回ボット" });
    expect(json.result.turns.length).toBeGreaterThan(0);
    expect(["p1", "p2", null]).toContain(json.result.winner);
    expect(json.result).toMatchObject({
      finalHp: { p1: expect.any(Number), p2: expect.any(Number) },
      totalTurns: expect.any(Number),
    });
  });

  it("400 for an invalid strategy body", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });

    const res = await POST(request({ strategy: { rules: [{ conditions: "bad" }] } }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_strategy" });
  });
});
