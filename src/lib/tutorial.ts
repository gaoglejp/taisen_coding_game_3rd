import {
  INITIAL_HP,
  type ActionType,
  type BoardPosition,
  type PlayerState,
  type SimulationResult,
  type Strategy,
} from "@/lib/match-simulator";

export type TutorialMissionId = "mission-1" | "mission-2" | "mission-3" | "mission-4";

export interface TutorialBoardConfig {
  width: number;
  height: number;
}

export type TutorialSuccessCondition =
  | { type: "action_used"; player: "p1"; action: ActionType }
  | { type: "reached_position"; player: "p1"; x: number; y: number }
  | { type: "scan_detected"; player: "p1" }
  | { type: "enemy_damaged"; minDamage: number }
  | { type: "enemy_destroyed" };

export type TutorialFailureCondition =
  | { type: "max_turns_exceeded" }
  | { type: "player_destroyed"; player: "p1" };

export interface TutorialVerificationCase {
  caseId: string;
  title: string;
  summary: string;
  playerInitialState: PlayerState;
  enemyInitialState: PlayerState;
  enemyStrategy: Strategy;
  obstaclePositions: BoardPosition[];
  maxTurns: number;
  successConditions: TutorialSuccessCondition[];
  failureConditions: TutorialFailureCondition[];
}

export interface TutorialMission {
  missionId: TutorialMissionId;
  title: string;
  summary: string;
  learningGoals: string[];
  boardConfig: TutorialBoardConfig;
  playerInitialState: PlayerState;
  enemyInitialState: PlayerState;
  enemyStrategy: Strategy;
  obstaclePositions: BoardPosition[];
  maxTurns: number;
  allowedToolboxCategories: string[];
  allowedBlockTypes: string[];
  initialWorkspace: object;
  successConditions: TutorialSuccessCondition[];
  failureConditions: TutorialFailureCondition[];
  verificationCases: TutorialVerificationCase[];
  hints: string[];
  completionMessage: string;
  nextMissionId: TutorialMissionId | null;
}

export interface TutorialCaseEvaluation {
  caseId: string;
  title: string;
  summary: string;
  success: boolean;
  messages: string[];
}

export interface TutorialEvaluation {
  success: boolean;
  messages: string[];
  cases: TutorialCaseEvaluation[];
}

const WAIT_STRATEGY: Strategy = {
  version: "1.0",
  rules: [],
  fallbackActions: [{ type: "WAIT", ap: 0 }],
};

const M1_CASE: TutorialVerificationCase = {
  caseId: "goal-forward",
  title: "前へ進んでゴールへ到達",
  summary: "敵も障害物もない固定盤面で、2ターン以内に正面のゴールへ到達します。",
  playerInitialState: { x: 4, y: 8, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 8, y: 1, dir: "S", hp: INITIAL_HP },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [],
  maxTurns: 2,
  successConditions: [{ type: "reached_position", player: "p1", x: 4, y: 6 }],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

const M2_CASE_OPEN: TutorialVerificationCase = {
  caseId: "front-open",
  title: "ケースA: 正面が空いている",
  summary: "正面に進めるときは、前へ移動します。",
  playerInitialState: { x: 4, y: 5, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 8, y: 1, dir: "S", hp: INITIAL_HP },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [],
  maxTurns: 1,
  successConditions: [{ type: "reached_position", player: "p1", x: 4, y: 4 }],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

const M2_CASE_BLOCKED: TutorialVerificationCase = {
  caseId: "front-blocked",
  title: "ケースB: 正面がふさがれている",
  summary: "正面に障害物があるときは、自機から見て右へ移動します。",
  playerInitialState: { x: 4, y: 5, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 8, y: 1, dir: "S", hp: INITIAL_HP },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [{ x: 4, y: 4 }],
  maxTurns: 1,
  successConditions: [{ type: "reached_position", player: "p1", x: 5, y: 5 }],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

const M3_CASE: TutorialVerificationCase = {
  caseId: "scan-around",
  title: "周囲を索敵する",
  summary: "自機から見て右にいる停止中の敵を、周囲を索敵で検出します。",
  playerInitialState: { x: 4, y: 6, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 6, y: 6, dir: "S", hp: INITIAL_HP },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [],
  maxTurns: 1,
  successConditions: [{ type: "scan_detected", player: "p1" }],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

const M4_CASE_FORWARD: TutorialVerificationCase = {
  caseId: "enemy-forward",
  title: "ケースA: 敵が前方にいる",
  summary: "敵を索敵してから、前方射撃で敵を破壊します。",
  playerInitialState: { x: 4, y: 6, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 4, y: 4, dir: "S", hp: 1 },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [],
  maxTurns: 3,
  successConditions: [
    { type: "scan_detected", player: "p1" },
    { type: "action_used", player: "p1", action: "SHOOT_FORWARD" },
    { type: "enemy_destroyed" },
  ],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

const M4_CASE_RIGHT: TutorialVerificationCase = {
  caseId: "enemy-right",
  title: "ケースB: 敵が右方向にいる",
  summary: "敵を索敵してから、右方向射撃で敵を破壊します。",
  playerInitialState: { x: 4, y: 6, dir: "N", hp: INITIAL_HP },
  enemyInitialState: { x: 6, y: 6, dir: "S", hp: 1 },
  enemyStrategy: WAIT_STRATEGY,
  obstaclePositions: [],
  maxTurns: 3,
  successConditions: [
    { type: "scan_detected", player: "p1" },
    { type: "action_used", player: "p1", action: "SHOOT_RIGHT" },
    { type: "enemy_destroyed" },
  ],
  failureConditions: [{ type: "max_turns_exceeded" }],
};

export const TUTORIAL_MISSIONS: TutorialMission[] = [
  {
    missionId: "mission-1",
    title: "ルールで前へ進もう",
    summary: "「ルール 実行」の中に「前へ移動」を入れて、自機をゴールまで進めます。",
    learningGoals: [
      "行動ブロックを「ルール 実行」の中へ配置する",
      "ルール内の行動がターンごとに実行されることを確認する",
      "前へ移動で自機を進める",
    ],
    boardConfig: { width: 10, height: 10 },
    playerInitialState: M1_CASE.playerInitialState,
    enemyInitialState: M1_CASE.enemyInitialState,
    enemyStrategy: WAIT_STRATEGY,
    obstaclePositions: M1_CASE.obstaclePositions,
    maxTurns: M1_CASE.maxTurns,
    allowedToolboxCategories: ["行動", "ルール"],
    allowedBlockTypes: ["tank_rule_always", "tank_act_move_forward"],
    initialWorkspace: {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: "tank_rule_always", x: 40, y: 40 }],
      },
    },
    successConditions: M1_CASE.successConditions,
    failureConditions: M1_CASE.failureConditions,
    verificationCases: [M1_CASE],
    hints: [
      "行動ブロックは、ルールの中に入れます。",
      "前へ進むには、オレンジ色の「前へ移動」を使います。",
    ],
    completionMessage: "ゴールへ到達できました。",
    nextMissionId: "mission-2",
  },
  {
    missionId: "mission-2",
    title: "通れる道を選ぼう",
    summary: "「前に進める？」と「ではない」を使い、正面が空いている場合とふさがれている場合の両方に対応します。",
    learningGoals: [
      "障害物がある方向には移動できないことを確認する",
      "前に進める？で移動できるか確認する",
      "ルール もしで条件に応じて行動を変える",
      "ではないで「前に進めない場合」を表す",
    ],
    boardConfig: { width: 10, height: 10 },
    playerInitialState: M2_CASE_OPEN.playerInitialState,
    enemyInitialState: M2_CASE_OPEN.enemyInitialState,
    enemyStrategy: WAIT_STRATEGY,
    obstaclePositions: M2_CASE_OPEN.obstaclePositions,
    maxTurns: M2_CASE_OPEN.maxTurns,
    allowedToolboxCategories: ["行動", "状態確認", "論理・比較", "ルール"],
    allowedBlockTypes: [
      "tank_rule",
      "tank_chk_can_move_forward",
      "tank_not",
      "tank_act_move_forward",
      "tank_act_move_right",
    ],
    initialWorkspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "tank_rule",
            x: 40,
            y: 40,
            next: { block: { type: "tank_rule" } },
          },
        ],
      },
    },
    successConditions: [],
    failureConditions: [{ type: "max_turns_exceeded" }],
    verificationCases: [M2_CASE_OPEN, M2_CASE_BLOCKED],
    hints: [
      "正面に進めるか、先に確認してみましょう。",
      "条件に応じて行動を変えるには、「ルール もし」を使います。",
      "前に進めない場合は、「ではない」と「前に進める？」を組み合わせます。",
      "右方向は、画面の右ではなく、自機から見た右です。",
    ],
    completionMessage: "正面が空いている場合とふさがれている場合の両方に対応できました。",
    nextMissionId: "mission-3",
  },
  {
    missionId: "mission-3",
    title: "周囲の敵を探そう",
    summary: "「周囲を索敵」で敵を検出し、結果として敵の相対位置を確認します。",
    learningGoals: [
      "敵の位置は最初からプログラムに見えているわけではないことを確認する",
      "周囲を索敵で敵を検出する",
      "索敵後に敵情報を確認する",
    ],
    boardConfig: { width: 10, height: 10 },
    playerInitialState: M3_CASE.playerInitialState,
    enemyInitialState: M3_CASE.enemyInitialState,
    enemyStrategy: WAIT_STRATEGY,
    obstaclePositions: M3_CASE.obstaclePositions,
    maxTurns: M3_CASE.maxTurns,
    allowedToolboxCategories: ["行動", "ルール"],
    allowedBlockTypes: ["tank_rule_always", "tank_act_scan_around"],
    initialWorkspace: {
      blocks: {
        languageVersion: 0,
        blocks: [{ type: "tank_rule_always", x: 40, y: 40 }],
      },
    },
    successConditions: M3_CASE.successConditions,
    failureConditions: M3_CASE.failureConditions,
    verificationCases: [M3_CASE],
    hints: [
      "敵を探すときは、「周囲を索敵」を使います。",
      "「周囲を索敵」は、オレンジ色の行動ブロックです。",
      "索敵後には、自機から見た敵の位置を確認できます。",
    ],
    completionMessage: "索敵で敵を検出できました。",
    nextMissionId: "mission-4",
  },
  {
    missionId: "mission-4",
    title: "敵のいる方向へ撃とう",
    summary: "索敵して敵を見つけ、敵の位置に応じて射撃方向を変えます。",
    learningGoals: [
      "敵を検出している？を条件として使う",
      "敵を検出していない場合は索敵する",
      "敵の前方距離と右方向距離を比較する",
      "かつで条件を組み合わせる",
      "敵の位置に応じて射撃方向を変える",
    ],
    boardConfig: { width: 10, height: 10 },
    playerInitialState: M4_CASE_FORWARD.playerInitialState,
    enemyInitialState: M4_CASE_FORWARD.enemyInitialState,
    enemyStrategy: WAIT_STRATEGY,
    obstaclePositions: M4_CASE_FORWARD.obstaclePositions,
    maxTurns: M4_CASE_FORWARD.maxTurns,
    allowedToolboxCategories: ["行動", "敵情報", "論理・比較", "数値・変数", "ルール"],
    allowedBlockTypes: [
      "tank_rule",
      "tank_chk_enemy_detected",
      "tank_not",
      "tank_act_scan_around",
      "tank_num_enemy_forward_distance",
      "tank_num_enemy_right_distance",
      "tank_num_literal",
      "tank_cmp",
      "tank_logic_op",
      "tank_act_shoot_forward",
      "tank_act_shoot_right",
    ],
    initialWorkspace: {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "tank_rule",
            x: 40,
            y: 40,
            next: {
              block: {
                type: "tank_rule",
                next: { block: { type: "tank_rule" } },
              },
            },
          },
        ],
      },
    },
    successConditions: [],
    failureConditions: [{ type: "max_turns_exceeded" }],
    verificationCases: [M4_CASE_FORWARD, M4_CASE_RIGHT],
    hints: [
      "敵を見つけていない場合は、まず索敵します。",
      "「敵を検出している？」を条件として使います。",
      "このチュートリアルでは既存エンジンどおり1ターンに1つの行動が採用されるため、索敵と射撃は別ターンになることがあります。",
      "敵が前方にいる場合は、右方向距離が0になります。",
      "敵が右方向にいる場合は、前方距離が0になります。",
      "2つの条件を組み合わせるには、「かつ」を使います。",
    ],
    completionMessage: "敵の位置に応じて射撃方向を選べました。基本チュートリアルを完了しました。",
    nextMissionId: null,
  },
];

export const TUTORIAL_MISSION_IDS = TUTORIAL_MISSIONS.map((mission) => mission.missionId);

export function getTutorialMission(missionId: string): TutorialMission | null {
  return TUTORIAL_MISSIONS.find((mission) => mission.missionId === missionId) ?? null;
}

export function getMissionNumber(missionId: TutorialMissionId): number {
  return TUTORIAL_MISSION_IDS.indexOf(missionId) + 1;
}

export function evaluateTutorialCase(
  testCase: TutorialVerificationCase,
  result: SimulationResult
): TutorialCaseEvaluation {
  const messages: string[] = [];
  const success = testCase.successConditions.every((condition) => {
    switch (condition.type) {
      case "action_used": {
        const matched = result.turns.some((turn) => turn[condition.player].action === condition.action);
        if (!matched) messages.push(`必要な行動 ${condition.action} が実行されていません。`);
        return matched;
      }
      case "reached_position": {
        const matched = result.turns.some(
          (turn) => turn[condition.player].x === condition.x && turn[condition.player].y === condition.y
        );
        if (!matched) messages.push(`ゴール地点 (${condition.x}, ${condition.y}) に到達していません。`);
        return matched;
      }
      case "scan_detected": {
        const matched = result.turns.some((turn) => turn[condition.player].scan_detected);
        if (!matched) messages.push("索敵で敵を検出できていません。");
        return matched;
      }
      case "enemy_damaged": {
        const damage = result.turns.reduce((sum, turn) => sum + turn.p2.damaged, 0);
        const matched = damage >= condition.minDamage;
        if (!matched) messages.push("敵にダメージを与えられていません。");
        return matched;
      }
      case "enemy_destroyed": {
        const matched = result.finalHp.p2 <= 0;
        if (!matched) messages.push("敵を破壊できていません。");
        return matched;
      }
    }
  });

  return {
    caseId: testCase.caseId,
    title: testCase.title,
    summary: testCase.summary,
    success,
    messages,
  };
}

export function summarizeTutorialEvaluation(cases: TutorialCaseEvaluation[]): TutorialEvaluation {
  const failed = cases.filter((testCase) => !testCase.success);
  return {
    success: failed.length === 0,
    messages: failed.map((testCase) => `${testCase.title}: ${testCase.messages.join(" ")}`),
    cases,
  };
}

export function evaluateTutorialSuccess(
  mission: TutorialMission,
  result: SimulationResult
): TutorialEvaluation {
  return summarizeTutorialEvaluation([evaluateTutorialCase(mission.verificationCases[0], result)]);
}
