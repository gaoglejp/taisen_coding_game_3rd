// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import * as Blockly from "blockly";
import {
  defineStrategyBlocks,
  DEFAULT_WORKSPACE_STATE,
  workspaceToStrategy,
} from "./strategy-blocks";

describe("workspaceToStrategy", () => {
  beforeAll(() => {
    defineStrategyBlocks();
  });

  it("serializes the default workspace into the strategy the simulator expects", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(DEFAULT_WORKSPACE_STATE, ws);

    const strategy = workspaceToStrategy(ws);

    expect(strategy.version).toBe("1.0");
    expect(strategy.rules).toHaveLength(2);
    expect(strategy.rules![0]).toEqual({
      conditions: [{ type: "scan_detected", value: true }],
      actions: [{ type: "SHOOT_FORWARD", ap: 1 }],
    });
    expect(strategy.rules![1]).toEqual({
      conditions: [],
      actions: [{ type: "MOVE_FORWARD", ap: 1 }],
    });
    expect(strategy.fallbackActions).toEqual([{ type: "WAIT", ap: 0 }]);

    ws.dispose();
  });

  it("defaults fallback to WAIT when the workspace has no fallback block", () => {
    const ws = new Blockly.Workspace();
    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules).toEqual([]);
    expect(strategy.fallbackActions).toEqual([{ type: "WAIT", ap: 0 }]);
    ws.dispose();
  });

  it("AND-chains multiple conditions and respects rule order", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              fields: { ACTION: "TURN_LEFT" },
              inputs: {
                CONDITIONS: {
                  block: {
                    type: "tank_condition",
                    fields: { COND: "damaged", VAL: "true" },
                    next: {
                      block: {
                        type: "tank_condition",
                        fields: { COND: "moved", VAL: "false" },
                      },
                    },
                  },
                },
              },
            },
            { type: "tank_fallback", fields: { ACTION: "SCAN" } },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules).toHaveLength(1);
    expect(strategy.rules![0].conditions).toEqual([
      { type: "damaged", value: true },
      { type: "moved", value: false },
    ]);
    expect(strategy.rules![0].actions).toEqual([{ type: "TURN_LEFT", ap: 1 }]);
    expect(strategy.fallbackActions).toEqual([{ type: "SCAN", ap: 1 }]);
    ws.dispose();
  });
});
