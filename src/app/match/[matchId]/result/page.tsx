"use client";

import Link from "next/link";

const MOCK_RESULT = {
  matchId: "match-001",
  roomName: "教室A-5限",
  matchNo: 7,
  p1Name: "はなこ",
  p2Name: "たろう",
  winner: "p1",
  endReason: "HP0",
  totalTurns: 16,
  timeSec: 48,
  p1Hp: 42,
  p2Hp: 0,
  p1DamageDealt: 100,
  p2DamageDealt: 58,
  p1HitRate: 75,
  p2HitRate: 50,
  p1Scans: 4,
  p2Scans: 2,
  p1Moves: 8,
  p2Moves: 6,
  p1Shoots: 4,
  p2Shoots: 4,
  p1Items: 1,
  p2Items: 0,
  firstDamageTurn: 3,
  winRate: 59,
  winRateDelta: 1.2,
  wins: 7,
  losses: 4,
  draws: 1,
  roomRank: 3,
  roomRankDelta: 2,
};

// HP timeline data per turn (P1, P2)
const HP_TIMELINE = [
  [100, 100],
  [100, 100],
  [100, 100],
  [85, 100], // T3 FirstDamage
  [85, 80],
  [70, 80],
  [70, 65],
  [70, 50],
  [55, 50],
  [55, 35],
  [42, 35],
  [42, 20],
  [42, 20],
  [42, 10],
  [42, 5],
  [42, 0], // T16 end
];

const RECENT_MATCHES = [
  { no: 3, result: "WIN", opponent: "ゆいか", delta: "+1.1" },
  { no: 4, result: "LOSS", opponent: "たろう", delta: "-0.8" },
  { no: 5, result: "WIN", opponent: "けんじ", delta: "+0.9" },
  { no: 6, result: "WIN", opponent: "さくら", delta: "+1.0" },
  { no: 7, result: "WIN", opponent: MOCK_RESULT.p2Name, delta: "+1.2", isCurrent: true },
];

const TURN_HIGHLIGHTS = [
  { turn: 3, color: "#f59e0b", event: "First Damage! はなこ → たろう -15HP" },
  { turn: 7, color: "#16a34a", event: "アイテム取得: BARRIER" },
  { turn: 10, color: "var(--p2)", event: "たろう SHOOT HIT: -13HP" },
  { turn: 13, color: "var(--p1)", event: "はなこ 連続ヒット × 2" },
  { turn: 16, color: "var(--ink)", event: "たろう HP0 — 対戦終了" },
];

const LEARNING_HINTS = [
  {
    icon: "🎯",
    title: "索敵→射撃コンボが有効",
    body: "T3でSCAN後にSHOOT_FORWARDを繋げたことで初ダメージを与えられました。このコンボを継続しましょう。",
    code: `IF scan_detected
  SHOOT_FORWARD
ELSE
  SCAN`,
  },
  {
    icon: "⚡",
    title: "AP効率を改善できます",
    body: "T5-T7でWAITが2回入っており、APを無駄にしていました。fallbackActionsにMOVE_FORWARDを設定しましょう。",
    code: `fallbackActions:
  MOVE_FORWARD`,
  },
  {
    icon: "🛡",
    title: "BARRIERアイテムを活用",
    body: "T7で取得したBARRIERを使わずに終わりました。次回はアイテム取得後すぐに使用するロジックを追加しましょう。",
    code: `IF has_item_barrier
  USE_ITEM`,
  },
];

function HpTimelineSVG() {
  const W = 420;
  const H = 120;
  const PAD = { t: 10, r: 10, b: 20, l: 30 };
  const turns = HP_TIMELINE.length;
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const p1Points = HP_TIMELINE.map((d, i) => ({
    x: PAD.l + (i / (turns - 1)) * chartW,
    y: PAD.t + (1 - d[0] / 100) * chartH,
  }));
  const p2Points = HP_TIMELINE.map((d, i) => ({
    x: PAD.l + (i / (turns - 1)) * chartW,
    y: PAD.t + (1 - d[1] / 100) * chartH,
  }));

  const toPath = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const toArea = (pts: { x: number; y: number }[]) => {
    const base = PAD.t + chartH;
    return (
      toPath(pts) +
      ` L ${pts[pts.length - 1].x.toFixed(1)} ${base} L ${pts[0].x.toFixed(1)} ${base} Z`
    );
  };

  const firstDamageX = PAD.l + ((MOCK_RESULT.firstDamageTurn - 1) / (turns - 1)) * chartW;
  const endX = PAD.l + ((turns - 1) / (turns - 1)) * chartW;

  return (
    <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
      {/* Area fills */}
      <path d={toArea(p1Points)} fill="rgba(37,99,235,.1)" />
      <path d={toArea(p2Points)} fill="rgba(239,68,68,.1)" />
      {/* Lines */}
      <path d={toPath(p1Points)} fill="none" stroke="#2563eb" strokeWidth={2} />
      <path d={toPath(p2Points)} fill="none" stroke="#ef4444" strokeWidth={2} />
      {/* FirstDamage marker */}
      <line
        x1={firstDamageX}
        y1={PAD.t}
        x2={firstDamageX}
        y2={PAD.t + chartH}
        stroke="#f59e0b"
        strokeWidth={1.5}
        strokeDasharray="4,3"
      />
      <text
        x={firstDamageX + 3}
        y={PAD.t + 10}
        fontSize={9}
        fill="#92400e"
        fontFamily="JetBrains Mono, monospace"
      >
        T{MOCK_RESULT.firstDamageTurn}
      </text>
      {/* End marker */}
      <line
        x1={endX}
        y1={PAD.t}
        x2={endX}
        y2={PAD.t + chartH}
        stroke="#374151"
        strokeWidth={1.5}
        strokeDasharray="4,3"
      />
      {/* Axis labels */}
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

export default function ResultPage({ params }: { params: { matchId: string } }) {
  const isWin = MOCK_RESULT.winner === "p1";

  const stats = [
    { label: "与ダメ", p1: MOCK_RESULT.p1DamageDealt, p2: MOCK_RESULT.p2DamageDealt, unit: "" },
    { label: "被ダメ", p1: MOCK_RESULT.p2DamageDealt, p2: MOCK_RESULT.p1DamageDealt, unit: "" },
    { label: "命中率", p1: MOCK_RESULT.p1HitRate, p2: MOCK_RESULT.p2HitRate, unit: "%" },
    { label: "索敵回数", p1: MOCK_RESULT.p1Scans, p2: MOCK_RESULT.p2Scans, unit: "回" },
    { label: "MOVE", p1: MOCK_RESULT.p1Moves, p2: MOCK_RESULT.p2Moves, unit: "回" },
    { label: "SHOOT", p1: MOCK_RESULT.p1Shoots, p2: MOCK_RESULT.p2Shoots, unit: "回" },
    { label: "TURN", p1: MOCK_RESULT.totalTurns, p2: MOCK_RESULT.totalTurns, unit: "" },
    { label: "アイテム", p1: MOCK_RESULT.p1Items, p2: MOCK_RESULT.p2Items, unit: "個" },
  ];

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
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{MOCK_RESULT.roomName}</span>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>·</span>
        <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>対戦 #{MOCK_RESULT.matchNo}</span>
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
            P1 {MOCK_RESULT.p1Name}
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
            P2 {MOCK_RESULT.p2Name}
          </span>
        </div>
      </header>

      <div style={{ flex: 1, padding: "24px" }}>
        {/* Hero section */}
        <div
          style={{
            background: isWin
              ? "linear-gradient(135deg, #f0fdf4, #dcfce7)"
              : "linear-gradient(135deg, #fef2f2, #fee2e2)",
            border: `2px solid ${isWin ? "#16a34a" : "var(--p2)"}`,
            borderRadius: 16,
            padding: "28px 32px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          {/* WIN badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: isWin ? "#16a34a" : "var(--p2)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 4px 20px ${isWin ? "rgba(22,163,74,.3)" : "rgba(239,68,68,.3)"}`,
              }}
            >
              <span style={{ fontSize: 28 }}>{isWin ? "✓" : "✗"}</span>
            </div>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: isWin ? "#15803d" : "var(--p2-ink)",
                letterSpacing: "0.05em",
              }}
            >
              {isWin ? "WIN" : "LOSE"}
            </span>
          </div>

          {/* Message */}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>
              {isWin ? "いい判断でした！" : "次回は巻き返しましょう"}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)" }}>
              索敵→射撃コンボが功を奏し、{MOCK_RESULT.totalTurns}ターンで決着がつきました。
            </div>
          </div>

          {/* HP comparison */}
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "あなた (P1)", hp: MOCK_RESULT.p1Hp, color: "var(--p1)", soft: "var(--p1-soft)", ink: "var(--p1-ink)" },
              { label: "相手 (P2)", hp: MOCK_RESULT.p2Hp, color: "var(--p2)", soft: "var(--p2-soft)", ink: "var(--p2-ink)" },
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
                <div style={{ fontSize: 11, color: p.ink, fontWeight: 600, marginBottom: 4 }}>
                  {p.label}
                </div>
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

          {/* Meta */}
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
              <span style={{ fontWeight: 600 }}>HP0</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-soft)" }}>ターン数:</span>
              <span style={{ fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
                {MOCK_RESULT.totalTurns}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <span style={{ color: "var(--ink-soft)" }}>対戦時間:</span>
              <span style={{ fontWeight: 600, fontFamily: "JetBrains Mono, monospace" }}>
                {MOCK_RESULT.timeSec}s
              </span>
            </div>
          </div>
        </div>

        {/* CTA block */}
        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 32,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/match/${params.matchId}/coding`}
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
            href={`/match/${params.matchId}/battle`}
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
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                HPタイムライン
              </div>
              <HpTimelineSVG />
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                {[
                  { color: "#2563eb", label: "P1 はなこ" },
                  { color: "#ef4444", label: "P2 たろう" },
                  { color: "#f59e0b", label: "FirstDamage (T3)", dashed: true },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div
                      style={{
                        width: item.dashed ? 16 : 12,
                        height: 2,
                        background: item.color,
                        borderStyle: item.dashed ? "dashed" : "solid",
                        borderWidth: item.dashed ? "1px 0 0 0" : 0,
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
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                対戦スタッツ
              </div>
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
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 4 }}>
                      {stat.label}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, alignItems: "baseline" }}>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 16, color: "var(--p1)" }}>
                        {stat.p1}{stat.unit}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>/</span>
                      <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 14, color: "var(--p2)" }}>
                        {stat.p2}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* FirstDamage banner */}
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
                <strong>First Damage!</strong> T{MOCK_RESULT.firstDamageTurn}で{MOCK_RESULT.p1Name}が先制攻撃に成功しました
              </span>
            </div>

            {/* Turn highlights */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                ターンハイライト
              </div>
              {TURN_HIGHLIGHTS.map((h) => (
                <div
                  key={h.turn}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: h.color,
                      flexShrink: 0,
                    }}
                  />
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
          </div>

          {/* Right: Ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Win rate card */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                勝率
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    fontSize: 40,
                    color: "var(--p1)",
                  }}
                >
                  {MOCK_RESULT.winRate}%
                </span>
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    fontWeight: 700,
                    fontSize: 13,
                    padding: "3px 10px",
                    borderRadius: 999,
                  }}
                >
                  ▲ +{MOCK_RESULT.winRateDelta}pt
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { label: "W", value: MOCK_RESULT.wins, color: "var(--success)" },
                  { label: "L", value: MOCK_RESULT.losses, color: "var(--danger)" },
                  { label: "D", value: MOCK_RESULT.draws, color: "var(--ink-soft)" },
                ].map((item) => (
                  <div key={item.label} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 2 }}>
                      {item.label}
                    </div>
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

            {/* Recent matches */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                最近の対戦
              </div>
              {RECENT_MATCHES.map((m) => (
                <div
                  key={m.no}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: m.isCurrent ? "var(--accent-soft)" : "transparent",
                    border: m.isCurrent ? "1px solid #fde047" : "1px solid transparent",
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
                    #{m.no}
                  </span>
                  <span
                    style={{
                      background: m.result === "WIN" ? "#dcfce7" : "#fee2e2",
                      color: m.result === "WIN" ? "#166534" : "#7f1d1d",
                      fontWeight: 700,
                      fontSize: 10,
                      padding: "1px 7px",
                      borderRadius: 999,
                    }}
                  >
                    {m.result}
                  </span>
                  <span style={{ flex: 1, fontSize: 13 }}>vs {m.opponent}</span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: m.delta.startsWith("+") ? "var(--success)" : "var(--danger)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {m.delta}
                  </span>
                  {m.isCurrent && (
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
              ))}
            </div>

            {/* Room ranking */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                ルームランキング
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontWeight: 800,
                    fontSize: 36,
                    color: "#f59e0b",
                  }}
                >
                  {MOCK_RESULT.roomRank}位
                </span>
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    fontWeight: 700,
                    fontSize: 12,
                    padding: "2px 8px",
                    borderRadius: 999,
                  }}
                >
                  ↑+{MOCK_RESULT.roomRankDelta}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Learning hints */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
            💡 学習ヒント
          </div>
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
                <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
                  {hint.body}
                </p>
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
