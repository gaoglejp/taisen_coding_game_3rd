import * as Blockly from "blockly";
import type {
  Strategy,
  StrategyCondition,
  StrategyValue,
  StrategyStmt,
  Direction,
} from "@/lib/match-simulator";

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

// 敵情報 number readouts (value blocks). label, block type, simulator metric.
// Output a Number; the 論理・比較 comparison block reads the metric and feeds the
// resulting boolean into 「もし」.
const ENEMY_NUMBER_BLOCKS: [string, string, string][] = [
  ["敵の前方距離", "tank_num_enemy_forward_distance", "enemy_forward_distance"],
  ["敵の右方向距離", "tank_num_enemy_right_distance", "enemy_right_distance"],
  ["敵までの距離", "tank_num_enemy_distance", "enemy_distance"],
];

// 前回結果 boolean checks (previous turn outcome). label, block type, condition.
const LAST_RESULT_CHECK_BLOCKS: [string, string, string][] = [
  ["前回ダメージを受けた？", "tank_chk_took_damage", "damaged"],
  ["前回敵に命中した？", "tank_chk_shot_hit", "shot_hit"],
];

// 自機情報 number readouts (value blocks). label, block type, simulator metric.
// Output a Number; read by the 論理・比較 comparison block.
const SELF_NUMBER_BLOCKS: [string, string, string][] = [
  ["自分のHP", "tank_num_self_hp", "self_hp"],
  ["残りターン", "tank_num_turns_left", "turns_left"],
];

// 自機情報 direction readouts/constants (value blocks). label, block type,
// direction value. `自分の向き` reports the player's facing; 上/右/下/左 are the
// N/E/S/W constants to compare it against. Output "Direction"; usable once the
// 論理・比較 category provides an equality block.
const SELF_DIRECTION_BLOCKS: [string, string, string][] = [
  ["自分の向き", "tank_dir_self_facing", "SELF"],
  ["上", "tank_dir_north", "N"],
  ["右", "tank_dir_east", "E"],
  ["下", "tank_dir_south", "S"],
  ["左", "tank_dir_west", "W"],
];

const ACTION_COLOUR = "#ff761a";
const CHECK_COLOUR = "#1bb3e8";
const ENEMY_COLOUR = "#f04b4e";
const LAST_RESULT_COLOUR = "#7868ff";
const SELF_COLOUR = "#18bd84";
const CONTROL_CAT_COLOUR = "#f0b400";
const CONTROL_BLOCK_COLOUR = "#5f86aa";
const LOGIC_COLOUR = "#2fb8a3";
const NUMVAR_CAT_COLOUR = "#21bea4";
const NUM_LITERAL_COLOUR = "#d7d7d7";
const MATH_COLOUR = "#21bea4";
const VAR_COLOUR = "#9b5bb5";
const RULE_COLOUR = "#5f86aa";
const FALLBACK_COLOUR = "#a653b0";

const ACTION_BLOCK_TO_TYPE: Record<string, string> = Object.fromEntries(
  ACTION_BLOCKS.map(([, block, type]) => [block, type])
);
const CHECK_BLOCK_TO_COND: Record<string, string> = Object.fromEntries(
  [...CHECK_BLOCKS, ...ENEMY_CHECK_BLOCKS, ...LAST_RESULT_CHECK_BLOCKS].map(([, block, cond]) => [
    block,
    cond,
  ])
);
const NUMBER_BLOCK_TO_METRIC: Record<string, string> = Object.fromEntries(
  [...ENEMY_NUMBER_BLOCKS, ...SELF_NUMBER_BLOCKS].map(([, block, metric]) => [block, metric])
);
const DIRECTION_BLOCK_TO_VALUE: Record<string, string> = Object.fromEntries(
  SELF_DIRECTION_BLOCKS.map(([, block, value]) => [block, value])
);
const COMPARE_OPS: ReadonlySet<string> = new Set(["EQ", "NEQ", "LT", "LTE", "GT", "GTE"]);
const ARITH_OPS: ReadonlySet<string> = new Set(["ADD", "SUB", "MUL", "DIV"]);

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

const LAST_RESULT_CHECK_DEFINITIONS = LAST_RESULT_CHECK_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Boolean",
  colour: LAST_RESULT_COLOUR,
  tooltip: `${label} の真偽を返します。ルールの「もし」に差し込みます。`,
  helpUrl: "",
}));

const SELF_NUMBER_DEFINITIONS = SELF_NUMBER_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Number",
  colour: SELF_COLOUR,
  tooltip: `${label} を数値で返します。比較ブロックと組み合わせて使います。`,
  helpUrl: "",
}));

const SELF_DIRECTION_DEFINITIONS = SELF_DIRECTION_BLOCKS.map(([label, type]) => ({
  type,
  message0: label,
  output: "Direction",
  colour: SELF_COLOUR,
  tooltip: `${label}。向きの比較に使います。`,
  helpUrl: "",
}));

// 論理・比較 (logic / comparison). Boolean-output blocks that compose the value
// and check blocks into a 「もし」 condition: compare two values, AND/OR two
// booleans, negate, or a true/false constant.
const LOGIC_BLOCK_DEFINITIONS = [
  {
    type: "tank_cmp",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A", check: ["Number", "Direction"] },
      {
        type: "field_dropdown",
        name: "OP",
        options: [
          ["=", "EQ"],
          ["≠", "NEQ"],
          ["<", "LT"],
          ["≤", "LTE"],
          [">", "GT"],
          ["≥", "GTE"],
        ],
      },
      { type: "input_value", name: "B", check: ["Number", "Direction"] },
    ],
    inputsInline: true,
    output: "Boolean",
    colour: LOGIC_COLOUR,
    tooltip: "2つの値を比較して真偽を返します。ルールの「もし」に差し込みます。",
    helpUrl: "",
  },
  {
    type: "tank_logic_op",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A", check: "Boolean" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [
          ["かつ", "AND"],
          ["または", "OR"],
        ],
      },
      { type: "input_value", name: "B", check: "Boolean" },
    ],
    inputsInline: true,
    output: "Boolean",
    colour: LOGIC_COLOUR,
    tooltip: "「かつ」は両方が真のとき、「または」はどちらかが真のときに真。",
    helpUrl: "",
  },
  {
    type: "tank_not",
    message0: "ではない %1",
    args0: [{ type: "input_value", name: "VAL", check: "Boolean" }],
    inputsInline: true,
    output: "Boolean",
    colour: LOGIC_COLOUR,
    tooltip: "真偽を反転します。",
    helpUrl: "",
  },
  {
    type: "tank_bool",
    message0: "%1",
    args0: [
      {
        type: "field_dropdown",
        name: "VAL",
        options: [
          ["true", "TRUE"],
          ["false", "FALSE"],
        ],
      },
    ],
    output: "Boolean",
    colour: LOGIC_COLOUR,
    tooltip: "true（真）か false（偽）の定数。",
    helpUrl: "",
  },
];

// 数値・変数 (numbers / variables). Number-output value blocks (literal,
// arithmetic, modulo, variable read) feed comparisons; the 「セット」 statement
// writes a variable and snaps into a rule's 「実行」 stack.
const NUMVAR_BLOCK_DEFINITIONS = [
  {
    type: "tank_num_literal",
    message0: "%1",
    args0: [{ type: "field_number", name: "NUM", value: 0 }],
    output: "Number",
    colour: NUM_LITERAL_COLOUR,
    tooltip: "数値。比較や計算の値として使います。",
    helpUrl: "",
  },
  {
    type: "tank_arith",
    message0: "%1 %2 %3",
    args0: [
      { type: "input_value", name: "A", check: "Number" },
      {
        type: "field_dropdown",
        name: "OP",
        options: [
          ["+", "ADD"],
          ["−", "SUB"],
          ["×", "MUL"],
          ["÷", "DIV"],
        ],
      },
      { type: "input_value", name: "B", check: "Number" },
    ],
    inputsInline: true,
    output: "Number",
    colour: MATH_COLOUR,
    tooltip: "2つの数値を四則演算します。",
    helpUrl: "",
  },
  {
    type: "tank_mod",
    message0: "%1 ÷ %2 の余り",
    args0: [
      { type: "input_value", name: "A", check: "Number" },
      { type: "input_value", name: "B", check: "Number" },
    ],
    inputsInline: true,
    output: "Number",
    colour: MATH_COLOUR,
    tooltip: "A を B で割った余り（剰余）を返します。",
    helpUrl: "",
  },
  {
    type: "tank_var_get",
    message0: "%1",
    args0: [{ type: "field_variable", name: "VAR", variable: "項目" }],
    output: "Number",
    colour: VAR_COLOUR,
    tooltip: "変数の値を読み出します（未設定なら 0）。",
    helpUrl: "",
  },
  {
    type: "tank_var_set",
    message0: "%1 に %2 をセット",
    args0: [
      { type: "field_variable", name: "VAR", variable: "項目" },
      { type: "input_value", name: "VALUE", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: "Action",
    nextStatement: "Action",
    colour: VAR_COLOUR,
    tooltip: "変数に値を代入します。ルールが一致したとき、行動の前に実行されます。",
    helpUrl: "",
  },
];

// 制御 (control flow). The 「もし」 block reuses Blockly's built-in controls_if
// mutator (the gear), so the player can add 「そうでなければもし」(else-if) and
// 「そうでなければ」(else) branches — inputs IF0/DO0, IF1/DO1…, ELSE. It nests in a
// rule's 「実行」 stack; the simulator runs the first true branch (see
// `collectBody` and the simulator's `runBody`).
const CONTROL_BLOCK_DEFINITIONS = [
  {
    type: "tank_ctl_if",
    message0: "もし %1",
    args0: [{ type: "input_value", name: "IF0", check: "Boolean" }],
    message1: "実行 %1",
    args1: [{ type: "input_statement", name: "DO0", check: "Action" }],
    previousStatement: "Action",
    nextStatement: "Action",
    colour: CONTROL_BLOCK_COLOUR,
    mutator: "controls_if_mutator",
    tooltip:
      "条件が真なら「実行」を行います。歯車で「そうでなければもし」「そうでなければ」を追加できます。",
    helpUrl: "",
  },
];

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
    type: "tank_rule_always",
    message0: "ルール",
    message1: "実行 %1",
    args1: [{ type: "input_statement", name: "DO", check: "Action" }],
    previousStatement: "Rule",
    nextStatement: "Rule",
    colour: RULE_COLOUR,
    tooltip:
      "条件を確認せず、順番が来たら実行します。上のルールから順に評価され、先に行動が決まると下のルールは実行されません。",
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
  ...LAST_RESULT_CHECK_DEFINITIONS,
  ...SELF_NUMBER_DEFINITIONS,
  ...SELF_DIRECTION_DEFINITIONS,
  ...LOGIC_BLOCK_DEFINITIONS,
  ...NUMVAR_BLOCK_DEFINITIONS,
  ...CONTROL_BLOCK_DEFINITIONS,
  ...STRUCTURE_BLOCK_DEFINITIONS,
];

let defined = false;

/** Registers the tank-strategy blocks. Safe to call more than once. */
export function defineStrategyBlocks(): void {
  if (defined) return;
  // Localize the built-in controls_if mutator (reused by tank_ctl_if) so its
  // gear-added branches read もし / 実行 / そうでなければもし / そうでなければ.
  const msg = Blockly.Msg as Record<string, string>;
  msg.CONTROLS_IF_MSG_IF = "もし";
  msg.CONTROLS_IF_MSG_THEN = "実行";
  msg.CONTROLS_IF_MSG_ELSEIF = "そうでなければもし";
  msg.CONTROLS_IF_MSG_ELSE = "そうでなければ";
  msg.CONTROLS_IF_IF_TITLE_IF = "もし";
  msg.CONTROLS_IF_ELSEIF_TITLE_ELSEIF = "そうでなければもし";
  msg.CONTROLS_IF_ELSE_TITLE_ELSE = "そうでなければ";
  Blockly.defineBlocksWithJsonArray(BLOCK_DEFINITIONS as unknown as object[]);
  defined = true;
}

export type StrategyToolbox = {
  kind: "categoryToolbox";
  contents: Array<{
    kind: "category";
    name: string;
    colour: string;
    contents: Array<{ kind: "block"; type: string }>;
  }>;
};

export interface StrategyToolboxFilter {
  allowedCategories?: string[];
  allowedBlockTypes?: string[];
}

export const STRATEGY_TOOLBOX: StrategyToolbox = {
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
      name: "前回結果",
      colour: String(LAST_RESULT_COLOUR),
      contents: LAST_RESULT_CHECK_BLOCKS.map(([, type]) => ({ kind: "block", type })),
    },
    {
      kind: "category",
      name: "自機情報",
      colour: String(SELF_COLOUR),
      contents: [...SELF_NUMBER_BLOCKS, ...SELF_DIRECTION_BLOCKS].map(([, type]) => ({
        kind: "block",
        type,
      })),
    },
    {
      kind: "category",
      name: "制御",
      colour: String(CONTROL_CAT_COLOUR),
      contents: [{ kind: "block", type: "tank_ctl_if" }],
    },
    {
      kind: "category",
      name: "論理・比較",
      colour: String(LOGIC_COLOUR),
      contents: [
        { kind: "block", type: "tank_cmp" },
        { kind: "block", type: "tank_logic_op" },
        { kind: "block", type: "tank_not" },
        { kind: "block", type: "tank_bool" },
      ],
    },
    {
      kind: "category",
      name: "数値・変数",
      colour: String(NUMVAR_CAT_COLOUR),
      contents: [
        { kind: "block", type: "tank_num_literal" },
        { kind: "block", type: "tank_arith" },
        { kind: "block", type: "tank_mod" },
        { kind: "block", type: "tank_var_get" },
        { kind: "block", type: "tank_var_set" },
      ],
    },
    {
      kind: "category",
      name: "ルール",
      colour: String(RULE_COLOUR),
      contents: [
        { kind: "block", type: "tank_rule" },
        { kind: "block", type: "tank_rule_always" },
      ],
    },
  ],
};

export function createStrategyToolbox(filter?: StrategyToolboxFilter | null): StrategyToolbox {
  const allowedCategories = filter?.allowedCategories
    ? new Set(filter.allowedCategories)
    : null;
  const allowedBlockTypes = filter?.allowedBlockTypes
    ? new Set(filter.allowedBlockTypes)
    : null;

  return {
    kind: "categoryToolbox",
    contents: STRATEGY_TOOLBOX.contents
      .filter((category) => !allowedCategories || allowedCategories.has(category.name))
      .map((category) => ({
        ...category,
        contents: category.contents.filter(
          (block) => !allowedBlockTypes || allowedBlockTypes.has(block.type)
        ),
      }))
      .filter((category) => category.contents.length > 0),
  };
}

// Starter workspace: advance forward while possible, otherwise sidestep right.
// If no rule matches, the serializer supplies WAIT as the implicit fallback.
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
    ],
  },
};

// Reads a value block (敵情報/自機情報 readout, direction constant, number
// literal, arithmetic/modulo, or variable read) into a `StrategyValue`. Returns
// null for an empty or incompletely-wired socket.
function valueToNode(block: Blockly.Block | null): StrategyValue | null {
  if (!block) return null;
  const metric = NUMBER_BLOCK_TO_METRIC[block.type];
  if (metric) return { type: metric };
  const dir = DIRECTION_BLOCK_TO_VALUE[block.type];
  if (dir === "SELF") return { type: "self_facing" };
  if (dir) return { type: "dir", dir: dir as Direction };
  switch (block.type) {
    case "tank_num_literal": {
      const n = Number(block.getFieldValue("NUM"));
      return Number.isFinite(n) ? { type: "num", value: n } : null;
    }
    case "tank_var_get": {
      const name = block.getField("VAR")?.getText();
      return name ? { type: "var", name } : null;
    }
    case "tank_arith": {
      const left = valueToNode(block.getInputTargetBlock("A"));
      const right = valueToNode(block.getInputTargetBlock("B"));
      const op = block.getFieldValue("OP");
      if (!left || !right || !ARITH_OPS.has(op)) return null;
      return { type: "arith", op, left, right };
    }
    case "tank_mod": {
      const left = valueToNode(block.getInputTargetBlock("A"));
      const right = valueToNode(block.getInputTargetBlock("B"));
      if (!left || !right) return null;
      return { type: "mod", left, right };
    }
    default:
      return null;
  }
}

// Walks a 「実行」 statement stack into ordered body statements: action blocks
// become `action`, 「セット」 blocks become `set`, and 「もし」 blocks become a
// nested `if` (its 「実行」 collected recursively). Other blocks are skipped.
function collectBody(start: Blockly.Block | null): StrategyStmt[] {
  const stmts: StrategyStmt[] = [];
  let block: Blockly.Block | null = start;
  while (block) {
    const actionType = ACTION_BLOCK_TO_TYPE[block.type];
    if (actionType) {
      stmts.push({ kind: "action", type: actionType });
    } else if (block.type === "tank_var_set") {
      const name = block.getField("VAR")?.getText();
      const value = valueToNode(block.getInputTargetBlock("VALUE"));
      if (name && value) stmts.push({ kind: "set", name, value });
    } else if (block.type === "tank_ctl_if") {
      const clauses = [];
      for (let i = 0; block.getInput("IF" + i); i++) {
        const cond = conditionToNode(block.getInputTargetBlock("IF" + i));
        if (cond) clauses.push({ cond, body: collectBody(block.getInputTargetBlock("DO" + i)) });
      }
      const elseBody = block.getInput("ELSE")
        ? collectBody(block.getInputTargetBlock("ELSE"))
        : [];
      if (clauses.length) {
        const node: StrategyStmt = { kind: "if", clauses };
        if (elseBody.length) node.else = elseBody;
        stmts.push(node);
      }
    }
    block = block.getNextBlock();
  }
  return stmts;
}

// Recursively reads a boolean block plugged into 「もし」 into the condition tree:
// a named check leaf, a true/false constant, NOT/AND/OR, or a comparison.
// Returns null for an empty or incompletely-wired condition.
function conditionToNode(block: Blockly.Block | null): StrategyCondition | null {
  if (!block) return null;
  const cond = CHECK_BLOCK_TO_COND[block.type];
  if (cond) return { type: cond, value: true };
  switch (block.type) {
    case "tank_bool":
      return { type: "bool", value: block.getFieldValue("VAL") === "TRUE" };
    case "tank_not": {
      const arg = conditionToNode(block.getInputTargetBlock("VAL"));
      return arg ? { type: "not", arg } : null;
    }
    case "tank_logic_op": {
      const a = conditionToNode(block.getInputTargetBlock("A"));
      const b = conditionToNode(block.getInputTargetBlock("B"));
      const args = [a, b].filter((n): n is StrategyCondition => n !== null);
      if (!args.length) return null;
      return { type: block.getFieldValue("OP") === "OR" ? "or" : "and", args };
    }
    case "tank_cmp": {
      const left = valueToNode(block.getInputTargetBlock("A"));
      const right = valueToNode(block.getInputTargetBlock("B"));
      const op = block.getFieldValue("OP");
      if (!left || !right || !COMPARE_OPS.has(op)) return null;
      return { type: "compare", cmp: op, left, right };
    }
    default:
      return null;
  }
}

/**
 * Walks a Blockly workspace and produces the `Strategy` JSON the simulator
 * consumes. Top-level `tank_rule` / `tank_rule_always` stacks become ordered
 * rules (first match wins); the first `tank_fallback` becomes `fallbackBody`.
 * A rule's 「もし」 boolean becomes its single condition (a boolean expression
 * tree); its 「実行」 stack becomes an ordered `body` of statements (actions,
 * variable sets, and nested 「もし」), of which the simulator runs the first
 * reachable action.
 */
export function workspaceToStrategy(workspace: Blockly.Workspace): Strategy {
  const rules: NonNullable<Strategy["rules"]> = [];
  let fallbackBody: StrategyStmt[] | undefined;

  for (const top of workspace.getTopBlocks(true)) {
    let block: Blockly.Block | null = top;
    while (block) {
      if (block.type === "tank_rule" || block.type === "tank_rule_always") {
        const cond =
          block.type === "tank_rule" ? conditionToNode(block.getInputTargetBlock("COND")) : null;
        rules.push({
          conditions: block.type === "tank_rule" && cond ? [cond] : [],
          body: collectBody(block.getInputTargetBlock("DO")),
        });
      } else if (block.type === "tank_fallback" && !fallbackBody) {
        const body = collectBody(block.getInputTargetBlock("DO"));
        if (body.length) fallbackBody = body;
      }
      block = block.getNextBlock();
    }
  }

  return {
    version: "1.0",
    rules,
    fallbackBody: fallbackBody ?? [{ kind: "action", type: "WAIT" }],
  };
}
