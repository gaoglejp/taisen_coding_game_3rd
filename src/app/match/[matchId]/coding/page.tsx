"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  connectSocket,
  disconnectSocket,
  lockCoding,
} from "@/lib/socket-client";
import type { Strategy } from "@/lib/match-simulator";
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

const MOCK_LAST_TURN = {
  damaged: 15,
  shoot_result: "HIT",
  scan_detected: true,
  moved: true,
  detected_targets: [
    { direction: "forward", distance: 2, age: 1 },
    { direction: "right", distance: -1, age: 3 },
  ],
};

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
  const [activeTab, setActiveTab] = useState<"status" | "lastTurn" | "hints" | "json">("status");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);
  const [locked, setLocked] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [opponentLocked, setOpponentLocked] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [matchMeta, setMatchMeta] = useState<{
    roomName: string;
    matchNumber: number;
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
        if (m?.room?.name) {
          setMatchMeta({
            roomName: m.room.name,
            matchNumber: m.matchNumber,
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

  useEffect(() => {
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
  }, [codingDeadlineAt]);


  const timerColor =
    timeLeft <= 30 ? "#dc2626" : timeLeft <= 60 ? "#f59e0b" : "#1f2330";

  const tabs = [
    { key: "status", label: "自機" },
    { key: "lastTurn", label: "直前ターン" },
    { key: "hints", label: "ヒント" },
    { key: "json", label: "JSON" },
  ] as const;

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
            {formatTime(timeLeft)}
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
            {activeTab === "status" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>自機ステータス</div>
                {/* Position */}
                <div
                  style={{
                    background: "var(--bg)",
                    borderRadius: 10,
                    padding: 12,
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--ink-soft)" }}>x = </span>
                      <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>4</span>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      <span style={{ color: "var(--ink-soft)" }}>y = </span>
                      <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>6</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>向き:</span>
                    <span
                      style={{
                        background: "var(--p1-soft)",
                        color: "var(--p1-ink)",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      ↑ NORTH
                    </span>
                  </div>
                </div>

                {/* HP Bar */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12, fontWeight: 600 }}>
                    <span>HP</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace" }}>84 / 100</span>
                  </div>
                  <div style={{ height: 12, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
                    <div
                      style={{
                        width: "84%",
                        height: "100%",
                        background: "var(--p1)",
                        borderRadius: 999,
                        transition: "width 0.3s",
                      }}
                    />
                  </div>
                </div>

                {/* Turn progress */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    ターン進捗 (4/20)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Array.from({ length: 20 }, (_, i) => (
                      <div
                        key={i}
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          background: i < 4 ? "var(--p1)" : "var(--line)",
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "lastTurn" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>直前ターン (T3)</div>

                {/* Action badges */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>last_actions</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {["MOVE_FORWARD", "SCAN"].map((a) => (
                      <span
                        key={a}
                        style={{
                          background: a === "MOVE_FORWARD" ? "var(--p1-soft)" : "#e0f2fe",
                          color: a === "MOVE_FORWARD" ? "var(--p1-ink)" : "#0369a1",
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Results */}
                <div
                  style={{
                    background: "var(--bg)",
                    borderRadius: 10,
                    padding: 12,
                    border: "1px solid var(--line)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {[
                    { key: "damaged", value: `${MOCK_LAST_TURN.damaged} ダメージ受けた`, color: "#fee2e2", textColor: "var(--p2-ink)" },
                    { key: "shoot_result", value: `射撃: ${MOCK_LAST_TURN.shoot_result}`, color: "#dcfce7", textColor: "#166534" },
                    { key: "scan_detected", value: `索敵: ${MOCK_LAST_TURN.scan_detected ? "検知あり" : "なし"}`, color: "#f0fdf4", textColor: "#166534" },
                    { key: "moved", value: `移動: ${MOCK_LAST_TURN.moved ? "成功" : "失敗"}`, color: "var(--p1-soft)", textColor: "var(--p1-ink)" },
                  ].map((row) => (
                    <div
                      key={row.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                        {row.key}
                      </span>
                      <span
                        style={{
                          background: row.color,
                          color: row.textColor,
                          padding: "1px 8px",
                          borderRadius: 6,
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Detected targets table */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
                    detected_targets
                    <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 6 }}>
                      ※絶対座標・HP・向きは取得不可
                    </span>
                  </div>
                  <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--bg)" }}>
                        {["forward", "right", "age"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "4px 8px",
                              textAlign: "left",
                              fontFamily: "JetBrains Mono, monospace",
                              fontWeight: 600,
                              color: "var(--ink-soft)",
                              borderBottom: "1px solid var(--line)",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MOCK_LAST_TURN.detected_targets.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                          <td style={{ padding: "4px 8px", fontFamily: "JetBrains Mono, monospace" }}>
                            {t.direction === "forward" ? t.distance : "—"}
                          </td>
                          <td style={{ padding: "4px 8px", fontFamily: "JetBrains Mono, monospace" }}>
                            {t.direction === "right" ? t.distance : "—"}
                          </td>
                          <td style={{ padding: "4px 8px", fontFamily: "JetBrains Mono, monospace" }}>{t.age}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "hints" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>ブロックヒント</div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  {["索敵を活用しよう", "AP管理が重要", "WAIT戦略を覚えよう"].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        background: "#fef9c3",
                        color: "#92400e",
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "2px 10px",
                        borderRadius: 999,
                        border: "1px solid #fde047",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {[
                  {
                    title: "SCANで先手を取ろう",
                    body: "SCAN(AP:2)を先に実行することで敵の位置を把握し、SHOOT_FORWARDへ繋げると命中率が上がります。",
                  },
                  {
                    title: "AP予算を計算しよう",
                    body: "1ターンのAP上限は3です。MOVE(1)+SHOOT(1)+SCAN(2)=4 となり超過します。優先順位を考えましょう。",
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

            {activeTab === "json" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>JSON プレビュー</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                  ブロックから自動生成 (読み取り専用)
                </div>
                <pre
                  style={{
                    background: "#1f2330",
                    color: "#e5e7eb",
                    borderRadius: 10,
                    padding: 16,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    lineHeight: 1.7,
                    overflow: "auto",
                    border: "1px solid #374151",
                    userSelect: "text",
                  }}
                >
                  {JSON.stringify(strategy, null, 2)}
                </pre>
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
          ブロック数: <span style={{ color: "var(--ink)", fontWeight: 700 }}>5</span>
        </span>
        <span>
          ネスト深度: <span style={{ color: "var(--ink)", fontWeight: 700 }}>2</span>
        </span>
        <span>
          アクション/ターン: <span style={{ color: "var(--ink)", fontWeight: 700 }}>2</span>
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
                <span style={{ fontWeight: 700 }}>2 ルール</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "var(--ink-soft)" }}>使用ブロック</span>
                <span style={{ fontWeight: 700 }}>5 ブロック</span>
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

      {/* Timeout Warning Modal */}
      {showTimeoutModal && !locked && (
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
              width: 420,
              maxWidth: "90vw",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
              border: "2px solid #fde047",
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏰</div>
            <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8, color: "#dc2626" }}>
              時間切れ警告
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 24, lineHeight: 1.7 }}>
              残り30秒を切りました。<br />
              時間内に確定しない場合、<br />
              <strong>WAIT戦略が自動提出されます。</strong>
            </div>
            <button
              onClick={() => setShowTimeoutModal(false)}
              style={{
                padding: "11px 32px",
                border: "none",
                borderRadius: 10,
                background: "var(--accent)",
                color: "#fff",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              コードを確定する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
