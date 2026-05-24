import * as Blockly from "blockly";
import type { Strategy } from "@/lib/match-simulator";

// Domain vocabulary the simulator understands (see src/lib/match-simulator.ts).
// Conditions are boolean checks against per-turn perception; actions are the
// six tank verbs. Anything outside these sets makes the simulator fall through.
export const CONDITION_OPTIONS: [string, string][] = [
  ["敵を発見", "scan_detected"],
  ["ダメージを受けた", "damaged"],
  ["移動した", "moved"],
];

export const ACTION_OPTIONS: [string, string][] = [
  ["前進", "MOVE_FORWARD"],
  ["左回転", "TURN_LEFT"],
  ["右回転", "TURN_RIGHT"],
  ["前方へ射撃", "SHOOT_FORWARD"],
  ["スキャン", "SCAN"],
  ["待機", "WAIT"],
];

const BLOCK_DEFINITIONS = [
  {
    type: "tank_condition",
    message0: "条件 %1 = %2",
    args0: [
      { type: "field_dropdown", name: "COND", options: CONDITION_OPTIONS },
      {
        type: "field_dropdown",
        name: "VAL",
        options: [
          ["true", "true"],
          ["false", "false"],
        ],
      },
    ],
    previousStatement: "Condition",
    nextStatement: "Condition",
    colour: 200,
    tooltip: "ルールの条件。同じルール内の条件はすべて満たされる必要があります (AND)。",
    helpUrl: "",
  },
  {
    type: "tank_rule",
    message0: "ルール",
    message1: "条件 (すべて満たす) %1",
    args1: [{ type: "input_statement", name: "CONDITIONS", check: "Condition" }],
    message2: "→ アクション %1",
    args2: [{ type: "field_dropdown", name: "ACTION", options: ACTION_OPTIONS }],
    previousStatement: "Rule",
    nextStatement: "Rule",
    colour: 230,
    tooltip: "条件をすべて満たすとき、指定したアクションを実行します。上のルールから順に評価され、最初に一致したルールが採用されます。",
    helpUrl: "",
  },
  {
    type: "tank_fallback",
    message0: "フォールバック → アクション %1",
    args0: [{ type: "field_dropdown", name: "ACTION", options: ACTION_OPTIONS }],
    colour: 290,
    tooltip: "どのルールにも一致しなかったときに実行するアクション。",
    helpUrl: "",
  },
] as const;

let defined = false;

/** Registers the tank-strategy blocks. Safe to call more than once. */
export function defineStrategyBlocks(): void {
  if (defined) return;
  Blockly.defineBlocksWithJsonArray(BLOCK_DEFINITIONS as unknown as object[]);
  defined = true;
}

export const STRATEGY_TOOLBOX = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "ルール",
      colour: "230",
      contents: [{ kind: "block", type: "tank_rule" }],
    },
    {
      kind: "category",
      name: "条件",
      colour: "200",
      contents: [{ kind: "block", type: "tank_condition" }],
    },
    {
      kind: "category",
      name: "フォールバック",
      colour: "290",
      contents: [{ kind: "block", type: "tank_fallback" }],
    },
  ],
};

// Starter workspace: scan→shoot, else advance, fallback wait. Mirrors the
// strategy the page used to hardcode, so a fresh player sees a working example.
export const DEFAULT_WORKSPACE_STATE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "tank_rule",
        x: 40,
        y: 40,
        fields: { ACTION: "SHOOT_FORWARD" },
        inputs: {
          CONDITIONS: {
            block: {
              type: "tank_condition",
              fields: { COND: "scan_detected", VAL: "true" },
            },
          },
        },
        next: {
          block: {
            type: "tank_rule",
            fields: { ACTION: "MOVE_FORWARD" },
          },
        },
      },
      {
        type: "tank_fallback",
        x: 40,
        y: 280,
        fields: { ACTION: "WAIT" },
      },
    ],
  },
};

/**
 * Walks a Blockly workspace and produces the `Strategy` JSON the simulator
 * consumes. Top-level `tank_rule` stacks become ordered rules (first match
 * wins); the first `tank_fallback` becomes `fallbackActions`. WAIT carries
 * ap 0, every other action ap 1 (the simulator ignores ap, but we keep it for
 * parity with the previous payload shape).
 */
export function workspaceToStrategy(workspace: Blockly.Workspace): Strategy {
  const rules: Strategy["rules"] = [];
  let fallback: { type: string; ap: number } | undefined;

  const actionToObj = (type: string) => ({ type, ap: type === "WAIT" ? 0 : 1 });

  for (const top of workspace.getTopBlocks(true)) {
    let block: Blockly.Block | null = top;
    while (block) {
      if (block.type === "tank_rule") {
        const conditions: { type: string; value: boolean }[] = [];
        let cond: Blockly.Block | null = block.getInputTargetBlock("CONDITIONS");
        while (cond) {
          if (cond.type === "tank_condition") {
            conditions.push({
              type: cond.getFieldValue("COND"),
              value: cond.getFieldValue("VAL") === "true",
            });
          }
          cond = cond.getNextBlock();
        }
        rules!.push({ conditions, actions: [actionToObj(block.getFieldValue("ACTION"))] });
      } else if (block.type === "tank_fallback" && !fallback) {
        fallback = actionToObj(block.getFieldValue("ACTION"));
      }
      block = block.getNextBlock();
    }
  }

  return {
    version: "1.0",
    rules,
    fallbackActions: [fallback ?? { type: "WAIT", ap: 0 }],
  };
}
