import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Strategy } from "@/lib/match-simulator";

const getSessionMock = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSessionMock() }));

import { POST } from "./route";

function request(body: unknown): Parameters<typeof POST>[0] {
  return new Request("http://localhost/api/tutorial/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0];
}

beforeEach(() => {
  getSessionMock.mockReset();
});

describe("POST /api/tutorial/simulate", () => {
  it("401 without a session", async () => {
    getSessionMock.mockResolvedValue(null);

    const res = await POST(request({ missionId: "mission-1", strategy: { fallbackActions: [{ type: "WAIT" }] } }));

    expect(res.status).toBe(401);
  });

  it("runs a mission on its fixed board and returns the evaluation", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });
    const strategy: Strategy = {
      version: "1.0",
      rules: [{ conditions: [], body: [{ kind: "action", type: "MOVE_FORWARD" }] }],
      fallbackBody: [{ kind: "action", type: "WAIT" }],
    };

    const res = await POST(request({ missionId: "mission-1", strategy }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.missionId).toBe("mission-1");
    expect(json.evaluation).toMatchObject({ success: true, messages: [] });
    expect(json.caseResults).toHaveLength(1);
    expect(json.result.turns[0].p1).toMatchObject({ x: 4, y: 7, action: "MOVE_FORWARD" });
  });

  it("400 for an invalid strategy", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });

    const res = await POST(request({ missionId: "mission-1", strategy: { rules: [{ conditions: "bad" }] } }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "invalid_strategy" });
  });

  it("404 for an unknown mission", async () => {
    getSessionMock.mockResolvedValue({ id: "u1", role: "ROOM_USER" });

    const res = await POST(request({ missionId: "missing", strategy: { fallbackActions: [{ type: "WAIT" }] } }));

    expect(res.status).toBe(404);
  });
});
