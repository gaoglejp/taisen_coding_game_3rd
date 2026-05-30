"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ActionEffects } from "@/components/battle/ActionEffects";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { DEFAULT_WORKSPACE_STATE } from "@/lib/strategy-blocks";
import { GRID_SIZE, INITIAL_HP, MAX_TURNS, type Direction, type SimulationResult, type Strategy, type TurnSnapshot } from "@/lib/match-simulator";

const BlocklyEditor = dynamic(() => import("@/components/coding/BlocklyEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
      エディタを読み込み中…
    </div>
  ),
});

type Difficulty = "weak" | "normal";

interface PracticeResponse {
  bot: { difficulty: Difficulty; name: string };
  result: SimulationResult;
}

const EMPTY_STRATEGY: Strategy = {
  version: "1.0",
  rules: [],
  fallbackActions: [{ type: "WAIT", ap: 0 }],
};

const INITIAL_P1 = { x: 0, y: GRID_SIZE - 1, dir: "N" as Direction, hp: INITIAL_HP };
const INITIAL_P2 = { x: GRID_SIZE - 1, y: 0, dir: "S" as Direction, hp: INITIAL_HP };
const DIR_ARROW: Record<Direction, string> = { N: "↑", E: "→", S: "↓", W: "←" };
const TURN_EFFECT_MS = 860;
const ACTION_LABEL: Record<string, string> = {
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

const subscribeHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeHydration, () => true, () => false);
}

function HpBar({ hp, color }: { hp: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, fontWeight: 700 }}>
        <span>HP</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{hp} / {INITIAL_HP}</span>
      </div>
      <div style={{ height: 9, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${Math.max(0, Math.min(100, (hp / INITIAL_HP) * 100))}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width .25s ease",
          }}
        />
      </div>
    </div>
  );
}

function PlayerPanel({
  label,
  name,
  color,
  soft,
  ink,
  state,
  turn,
}: {
  label: "P1" | "P2";
  name: string;
  color: string;
  soft: string;
  ink: string;
  state: { x: number; y: number; dir: Direction; hp: number };
  turn?: TurnSnapshot["p1"];
}) {
  const displayX = "ABCDEFGHIJ"[state.x] ?? String(state.x);
  const displayY = GRID_SIZE - state.y;

  return (
    <aside
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 14,
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            background: color,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            padding: "3px 10px",
            borderRadius: 999,
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {label}
        </span>
        <strong style={{ fontSize: 14 }}>{name}</strong>
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 10, fontSize: 12 }}>
          <span><span style={{ color: "var(--ink-soft)" }}>x=</span><strong>{displayX}</strong></span>
          <span><span style={{ color: "var(--ink-soft)" }}>y=</span><strong>{displayY}</strong></span>
          <span
            style={{
              background: soft,
              color: ink,
              fontSize: 10,
              fontWeight: 800,
              padding: "1px 8px",
              borderRadius: 999,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {DIR_ARROW[state.dir]} {state.dir}
          </span>
        </div>
        <HpBar hp={state.hp} color={color} />
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 8 }}>last_turn</div>
        {[
          ["action", turn ? ACTION_LABEL[turn.action] ?? turn.action : "—"],
          ["damaged", String(turn?.damaged ?? 0)],
          ["shoot_result", turn?.shoot_result ?? "—"],
          ["scan_detected", String(turn?.scan_detected ?? false)],
          ["moved", String(turn?.moved ?? false)],
        ].map(([key, value]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, marginBottom: 4 }}>
            <span style={{ color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{key}</span>
            <strong style={{ fontFamily: "JetBrains Mono, monospace", color: value === "HIT" || value === "true" ? "var(--success)" : value !== "0" && key === "damaged" ? "var(--danger)" : "var(--ink)" }}>
              {value}
            </strong>
          </div>
        ))}
      </div>
    </aside>
  );
}

function Board({
  p1,
  p2,
  snapshot,
  cellSize,
}: {
  p1: { x: number; y: number; dir: Direction; hp: number };
  p2: { x: number; y: number; dir: Direction; hp: number };
  snapshot?: TurnSnapshot;
  cellSize: number;
}) {
  const cols = "ABCDEFGHIJ";
  const glyphSize = Math.max(20, cellSize - 10);
  return (
    <div aria-label="練習バトル盤面">
      <div style={{ display: "flex", marginLeft: 28 }}>
        {Array.from({ length: GRID_SIZE }, (_, i) => (
          <div key={i} style={{ width: cellSize, textAlign: "center", fontSize: 10, fontWeight: 800, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
            {cols[i]}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        <div>
          {Array.from({ length: GRID_SIZE }, (_, row) => (
            <div key={row} style={{ width: 24, height: cellSize, textAlign: "right", paddingRight: 4, fontSize: 10, fontWeight: 800, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace", display: "grid", alignItems: "center" }}>
              {GRID_SIZE - row}
            </div>
          ))}
        </div>
        <div style={{ position: "relative", width: cellSize * GRID_SIZE, height: cellSize * GRID_SIZE }}>
          {Array.from({ length: GRID_SIZE }, (_, row) => (
            <div key={row} style={{ display: "flex", alignItems: "center" }}>
              {Array.from({ length: GRID_SIZE }, (_, col) => {
                const isP1 = p1.x === col && p1.y === row;
                const isP2 = p2.x === col && p2.y === row;
                return (
                  <div
                    key={col}
                    style={{
                      width: cellSize,
                      height: cellSize,
                      border: "1px solid var(--line)",
                      background: "var(--surface)",
                      display: "grid",
                      placeItems: "center",
                      position: "relative",
                    }}
                  >
                    {isP1 && (
                      <TankGlyph arrow={DIR_ARROW[p1.dir]} background="var(--p1)" shadow="rgba(37,99,235,.38)" size={glyphSize} />
                    )}
                    {isP2 && (
                      <TankGlyph arrow={DIR_ARROW[p2.dir]} background="var(--p2)" shadow="rgba(239,68,68,.38)" size={glyphSize} />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          <ActionEffects snapshot={snapshot} cellSize={cellSize} />
        </div>
      </div>
    </div>
  );
}

function TankGlyph({ arrow, background, shadow, size }: { arrow: string; background: string; shadow: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background,
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontWeight: 800,
        fontSize: Math.max(11, Math.round(size * 0.47)),
        boxShadow: `0 2px 8px ${shadow}`,
      }}
    >
      {arrow}
    </div>
  );
}

export default function PracticePage() {
  const [strategy, setStrategy] = useState<Strategy>(EMPTY_STRATEGY);
  const [difficulty, setDifficulty] = useState<Difficulty>("weak");
  const [simulation, setSimulation] = useState<PracticeResponse | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Board cell size scales with viewport height so the 10×10 board ends up at
  // roughly half the viewport tall, leaving room for the scrollable player /
  // controls / turn-log pane below.
  const [cellPx, setCellPx] = useState(32);
  useEffect(() => {
    const compute = () => {
      const px = Math.max(28, Math.min(36, Math.floor(window.innerHeight * 0.035)));
      setCellPx(px);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  const hydrated = useHydrated();

  const handleStrategyChange = useCallback((next: Strategy) => {
    setStrategy(next);
  }, []);

  const totalTurns = simulation?.result.totalTurns ?? MAX_TURNS;
  const activeSnapshot = simulation?.result.turns[currentTurn - 1];
  const p1 = activeSnapshot
    ? { x: activeSnapshot.p1.x, y: activeSnapshot.p1.y, dir: activeSnapshot.p1.dir, hp: activeSnapshot.p1.hp }
    : INITIAL_P1;
  const p2 = activeSnapshot
    ? { x: activeSnapshot.p2.x, y: activeSnapshot.p2.y, dir: activeSnapshot.p2.dir, hp: activeSnapshot.p2.hp }
    : INITIAL_P2;
  const replayComplete = Boolean(simulation && currentTurn >= simulation.result.totalTurns);
  const replayControlsDisabled = hydrated && !simulation;

  const resultLabel = useMemo(() => {
    const winner = simulation?.result.winner;
    if (!winner) return "引き分け";
    return winner === "p1" ? "勝利" : "敗北";
  }, [simulation]);

  useEffect(() => {
    if (!playing || !simulation) return;
    const id = setInterval(() => {
      setCurrentTurn((turn) => {
        const next = Math.min(turn + 1, simulation.result.totalTurns);
        if (next >= simulation.result.totalTurns) setPlaying(false);
        return next;
      });
    }, TURN_EFFECT_MS);
    return () => clearInterval(id);
  }, [playing, simulation]);

  const runPractice = async () => {
    setBusy(true);
    setError(null);
    setPlaying(false);
    try {
      const res = await fetch("/api/practice/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ strategy, difficulty }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        throw new Error(data?.error ?? "simulate_failed");
      }
      setSimulation(data);
      setCurrentTurn(0);
      setPlaying(true);
    } catch {
      setError("練習対戦を開始できませんでした。ブロックを確認してもう一度試してください。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "var(--bg)", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopbarPaper title="練習モード" />
      <main style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 1360, margin: "0 auto", padding: "18px 20px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(520px, 1.05fr) minmax(520px, .95fr)", gap: 16, height: "100%", minHeight: 0 }}>
          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <div>
                <Link
                  href="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    textDecoration: "none",
                    marginBottom: 4,
                  }}
                >
                  ← ダッシュボードへ戻る
                </Link>
                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>ソロバトル</h1>
                <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-soft)" }}>ブロックで自分のストラテジーを組む</div>
              </div>
              <div style={{ display: "flex", gap: 6, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 8, padding: 3 }}>
                {[
                  ["weak", "弱い"],
                  ["normal", "普通"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key as Difficulty)}
                    style={{
                      border: "none",
                      borderRadius: 6,
                      padding: "6px 10px",
                      background: difficulty === key ? "var(--ink)" : "transparent",
                      color: difficulty === key ? "#fff" : "var(--ink)",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <div style={{ flex: 1, minHeight: 0 }}>
              <BlocklyEditor onChange={handleStrategyChange} initialState={DEFAULT_WORKSPACE_STATE} />
            </div>
          </section>

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              overflow: "hidden",
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <header style={{ padding: "13px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>リプレイ</h2>
                <div style={{ marginTop: 2, fontSize: 12, color: "var(--ink-soft)" }}>
                  {simulation ? `あなた vs ${simulation.bot.name}` : "対戦開始後に再生されます"}
                </div>
              </div>
              <span
                aria-label="現在ターン"
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 800,
                  fontSize: 14,
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  padding: "5px 12px",
                  borderRadius: 999,
                }}
              >
                TURN {currentTurn} / {totalTurns}
              </span>
            </header>

            {/* Board: stays visible regardless of scrolling below. */}
            <div style={{ display: "flex", justifyContent: "center", overflowX: "auto", padding: "14px 14px 10px", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
              <Board p1={p1} p2={p2} snapshot={activeSnapshot} cellSize={cellPx} />
            </div>

            {/* Scrollable lower pane: player panels, replay controls, turn log. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 14, flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 12 }}>
                <PlayerPanel
                  label="P1"
                  name="あなた"
                  color="var(--p1)"
                  soft="var(--p1-soft)"
                  ink="var(--p1-ink)"
                  state={p1}
                  turn={activeSnapshot?.p1}
                />
                <PlayerPanel
                  label="P2"
                  name={simulation?.bot.name ?? "Bot"}
                  color="var(--p2)"
                  soft="var(--p2-soft)"
                  ink="var(--p2-ink)"
                  state={p2}
                  turn={activeSnapshot?.p2}
                />
              </div>

              <div style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  {[
                    ["最初へ", "⏮", () => { setPlaying(false); setCurrentTurn(0); }],
                    ["前のターン", "⏪", () => { setPlaying(false); setCurrentTurn((turn) => Math.max(0, turn - 1)); }],
                    [playing ? "一時停止" : "再生", playing ? "⏸" : "▶", () => simulation && setPlaying((value) => !value)],
                    ["次のターン", "⏩", () => { setPlaying(false); setCurrentTurn((turn) => Math.min(totalTurns, turn + 1)); }],
                    ["最後へ", "⏭", () => { setPlaying(false); setCurrentTurn(totalTurns); }],
                  ].map(([title, icon, action]) => (
                    <button
                      key={String(title)}
                      type="button"
                      title={String(title)}
                      onClick={action as () => void}
                      disabled={replayControlsDisabled}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: "1px solid var(--line)",
                        background: icon === "▶" || icon === "⏸" ? "var(--p1)" : "var(--surface)",
                        color: icon === "▶" || icon === "⏸" ? "#fff" : "var(--ink)",
                        fontSize: 15,
                        cursor: simulation ? "pointer" : "not-allowed",
                      }}
                    >
                      {String(icon)}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="リプレイターン"
                  type="range"
                  min={0}
                  max={totalTurns}
                  value={currentTurn}
                  disabled={replayControlsDisabled}
                  onChange={(e) => {
                    setPlaying(false);
                    setCurrentTurn(Number(e.target.value));
                  }}
                  style={{ width: "100%" }}
                />
              </div>

              <div
                style={{
                  width: "100%",
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 112,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink-soft)", marginBottom: 8 }}>ターンログ</div>
                <div style={{ maxHeight: 132, overflowY: "auto", paddingRight: 4 }}>
                  {(simulation?.result.turns ?? [])
                    .slice(0, currentTurn)
                    .reverse()
                    .flatMap((snap) => snap.logs.map((log) => ({ turn: snap.turn, log })))
                    .map(({ turn, log }, index) => (
                      <div
                        key={`${turn}-${index}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 12,
                          padding: "4px 6px",
                          borderRadius: 8,
                          background: index === 0 ? "var(--accent-soft)" : "transparent",
                          border: index === 0 ? "1px solid #f3d27d" : "1px solid transparent",
                        }}
                      >
                        <span style={{ background: log.playerId === "p1" ? "var(--p1)" : "var(--p2)", color: "#fff", borderRadius: 4, padding: "1px 5px", fontFamily: "JetBrains Mono, monospace", fontSize: 10, fontWeight: 800 }}>
                          T{turn}
                        </span>
                        <span>{log.playerId === "p1" ? "あなた" : "Bot"}: {log.text}</span>
                      </div>
                    ))}
                  {!simulation && <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>まだリプレイはありません</div>}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <footer
        role="contentinfo"
        aria-label="対戦開始フッタ"
        style={{
          flexShrink: 0,
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          boxShadow: "0 -6px 18px rgba(31,35,48,0.06)",
        }}
      >
        <div style={{ maxWidth: 1360, margin: "0 auto", width: "100%", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            onClick={runPractice}
            disabled={busy}
            style={{
              background: busy ? "#d1d5db" : "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 9,
              padding: "10px 22px",
              fontSize: 14,
              fontWeight: 800,
              cursor: busy ? "wait" : "pointer",
              boxShadow: busy ? "none" : "0 2px 0 #c2740a",
            }}
          >
            {busy ? "対戦準備中…" : "対戦開始"}
          </button>
          {error && (
            <span role="alert" style={{ color: "var(--danger)", fontSize: 13, fontWeight: 700 }}>
              {error}
            </span>
          )}
          {simulation && replayComplete && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <strong style={{ fontSize: 16 }}>{resultLabel}</strong>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>終了理由: {simulation.result.endReason}</span>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>ターン数: {simulation.result.totalTurns}</span>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>残HP: あなた {simulation.result.finalHp.p1} / Bot {simulation.result.finalHp.p2}</span>
              <button
                type="button"
                onClick={() => {
                  setSimulation(null);
                  setCurrentTurn(0);
                  setPlaying(false);
                }}
                style={{
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                再挑戦
              </button>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
