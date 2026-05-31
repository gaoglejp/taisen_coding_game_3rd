// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from "vitest";
import * as Blockly from "blockly";
import {
  createStrategyToolbox,
  defineStrategyBlocks,
  DEFAULT_WORKSPACE_STATE,
  STRATEGY_TOOLBOX,
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
      body: [{ kind: "action", type: "MOVE_FORWARD" }],
    });
    expect(strategy.rules![1]).toEqual({
      conditions: [{ type: "can_move_right", value: true }],
      body: [{ kind: "action", type: "MOVE_RIGHT" }],
    });
    expect(strategy.fallbackBody).toEqual([{ kind: "action", type: "WAIT" }]);

    ws.dispose();
  });

  it("does not expose the fallback block in the toolbox", () => {
    const toolboxText = JSON.stringify(STRATEGY_TOOLBOX);
    expect(toolboxText).not.toContain("tank_fallback");
    expect(toolboxText).not.toContain("フォールバック");
  });

  it("exposes the conditionless rule block in the rule toolbox category", () => {
    const toolboxText = JSON.stringify(STRATEGY_TOOLBOX);
    expect(toolboxText).toContain("tank_rule");
    expect(toolboxText).toContain("tank_rule_always");
  });

  it("can restrict the toolbox by category and block type", () => {
    const toolbox = createStrategyToolbox({
      allowedCategories: ["行動", "ルール"],
      allowedBlockTypes: ["tank_act_move_forward", "tank_rule_always"],
    });
    const toolboxText = JSON.stringify(toolbox);

    expect(toolbox.contents.map((category) => category.name)).toEqual(["行動", "ルール"]);
    expect(toolboxText).toContain("tank_act_move_forward");
    expect(toolboxText).toContain("tank_rule_always");
    expect(toolboxText).not.toContain("tank_act_shoot_forward");
    expect(toolboxText).not.toContain("tank_rule\"");
  });

  it("defaults fallback to WAIT when the workspace has no fallback block", () => {
    const ws = new Blockly.Workspace();
    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules).toEqual([]);
    expect(strategy.fallbackBody).toEqual([{ kind: "action", type: "WAIT" }]);
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
    expect(strategy.rules![0].body).toEqual([
      { kind: "action", type: "MOVE_LEFT" },
      { kind: "action", type: "SHOOT_FORWARD" },
    ]);
    expect(strategy.fallbackBody).toEqual([{ kind: "action", type: "SCAN_AROUND" }]);
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
    expect(strategy.rules![0].body).toEqual([{ kind: "action", type: "SHOOT_FORWARD" }]);
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
    expect(strategy.rules![0].body).toEqual([{ kind: "action", type: "WAIT" }]);
    ws.dispose();
  });

  it("serializes the conditionless rule block as an always-matching rule", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule_always",
              inputs: { DO: { block: { type: "tank_act_move_forward" } } },
            },
          ],
        },
      },
      ws
    );

    const strategy = workspaceToStrategy(ws);
    expect(strategy.rules![0].conditions).toEqual([]);
    expect(strategy.rules![0].body).toEqual([{ kind: "action", type: "MOVE_FORWARD" }]);
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

  it("serializes a number literal into a compare's right operand", () => {
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
                      B: { block: { type: "tank_num_literal", fields: { NUM: 30 } } },
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
      { type: "compare", cmp: "LT", left: { type: "self_hp" }, right: { type: "num", value: 30 } },
    ]);
    ws.dispose();
  });

  it("serializes a variable-set statement (with an arithmetic value) into the rule body", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        variables: [{ name: "count", id: "v1" }],
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: { block: { type: "tank_bool", fields: { VAL: "TRUE" } } },
                DO: {
                  block: {
                    type: "tank_var_set",
                    fields: { VAR: { id: "v1" } },
                    inputs: {
                      VALUE: {
                        block: {
                          type: "tank_arith",
                          fields: { OP: "ADD" },
                          inputs: {
                            A: { block: { type: "tank_var_get", fields: { VAR: { id: "v1" } } } },
                            B: { block: { type: "tank_num_literal", fields: { NUM: 1 } } },
                          },
                        },
                      },
                    },
                    next: { block: { type: "tank_act_scan_around" } },
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
    expect(strategy.rules![0].body).toEqual([
      {
        kind: "set",
        name: "count",
        value: {
          type: "arith",
          op: "ADD",
          left: { type: "var", name: "count" },
          right: { type: "num", value: 1 },
        },
      },
      { kind: "action", type: "SCAN_AROUND" },
    ]);
    ws.dispose();
  });

  it("serializes a nested もし block into an if clause in the rule body", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                COND: { block: { type: "tank_chk_can_move_forward" } },
                DO: {
                  block: {
                    type: "tank_ctl_if",
                    inputs: {
                      IF0: { block: { type: "tank_chk_enemy_detected" } },
                      DO0: { block: { type: "tank_act_shoot_forward" } },
                    },
                    next: { block: { type: "tank_act_move_forward" } },
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
    expect(strategy.rules![0].body).toEqual([
      {
        kind: "if",
        clauses: [
          { cond: { type: "scan_detected", value: true }, body: [{ kind: "action", type: "SHOOT_FORWARD" }] },
        ],
      },
      { kind: "action", type: "MOVE_FORWARD" },
    ]);
    ws.dispose();
  });

  it("serializes a もし block with an else-if and an else branch", () => {
    const ws = new Blockly.Workspace();
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: "tank_rule",
              inputs: {
                DO: {
                  block: {
                    type: "tank_ctl_if",
                    extraState: { elseIfCount: 1, hasElse: true },
                    inputs: {
                      IF0: { block: { type: "tank_chk_enemy_detected" } },
                      DO0: { block: { type: "tank_act_shoot_forward" } },
                      IF1: { block: { type: "tank_chk_can_move_forward" } },
                      DO1: { block: { type: "tank_act_move_forward" } },
                      ELSE: { block: { type: "tank_act_scan_around" } },
                    },
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
    expect(strategy.rules![0].body).toEqual([
      {
        kind: "if",
        clauses: [
          { cond: { type: "scan_detected", value: true }, body: [{ kind: "action", type: "SHOOT_FORWARD" }] },
          { cond: { type: "can_move_forward", value: true }, body: [{ kind: "action", type: "MOVE_FORWARD" }] },
        ],
        else: [{ kind: "action", type: "SCAN_AROUND" }],
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
