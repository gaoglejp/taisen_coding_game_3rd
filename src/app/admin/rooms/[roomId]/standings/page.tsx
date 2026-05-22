"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";

const MOCK_STANDINGS = [
  { id: "p1", username: "tanaka_k", displayName: "田中 健二", matches: 12, w: 9, l: 2, d: 1, winRate: 75.0, avgDmgGiven: 48.2, avgDmgTaken: 22.1, avgTurns: 142, recent: ["W","W","L","W","W"] },
  { id: "p2", username: "kobayashi_y", displayName: "小林 陽一", matches: 10, w: 7, l: 2, d: 1, winRate: 70.0, avgDmgGiven: 45.8, avgDmgTaken: 26.3, avgTurns: 151, recent: ["W","L","W","W","W"] },
  { id: "p3", username: "suzuki_h", displayName: "鈴木 花子", matches: 11, w: 6, l: 5, d: 0, winRate: 54.5, avgDmgGiven: 38.4, avgDmgTaken: 35.7, avgTurns: 162, recent: ["L","W","W","L","W"] },
  { id: "p4", username: "ito_m", displayName: "伊藤 みか", matches: 10, w: 5, l: 4, d: 1, winRate: 50.0, avgDmgGiven: 36.9, avgDmgTaken: 38.1, avgTurns: 168, recent: ["W","D","L","W","L"] },
  { id: "p5", username: "watanabe_r", displayName: "渡辺 涼", matches: 11, w: 5, l: 6, d: 0, winRate: 45.5, avgDmgGiven: 33.2, avgDmgTaken: 41.5, avgTurns: 175, recent: ["L","W","L","L","W"] },
  { id: "p6", username: "yoshida_t", displayName: "吉田 達也", matches: 9, w: 3, l: 5, d: 1, winRate: 33.3, avgDmgGiven: 28.7, avgDmgTaken: 47.8, avgTurns: 181, recent: ["L","L","W","L","D"] },
  { id: "p7", username: "nakamura_s", displayName: "中村 俊介", matches: 6, w: 2, l: 3, d: 1, winRate: 33.3, avgDmgGiven: 25.4, avgDmgTaken: 49.2, avgTurns: 185, recent: ["W","L","D","L","L"] },
  { id: "p8", username: "kato_n", displayName: "加藤 奈々", matches: 3, w: 1, l: 2, d: 0, winRate: 33.3, avgDmgGiven: 22.1, avgDmgTaken: 52.0, avgTurns: 190, recent: ["W","L","L"] },
];

const KPI_DATA = {
  totalMatches: 47,
  avgTurns: 164.3,
  avgWinRate: 49.4,
  firstDamageRate: 61.2,
  deltas: { totalMatches: "+8", avgTurns: "-2.1", avgWinRate: "+1.2", firstDamageRate: "+3.4" },
};

const DONUT_DATA = [
  { label: "HP0", value: 28, color: "#dc2626" },
  { label: "TIMEOUT", value: 14, color: "#d97706" },
  { label: "DISCONNECT", value: 5, color: "#7c3aed" },
];

const RECENT_MATCHES_SAMPLE = [
  { matchNo: 41, vs: "suzuki_h", result: "W", endReason: "HP_ZERO", turns: 138 },
  { matchNo: 39, vs: "watanabe_r", result: "W", endReason: "HP_ZERO", turns: 145 },
  { matchNo: 37, vs: "yoshida_t", result: "L", endReason: "TIMEOUT", turns: 200 },
  { matchNo: 35, vs: "kobayashi_y", result: "W", endReason: "HP_ZERO", turns: 132 },
  { matchNo: 33, vs: "ito_m", result: "W", endReason: "HP_ZERO", turns: 141 },
];

export default function RoomStandingsPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  const [period, setPeriod] = useState("全期間");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rankingPublic, setRankingPublic] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<typeof MOCK_STANDINGS[0] | null>(null);

  const PERIODS = ["全期間", "直近7日", "直近30日", "任意期間"];

  const total = DONUT_DATA.reduce((s, d) => s + d.value, 0);
  const r = 50;
  const cx = 70;
  const cy = 70;
  const donutSegments = DONUT_DATA.map((d, idx) => {
    const prevSum = DONUT_DATA.slice(0, idx).reduce((s, x) => s + x.value, 0);
    const startAngle = (prevSum / total) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((prevSum + d.value) / total) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = d.value / total > 0.5 ? 1 : 0;
    const innerR = 32;
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    return { ...d, pathD: `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1} Z` };
  });

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="suzuki_h" displayName="鈴木 花子" role="ROOM_ADMIN" />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={ROOM_NAV} scope="room" roomName="春季トーナメント2024" roomNumber="R-2402" />
        <main style={{ flex: 1, padding: "32px", position: "relative" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>成績</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>ランキング公開:</span>
                <button
                  onClick={() => setRankingPublic(!rankingPublic)}
                  style={{ width: 44, height: 24, borderRadius: 12, background: rankingPublic ? "#15803d" : "#9ca3af", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: rankingPublic ? 23 : 3, transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 12, fontWeight: 700, color: rankingPublic ? "#15803d" : "#6b7280" }}>{rankingPublic ? "公開中" : "非公開"}</span>
              </div>
              <button style={secondaryBtnStyle}>⬇ CSV エクスポート</button>
            </div>
          </div>

          {/* Period tabs */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "14px 20px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            {PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)} style={filterChipStyle(period === p)}>{p}</button>
            ))}
            {period === "任意期間" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>〜</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }} />
              </div>
            )}
          </div>

          {/* KPI tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "総試合数", value: KPI_DATA.totalMatches, unit: "試合", delta: KPI_DATA.deltas.totalMatches },
              { label: "平均ターン数", value: KPI_DATA.avgTurns, unit: "T", delta: KPI_DATA.deltas.avgTurns },
              { label: "平均勝率", value: `${KPI_DATA.avgWinRate}%`, unit: "", delta: KPI_DATA.deltas.avgWinRate },
              { label: "FirstDamage取得率", value: `${KPI_DATA.firstDamageRate}%`, unit: "", delta: KPI_DATA.deltas.firstDamageRate },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "var(--room-admin-accent)" }}>{kpi.value}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{kpi.unit}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color: kpi.delta.startsWith("+") ? "#15803d" : "#dc2626",
                    background: kpi.delta.startsWith("+") ? "#dcfce7" : "#fee2e2",
                    borderRadius: 999, padding: "1px 7px"
                  }}>{kpi.delta}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Table + Drawer */}
          <div style={{ display: "flex", gap: "20px" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9f8f5", borderBottom: "1px solid var(--line)" }}>
                      {["順位", "プレイヤー", "試合数", "W/L/D", "勝率", "与ダメ平均", "被ダメ平均", "平均ターン", "直近N"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_STANDINGS.map((player, i) => {
                      const rank = i + 1;
                      const isSelected = selectedPlayer?.id === player.id;
                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedPlayer(isSelected ? null : player)}
                          style={{ borderBottom: "1px solid var(--line)", height: 52, cursor: "pointer", background: isSelected ? "rgba(8,145,178,0.04)" : "transparent" }}
                        >
                          <td style={{ padding: "0 16px", fontSize: 16, fontWeight: 800, color: rank === 1 ? "#d97706" : rank <= 3 ? "#4b5563" : "var(--ink-soft)" }}>
                            {rank === 1 ? "👑" : `#${rank}`}
                          </td>
                          <td style={{ padding: "0 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: isSelected ? "var(--room-admin-accent)" : "#e5e7eb",
                                color: isSelected ? "#fff" : "#6b7280",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 11, fontWeight: 700,
                              }}>
                                {player.displayName[0]}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{player.displayName}</div>
                                <div style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>@{player.username}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{player.matches}</td>
                          <td style={{ padding: "0 16px" }}>
                            <div style={{ display: "flex", gap: "4px", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
                              <span style={{ color: "#15803d", fontWeight: 700 }}>{player.w}W</span>
                              <span style={{ color: "#dc2626", fontWeight: 700 }}>{player.l}L</span>
                              <span style={{ color: "#92400e", fontWeight: 700 }}>{player.d}D</span>
                            </div>
                          </td>
                          <td style={{ padding: "0 16px", minWidth: 120 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <div style={{ flex: 1, height: 6, background: "#e5e7eb", borderRadius: 999, overflow: "hidden" }}>
                                <div style={{
                                  width: `${player.winRate}%`, height: "100%",
                                  background: player.winRate >= 60 ? "#15803d" : player.winRate >= 40 ? "var(--room-admin-accent)" : "#dc2626",
                                  borderRadius: 999,
                                }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)", minWidth: 40, fontFamily: "JetBrains Mono, monospace" }}>{player.winRate}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "0 16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "#15803d", fontWeight: 700 }}>{player.avgDmgGiven}</td>
                          <td style={{ padding: "0 16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "#dc2626", fontWeight: 700 }}>{player.avgDmgTaken}</td>
                          <td style={{ padding: "0 16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-soft)" }}>{player.avgTurns}</td>
                          <td style={{ padding: "0 16px" }}>
                            <div style={{ display: "flex", gap: "3px" }}>
                              {player.recent.map((result, ri) => (
                                <span
                                  key={ri}
                                  style={{
                                    width: 16, height: 16, borderRadius: "50%",
                                    background: result === "W" ? "#15803d" : result === "L" ? "#dc2626" : "#d97706",
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 8, color: "#fff", fontWeight: 800,
                                  }}
                                >
                                  {result}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Donut chart */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px", marginTop: "20px" }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", margin: "0 0 16px" }}>終了理由の内訳</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
                  <svg width={140} height={140} viewBox="0 0 140 140">
                    {donutSegments.map((seg) => (
                      <path key={seg.label} d={seg.pathD} fill={seg.color} />
                    ))}
                    <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 18, fontWeight: 800 }} fill="#1f2937">{total}</text>
                    <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10 }} fill="#6b7280">試合</text>
                  </svg>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {donutSegments.map((seg) => (
                      <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{seg.label}</span>
                        <span style={{ fontSize: 13, fontFamily: "JetBrains Mono, monospace", color: "var(--ink-soft)" }}>
                          {seg.value}件 ({Math.round(seg.value / total * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Drilldown drawer */}
            {selectedPlayer && (
              <div style={{ width: 320, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", alignSelf: "flex-start", position: "sticky", top: 120 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--ink)" }}>{selectedPlayer.displayName}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>@{selectedPlayer.username}</div>
                  </div>
                  <button onClick={() => setSelectedPlayer(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--ink-soft)" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                  {[
                    { label: "試合数", value: selectedPlayer.matches },
                    { label: "勝率", value: `${selectedPlayer.winRate}%` },
                    { label: "与ダメ平均", value: selectedPlayer.avgDmgGiven },
                    { label: "被ダメ平均", value: selectedPlayer.avgDmgTaken },
                  ].map((s) => (
                    <div key={s.label} style={{ background: "#f9f8f5", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-soft)", marginBottom: 2 }}>{s.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "var(--room-admin-accent)", fontFamily: "JetBrains Mono, monospace" }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: "8px", letterSpacing: "0.05em" }}>直近マッチ</div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {RECENT_MATCHES_SAMPLE.map((m, i) => (
                    <div key={m.matchNo} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: i < RECENT_MATCHES_SAMPLE.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: m.result === "W" ? "#dcfce7" : m.result === "L" ? "#fee2e2" : "#fef3c7",
                        color: m.result === "W" ? "#15803d" : m.result === "L" ? "#dc2626" : "#92400e",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, flexShrink: 0,
                      }}>
                        {m.result}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>vs {m.vs}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>#{m.matchNo} · {m.turns}T · {m.endReason}</div>
                      </div>
                      <span style={{ fontSize: 10, color: "var(--room-admin-accent)", fontWeight: 600, cursor: "pointer" }}>リプレイ</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700,
  color: "var(--ink-soft)", letterSpacing: "0.05em", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap",
};
const secondaryBtnStyle: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
  padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)",
};

function filterChipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--room-admin-accent)" : "#f3f4f6",
    color: active ? "#fff" : "var(--ink)",
    border: "none", borderRadius: 999, padding: "4px 14px",
    fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}
