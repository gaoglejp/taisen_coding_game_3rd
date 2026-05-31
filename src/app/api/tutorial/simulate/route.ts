import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { simulate } from "@/lib/match-simulator";
import {
  evaluateTutorialCase,
  getTutorialMission,
  summarizeTutorialEvaluation,
} from "@/lib/tutorial";
import { isRecord, isValidStrategy } from "@/lib/strategy-validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.missionId !== "string") {
    return NextResponse.json({ error: "invalid_mission" }, { status: 400 });
  }

  const mission = getTutorialMission(body.missionId);
  if (!mission) {
    return NextResponse.json({ error: "mission_not_found" }, { status: 404 });
  }

  if (!isValidStrategy(body.strategy)) {
    return NextResponse.json({ error: "invalid_strategy" }, { status: 400 });
  }
  const strategy = body.strategy;

  const caseResults = mission.verificationCases.map((testCase) => {
    const result = simulate(strategy, testCase.enemyStrategy, {
      maxTurns: testCase.maxTurns,
      playerInitialState: testCase.playerInitialState,
      enemyInitialState: testCase.enemyInitialState,
      obstaclePositions: testCase.obstaclePositions,
    });
    return {
      case: {
        caseId: testCase.caseId,
        title: testCase.title,
        summary: testCase.summary,
      },
      result,
      evaluation: evaluateTutorialCase(testCase, result),
    };
  });
  const evaluation = summarizeTutorialEvaluation(caseResults.map((caseResult) => caseResult.evaluation));

  return NextResponse.json({
    missionId: mission.missionId,
    result: caseResults[0]?.result,
    caseResults,
    evaluation,
  });
}
