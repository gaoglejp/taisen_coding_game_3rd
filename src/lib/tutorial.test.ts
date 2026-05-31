import { describe, expect, it } from "vitest";
import { simulate, type Strategy } from "@/lib/match-simulator";
import {
  evaluateTutorialCase,
  getTutorialMission,
  summarizeTutorialEvaluation,
  type TutorialMissionId,
} from "@/lib/tutorial";

const waitOnly: Strategy = {
  version: "1.0",
  rules: [],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const alwaysForward: Strategy = {
  version: "1.0",
  rules: [{ conditions: [], body: [{ kind: "action", type: "MOVE_FORWARD" }] }],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const scanOnly: Strategy = {
  version: "1.0",
  rules: [{ conditions: [], body: [{ kind: "action", type: "SCAN_AROUND" }] }],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const chooseOpenPath: Strategy = {
  version: "1.0",
  rules: [
    {
      conditions: [{ type: "can_move_forward", value: true }],
      body: [{ kind: "action", type: "MOVE_FORWARD" }],
    },
    {
      conditions: [{ type: "not", arg: { type: "can_move_forward", value: true } }],
      body: [{ kind: "action", type: "MOVE_RIGHT" }],
    },
  ],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const scanThenShootForward: Strategy = {
  version: "1.0",
  rules: [
    {
      conditions: [{ type: "not", arg: { type: "scan_detected", value: true } }],
      body: [{ kind: "action", type: "SCAN_AROUND" }],
    },
    {
      conditions: [{ type: "scan_detected", value: true }],
      body: [{ kind: "action", type: "SHOOT_FORWARD" }],
    },
  ],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const scanThenShootByDirection: Strategy = {
  version: "1.0",
  rules: [
    {
      conditions: [{ type: "not", arg: { type: "scan_detected", value: true } }],
      body: [{ kind: "action", type: "SCAN_AROUND" }],
    },
    {
      conditions: [
        {
          type: "and",
          args: [
            {
              type: "compare",
              cmp: "GT",
              left: { type: "enemy_forward_distance" },
              right: { type: "num", value: 0 },
            },
            {
              type: "compare",
              cmp: "EQ",
              left: { type: "enemy_right_distance" },
              right: { type: "num", value: 0 },
            },
          ],
        },
      ],
      body: [{ kind: "action", type: "SHOOT_FORWARD" }],
    },
    {
      conditions: [
        {
          type: "and",
          args: [
            {
              type: "compare",
              cmp: "GT",
              left: { type: "enemy_right_distance" },
              right: { type: "num", value: 0 },
            },
            {
              type: "compare",
              cmp: "EQ",
              left: { type: "enemy_forward_distance" },
              right: { type: "num", value: 0 },
            },
          ],
        },
      ],
      body: [{ kind: "action", type: "SHOOT_RIGHT" }],
    },
  ],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

function runMission(missionId: TutorialMissionId, strategy: Strategy) {
  const mission = getTutorialMission(missionId);
  if (!mission) throw new Error(`missing mission ${missionId}`);
  const cases = mission.verificationCases.map((testCase) => {
    const result = simulate(strategy, testCase.enemyStrategy, {
      maxTurns: testCase.maxTurns,
      playerInitialState: testCase.playerInitialState,
      enemyInitialState: testCase.enemyInitialState,
      obstaclePositions: testCase.obstaclePositions,
    });
    return evaluateTutorialCase(testCase, result);
  });
  return summarizeTutorialEvaluation(cases);
}

describe("tutorial mission evaluation", () => {
  it("clears mission 1 only when the tank reaches the forward goal", () => {
    expect(runMission("mission-1", alwaysForward).success).toBe(true);
    expect(runMission("mission-1", waitOnly).success).toBe(false);
  });

  it("clears mission 2 only when both open and blocked-front cases pass", () => {
    const clear = runMission("mission-2", chooseOpenPath);
    expect(clear.success).toBe(true);
    expect(clear.cases.map((testCase) => testCase.success)).toEqual([true, true]);

    const forwardOnly = runMission("mission-2", alwaysForward);
    expect(forwardOnly.success).toBe(false);
    expect(forwardOnly.cases.map((testCase) => testCase.success)).toEqual([true, false]);
  });

  it("clears mission 3 only after scan detects the enemy", () => {
    expect(runMission("mission-3", scanOnly).success).toBe(true);
    expect(runMission("mission-3", waitOnly).success).toBe(false);
  });

  it("clears mission 4 only when forward and right enemy cases are both destroyed", () => {
    const clear = runMission("mission-4", scanThenShootByDirection);
    expect(clear.success).toBe(true);
    expect(clear.cases.map((testCase) => testCase.success)).toEqual([true, true]);

    const forwardOnly = runMission("mission-4", scanThenShootForward);
    expect(forwardOnly.success).toBe(false);
    expect(forwardOnly.cases.map((testCase) => testCase.success)).toEqual([true, false]);
  });
});
