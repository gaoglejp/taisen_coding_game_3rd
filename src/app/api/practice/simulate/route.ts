import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { MAX_TURNS, simulate, type Strategy } from "@/lib/match-simulator";

const ACTION_TYPES = new Set([
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

const CONDITION_TYPES = new Set([
  "scan_detected",
  "damaged",
  "moved",
  "can_move_forward",
  "can_move_back",
  "can_move_left",
  "can_move_right",
]);

const BOTS = {
  weak: {
    name: "待機ボット",
    strategy: {
      version: "1.0",
      rules: [],
      fallbackActions: [{ type: "WAIT", ap: 0 }],
    } satisfies Strategy,
  },
  normal: {
    name: "巡回ボット",
    strategy: {
      version: "1.0",
      rules: [
        { conditions: [{ type: "scan_detected", value: true }], actions: [{ type: "SHOOT_FORWARD", ap: 1 }] },
        { conditions: [{ type: "can_move_forward", value: true }], actions: [{ type: "MOVE_FORWARD", ap: 1 }] },
        { conditions: [{ type: "can_move_right", value: true }], actions: [{ type: "MOVE_RIGHT", ap: 1 }] },
      ],
      fallbackActions: [{ type: "SCAN_AROUND", ap: 1 }],
    } satisfies Strategy,
  },
} as const;

type Difficulty = keyof typeof BOTS;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidAction(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!ACTION_TYPES.has(String(value.type))) return false;
  return value.ap === undefined || typeof value.ap === "number";
}

function isValidCondition(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return CONDITION_TYPES.has(String(value.type)) && typeof value.value === "boolean";
}

function isValidStrategy(value: unknown): value is Strategy {
  if (!isRecord(value)) return false;

  const rules = value.rules;
  if (rules !== undefined) {
    if (!Array.isArray(rules)) return false;
    for (const rule of rules) {
      if (!isRecord(rule)) return false;
      const conditions = rule.conditions;
      const actions = rule.actions;
      if (conditions !== undefined && (!Array.isArray(conditions) || !conditions.every(isValidCondition))) {
        return false;
      }
      if (actions !== undefined && (!Array.isArray(actions) || !actions.every(isValidAction))) {
        return false;
      }
    }
  }

  const fallbackActions = value.fallbackActions;
  if (
    fallbackActions !== undefined &&
    (!Array.isArray(fallbackActions) || !fallbackActions.every(isValidAction))
  ) {
    return false;
  }

  return Array.isArray(rules) || Array.isArray(fallbackActions);
}

function parseDifficulty(value: unknown): Difficulty | null {
  if (value === undefined || value === "weak") return "weak";
  if (value === "normal") return "normal";
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !isValidStrategy(body.strategy)) {
    return NextResponse.json({ error: "invalid_strategy" }, { status: 400 });
  }

  const difficulty = parseDifficulty(body.difficulty);
  if (!difficulty) {
    return NextResponse.json({ error: "invalid_difficulty" }, { status: 400 });
  }

  const bot = BOTS[difficulty];
  const result = simulate(body.strategy, bot.strategy, { maxTurns: MAX_TURNS });

  return NextResponse.json({
    bot: { difficulty, name: bot.name },
    result,
  });
}
