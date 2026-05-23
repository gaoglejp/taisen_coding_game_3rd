"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";

interface ApiPlayer {
  id: string;
  username: string;
  displayName: string | null;
}

interface ApiResult {
  matchId: string;
  matchNumber: number;
  endReason: string | null;
  winner: ApiPlayer | null;
  winnerSide: "p1" | "p2" | null;
  isDraw: boolean;
  player1: ApiPlayer | null;
  player2: ApiPlayer | null;
  room: { id: string; name: string; roomNumber: string } | null;
  durationMs: number | null;
  startedAt: string | null;
  endedAt: string | null;
  stats: {
    totalTurns: number;
    p1: {
      finalHp: number;
      damageDealt: number;
      damageTaken: number;
      shoots: number;
      hits: number;
      hitRate: number;
      scans: number;
      moves: number;
    };
    p2: {
      finalHp: number;
      damageDealt: number;
      damageTaken: number;
      shoots: number;
      hits: number;
      hitRate: number;
      scans: number;
      moves: number;
    };
    firstDamageTurn: number | null;
    firstDamageBy: "p1" | "p2" | null;
    hpTimeline: Array<[number, number]>;
  };
}

interface RecentMatch {
  id: string;
  matchNumber: number;
  result: "WIN" | "LOSE" | "DRAW";
  opponent: { id: string; username: string; displayName: string | null } | null;
}

interface MeStats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
}

const LEARNING_HINTS = [
  {
    icon: "🎯",
    title: "索敵→射撃コンボが有効",
    body: "SCAN で敵を検知してから SHOOT_FORWARD を繋げると命中率が大きく上がります。直前ターンの scan_detected を条件に使いましょう。",
    code: `IF scan_detected
  SHOOT_FORWARD
ELSE
  SCAN`,
  },
  {
    icon: "⚡",
    title: "fallbackActions を設定しよう",
    body: "どのルールにも当てはまらないときの保険です。WAIT のままだと AP を無駄にしてしまうので MOVE_FORWARD を入れておくと安全です。",
    code: `fallbackActions:
  MOVE_FORWARD`,
  },
  {
    icon: "🛡",
    title: "ダメージを受けたら反撃",
    body: "damaged を条件に使うと、被弾直後にだけ撃ち返す省 AP な反撃ロジックが組めます。",
    code: `IF damaged
  SHOOT_FORWARD`,
  },
];

function HpTimelineSVG({
  timeline,
  firstDamageTurn,
}: {
  timeline: Array<[number, number]>;
  firstDamageTurn: number | null;
}) {
  const W = 420;
  const H = 120;
  const PAD = { t: 10, r: 10, b: 20, l: 30 };
  if (timeline.length < 2) return null;
  const turns = timeline.length;
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const points = (side: 0 | 1) =>
    timeline.map((d, i) => ({
      x: PAD.l + (i / (turns - 1)) * chartW,
      y: PAD.t + (1 - d[side] / 100) * chartH,
    }));
  const p1Pts = points(0);
  const p2Pts = points(1);

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const toArea = (pts: { x: number; y: number }[]) => {
    const base = PAD.t + chartH;
    return (
      toPath(pts) +
      ` L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`
    );
  };

  // firstDamageTurn maps to index `firstDamageTurn` in the timeline because
  // index 0 is the pre-game snapshot.
  const firstDamageX =
    firstDamageTurn != null
      ? PAD.l + (firstDamageTurn / (turns - 1)) * chartW
      : null;
  const endX = PAD.l + chartW;

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      <path d={toArea(p1Pts)} fill="rgba(37,99,235,.1)" />
      <path d={toArea(p2Pts)} fill="rgba(239,68,68,.1)" />
      <path d={toPath(p1Pts)} fill="none" stroke="#2563eb" strokeWidth={2} />
      <path d={toPath(p2Pts)} fill="none" stroke="#ef4444" strokeWidth={2} />
      {firstDamageX != null && (
        <>
          <line x1={firstDamageX} y1={PAD.t} x2={firstDamageX} y2={PAD.t + chartH} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" />
          <text x={firstDamageX + 3} y={PAD.t + 10} fontSize={9} fill="#92400e" fontFamily="JetBrains Mono, monospace">
            T{firstDamageTurn}
          </text>
        </>
      )}
      <line x1={endX} y1={PAD.t} x2={endX} y2={PAD.t + chartH} stroke="#374151" strokeWidth={1.5} strokeDasharray="4,3" />
      {[0, 50, 100].map((val) => (
        <text
          key={val}
          x={PAD.l - 4}
          y={PAD.t + (1 - val / 100) * chartH + 4}
          fontSize={8}
          textAnchor="end"
          fill="#9ca3af"
          fontFamily="JetBrains Mono, monospace"
        >
          {val}
        </text>
      ))}
    </svg>
  );
}

export default function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = use(params);
  const [data, setData] = useState<ApiResult | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [meStats, setMeStats] = useState<MeStats | null>(null);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [meRes, resultRes, statsRes, matchesRes] = await Promise.allSettled([
          fetch("/api/me"),
          fetch(`/api/match/${matchId}/result`),
          fetch("/api/me/stats"),
          fetch("/api/me/matches?limit=5"),
        ]);
        if (cancelled) return;
        if (meRes.status === "fulfilled" && meRes.value.ok) {
          const j = await meRes.value.json();
          setMeId(j.user?.id ?? null);
        }
        if (resultRes.status === "fulfilled" && resultRes.value.ok) {
          setData(await resultRes.value.json());
        } else if (resultRes.status === "fulfilled") {
          const j = await resultRes.value.json().catch(() => null);
          setError(j?.error ?? "結果を取得できませんでした");
        }
        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const j = await statsRes.value.json();
          setMeStats(j.stats);
        }
        if (matchesRes.status === "fulfilled" && matchesRes.value.ok) {
          const j = await matchesRes.value.json();
          setRecent(j.matches ?? []);
        }
      } catch {
        if (!cancelled) setError("結果を取得できませんでした");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
        {error}
        <div style={{ marginTop: 16 }}>
          <Link href="/dashboard" style={{ color: "var(--accent)" }}>ダッシュボードへ</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>読み込み中…</div>
    );
  }

  // Viewer perspective: if the logged-in user is one of the players, "me" =
  // that side. Otherwise default to P1 perspective for spectators/admins.
  const mySide: "p1" | "p2" = meId && data.player2?.id === meId ? "p2" : "p1";
  const opSide: "p1" | "p2" = mySide === "p1" ? "p2" : "p1";
  const me = mySide === "p1" ? data.player1 : data.player2;
  const op = mySide === "p1" ? data.player2 : data.player1;
  const myStats = data.stats[mySide];
  const opStats = data.stats[opSide];
  const isWin = data.winnerSide === mySide;
  const isDraw = data.isDraw;
  const verdict = isDraw ? "DRAW" : isWin ? "WIN" : "LOSE";
  const verdictColor = isDraw ? "#6b7280" : isWin ? "#16a34a" : "var(--p2)";
  const verdictSoftBg = isDraw
    ? "linear-gradient(135deg, #f9fafb, #f3f4f6)"
    : isWin
      ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
      : "linear-gradient(135deg, #fef2f2, #fee2e2)";

  const meName = me?.displayName ?? me?.username ?? "あなた";
  const opName = op?.displayName ?? op?.username ?? "相手";
  const p1Name = data.player1?.displayName ?? data.player1?.username ?? "P1";
  const p2Name = data.player2?.displayName ?? data.player2?.username ?? "P2";

  const stats = [
    { label: "与ダメ", me: myStats.damageDealt, op: opStats.damageDealt, unit: "" },
    { label: "被ダメ", me: myStats.damageTaken, op: opStats.damageTaken, unit: "" },
    { label: "命中率", me: myStats.hitRate, op: opStats.hitRate, unit: "%" },
    { label: "索敵回数", me: myStats.scans, op: opStats.scans, unit: "回" },
    { label: "MOVE", me: myStats.moves, op: opStats.moves, unit: "回" },
    { label: "SHOOT", me: myStats.shoots, op: opStats.shoots, unit: "回" },
    { label: "TURN", me: data.stats.totalTurns, op: data.stats.totalTurns, unit: "" },
    { label: "HIT", me: myStats.hits, op: opStats.hits, unit: "" },
  ];

  const highlights: Array<{ turn: number; color: string; event: string }> = [];
  if (data.stats.firstDamageTurn != null && data.stats.firstDamageBy != null) {
    const attacker = data.stats.firstDamageBy === "p1" ? p1Name : p2Name;
    const target = data.stats.firstDamageBy === "p1" ? p2Name : p1Name;
    highlights.push({
      turn: data.stats.firstDamageTurn,
      color: "#f59e0b",
      event: `First Damage! ${attacker} → ${target}`,
    });
  }
  if (data.endReason === "HP_ZERO" && data.winner) {
    highlights.push({
      turn: data.stats.totalTurns,
      color: "var(--ink)",
      event: `${data.winner.displayName ?? data.winner.username} の勝利 — 対戦終了`,
    });
  } else if (data.endReason === "TIMEOUT") {
    highlights.push({
      turn: data.stats.totalTurns,
      color: "var(--ink)",
      event: `${data.stats.totalTurns}ターンで時間切れ`,
    });
  }

  const timeSec = data.durationMs != null ? Math.round(data.durationMs / 1000) : null;
  const endReasonLabel =
    data.endReason === "HP_ZERO"
      ? "HP0"
      : data.endReason === "TIMEOUT"
        ? "ターン上限"
        : data.endReason ?? "—";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        maxWidth: 1440,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(180deg, #fbf8ef, #f6f1e2)",
          borderBottom: "1px solid var(--line)",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--ink)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 13,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 14 }}>対戦・コーディング</span>
        </div>
        <span style={{ color: "var(--line)", fontSize: 18 }}>|</span>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{data.room?.name ?? "—"}</span>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>·</span>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>対戦 #{data.matchNumber}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              background: "var(--p1)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: 999,
            }}
          >
            P1 {p1Name}
          </span>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>vs</span>
          <span
            style={{
              background: "var(--p2)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 10px",
              borderRadius: 999,
            }}
          >
            P2 {p2Name}
          </span>
        </div>
      </header>

      <div style={{ flex: 1, padding: "24px" }}>
        {/* Hero section */}
        <div
          style={{
            background: verdictSoftBg,
            border: `2px solid ${verdictColor}`,
            borderRadius: 16,
            padding: "28px 32px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: verdictColor,
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 20px ${isWin ? "rgba(22,163,74,.3)" : isDraw ? "rgba(107,114,128,.2)" : "rgba(239,68,68,.3)"}`,
              }}
            >
              <span style={{ fontSize: 28 }}>{isDraw ? "=" : isWin ? "✓" : "✗"}</span>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: isDraw ? "#374151" : isWin ? "#15803d" : "var(--p2-ink)",
                letterSpacing: "0.05em",
              }}
            >
              {verdict}
            </span>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
              {isDraw
                ? "互角の戦いでした"
                : isWin
                  ? "いい判断でした！"
                  : "次回は巻き返しましょう"}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
              {data.stats.totalTurns}ターンで決着がつきました。
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: `あなた (${mySide.toUpperCase()})`, hp: myStats.finalHp, color: mySide === "p1" ? "var(--p1)" : "var(--p2)", soft: mySide === "p1" ? "var(--p1-soft)" : "var(--p2-soft)", ink: mySide === "p1" ? "var(--p1-ink)" : "var(--p2-ink)" },
              { label: `相手 (${opSide.toUpperCase()})`, hp: opStats.finalHp, color: opSide === "p1" ? "var(--p1)" : "var(--p2)", soft: opSide === "p1" ? "var(--p1-soft)" : "var(--p2-soft)", ink: opSide === "p1" ? "var(--p1-ink)" : "var(--p2-ink)" },
            ].map((p) => (
              <div
                key={p.label}
                style={{
                  background: p.soft,
                  border: `1px solid ${p.color}`,
                  borderRadius: 12,
                  padding: "12px 20px",
                  textAlign: "center",
                  minWidth: 100,
                }}
              >
                <div style={{ fontSize: 11, color: p.ink, fontWeight: 600, marginBottom: 4 }}>{p.label}</div>
                <div
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    fontSize: 24,
                    color: p.color,
                  }}
                >
                  {p.hp}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>HP残り</div>
              </div>
            ))}
          </div>

          <div
            style={{
              background: "rgba(255,255,255,.7)",
              borderRadius: 10,
              padding: "10px 16px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-soft)" }}>終了理由:</span>
              <span style={{ fontWeight: 600 }}>{endReasonLabel}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-soft)" }}>ターン数:</span>
              <span style={{ fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
                {data.stats.totalTurns}
              </span>
            </div>
            {timeSec != null && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ color: "var(--ink-soft)" }}>対戦時間:</span>
                <span style={{ fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>{timeSec}s</span>
              </div>
            )}
          </div>
        </div>

        {/* CTA block */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
          <Link
            href={`/match/${matchId}/coding`}
            style={{
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 700,
              padding: "12px 28px",
              borderRadius: 10,
              fontSize: 15,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ✎ コードを改善して再戦
          </Link>
          <Link
            href={`/match/${matchId}/battle`}
            style={{
              background: "var(--surface)",
              color: "var(--ink)",
              fontWeight: 600,
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              textDecoration: "none",
              border: "1px solid var(--line)",
            }}
          >
            リプレイを見る
          </Link>
          <Link
            href="/dashboard"
            style={{
              background: "var(--surface)",
              color: "var(--ink-soft)",
              fontWeight: 600,
              padding: "12px 24px",
              borderRadius: 10,
              fontSize: 14,
              textDecoration: "none",
              border: "1px solid var(--line)",
            }}
          >
            ダッシュボード
          </Link>
        </div>

        {/* 2 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24 }}>
          {/* Left: Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* HP Timeline */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>HPタイムライン</div>
              <HpTimelineSVG timeline={data.stats.hpTimeline} firstDamageTurn={data.stats.firstDamageTurn} />
              <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { color: "#2563eb", label: `P1 ${p1Name}` },
                  { color: "#ef4444", label: `P2 ${p2Name}` },
                  ...(data.stats.firstDamageTurn != null
                    ? [{ color: "#f59e0b", label: `FirstDamage (T${data.stats.firstDamageTurn})`, dashed: true }]
                    : []),
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: "dashed" in item && item.dashed ? 16 : 12,
                        height: 2,
                        background: item.color,
                        borderStyle: "dashed" in item && item.dashed ? "dashed" : "solid",
                        borderWidth: "dashed" in item && item.dashed ? "1px 0 0 0" : 0,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stat tiles */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>対戦スタッツ</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      background: "var(--bg)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      border: "1px solid var(--line)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 4 }}>{stat.label}</div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, alignItems: "baseline" }}>
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                          fontSize: 16,
                          color: mySide === "p1" ? "var(--p1)" : "var(--p2)",
                        }}
                      >
                        {stat.me}
                        {stat.unit}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>/</span>
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontWeight: 700,
                          fontSize: 14,
                          color: opSide === "p1" ? "var(--p1)" : "var(--p2)",
                        }}
                      >
                        {stat.op}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 8, textAlign: "right" }}>
                左: {meName} ({mySide.toUpperCase()}) ／ 右: {opName} ({opSide.toUpperCase()})
              </div>
            </div>

            {/* FirstDamage banner */}
            {data.stats.firstDamageTurn != null && data.stats.firstDamageBy != null && (
              <div
                style={{
                  background: "#fef9c3",
                  border: "1px solid #fde047",
                  borderRadius: 10,
                  padding: "10px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                }}
              >
                <span style={{ fontSize: 18 }}>⭐</span>
                <span>
                  <strong>First Damage!</strong> T{data.stats.firstDamageTurn}で
                  {data.stats.firstDamageBy === "p1" ? p1Name : p2Name}が先制攻撃に成功しました
                </span>
              </div>
            )}

            {/* Turn highlights */}
            {highlights.length > 0 && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>ターンハイライト</div>
                {highlights.map((h, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: i < highlights.length - 1 ? "1px solid var(--line)" : "none",
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: h.color, flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "JetBrains Mono, monospace",
                        color: "var(--ink-soft)",
                        minWidth: 24,
                      }}
                    >
                      T{h.turn}
                    </span>
                    <span style={{ fontSize: 13 }}>{h.event}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {meStats && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>勝率</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontWeight: 800,
                      fontSize: 40,
                      color: "var(--p1)",
                    }}
                  >
                    {meStats.winRate}%
                  </span>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>({meStats.total} 戦)</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[
                    { label: "W", value: meStats.wins, color: "var(--success)" },
                    { label: "L", value: meStats.losses, color: "var(--danger)" },
                    { label: "D", value: meStats.draws, color: "var(--ink-soft)" },
                  ].map((item) => (
                    <div key={item.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 2 }}>{item.label}</div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: 18,
                          color: item.color,
                          fontFamily: "JetBrains Mono, monospace",
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recent.length > 0 && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>最近の対戦</div>
                {recent.map((m) => {
                  const opName = m.opponent?.displayName ?? m.opponent?.username ?? "—";
                  const isCurrent = m.id === data.matchId;
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: isCurrent ? "var(--accent-soft)" : "transparent",
                        border: isCurrent ? "1px solid #fde047" : "1px solid transparent",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 10,
                          color: "var(--ink-soft)",
                          minWidth: 24,
                        }}
                      >
                        #{m.matchNumber}
                      </span>
                      <span
                        style={{
                          background:
                            m.result === "WIN" ? "#dcfce7" : m.result === "LOSE" ? "#fee2e2" : "#f3f4f6",
                          color:
                            m.result === "WIN" ? "#166534" : m.result === "LOSE" ? "#7f1d1d" : "#374151",
                          fontWeight: 700,
                          fontSize: 10,
                          padding: "1px 7px",
                          borderRadius: 999,
                        }}
                      >
                        {m.result}
                      </span>
                      <span style={{ flex: 1, fontSize: 13 }}>vs {opName}</span>
                      {isCurrent && (
                        <span
                          style={{
                            background: "var(--accent)",
                            color: "#fff",
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          NOW
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Learning hints */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>💡 学習ヒント</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {LEARNING_HINTS.map((hint) => (
              <div
                key={hint.title}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{hint.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{hint.title}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>{hint.body}</p>
                <pre
                  style={{
                    background: "#1f2330",
                    color: "#e5e7eb",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace",
                    lineHeight: 1.6,
                    margin: 0,
                    overflow: "auto",
                  }}
                >
                  {hint.code}
                </pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
