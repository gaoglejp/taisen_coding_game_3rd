import * as Blockly from "blockly";
import type { Strategy } from "@/lib/match-simulator";

// Domain vocabulary the simulator understands (see src/lib/match-simulator.ts).
//
// Actions (行動) are individual statement blocks; state checks (状態確認) are
// boolean value blocks. A rule plugs one boolean into 「もし」 and one action
// stack into 「実行」. Anything outside these sets makes the simulator fall
// through to WAIT.

// label, block type, simulator action
const ACTION_BLOCKS: [string, string, string][] = [
  ["前へ移動", "tank_act_move_forward", "MOVE_FORWARD"],
  ["後ろへ移動", "tank_act_move_back", "MOVE_BACK"],
  ["左へ移動", "tank_act_move_left", "MOVE_LEFT"],
  ["右へ移動", "tank_act_move_right", "MOVE_RIGHT"],
  ["前へ射撃", "tank_act_shoot_forward", "SHOOT_FORWARD"],
  ["後ろへ射撃", "tank_act_shoot_back", "SHOOT_BACK"],
  ["左へ射撃", "tank_act_shoot_left", "SHOOT_LEFT"],
  ["右へ射撃", "tank_act_shoot_right", "SHOOT_RIGHT"],
  ["周囲を索敵", "tank_act_scan_around", "SCAN_AROUND"],
  ["待機", "tank_act_wait", "WAIT"],
];

// label, block type, simulator condition
const CHECK_BLOCKS: [string, string, string][] = [
  ["前に進める？", "tank_chk_can_move_forward", "can_move_forward"],
  ["後ろに進める？", "tank_chk_can_move_back", "can_move_back"],
  ["左に進める？", "tank_chk_can_move_left", "can_move_left"],
  ["右に進める？", "tank_chk_can_move_right", "can_move_right"],
];

// 敵情報 boolean checks. label, block type, simulator condition.
const ENEMY_CHECK_BLOCKS: [string, string, string][] = [
  ["敵を検出している？", "tank_chk_enemy_detected", "scan_detected"],
];

// 敵情報 number readouts (value blocks). label, block type. These output a
// Number; they become usable inside rules once the 論理・比較 (comparison)
// category lands, which will compare them and feed the boolean into 「もし」.
const ENEMY_NUMBER_BLOCKS: [string, string][] = [
  ["敵の前方距離", "tank_num_enemy_forward_distance"],
  ["敵の右方向距離", "tank_num_enemy_right_distance"],
  ["敵までの距離", "tank_num_enemy_distance"],
];

const ACTION_COLOUR = 30;
const CHECK_COLOUR = 210;
const ENEMY_COLOUR = 0;
const RULE_COLOUR = 230;
const FALLBACK_COLOUR = 290;

const ACTION_BLOCK_TO_TYPE: Record<string, string> = Object.fromEntries(
  ACTION_BLOCKS.map(([, block, type]) => [block, type])
);
const CHECK_BLOCK_TO_COND: Record<string, string> = Object.fromEntries(
  [...CHECK_BLOCKS, ...ENEMY_CHECK_BLOCKS].map(([, block, cond]) => [block, cond])
);

const ACTION_BLOCK_DEFINITIONS = ACTION_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  previousStatement: "Action",
  nextStatement: "Action",
  colour: ACTION_COLOUR,
  tooltip: `${label}。1ターンに実行する行動です。`,
  helpUrl: "",
}));

const CHECK_BLOCK_DEFINITIONS = CHECK_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Boolean",
  colour: CHECK_COLOUR,
  tooltip: `${label} の真偽を返します。ルールの「もし」に差し込みます。`,
  helpUrl: "",
}));

const ENEMY_CHECK_DEFINITIONS = ENEMY_CHECK_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Boolean",
  colour: ENEMY_COLOUR,
  tooltip: `${label} の真偽を返します。ルールの「もし」に差し込みます。`,
  helpUrl: "",
}));

const ENEMY_NUMBER_DEFINITIONS = ENEMY_NUMBER_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Number",
  colour: ENEMY_COLOUR,
  tooltip: `${label} を数値で返します。比較ブロックと組み合わせて使います。`,
  helpUrl: "",
}));

const STRUCTURE_BLOCK_DEFINITIONS = [
  {
    type: "tank_rule",
    message0: "ルール",
    message1: "もし %1",
    args1: [{ type: "input_value", name: "COND", check: "Boolean" }],
    message2: "実行 %1",
    args2: [{ type: "input_statement", name: "DO", check: "Action" }],
    previousStatement: "Rule",
    nextStatement: "Rule",
    colour: RULE_COLOUR,
    tooltip:
      "「もし」の条件が真のとき、「実行」の行動を行います。上のルールから順に評価され、最初に一致したルールが採用されます。",
    helpUrl: "",
  },
  {
    type: "tank_fallback",
    message0: "フォールバック",
    message1: "実行 %1",
    args1: [{ type: "input_statement", name: "DO", check: "Action" }],
    colour: FALLBACK_COLOUR,
    tooltip: "どのルールにも一致しなかったときに実行する行動。",
    helpUrl: "",
  },
];

const BLOCK_DEFINITIONS = [
  ...ACTION_BLOCK_DEFINITIONS,
  ...CHECK_BLOCK_DEFINITIONS,
  ...ENEMY_CHECK_DEFINITIONS,
  ...ENEMY_NUMBER_DEFINITIONS,
  ...STRUCTURE_BLOCK_DEFINITIONS,
];

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
      name: "行動",
      colour: String(ACTION_COLOUR),
      contents: ACTION_BLOCKS.map(([, type]) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "状態確認",
      colour: String(CHECK_COLOUR),
      contents: CHECK_BLOCKS.map(([, type]) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "敵情報",
      colour: String(ENEMY_COLOUR),
      contents: [...ENEMY_CHECK_BLOCKS, ...ENEMY_NUMBER_BLOCKS].map(([, type]) => ({
        kind: "block",
        type,
      })),
    },
    {
      kind: "category",
      name: "ルール",
      colour: String(RULE_COLOUR),
      contents: [{ kind: "block", type: "tank_rule" }],
    },
    {
      kind: "category",
      name: "フォールバック",
      colour: String(FALLBACK_COLOUR),
      contents: [{ kind: "block", type: "tank_fallback" }],
    },
  ],
};

// Starter workspace: advance forward while possible, otherwise sidestep right,
// and shoot forward as a fallback. Demonstrates rules + checks + actions and
// gives a fresh player a working example to edit.
export const DEFAULT_WORKSPACE_STATE = {
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: "tank_rule",
        x: 40,
        y: 40,
        inputs: {
          COND: { block: { type: "tank_chk_can_move_forward" } },
          DO: { block: { type: "tank_act_move_forward" } },
        },
        next: {
          block: {
            type: "tank_rule",
            inputs: {
              COND: { block: { type: "tank_chk_can_move_right" } },
              DO: { block: { type: "tank_act_move_right" } },
            },
          },
        },
      },
      {
        type: "tank_fallback",
        x: 40,
        y: 320,
        inputs: { DO: { block: { type: "tank_act_shoot_forward" } } },
      },
    ],
  },
};

const actionToObj = (type: string) => ({ type, ap: type === "WAIT" ? 0 : 1 });

// Collects the action stack plugged into a 「実行」 statement input.
function collectActions(start: Blockly.Block | null): { type: string; ap: number }[] {
  const actions: { type: string; ap: number }[] = [];
  let block: Blockly.Block | null = start;
  while (block) {
    const type = ACTION_BLOCK_TO_TYPE[block.type];
    if (type) actions.push(actionToObj(type));
    block = block.getNextBlock();
  }
  return actions;
}

/**
 * Walks a Blockly workspace and produces the `Strategy` JSON the simulator
 * consumes. Top-level `tank_rule` stacks become ordered rules (first match
 * wins); the first `tank_fallback` becomes `fallbackActions`. A rule's 「もし」
 * boolean becomes its single condition; its 「実行」 stack becomes the actions
 * (the simulator runs the first one).
 */
export function workspaceToStrategy(workspace: Blockly.Workspace): Strategy {
  const rules: NonNullable<Strategy["rules"]> = [];
  let fallback: { type: string; ap: number }[] | undefined;

  for (const top of workspace.getTopBlocks(true)) {
    let block: Blockly.Block | null = top;
    while (block) {
      if (block.type === "tank_rule") {
        const conditions: { type: string; value: boolean }[] = [];
        const condBlock = block.getInputTargetBlock("COND");
        const cond = condBlock && CHECK_BLOCK_TO_COND[condBlock.type];
        if (cond) conditions.push({ type: cond, value: true });
        rules.push({ conditions, actions: collectActions(block.getInputTargetBlock("DO")) });
      } else if (block.type === "tank_fallback" && !fallback) {
        const actions = collectActions(block.getInputTargetBlock("DO"));
        if (actions.length) fallback = actions;
      }
      block = block.getNextBlock();
    }
  }

  return {
    version: "1.0",
    rules,
    fallbackActions: fallback ?? [{ type: "WAIT", ap: 0 }],
  };
}
