"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";

interface ApiStanding {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number; // ratio 0–1
  points: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgTurns: number;
  recent: ("W" | "L" | "D")[];
  recentMatches: {
    matchNumber: number;
    opponentName: string;
    result: string;
    endReason: string | null;
    turns: number;
  }[];
}

interface ApiSummary {
  totalMatches: number;
  avgTurns: number;
  avgWinRate: number;
  firstDamageWinRate: number;
  endReasonCounts: Record<string, number>;
}

interface RecentMatch {
  matchNo: number;
  vs: string;
  result: string;
  endReason: string;
  turns: number;
}

interface StandingRow {
  id: string;
  username: string;
  displayName: string;
  matches: number;
  w: number;
  l: number;
  d: number;
  winRate: number; // percentage 0–100
  avgDmgGiven: number;
  avgDmgTaken: number;
  avgTurns: number;
  recent: string[];
  recentMatches: RecentMatch[];
}

const END_REASON_STYLE: Record<string, { label: string; color: string }> = {
  HP_ZERO: { label: "HP0", color: "#dc2626" },
  TIMEOUT: { label: "TIMEOUT", color: "#d97706" },
  DISCONNECT: { label: "DISCONNECT", color: "#7c3aed" },
  NO_SHOW: { label: "NO_SHOW", color: "#6b7280" },
  LEAVE: { label: "LEAVE", color: "#0891b2" },
  CANCELED: { label: "CANCELED", color: "#9ca3af" },
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export default function RoomStandingsPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "お知らせ", href: `/admin/rooms/${roomId}/announcements`, icon: "📢" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  const [period, setPeriod] = useState("全期間");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [rankingPublic, setRankingPublic] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PERIODS = ["全期間", "直近7日", "直近30日", "任意期間"];

  useEffect(() => {
    const params = new URLSearchParams();
    if (period === "直近7日") params.set("from", isoDaysAgo(7));
    else if (period === "直近30日") params.set("from", isoDaysAgo(30));
    else if (period === "任意期間") {
      if (customStart) params.set("from", new Date(customStart).toISOString());
      if (customEnd) params.set("to", new Date(customEnd).toISOString());
    }
    const qs = params.toString();
    const controller = new AbortController();
    fetch(`/api/admin/rooms/${roomId}/standings${qs ? `?${qs}` : ""}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          setError(d?.error ?? "成績を取得できませんでした");
          setStandings([]);
          setSummary(null);
          return;
        }
        const data = await res.json();
        setRoomName(data.room?.name ?? "");
        setRoomNumber(data.room?.roomNumber ?? "");
        setSummary(data.summary ?? null);
        const rows: StandingRow[] = (data.standings as ApiStanding[]).map((s) => ({
          id: s.userId,
          username: s.username,
          displayName: s.displayName ?? s.username,
          matches: s.played,
          w: s.wins,
          l: s.losses,
          d: s.draws,
          winRate: Math.round(s.winRate * 1000) / 10,
          avgDmgGiven: s.avgDamageDealt,
          avgDmgTaken: s.avgDamageTaken,
          avgTurns: s.avgTurns,
          recent: s.recent,
          recentMatches: s.recentMatches.map((m) => ({
            matchNo: m.matchNumber,
            vs: m.opponentName,
            result: m.result,
            endReason: m.endReason ?? "—",
            turns: m.turns,
          })),
        }));
        setStandings(rows);
        setError(null);
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setError("成績を取得できませんでした");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [roomId, period, customStart, customEnd]);

  const selectedPlayer = standings.find((s) => s.id === selectedId) ?? null;

  const donutData = summary
    ? Object.entries(summary.endReasonCounts).map(([reason, value]) => ({
        label: END_REASON_STYLE[reason]?.label ?? reason,
        value,
        color: END_REASON_STYLE[reason]?.color ?? "#6b7280",
      }))
    : [];

  const total = donutData.reduce((s, d) => s + d.value, 0);
  const r = 50;
  const cx = 70;
  const cy = 70;
  const donutSegments = donutData.map((d, idx) => {
    const prevSum = donutData.slice(0, idx).reduce((s, x) => s + x.value, 0);
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
        <AdminSidenav items={ROOM_NAV} scope="room" roomName={roomName} roomNumber={roomNumber} />
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
              { label: "総試合数", value: summary?.totalMatches ?? 0, unit: "試合" },
              { label: "平均ターン数", value: summary?.avgTurns ?? 0, unit: "T" },
              { label: "平均勝率", value: `${summary?.avgWinRate ?? 0}%`, unit: "" },
              { label: "先制ダメージ勝率", value: `${summary?.firstDamageWinRate ?? 0}%`, unit: "" },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 26, fontWeight: 800, color: "var(--room-admin-accent)" }}>{kpi.value}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{kpi.unit}</span>
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
                    {(loading || error || standings.length === 0) && (
                      <tr>
                        <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: error ? "#dc2626" : "var(--ink-soft)" }}>
                          {error ? error : loading ? "読み込み中…" : "対象期間の成績データはありません"}
                        </td>
                      </tr>
                    )}
                    {!loading && !error && standings.map((player, i) => {
                      const rank = i + 1;
                      const isSelected = selectedId === player.id;
                      return (
                        <tr
                          key={player.id}
                          onClick={() => setSelectedId(isSelected ? null : player.id)}
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
                  <button onClick={() => setSelectedId(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--ink-soft)" }}>✕</button>
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
                  {selectedPlayer.recentMatches.length === 0 && (
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", padding: "8px 0" }}>マッチ履歴はありません</div>
                  )}
                  {selectedPlayer.recentMatches.map((m, i) => (
                    <div key={m.matchNo} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: i < selectedPlayer.recentMatches.length - 1 ? "1px solid var(--line)" : "none" }}>
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
