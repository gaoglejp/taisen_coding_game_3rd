// Pure deterministic turn simulator for a 10x10, two-player match.
//
// A strategy is the JSON object produced by the coding page (see
// MOCK_STRATEGY_JSON in src/app/match/[matchId]/coding/page.tsx). The simulator
// evaluates rules in order, takes the first matching rule's first action, and
// applies it. With no matching rule it falls back to `fallbackActions[0]`, or
// WAIT if that is missing too.
//
// The simulator is intentionally small: no obstacles, no items, no AP budget,
// one action per player per turn. The intent is to get a complete game loop
// landed end-to-end; richer rules can be layered on without changing the
// turn_event / match_result shape.

export type Direction = "N" | "E" | "S" | "W";

export type ActionType =
  | "MOVE_FORWARD"
  | "TURN_LEFT"
  | "TURN_RIGHT"
  | "SHOOT_FORWARD"
  | "SCAN"
  | "WAIT";

const ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  "MOVE_FORWARD",
  "TURN_LEFT",
  "TURN_RIGHT",
  "SHOOT_FORWARD",
  "SCAN",
  "WAIT",
]);

export interface PlayerState {
  x: number;
  y: number;
  dir: Direction;
  hp: number;
}

export interface DetectedTarget {
  direction: "forward";
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

interface StrategyCondition {
  type?: string;
  value?: unknown;
}

interface StrategyAction {
  type?: string;
  ap?: number;
}

interface StrategyRule {
  conditions?: StrategyCondition[];
  actions?: StrategyAction[];
}

export interface Strategy {
  version?: string;
  rules?: StrategyRule[];
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

interface Perception {
  scan_detected: boolean;
  damaged: number;
  moved: boolean;
}

function isAction(value: unknown): value is ActionType {
  return typeof value === "string" && ACTION_TYPES.has(value as ActionType);
}

function chooseAction(strategy: Strategy | null | undefined, perception: Perception): ActionType {
  const rules = strategy?.rules ?? [];
  for (const rule of rules) {
    const conds = rule?.conditions ?? [];
    if (conds.every((c) => evaluateCondition(c, perception))) {
      const action = rule?.actions?.[0]?.type;
      if (isAction(action)) return action;
    }
  }
  const fallback = strategy?.fallbackActions?.[0]?.type;
  return isAction(fallback) ? fallback : "WAIT";
}

function evaluateCondition(c: StrategyCondition, p: Perception): boolean {
  switch (c?.type) {
    case "scan_detected":
      return p.scan_detected === Boolean(c.value);
    case "damaged":
      return p.damaged > 0 === Boolean(c.value);
    case "moved":
      return p.moved === Boolean(c.value);
    default:
      return false;
  }
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function forwardCell(player: PlayerState): [number, number] {
  const [dx, dy] = DIR_DELTA[player.dir];
  return [player.x + dx, player.y + dy];
}

// Distance along `shooter.dir` to `target` if target is on that ray within
// `range`. Returns 0 if not in line.
function forwardDistance(shooter: PlayerState, target: PlayerState, range: number): number {
  const [dx, dy] = DIR_DELTA[shooter.dir];
  for (let step = 1; step <= range; step++) {
    const x = shooter.x + dx * step;
    const y = shooter.y + dy * step;
    if (!inBounds(x, y)) return 0;
    if (target.x === x && target.y === y) return step;
  }
  return 0;
}

function applyTurnAction(player: PlayerState, action: ActionType): void {
  if (action === "TURN_LEFT") player.dir = TURN_LEFT_OF[player.dir];
  else if (action === "TURN_RIGHT") player.dir = TURN_RIGHT_OF[player.dir];
}

const ACTION_LABEL: Record<ActionType, string> = {
  MOVE_FORWARD: "前進",
  TURN_LEFT: "左旋回",
  TURN_RIGHT: "右旋回",
  SHOOT_FORWARD: "射撃",
  SCAN: "索敵",
  WAIT: "待機",
};

function logLine(
  action: ActionType,
  moved: boolean,
  shoot: "HIT" | "MISS" | null,
  scan: boolean
): string {
  const tail =
    action === "MOVE_FORWARD"
      ? moved
        ? "成功"
        : "ブロック"
      : action === "SHOOT_FORWARD"
        ? shoot === "HIT"
          ? `HIT -${SHOOT_DAMAGE}`
          : "MISS"
        : action === "SCAN"
          ? scan
            ? "検知あり"
            : "検知なし"
          : "";
  return tail ? `${ACTION_LABEL[action]} → ${tail}` : ACTION_LABEL[action];
}

export function simulate(
  strategy1: Strategy | null | undefined,
  strategy2: Strategy | null | undefined,
  options?: { maxTurns?: number }
): SimulationResult {
  const maxTurns = normalizeMaxTurns(options?.maxTurns);
  const p1: PlayerState = { x: 0, y: 0, dir: "E", hp: INITIAL_HP };
  const p2: PlayerState = { x: GRID_SIZE - 1, y: GRID_SIZE - 1, dir: "W", hp: INITIAL_HP };
  let perception1: Perception = { scan_detected: false, damaged: 0, moved: false };
  let perception2: Perception = { scan_detected: false, damaged: 0, moved: false };

  const turns: TurnSnapshot[] = [];
  let endReason: "HP_ZERO" | "TIMEOUT" = "TIMEOUT";

  for (let turn = 1; turn <= maxTurns; turn++) {
    const action1 = chooseAction(strategy1, perception1);
    const action2 = chooseAction(strategy2, perception2);

    // Resolve moves simultaneously: cannot move onto opponent, cannot swap
    // into the same cell. If they collide on the target cell, neither moves.
    const move1 = action1 === "MOVE_FORWARD" ? forwardCell(p1) : null;
    const move2 = action2 === "MOVE_FORWARD" ? forwardCell(p2) : null;
    const validMove1 = move1 && inBounds(...move1) && !(move1[0] === p2.x && move1[1] === p2.y);
    const validMove2 = move2 && inBounds(...move2) && !(move2[0] === p1.x && move2[1] === p1.y);
    const collision = validMove1 && validMove2 && move1![0] === move2![0] && move1![1] === move2![1];
    const moved1 = !!validMove1 && !collision;
    const moved2 = !!validMove2 && !collision;
    if (moved1) {
      p1.x = move1![0];
      p1.y = move1![1];
    }
    if (moved2) {
      p2.x = move2![0];
      p2.y = move2![1];
    }

    applyTurnAction(p1, action1);
    applyTurnAction(p2, action2);

    // Shoots and scans use post-move positions.
    const shootDist1 = action1 === "SHOOT_FORWARD" ? forwardDistance(p1, p2, SHOOT_RANGE) : 0;
    const shootDist2 = action2 === "SHOOT_FORWARD" ? forwardDistance(p2, p1, SHOOT_RANGE) : 0;
    const shootResult1: "HIT" | "MISS" | null =
      action1 === "SHOOT_FORWARD" ? (shootDist1 > 0 ? "HIT" : "MISS") : null;
    const shootResult2: "HIT" | "MISS" | null =
      action2 === "SHOOT_FORWARD" ? (shootDist2 > 0 ? "HIT" : "MISS") : null;
    const damaged1 = shootDist2 > 0 ? SHOOT_DAMAGE : 0;
    const damaged2 = shootDist1 > 0 ? SHOOT_DAMAGE : 0;
    p1.hp = Math.max(0, p1.hp - damaged1);
    p2.hp = Math.max(0, p2.hp - damaged2);

    const scanDist1 = action1 === "SCAN" ? forwardDistance(p1, p2, SCAN_RANGE) : 0;
    const scanDist2 = action2 === "SCAN" ? forwardDistance(p2, p1, SCAN_RANGE) : 0;
    const scan1 = scanDist1 > 0;
    const scan2 = scanDist2 > 0;

    const targets1: DetectedTarget[] = scan1
      ? [{ direction: "forward", distance: scanDist1, age: 0 }]
      : [];
    const targets2: DetectedTarget[] = scan2
      ? [{ direction: "forward", distance: scanDist2, age: 0 }]
      : [];

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

    perception1 = { scan_detected: scan1, damaged: damaged1, moved: moved1 };
    perception2 = { scan_detected: scan2, damaged: damaged2, moved: moved2 };

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
