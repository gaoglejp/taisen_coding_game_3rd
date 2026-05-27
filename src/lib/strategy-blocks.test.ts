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
      conditions: [{ type: "can_move_forward", value: true }],
      actions: [{ type: "MOVE_FORWARD", ap: 1 }],
    });
    expect(strategy.rules![1]).toEqual({
      conditions: [{ type: "can_move_right", value: true }],
      actions: [{ type: "MOVE_RIGHT", ap: 1 }],
    });
    expect(strategy.fallbackActions).toEqual([{ type: "SHOOT_FORWARD", ap: 1 }]);

    ws.dispose();
  });

  it("defaults fallback to WAIT when the workspace has no fallback block", () => {
    const ws = new Blockly.Workspace();
    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules).toEqual([]);
    expect(strategy.fallbackActions).toEqual([{ type: "WAIT", ap: 0 }]);
    ws.dispose();
  });

  it("maps a check block to a condition and walks the action stack in order", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: { block: { type: "tank_chk_can_move_left" } },
                DO: {
                  block: {
                    type: "tank_act_move_left",
                    next: { block: { type: "tank_act_shoot_forward" } },
                  },
                },
              },
            },
            {
              type: "tank_fallback",
              inputs: { DO: { block: { type: "tank_act_scan_around" } } },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules).toHaveLength(1);
    expect(strategy.rules![0].conditions).toEqual([{ type: "can_move_left", value: true }]);
    expect(strategy.rules![0].actions).toEqual([
      { type: "MOVE_LEFT", ap: 1 },
      { type: "SHOOT_FORWARD", ap: 1 },
    ]);
    expect(strategy.fallbackActions).toEqual([{ type: "SCAN_AROUND", ap: 1 }]);
    ws.dispose();
  });

  it("maps the 敵を検出している？ check to the scan_detected condition", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: { block: { type: "tank_chk_enemy_detected" } },
                DO: { block: { type: "tank_act_shoot_forward" } },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([{ type: "scan_detected", value: true }]);
    expect(strategy.rules![0].actions).toEqual([{ type: "SHOOT_FORWARD", ap: 1 }]);
    ws.dispose();
  });

  it("maps the 前回結果 checks to damaged / shot_hit conditions", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: { block: { type: "tank_chk_took_damage" } },
                DO: { block: { type: "tank_act_move_back" } },
              },
              next: {
                block: {
                  type: "tank_rule",
                  inputs: {
                    COND: { block: { type: "tank_chk_shot_hit" } },
                    DO: { block: { type: "tank_act_shoot_forward" } },
                  },
                },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([{ type: "damaged", value: true }]);
    expect(strategy.rules![1].conditions).toEqual([{ type: "shot_hit", value: true }]);
    ws.dispose();
  });

  it("treats a rule with no condition block as always-matching (empty conditions)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            { type: "tank_rule", inputs: { DO: { block: { type: "tank_act_wait" } } } },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([]);
    expect(strategy.rules![0].actions).toEqual([{ type: "WAIT", ap: 0 }]);
    ws.dispose();
  });

  it("serializes a comparison of a self metric against a number into a compare node", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: {
                  block: {
                    type: "tank_cmp",
                    fields: { OP: "LT" },
                    inputs: {
                      A: { block: { type: "tank_num_self_hp" } },
                      B: { block: { type: "tank_num_turns_left" } },
                    },
                  },
                },
                DO: { block: { type: "tank_act_move_back" } },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([
      { type: "compare", cmp: "LT", left: { type: "self_hp" }, right: { type: "turns_left" } },
    ]);
    ws.dispose();
  });

  it("serializes a direction equality into a compare node (self_facing vs constant)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: {
                  block: {
                    type: "tank_cmp",
                    fields: { OP: "EQ" },
                    inputs: {
                      A: { block: { type: "tank_dir_self_facing" } },
                      B: { block: { type: "tank_dir_east" } },
                    },
                  },
                },
                DO: { block: { type: "tank_act_move_forward" } },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([
      { type: "compare", cmp: "EQ", left: { type: "self_facing" }, right: { type: "dir", dir: "E" } },
    ]);
    ws.dispose();
  });

  it("serializes AND of two checks and a NOT of a constant", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: {
                  block: {
                    type: "tank_logic_op",
                    fields: { OP: "AND" },
                    inputs: {
                      A: { block: { type: "tank_chk_enemy_detected" } },
                      B: {
                        block: {
                          type: "tank_not",
                          inputs: { VAL: { block: { type: "tank_bool", fields: { VAL: "FALSE" } } } },
                        },
                      },
                    },
                  },
                },
                DO: { block: { type: "tank_act_shoot_forward" } },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([
      {
        type: "and",
        args: [
          { type: "scan_detected", value: true },
          { type: "not", arg: { type: "bool", value: false } },
        ],
      },
    ]);
    ws.dispose();
  });

  it("drops a comparison with an empty value socket (returns no condition)", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: {
                  block: {
                    type: "tank_cmp",
                    fields: { OP: "LT" },
                    inputs: { A: { block: { type: "tank_num_self_hp" } } },
                  },
                },
                DO: { block: { type: "tank_act_wait" } },
              },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([]);
    ws.dispose();
  });
});
