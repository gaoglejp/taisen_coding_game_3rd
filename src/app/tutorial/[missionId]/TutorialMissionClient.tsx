"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { createStrategyToolbox } from "@/lib/strategy-blocks";
import {
  getMissionNumber,
  type TutorialMission,
} from "@/lib/tutorial";
import {
  DEFAULT_TUTORIAL_PROGRESS,
  isMissionUnlocked,
  loadTutorialProgress,
  markMissionCompleted,
  type TutorialProgress,
} from "@/lib/tutorial-progress";
import {
  GRID_SIZE,
  type BoardPosition,
  type Direction,
  type SimulationResult,
  type Strategy,
  type TurnSnapshot,
} from "@/lib/match-simulator";

const BlocklyEditor = dynamic(() => import("@/components/coding/BlocklyEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
      エディタを読み込み中...
    </div>
  ),
});

interface TutorialResponse {
  result: SimulationResult;
  caseResults?: Array<{
    case: { caseId: string; title: string; summary: string };
    result: SimulationResult;
    evaluation: { caseId: string; title: string; summary: string; success: boolean; messages: string[] };
  }>;
  evaluation: { success: boolean; messages: string[] };
}

const EMPTY_STRATEGY: Strategy = {
  version: "1.0",
  rules: [],
  fallbackBody: [{ kind: "action", type: "WAIT" }],
};

const DIR_ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };

export function TutorialMissionClient({ mission }: { mission: TutorialMission }) {
  const [strategy, setStrategy] = useState<Strategy>(EMPTY_STRATEGY);
  const [runResult, setRunResult] = useState<TutorialResponse | null>(null);
  const [progress, setProgress] = useState<TutorialProgress>(DEFAULT_TUTORIAL_PROGRESS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedRuns, setFailedRuns] = useState(0);
  const [editorResetVersion, setEditorResetVersion] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setProgress(loadTutorialProgress()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const toolbox = useMemo(
    () =>
      createStrategyToolbox({
        allowedCategories: mission.allowedToolboxCategories,
        allowedBlockTypes: mission.allowedBlockTypes,
      }),
    [mission.allowedBlockTypes, mission.allowedToolboxCategories]
  );

  const unlocked = isMissionUnlocked(mission.missionId, progress);
  const displayResult = runResult?.caseResults?.find((caseResult) => !caseResult.evaluation.success)?.result ?? runResult?.result;
  const latestTurn = displayResult?.turns.at(-1);
  const p1 = latestTurn?.p1 ?? mission.playerInitialState;
  const p2 = latestTurn?.p2 ?? mission.enemyInitialState;
  const visibleHints = mission.hints.slice(0, Math.min(mission.hints.length, Math.max(1, failedRuns + 1)));

  const handleStrategyChange = useCallback((next: Strategy) => {
    setStrategy(next);
  }, []);

  const runMission = async () => {
    setBusy(true);
    setError(null);
    setRunResult(null);
    try {
      const res = await fetch("/api/tutorial/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ missionId: mission.missionId, strategy }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result || !data?.evaluation) {
        throw new Error(data?.error ?? "simulate_failed");
      }
      setRunResult(data);
      if (data.evaluation.success) {
        setFailedRuns(0);
        setProgress((current) => markMissionCompleted(mission.missionId, current));
      } else {
        setFailedRuns((current) => Math.min(Math.max(0, mission.hints.length - 1), current + 1));
      }
    } catch {
      setError("実行できませんでした。ブロックを確認してもう一度試してください。");
    } finally {
      setBusy(false);
    }
  };

  const resetRun = () => {
    setStrategy(EMPTY_STRATEGY);
    setRunResult(null);
    setError(null);
    setFailedRuns(0);
    setEditorResetVersion((current) => current + 1);
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <TopbarPaper title="基本チュートリアル" />
      <main style={{ width: "100%", maxWidth: 1360, margin: "0 auto", padding: "18px 20px 92px", flex: 1 }}>
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 14,
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ maxWidth: 820 }}>
            <Link href="/tutorial" style={{ color: "var(--ink-soft)", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>
              ← チュートリアルトップへ戻る
            </Link>
            <h1 style={{ margin: "6px 0 8px", fontSize: 24, color: "var(--ink)" }}>
              Mission {getMissionNumber(mission.missionId)}: {mission.title}
            </h1>
            <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>{mission.summary}</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <Link href="/practice" style={secondaryButtonStyle}>
              通常の一人対戦へ戻る
            </Link>
            {mission.nextMissionId && progress.completedMissionIds.includes(mission.missionId) && (
              <Link href={`/tutorial/${mission.nextMissionId}`} style={primaryLinkStyle}>
                次のミッションへ
              </Link>
            )}
          </div>
        </section>

        {!unlocked && (
          <div
            role="alert"
            style={{
              border: "1px solid #f3d27d",
              background: "var(--accent-soft)",
              borderRadius: 12,
              padding: 14,
              marginBottom: 14,
              fontWeight: 800,
            }}
          >
            このミッションはまだ開始できません。前のミッションをクリアしてください。
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(520px, 1.1fr) minmax(420px, .9fr)", gap: 14 }}>
          <section style={panelStyle}>
            <header style={panelHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>今回学ぶ内容</h2>
                <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--ink-soft)", fontSize: 13, lineHeight: 1.7 }}>
                  {mission.learningGoals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>
            </header>
            <div style={{ height: 520, borderTop: "1px solid var(--line)" }}>
              <BlocklyEditor
                key={`${mission.missionId}-${editorResetVersion}`}
                onChange={handleStrategyChange}
                initialState={mission.initialWorkspace}
                toolbox={toolbox}
                readOnly={!unlocked}
              />
            </div>
          </section>

          <section style={panelStyle}>
            <header style={panelHeaderStyle}>
              <div>
                <h2 style={sectionTitleStyle}>現在の盤面</h2>
                <p style={{ margin: "4px 0 0", color: "var(--ink-soft)", fontSize: 12 }}>
                  固定初期位置と固定障害物で、同じコードを必要な確認ケースに通します。
                </p>
              </div>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 900 }}>
                TURN {displayResult?.totalTurns ?? 0} / {mission.maxTurns}
              </span>
            </header>
            <div style={{ padding: 16, display: "grid", gap: 14 }}>
              <Board p1={p1} p2={p2} obstacles={mission.obstaclePositions} snapshot={latestTurn} />
              <ResultPanel mission={mission} response={runResult} error={error} />
              <CasePanel response={runResult} />
              <ScanPanel response={runResult} />
              <div style={{ display: "grid", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>ヒント</h3>
                <p style={{ margin: 0, color: "var(--ink-soft)", fontSize: 12 }}>
                  失敗すると次のヒントを表示します。
                </p>
                {visibleHints.map((hint) => (
                  <div key={hint} style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, fontSize: 13 }}>
                    {hint}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer style={footerStyle}>
        <div style={{ maxWidth: 1360, margin: "0 auto", width: "100%", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/tutorial" style={secondaryButtonStyle}>
            チュートリアルトップへ戻る
          </Link>
          <button type="button" onClick={runMission} disabled={busy || !unlocked} style={primaryButtonStyle(busy || !unlocked)}>
            {busy ? "実行中..." : "実行"}
          </button>
          <button type="button" onClick={resetRun} style={secondaryButtonStyle}>
            リセット
          </button>
          {runResult?.evaluation.success && mission.nextMissionId && (
            <Link href={`/tutorial/${mission.nextMissionId}`} style={{ ...primaryLinkStyle, marginLeft: "auto" }}>
              次のミッションへ進む
            </Link>
          )}
        </div>
      </footer>
    </div>
  );
}

function ResultPanel({
  mission,
  response,
  error,
}: {
  mission: TutorialMission;
  response: TutorialResponse | null;
  error: string | null;
}) {
  if (error) {
    return <div role="alert" style={resultStyle("#fee2e2", "#dc2626")}>{error}</div>;
  }
  if (!response) {
    return <div style={resultStyle("var(--bg)", "var(--ink-soft)")}>実行結果はまだありません。</div>;
  }
  if (response.evaluation.success) {
    return <div style={resultStyle("#dcfce7", "#15803d")}>{mission.completionMessage}</div>;
  }
  return (
    <div style={resultStyle("#fef3c7", "#92400e")}>
      <strong>まだクリア条件を満たしていません。</strong>
      {response.evaluation.messages.map((message) => (
        <div key={message}>{message}</div>
      ))}
    </div>
  );
}

function CasePanel({ response }: { response: TutorialResponse | null }) {
  if (!response?.caseResults || response.caseResults.length <= 1) return null;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14 }}>確認ケース</h3>
      {response.caseResults.map((caseResult) => (
        <div
          key={caseResult.case.caseId}
          style={{
            background: caseResult.evaluation.success ? "#dcfce7" : "#fef3c7",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 10,
            fontSize: 13,
            display: "grid",
            gap: 4,
          }}
        >
          <strong style={{ color: caseResult.evaluation.success ? "#15803d" : "#92400e" }}>
            {caseResult.evaluation.success ? "成功" : "未達"}: {caseResult.case.title}
          </strong>
          <span style={{ color: "var(--ink-soft)" }}>{caseResult.case.summary}</span>
          {caseResult.evaluation.messages.map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function ScanPanel({ response }: { response: TutorialResponse | null }) {
  const scanned = response?.caseResults
    ?.flatMap((caseResult) =>
      caseResult.result.turns
        .filter((turn) => turn.p1.scan_detected)
        .map((turn) => ({ title: caseResult.case.title, turn }))
    )
    .at(0);
  if (!scanned) return null;
  const target = scanned.turn.p1.detected_targets[0];
  if (!target) return null;
  const forward = target.direction === "FORWARD" ? target.distance : 0;
  const right = target.direction === "RIGHT" ? target.distance : target.direction === "LEFT" ? -target.distance : 0;
  const distance = target.distance;
  return (
    <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, fontSize: 13 }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>索敵結果</h3>
      <div>敵を発見しました。</div>
      <div style={{ marginTop: 6, display: "grid", gap: 3, fontFamily: "JetBrains Mono, monospace" }}>
        <span>敵の前方距離: {forward}</span>
        <span>敵の右方向距離: {right}</span>
        <span>敵までの距離: {distance}</span>
      </div>
    </div>
  );
}

function Board({
  p1,
  p2,
  obstacles,
  snapshot,
}: {
  p1: { x: number; y: number; dir: Direction; hp: number };
  p2: { x: number; y: number; dir: Direction; hp: number };
  obstacles: BoardPosition[];
  snapshot?: TurnSnapshot;
}) {
  const obstacleKeys = new Set(obstacles.map((pos) => `${pos.x},${pos.y}`));
  const cellSize = 32;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID_SIZE}, ${cellSize}px)`, justifyContent: "center" }}>
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
          const x = index % GRID_SIZE;
          const y = Math.floor(index / GRID_SIZE);
          const isP1 = p1.x === x && p1.y === y;
          const isP2 = p2.x === x && p2.y === y;
          const blocked = obstacleKeys.has(`${x},${y}`);
          return (
            <div
              key={`${x}-${y}`}
              style={{
                width: cellSize,
                height: cellSize,
                border: "1px solid var(--line)",
                background: blocked ? "#cbd5e1" : "var(--surface)",
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                fontWeight: 900,
              }}
            >
              {isP1 ? <Tank label={DIR_ARROW[p1.dir]} color="var(--p1)" /> : isP2 ? <Tank label={DIR_ARROW[p2.dir]} color="var(--p2)" /> : null}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: "var(--ink-soft)" }}>
        <span>P1 HP {p1.hp}</span>
        <span>P2 HP {p2.hp}</span>
        <span>直近: {snapshot ? `${snapshot.p1.action} / ${snapshot.p2.action}` : "-"}</span>
      </div>
    </div>
  );
}

function Tank({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        background: color,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

const panelStyle = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  overflow: "hidden",
} satisfies CSSProperties;

const panelHeaderStyle = {
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
} satisfies CSSProperties;

const sectionTitleStyle = {
  margin: 0,
  fontSize: 17,
  fontWeight: 900,
  color: "var(--ink)",
} satisfies CSSProperties;

const secondaryButtonStyle = {
  display: "inline-flex",
  border: "1px solid var(--line)",
  background: "var(--surface)",
  color: "var(--ink)",
  borderRadius: 9,
  padding: "9px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
} satisfies CSSProperties;

const primaryLinkStyle = {
  display: "inline-flex",
  border: "1px solid var(--p1)",
  background: "var(--p1)",
  color: "#fff",
  borderRadius: 9,
  padding: "9px 14px",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
} satisfies CSSProperties;

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    border: "none",
    background: disabled ? "#d1d5db" : "var(--accent)",
    color: "#fff",
    borderRadius: 9,
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}

function resultStyle(background: string, color: string): CSSProperties {
  return {
    background,
    color,
    borderRadius: 10,
    border: "1px solid var(--line)",
    padding: 12,
    fontSize: 13,
    fontWeight: 800,
    display: "grid",
    gap: 4,
  };
}

const footerStyle = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  background: "var(--surface)",
  borderTop: "1px solid var(--line)",
  padding: "12px 20px",
  boxShadow: "0 -6px 18px rgba(31,35,48,0.06)",
} satisfies CSSProperties;
