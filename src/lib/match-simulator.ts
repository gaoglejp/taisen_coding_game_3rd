// Pure deterministic turn simulator for a 10x10, two-player match.
//
// A strategy is the JSON object produced by the coding/practice block editor
// (see src/lib/strategy-blocks.ts). The simulator evaluates rules in order,
// takes the first matching rule's first action, and applies it. With no
// matching rule it falls back to `fallbackActions[0]`, or WAIT if missing.
//
// The simulator is intentionally small: no obstacles, no items, no AP budget,
// one action per player per turn. Movement and shooting are relative to the
// player's facing (forward / back / left / right). A successful movement turns
// the player to face the absolute direction they moved.

export type Direction = "N" | "E" | "S" | "W";

export type RelDir = "FORWARD" | "BACK" | "LEFT" | "RIGHT";

export type ActionType =
  | "MOVE_FORWARD"
  | "MOVE_BACK"
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "SHOOT_FORWARD"
  | "SHOOT_BACK"
  | "SHOOT_LEFT"
  | "SHOOT_RIGHT"
  | "SCAN_AROUND"
  | "WAIT";

const ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  "MOVE_FORWARD",
  "MOVE_BACK",
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "SHOOT_FORWARD",
  "SHOOT_BACK",
  "SHOOT_LEFT",
  "SHOOT_RIGHT",
  "SCAN_AROUND",
  "WAIT",
]);

const MOVE_ACTIONS: Partial<Record<ActionType, RelDir>> = {
  MOVE_FORWARD: "FORWARD",
  MOVE_BACK: "BACK",
  MOVE_LEFT: "LEFT",
  MOVE_RIGHT: "RIGHT",
};

const SHOOT_ACTIONS: Partial<Record<ActionType, RelDir>> = {
  SHOOT_FORWARD: "FORWARD",
  SHOOT_BACK: "BACK",
  SHOOT_LEFT: "LEFT",
  SHOOT_RIGHT: "RIGHT",
};

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  hp: number;
}

export interface DetectedTarget {
  direction: RelDir;
  distance: number;
  age: number;
}

export interface PerPlayerTurn extends PlayerState {
  action: ActionType;
  moved: boolean;
  damaged: number;
  shoot_result: "HIT" | "MISS" | null;
  scan_detected: boolean;
  detected_targets: DetectedTarget[];
}

export interface TurnSnapshot {
  turn: number;
  p1: PerPlayerTurn;
  p2: PerPlayerTurn;
  logs: Array<{ playerId: "p1" | "p2"; text: string }>;
}

export interface SimulationResult {
  turns: TurnSnapshot[];
  winner: "p1" | "p2" | null;
  endReason: "HP_ZERO" | "TIMEOUT";
  finalHp: { p1: number; p2: number };
  totalTurns: number;
}

// A value node: a number/direction the comparison block reads. `type` selects a
// perception metric (enemy_distance, self_hp, turns_left, self_facing, ...), or
// "num" for a literal (value) / "dir" for a direction constant (dir).
export interface StrategyValue {
  type?: string;
  value?: number;
  dir?: Direction;
  name?: string;
  op?: string;
  left?: StrategyValue;
  right?: StrategyValue;
}

// A condition node. Legacy named perception checks keep the flat
// `{ type, value }` shape; the 論理・比較 blocks add the "and"/"or"/"not"/"bool"/
// "compare" operators, forming a boolean expression tree.
export interface StrategyCondition {
  type?: string;
  value?: unknown;
  args?: StrategyCondition[];
  arg?: StrategyCondition;
  cmp?: string;
  left?: StrategyValue;
  right?: StrategyValue;
}

interface StrategyAction {
  type?: string;
  ap?: number;
}

// A variable assignment: `name に <value> をセット`. Applied (in order) when its
// rule matches, before the rule's action is taken.
export interface StrategySet {
  name?: string;
  value?: StrategyValue;
}

// One branch of an `if` statement: a condition and the body to run when true.
export interface StrategyClause {
  cond?: StrategyCondition;
  body?: StrategyStmt[];
}

// One statement in a matched rule's 「実行」 body, executed in order. The first
// `action` reached (descending into the first true `if`/`else-if` branch, or the
// `else`) is the turn's action; `set` mutates a variable.
export interface StrategyStmt {
  kind?: string;
  type?: string;
  name?: string;
  value?: StrategyValue;
  // if: ordered clauses (clauses[0] = if, the rest = else-if) plus optional else.
  clauses?: StrategyClause[];
  else?: StrategyStmt[];
  // Legacy single-branch if (no else): `cond` + `body`.
  cond?: StrategyCondition;
  body?: StrategyStmt[];
}

interface StrategyRule {
  conditions?: StrategyCondition[];
  // `body` is the current ordered-statement form. `sets`/`actions` are the
  // legacy flat form (stored strategies, bots) and still execute.
  body?: StrategyStmt[];
  sets?: StrategySet[];
  actions?: StrategyAction[];
}

export interface Strategy {
  version?: string;
  rules?: StrategyRule[];
  fallbackBody?: StrategyStmt[];
  fallbackSets?: StrategySet[];
  fallbackActions?: StrategyAction[];
}

export const GRID_SIZE = 10;
export const MAX_TURNS = 20;
export const INITIAL_HP = 100;
const MIN_TURNS = 1;
const MAX_TURNS_LIMIT = 200;
const SHOOT_RANGE = 3;
const SHOOT_DAMAGE = 15;
const SCAN_RANGE = 3;

const DIR_DELTA: Record<Direction, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

const TURN_LEFT_OF: Record<Direction, Direction> = { N: "W", W: "S", S: "E", E: "N" };
const TURN_RIGHT_OF: Record<Direction, Direction> = { N: "E", E: "S", S: "W", W: "N" };
const OPPOSITE_OF: Record<Direction, Direction> = { N: "S", S: "N", E: "W", W: "E" };
const REL_DIRS: RelDir[] = ["FORWARD", "BACK", "LEFT", "RIGHT"];

// The absolute compass direction of a relative direction, given a facing.
function relDirection(facing: Direction, rel: RelDir): Direction {
  switch (rel) {
    case "FORWARD":
      return facing;
    case "BACK":
      return OPPOSITE_OF[facing];
    case "LEFT":
      return TURN_LEFT_OF[facing];
    case "RIGHT":
      return TURN_RIGHT_OF[facing];
  }
}

function relDelta(facing: Direction, rel: RelDir): [number, number] {
  return DIR_DELTA[relDirection(facing, rel)];
}

interface Perception {
  scan_detected: boolean;
  damaged: number;
  moved: boolean;
  shot_hit: boolean;
  can_move_forward: boolean;
  can_move_back: boolean;
  can_move_left: boolean;
  can_move_right: boolean;
  self_hp: number;
  turns_left: number;
  self_facing: Direction;
  // Enemy position is read from ground truth (the simulator is omniscient for
  // movement and shooting too), expressed relative to the player's facing:
  // forward/right are signed projections, distance is Manhattan.
  enemy_distance: number;
  enemy_forward_distance: number;
  enemy_right_distance: number;
}

function isDirection(value: unknown): value is Direction {
  return value === "N" || value === "E" || value === "S" || value === "W";
}

function isAction(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPES.has(value as ActionType);
}

// Per-player variable store, persisted across turns. Unset variables read as 0.
type Vars = Record<string, number>;

function setVar(s: StrategySet | undefined, p: Perception, vars: Vars): void {
  if (!s?.name) return;
  const v = evaluateValue(s.value, p, vars);
  if (typeof v === "number") vars[s.name] = v;
}

// Runs a 「実行」 body: a `set` mutates a variable; the first `action` reached is
// the turn's action; an `if` descends into its nested body when its condition
// holds. Returns the chosen action, or null if the body produces none.
function runBody(stmts: StrategyStmt[] | undefined, p: Perception, vars: Vars): ActionType | null {
  for (const s of stmts ?? []) {
    switch (s?.kind) {
      case "set":
        setVar({ name: s.name, value: s.value }, p, vars);
        break;
      case "action":
        if (isAction(s.type)) return s.type;
        break;
      case "if": {
        const clauses = s.clauses ?? (s.cond ? [{ cond: s.cond, body: s.body }] : []);
        let matched = false;
        for (const cl of clauses) {
          if (cl?.cond && evaluateCondition(cl.cond, p, vars)) {
            matched = true;
            const a = runBody(cl.body, p, vars);
            if (a) return a;
            break;
          }
        }
        if (!matched) {
          const a = runBody(s.else, p, vars);
          if (a) return a;
        }
        break;
      }
    }
  }
  return null;
}

// Legacy flat form: apply sets in order, then take the first valid action.
function runLegacy(
  sets: StrategySet[] | undefined,
  actions: StrategyAction[] | undefined,
  p: Perception,
  vars: Vars
): ActionType | null {
  for (const s of sets ?? []) setVar(s, p, vars);
  const action = actions?.[0]?.type;
  return isAction(action) ? action : null;
}

// Walks rules top-down. A matched rule runs its body (or legacy sets+action);
// if that yields an action it wins, otherwise the rule falls through (its
// variable writes persist), so later rules see the updated variables.
function chooseAction(
  strategy: Strategy | null | undefined,
  perception: Perception,
  vars: Vars
): ActionType {
  const rules = strategy?.rules ?? [];
  for (const rule of rules) {
    const conds = rule?.conditions ?? [];
    if (conds.every((c) => evaluateCondition(c, perception, vars))) {
      const action = rule?.body
        ? runBody(rule.body, perception, vars)
        : runLegacy(rule?.sets, rule?.actions, perception, vars);
      if (action) return action;
    }
  }
  const fallback = strategy?.fallbackBody
    ? runBody(strategy.fallbackBody, perception, vars)
    : runLegacy(strategy?.fallbackSets, strategy?.fallbackActions, perception, vars);
  return fallback ?? "WAIT";
}

// Reads a value node into a number or direction; null when unresolved.
function evaluateValue(
  v: StrategyValue | undefined,
  p: Perception,
  vars: Vars
): number | Direction | null {
  switch (v?.type) {
    case "num":
      return typeof v.value === "number" && Number.isFinite(v.value) ? v.value : null;
    case "dir":
      return isDirection(v.dir) ? v.dir : null;
    case "self_facing":
      return p.self_facing;
    case "enemy_distance":
      return p.enemy_distance;
    case "enemy_forward_distance":
      return p.enemy_forward_distance;
    case "enemy_right_distance":
      return p.enemy_right_distance;
    case "self_hp":
      return p.self_hp;
    case "turns_left":
      return p.turns_left;
    case "var":
      return v.name ? (vars[v.name] ?? 0) : null;
    case "arith":
      return evaluateArith(v, p, vars);
    case "mod": {
      const l = evaluateValue(v.left, p, vars);
      const r = evaluateValue(v.right, p, vars);
      if (typeof l !== "number" || typeof r !== "number" || r === 0) return null;
      return ((l % r) + r) % r;
    }
    default:
      return null;
  }
}

function evaluateArith(v: StrategyValue, p: Perception, vars: Vars): number | null {
  const l = evaluateValue(v.left, p, vars);
  const r = evaluateValue(v.right, p, vars);
  if (typeof l !== "number" || typeof r !== "number") return null;
  switch (v.op) {
    case "ADD":
      return l + r;
    case "SUB":
      return l - r;
    case "MUL":
      return l * r;
    case "DIV":
      return r === 0 ? null : l / r;
    default:
      return null;
  }
}

function evaluateCompare(c: StrategyCondition, p: Perception, vars: Vars): boolean {
  const l = evaluateValue(c.left, p, vars);
  const r = evaluateValue(c.right, p, vars);
  if (l === null || r === null) return false;
  switch (c.cmp) {
    case "EQ":
      return l === r;
    case "NEQ":
      return l !== r;
    case "LT":
      return typeof l === "number" && typeof r === "number" && l < r;
    case "GT":
      return typeof l === "number" && typeof r === "number" && l > r;
    case "LTE":
      return typeof l === "number" && typeof r === "number" && l <= r;
    case "GTE":
      return typeof l === "number" && typeof r === "number" && l >= r;
    default:
      return false;
  }
}

function evaluateCondition(c: StrategyCondition, p: Perception, vars: Vars): boolean {
  switch (c?.type) {
    case "scan_detected":
      return p.scan_detected === Boolean(c.value);
    case "damaged":
      return p.damaged > 0 === Boolean(c.value);
    case "moved":
      return p.moved === Boolean(c.value);
    case "shot_hit":
      return p.shot_hit === Boolean(c.value);
    case "can_move_forward":
      return p.can_move_forward === Boolean(c.value);
    case "can_move_back":
      return p.can_move_back === Boolean(c.value);
    case "can_move_left":
      return p.can_move_left === Boolean(c.value);
    case "can_move_right":
      return p.can_move_right === Boolean(c.value);
    case "bool":
      return Boolean(c.value);
    case "not":
      return c.arg ? !evaluateCondition(c.arg, p, vars) : false;
    case "and":
      return (c.args ?? []).every((a) => evaluateCondition(a, p, vars));
    case "or":
      return (c.args ?? []).some((a) => evaluateCondition(a, p, vars));
    case "compare":
      return evaluateCompare(c, p, vars);
    default:
      return false;
  }
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

// Cell one step from `player` in relative direction `rel`.
function relCell(player: PlayerState, rel: RelDir): [number, number] {
  const [dx, dy] = relDelta(player.dir, rel);
  return [player.x + dx, player.y + dy];
}

// Distance along `delta` to `target` if it sits on that ray within `range`.
// Returns 0 if not in line.
function rayDistance(
  shooter: PlayerState,
  target: PlayerState,
  delta: [number, number],
  range: number
): number {
  const [dx, dy] = delta;
  for (let step = 1; step <= range; step++) {
    const x = shooter.x + dx * step;
    const y = shooter.y + dy * step;
    if (!inBounds(x, y)) return 0;
    if (target.x === x && target.y === y) return step;
  }
  return 0;
}

// Whether `self` could step into its relative cell (in bounds, not the
// opponent's current cell).
function canMove(self: PlayerState, opponent: PlayerState, rel: RelDir): boolean {
  const [x, y] = relCell(self, rel);
  return inBounds(x, y) && !(x === opponent.x && y === opponent.y);
}

function buildPerception(
  self: PlayerState,
  opponent: PlayerState,
  scan_detected: boolean,
  damaged: number,
  moved: boolean,
  shot_hit: boolean,
  turnsLeft: number
): Perception {
  const dx = opponent.x - self.x;
  const dy = opponent.y - self.y;
  const [ffx, ffy] = DIR_DELTA[self.dir];
  const [frx, fry] = DIR_DELTA[TURN_RIGHT_OF[self.dir]];
  return {
    scan_detected,
    damaged,
    moved,
    shot_hit,
    can_move_forward: canMove(self, opponent, "FORWARD"),
    can_move_back: canMove(self, opponent, "BACK"),
    can_move_left: canMove(self, opponent, "LEFT"),
    can_move_right: canMove(self, opponent, "RIGHT"),
    self_hp: self.hp,
    turns_left: turnsLeft,
    self_facing: self.dir,
    enemy_distance: Math.abs(dx) + Math.abs(dy),
    enemy_forward_distance: dx * ffx + dy * ffy,
    enemy_right_distance: dx * frx + dy * fry,
  };
}

const ACTION_LABEL: Record<ActionType, string> = {
  MOVE_FORWARD: "前進",
  MOVE_BACK: "後退",
  MOVE_LEFT: "左移動",
  MOVE_RIGHT: "右移動",
  SHOOT_FORWARD: "前方射撃",
  SHOOT_BACK: "後方射撃",
  SHOOT_LEFT: "左方射撃",
  SHOOT_RIGHT: "右方射撃",
  SCAN_AROUND: "全方位索敵",
  WAIT: "待機",
};

function logLine(
  action: ActionType,
  moved: boolean,
  shoot: "HIT" | "MISS" | null,
  scan: boolean
): string {
  if (action in MOVE_ACTIONS) {
    return `${ACTION_LABEL[action]} → ${moved ? "成功" : "ブロック"}`;
  }
  if (action in SHOOT_ACTIONS) {
    return `${ACTION_LABEL[action]} → ${shoot === "HIT" ? `HIT -${SHOOT_DAMAGE}` : "MISS"}`;
  }
  if (action === "SCAN_AROUND") {
    return `${ACTION_LABEL[action]} → ${scan ? "検知あり" : "検知なし"}`;
  }
  return ACTION_LABEL[action];
}

export function simulate(
  strategy1: Strategy | null | undefined,
  strategy2: Strategy | null | undefined,
  options?: { maxTurns?: number }
): SimulationResult {
  const maxTurns = normalizeMaxTurns(options?.maxTurns);
  const p1: PlayerState = { x: 0, y: GRID_SIZE - 1, dir: "N", hp: INITIAL_HP };
  const p2: PlayerState = { x: GRID_SIZE - 1, y: 0, dir: "S", hp: INITIAL_HP };
  let perception1: Perception = buildPerception(p1, p2, false, 0, false, false, maxTurns);
  let perception2: Perception = buildPerception(p2, p1, false, 0, false, false, maxTurns);
  const vars1: Vars = {};
  const vars2: Vars = {};

  const turns: TurnSnapshot[] = [];
  let endReason: "HP_ZERO" | "TIMEOUT" = "TIMEOUT";

  for (let turn = 1; turn <= maxTurns; turn++) {
    const action1 = chooseAction(strategy1, perception1, vars1);
    const action2 = chooseAction(strategy2, perception2, vars2);

    // Resolve moves simultaneously: cannot move onto the opponent's current
    // cell, and if both target the same cell neither moves. Movement targets
    // are calculated from the pre-move facing; successful moves then update
    // both position and facing to the absolute movement direction.
    const moveRel1 = MOVE_ACTIONS[action1];
    const moveRel2 = MOVE_ACTIONS[action2];
    const move1 = moveRel1 ? relCell(p1, moveRel1) : null;
    const move2 = moveRel2 ? relCell(p2, moveRel2) : null;
    const validMove1 = move1 && inBounds(...move1) && !(move1[0] === p2.x && move1[1] === p2.y);
    const validMove2 = move2 && inBounds(...move2) && !(move2[0] === p1.x && move2[1] === p1.y);
    const collision = validMove1 && validMove2 && move1![0] === move2![0] && move1![1] === move2![1];
    const moved1 = !!validMove1 && !collision;
    const moved2 = !!validMove2 && !collision;
    if (moved1) {
      p1.x = move1![0];
      p1.y = move1![1];
      p1.dir = relDirection(p1.dir, moveRel1!);
    }
    if (moved2) {
      p2.x = move2![0];
      p2.y = move2![1];
      p2.dir = relDirection(p2.dir, moveRel2!);
    }

    // Shoots and scans use post-move positions.
    const shootRel1 = SHOOT_ACTIONS[action1];
    const shootRel2 = SHOOT_ACTIONS[action2];
    const shootDist1 = shootRel1 ? rayDistance(p1, p2, relDelta(p1.dir, shootRel1), SHOOT_RANGE) : 0;
    const shootDist2 = shootRel2 ? rayDistance(p2, p1, relDelta(p2.dir, shootRel2), SHOOT_RANGE) : 0;
    const shootResult1: "HIT" | "MISS" | null = shootRel1 ? (shootDist1 > 0 ? "HIT" : "MISS") : null;
    const shootResult2: "HIT" | "MISS" | null = shootRel2 ? (shootDist2 > 0 ? "HIT" : "MISS") : null;
    const damaged1 = shootDist2 > 0 ? SHOOT_DAMAGE : 0;
    const damaged2 = shootDist1 > 0 ? SHOOT_DAMAGE : 0;
    p1.hp = Math.max(0, p1.hp - damaged1);
    p2.hp = Math.max(0, p2.hp - damaged2);

    const targets1: DetectedTarget[] =
      action1 === "SCAN_AROUND"
        ? REL_DIRS.map((rel) => ({ rel, dist: rayDistance(p1, p2, relDelta(p1.dir, rel), SCAN_RANGE) }))
            .filter((o) => o.dist > 0)
            .map((o) => ({ direction: o.rel, distance: o.dist, age: 0 }))
        : [];
    const targets2: DetectedTarget[] =
      action2 === "SCAN_AROUND"
        ? REL_DIRS.map((rel) => ({ rel, dist: rayDistance(p2, p1, relDelta(p2.dir, rel), SCAN_RANGE) }))
            .filter((o) => o.dist > 0)
            .map((o) => ({ direction: o.rel, distance: o.dist, age: 0 }))
        : [];
    const scan1 = targets1.length > 0;
    const scan2 = targets2.length > 0;

    turns.push({
      turn,
      p1: {
        ...p1,
        action: action1,
        moved: moved1,
        damaged: damaged1,
        shoot_result: shootResult1,
        scan_detected: scan1,
        detected_targets: targets1,
      },
      p2: {
        ...p2,
        action: action2,
        moved: moved2,
        damaged: damaged2,
        shoot_result: shootResult2,
        scan_detected: scan2,
        detected_targets: targets2,
      },
      logs: [
        { playerId: "p1", text: logLine(action1, moved1, shootResult1, scan1) },
        { playerId: "p2", text: logLine(action2, moved2, shootResult2, scan2) },
      ],
    });

    perception1 = buildPerception(p1, p2, scan1, damaged1, moved1, shootResult1 === "HIT", maxTurns - turn);
    perception2 = buildPerception(p2, p1, scan2, damaged2, moved2, shootResult2 === "HIT", maxTurns - turn);

    if (p1.hp <= 0 || p2.hp <= 0) {
      endReason = "HP_ZERO";
      break;
    }
  }

  let winner: "p1" | "p2" | null = null;
  if (p1.hp > p2.hp) winner = "p1";
  else if (p2.hp > p1.hp) winner = "p2";

  return {
    turns,
    winner,
    endReason,
    finalHp: { p1: p1.hp, p2: p2.hp },
    totalTurns: turns.length,
  };
}

export function normalizeMaxTurns(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return MAX_TURNS;
  const integer = Math.trunc(value);
  if (integer < MIN_TURNS) return MIN_TURNS;
  if (integer > MAX_TURNS_LIMIT) return MAX_TURNS_LIMIT;
  return integer;
}
