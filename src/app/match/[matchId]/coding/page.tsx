"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  connectSocket,
  disconnectSocket,
  lockCoding,
} from "@/lib/socket-client";
import {
  GRID_SIZE,
  MAX_TURNS,
  type Strategy,
  type StrategyStmt,
} from "@/lib/match-simulator";
import { secondsUntil } from "@/lib/coding-timer";

// <!-- bind: WS recv coding_start { codingDeadlineAt } -->
// <!-- bind: WS send coding_lock { matchId, strategy, blocklyXml? } -->

// The strategy editor is real Blockly (DOM-only), so load it client-side with
// SSR disabled. It serializes the block workspace into the Strategy JSON the
// simulator consumes (see src/lib/strategy-blocks.ts) on every edit.
const BlocklyEditor = dynamic(() => import("@/components/coding/BlocklyEditor"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--ink-soft)", fontSize: 13 }}>
      エディタを読み込み中…
    </div>
  ),
});

const EMPTY_STRATEGY: Strategy = {
  version: "1.0",
  rules: [],
  fallbackActions: [{ type: "WAIT", ap: 0 }],
};

const DEFAULT_ROOM_INITIAL_HP = 50;

function numberPresetValue(preset: Record<string, unknown> | null | undefined, key: string): number | undefined {
  const value = preset?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

// Statement walkers used by the right tab pane and the bottom status bar to
// summarize the live strategy (rule count, block count, max if-depth) — these
// replace the mock numbers that lingered from the original prototype.
function countStmts(stmts: StrategyStmt[] | undefined): number {
  if (!stmts) return 0;
  let n = 0;
  for (const s of stmts) {
    n++;
    if (s.kind === "if") {
      for (const cl of s.clauses ?? []) n += countStmts(cl.body);
      n += countStmts(s.else);
    }
  }
  return n;
}

function stmtDepth(stmts: StrategyStmt[] | undefined): number {
  if (!stmts) return 0;
  let max = 0;
  for (const s of stmts) {
    if (s.kind === "if") {
      let inner = 0;
      for (const cl of s.clauses ?? []) inner = Math.max(inner, stmtDepth(cl.body));
      inner = Math.max(inner, stmtDepth(s.else));
      max = Math.max(max, 1 + inner);
    }
  }
  return max;
}

function strategyStats(strategy: Strategy): { rules: number; blocks: number; depth: number } {
  let blocks = 0;
  let depth = 0;
  for (const rule of strategy.rules ?? []) {
    blocks += rule.conditions?.length ?? 0;
    blocks += countStmts(rule.body);
    blocks += rule.actions?.length ?? 0;
    blocks += rule.sets?.length ?? 0;
    depth = Math.max(depth, stmtDepth(rule.body));
  }
  blocks += countStmts(strategy.fallbackBody);
  blocks += strategy.fallbackActions?.length ?? 0;
  blocks += strategy.fallbackSets?.length ?? 0;
  depth = Math.max(depth, stmtDepth(strategy.fallbackBody));
  return { rules: strategy.rules?.length ?? 0, blocks, depth };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CodingPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(300);
  const [codingDeadlineAt, setCodingDeadlineAt] = useState<string | null>(null);
  // `deadlineLoaded` becomes true once /api/match/{id}/state has returned. We
  // use it (combined with `codingDeadlineAt === null`) to distinguish the brief
  // pre-load "deadline unknown" state from a real unlimited match — see the
  // timer effect and the timer/modal rendering below.
  const [deadlineLoaded, setDeadlineLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "hints">("info");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [locked, setLocked] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [opponentLocked, setOpponentLocked] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [matchMeta, setMatchMeta] = useState<{
    roomName: string;
    matchNumber: number;
    maxTurns: number;
    initialHp: number;
    player1: { id: string; displayName: string | null; username: string } | null;
    player2: { id: string; displayName: string | null; username: string } | null;
  } | null>(null);
  const [strategy, setStrategy] = useState<Strategy>(EMPTY_STRATEGY);
  const [blocklyState, setBlocklyState] = useState("");
  const handleStrategyChange = useCallback((next: Strategy, state: string) => {
    setStrategy(next);
    setBlocklyState(state);
  }, []);

  // Fetch session + match meta. We need the user id to distinguish self vs
  // opponent lock events, and the match meta to render room name / match
  // number / opponent name without mocks.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch("/api/me", { credentials: "include" }),
      fetch(`/api/match/${matchId}/state`, { credentials: "include" }),
    ]).then(async ([meRes, stateRes]) => {
      if (cancelled) return;
      if (meRes.status === "fulfilled" && meRes.value.ok) {
        const data = await meRes.value.json();
        if (data?.user?.id) setMyUserId(data.user.id);
      }
      if (stateRes.status === "fulfilled" && stateRes.value.ok) {
        const data = await stateRes.value.json();
        const m = data?.match;
        setCodingDeadlineAt(typeof m?.codingDeadlineAt === "string" ? m.codingDeadlineAt : null);
        setDeadlineLoaded(true);
        if (m?.room?.name) {
          const preset = m.room.rulePreset as Record<string, unknown> | null | undefined;
          const maxTurns = numberPresetValue(preset, "maxTurns") ?? numberPresetValue(preset, "maxTurn") ?? MAX_TURNS;
          const initialHp = numberPresetValue(preset, "initialHp") ?? DEFAULT_ROOM_INITIAL_HP;
          setMatchMeta({
            roomName: m.room.name,
            matchNumber: m.matchNumber,
            maxTurns,
            initialHp,
            player1: m.player1 ?? null,
            player2: m.player2 ?? null,
          });
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const opponent = (() => {
    if (!matchMeta || !myUserId) return null;
    if (matchMeta.player1?.id === myUserId) return matchMeta.player2;
    if (matchMeta.player2?.id === myUserId) return matchMeta.player1;
    return null;
  })();
  const roomName = matchMeta?.roomName ?? "…";
  const matchNumber = matchMeta?.matchNumber ?? 0;
  const maxTurns = matchMeta?.maxTurns ?? MAX_TURNS;
  const initialHp = matchMeta?.initialHp ?? DEFAULT_ROOM_INITIAL_HP;
  const opponentName = opponent?.displayName ?? opponent?.username ?? "—";

  // Wire Socket.io for this match.
  useEffect(() => {
    const socket = connectSocket(matchId);

    const onCodingLocked = ({
      playerId,
    }: {
      playerId: string;
      autoLocked: boolean;
    }) => {
      if (myUserId && playerId !== myUserId) {
        setOpponentLocked(true);
      }
    };
    const onMatchStarted = () => {
      router.push(`/match/${matchId}/battle`);
    };

    socket.on("coding_locked", onCodingLocked);
    socket.on("match_started", onMatchStarted);

    return () => {
      socket.off("coding_locked", onCodingLocked);
      socket.off("match_started", onMatchStarted);
      disconnectSocket();
    };
  }, [matchId, myUserId, router]);

  // `null` codingDeadlineAt after the state load is the signal for an
  // "unlimited" match (admin set codingTimeLimitSec = -1 or simply created the
  // match without a deadline — used for test-play). In that mode we skip the
  // countdown and the timeout modal entirely.
  const isUnlimited = deadlineLoaded && codingDeadlineAt === null;

  useEffect(() => {
    if (isUnlimited) return;
    const localFallbackStartedAt = Date.now();

    const updateTimeLeft = () => {
      const nextFromDeadline = secondsUntil(codingDeadlineAt);
      const next =
        nextFromDeadline ?? Math.max(0, 300 - Math.floor((Date.now() - localFallbackStartedAt) / 1000));

      setTimeLeft((prev) => {
        if ((prev > 30 && next <= 30) || (prev > 0 && next <= 0)) {
          setShowTimeoutModal(true);
        }
        return next;
      });
    };

    updateTimeLeft();
    const id = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(id);
  }, [codingDeadlineAt, isUnlimited]);


  const timerColor = isUnlimited
    ? "var(--ink-soft)"
    : timeLeft <= 30 ? "#dc2626" : timeLeft <= 60 ? "#f59e0b" : "#1f2330";

  const tabs = [
    { key: "info", label: "対戦情報" },
    { key: "hints", label: "ヒント" },
  ] as const;
  const stats = strategyStats(strategy);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)" }}>
      {/* Top Header */}
      <header
        style={{
          background: "linear-gradient(180deg, #fbf8ef, #f6f1e2)",
          borderBottom: "1px solid var(--line)",
          padding: "10px 20px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
          zIndex: 50,
        }}
      >
        {/* Left: Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--ink)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,.25)",
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>対戦・コーディング</span>
          <span
            style={{
              fontSize: 10,
              color: "#92400e",
              fontWeight: 600,
              padding: "2px 7px",
              background: "var(--accent-soft)",
              border: "1px solid #f3d27d",
              borderRadius: 999,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            v0.2
          </span>
          <Link
            href="/dashboard"
            style={{
              marginLeft: 6,
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              color: "var(--ink-soft)",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid var(--line)",
              background: "var(--surface)",
            }}
          >
            ← ダッシュボード
          </Link>
        </div>

        {/* Center: Match info */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
            {roomName}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 2 }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              対戦 #{matchNumber}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>vs</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                background: "var(--surface)",
                padding: "2px 10px 2px 2px",
                borderRadius: 999,
                border: "1px solid var(--line)",
                color: "var(--ink)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "var(--p2-soft)",
                  color: "var(--p2-ink)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {opponentName?.[0]?.toUpperCase() ?? "?"}
              </span>
              {opponentName}
            </span>
          </div>
        </div>

        {/* Right: Timer + CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "flex-end" }}>
          {opponentLocked && (
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
                border: "1px solid #fde047",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              相手 ✓ 確定済み
            </span>
          )}
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 24,
              fontWeight: 700,
              color: timerColor,
              letterSpacing: "0.05em",
              minWidth: 72,
              textAlign: "right",
              transition: "color 0.3s",
            }}
          >
            {isUnlimited ? "∞" : formatTime(timeLeft)}
          </div>
          <button
            onClick={() => !locked && setShowConfirmModal(true)}
            disabled={locked}
            style={{
              background: locked ? "#d1d5db" : "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              fontSize: 14,
              cursor: locked ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            コードを確定する
          </button>
        </div>
      </header>

      {/* Main 3-pane layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Workspace: Blockly renders its own toolbox + canvas here. */}
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
          <BlocklyEditor onChange={handleStrategyChange} />
        </div>

        {/* Right Pane: Tabs */}
        <div
          style={{
            width: 360,
            flexShrink: 0,
            borderLeft: "1px solid var(--line)",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg)",
              flexShrink: 0,
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  flex: 1,
                  padding: "10px 4px",
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  background: "transparent",
                  borderBottom: activeTab === tab.key ? "2px solid var(--accent)" : "2px solid transparent",
                  color: activeTab === tab.key ? "var(--ink)" : "var(--ink-soft)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
            {activeTab === "info" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Match meta: room name, match number, opponent. */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    対戦
                  </div>
                  <div
                    style={{
                      background: "var(--bg)",
                      borderRadius: 10,
                      padding: 12,
                      border: "1px solid var(--line)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "var(--ink-soft)" }}>ルーム</span>
                      <span style={{ fontWeight: 700 }}>{roomName}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "var(--ink-soft)" }}>マッチ番号</span>
                      <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>#{matchNumber}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                      <span style={{ color: "var(--ink-soft)" }}>対戦相手</span>
                      <span style={{ fontWeight: 700 }}>{opponentName}</span>
                    </div>
                  </div>
                </div>

                {/* Game rules — what the player is designing for. */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    対戦ルール
                  </div>
                  <div
                    style={{
                      background: "var(--bg)",
                      borderRadius: 10,
                      padding: 12,
                      border: "1px solid var(--line)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {[
                      ["盤面", `${GRID_SIZE} × ${GRID_SIZE}`],
                      ["最大ターン数", `${maxTurns} ターン`],
                      ["開始 HP", `${initialHp}`],
                      ["1 ターンの行動", "1 アクション"],
                      ["AP", "全アクション 1"],
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--ink-soft)" }}>{label}</span>
                        <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live block summary derived from the current strategy. */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    ブロック構成
                  </div>
                  <div
                    style={{
                      background: "var(--bg)",
                      borderRadius: 10,
                      padding: 12,
                      border: "1px solid var(--line)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {[
                      ["ルール数", stats.rules],
                      ["ブロック数", stats.blocks],
                      ["「もし」ネスト深度", stats.depth],
                    ].map(([label, value]) => (
                      <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: "var(--ink-soft)" }}>{label}</span>
                        <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "hints" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>ヒント</div>

                {[
                  {
                    title: "ルールは上から評価される",
                    body: "「ルール」ブロックは上から順に「もし」を評価し、最初に真になったルールの「実行」を 1 つだけ実行します。優先したい条件を上に置きましょう。",
                  },
                  {
                    title: "「もし」は分岐を増やせる",
                    body: "「もし」ブロック左上の歯車から「そうでなければもし」「そうでなければ」を追加できます。条件を細かく分けたいときに便利です。",
                  },
                  {
                    title: "1 ターン = 1 アクション",
                    body: "1 ターンに実行できる行動は 1 つだけです。実行スタックの先頭の行動が実際に走り、残りはその回には実行されません。",
                  },
                  {
                    title: "JSON で確認できる",
                    body: "JSON タブで現在のストラテジーが構造化された JSON として確認できます。確定前に意図通りか見直しましょう。",
                  },
                ].map((hint) => (
                  <div
                    key={hint.title}
                    style={{
                      background: "var(--bg)",
                      borderRadius: 10,
                      padding: 12,
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>
                      💡 {hint.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
                      {hint.body}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom status bar — matches the practice page's light footer chrome. */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexShrink: 0,
          fontSize: 12,
          color: "var(--ink-soft)",
          fontFamily: "JetBrains Mono, monospace",
          boxShadow: "0 -4px 12px rgba(31,35,48,0.04)",
        }}
      >
        <span>
          ルール数: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{stats.rules}</span>
        </span>
        <span>
          ブロック数: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{stats.blocks}</span>
        </span>
        <span>
          「もし」ネスト深度: <span style={{ color: "var(--ink)", fontWeight: 700 }}>{stats.depth}</span>
        </span>
        <span style={{ color: "var(--line-2)" }}>|</span>
        <span>AP: 全アクション 1</span>
        <span style={{ marginLeft: "auto" }}>
          確定フラグ:{" "}
          <span
            style={{
              color: locked ? "var(--success)" : "var(--danger)",
              fontWeight: 700,
            }}
          >
            {locked ? "✓ 確定済み" : "未確定"}
          </span>
        </span>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && !waitingForOpponent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 32,
              width: 480,
              maxWidth: "90vw",
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>
              コードを確定する
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 20 }}>
              以下のストラテジーで対戦を開始します。確定後は変更できません。
            </div>
            <div
              style={{
                background: "var(--bg)",
                borderRadius: 10,
                padding: 16,
                border: "1px solid var(--line)",
                marginBottom: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "var(--ink-soft)" }}>ルール数</span>
                <span style={{ fontWeight: 700 }}>{stats.rules} ルール</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "var(--ink-soft)" }}>使用ブロック</span>
                <span style={{ fontWeight: 700 }}>{stats.blocks} ブロック</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--ink-soft)" }}>全ルール不一致時</span>
                <span
                  style={{
                    background: "#f3f4f6",
                    padding: "1px 8px",
                    borderRadius: 6,
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                >
                  WAIT
                </span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: "11px",
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  background: "var(--surface)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  lockCoding(matchId, strategy, blocklyState || undefined);
                  setLocked(true);
                  setShowConfirmModal(false);
                  setWaitingForOpponent(true);
                }}
                style={{
                  flex: 2,
                  padding: "11px",
                  border: "none",
                  borderRadius: 10,
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                確定する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for opponent */}
      {waitingForOpponent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.6)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 40,
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                border: "4px solid var(--line)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                margin: "0 auto 20px",
                animation: "spin 1s linear infinite",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              相手の確定を待っています
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              対戦相手がコードを確定するまでお待ちください...
            </div>
          </div>
        </div>
      )}

      {/* Timeout Modal — two states:
          • timeLeft <= 0: 続行不能。ダッシュボードへ戻る導線を主役にする。
          • timeLeft > 0 (30 秒未満警告): 確定促進。閉じて編集に戻れる。 */}
      {showTimeoutModal && !locked && !isUnlimited && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "var(--surface)",
              borderRadius: 16,
              padding: 32,
              width: 440,
              maxWidth: "90vw",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              border: timeLeft <= 0 ? "2px solid var(--danger)" : "2px solid #fde047",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8, color: "var(--danger)" }}>
              {timeLeft <= 0 ? "時間切れ" : "時間切れ警告"}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24, lineHeight: 1.7 }}>
              {timeLeft <= 0 ? (
                <>
                  コーディング時間が終了しました。<br />
                  この対戦はもう編集できません。<br />
                  ダッシュボードに戻って次のマッチへ進みましょう。
                </>
              ) : (
                <>
                  残り 30 秒を切りました。<br />
                  時間内に確定しない場合、<br />
                  <strong>WAIT 戦略が自動提出されます。</strong>
                </>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              {timeLeft > 0 && (
                <button
                  onClick={() => setShowTimeoutModal(false)}
                  style={{
                    padding: "11px 22px",
                    border: "none",
                    borderRadius: 10,
                    background: "var(--accent)",
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  編集に戻る
                </button>
              )}
              <Link
                href="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "11px 22px",
                  borderRadius: 10,
                  background: timeLeft <= 0 ? "var(--accent)" : "var(--surface)",
                  color: timeLeft <= 0 ? "#fff" : "var(--ink)",
                  border: timeLeft <= 0 ? "none" : "1px solid var(--line)",
                  fontSize: 14,
                  fontWeight: 700,
                  textDecoration: "none",
                  boxShadow: timeLeft <= 0 ? "0 2px 0 #c2740a" : "none",
                }}
              >
                ← ダッシュボードへ戻る
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
