import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { MAX_TURNS, simulate, type Strategy } from "@/lib/match-simulator";
import { isRecord, isValidStrategy } from "@/lib/strategy-validation";

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
