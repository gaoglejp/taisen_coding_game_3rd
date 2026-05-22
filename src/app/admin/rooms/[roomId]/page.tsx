"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { StatusBadge } from "@/components/ui/StatusBadge";

const MOCK_ROOM = {
  id: "r2",
  roomNumber: "R-2402",
  name: "春季トーナメント2024",
  kind: "TOURNAMENT",
  status: "ACTIVE",
  expiresAt: "2024-05-31",
  description: "春季トーナメントの公式ルーム",
  rules: {
    boardWidth: 10,
    boardHeight: 10,
    maxTurns: 200,
    ap: 3,
    scanRange: 2,
    obstacleCount: 8,
    codingTimeLimitSec: 180,
  },
};

const MOCK_KPIS = {
  memberCount: 16,
  todayMatches: 8,
  activeMatches: 2,
  avgWinRate: 52.4,
};

const MOCK_ACTIVE_MATCHES = [
  { id: "m1", matchNumber: 42, p1: "tanaka_k", p2: "suzuki_h", status: "BATTLING", elapsedMin: 12 },
  { id: "m2", matchNumber: 43, p1: "ito_m", p2: "watanabe_r", status: "CODING", elapsedMin: 3 },
];

const MOCK_ACTIVITIES = [
  { id: "a1", type: "MATCH_START", message: "マッチ #42 が開始されました", time: "14:22", relatedId: "m1" },
  { id: "a2", type: "MEMBER_JOIN", message: "watanabe_r がルームに参加しました", time: "13:50", relatedId: null },
  { id: "a3", type: "MATCH_END", message: "マッチ #41 が終了 (勝者: tanaka_k)", time: "13:45", relatedId: null },
  { id: "a4", type: "MATCH_START", message: "マッチ #43 が開始されました", time: "11:30", relatedId: "m2" },
  { id: "a5", type: "MEMBER_JOIN", message: "ito_m がルームに参加しました", time: "10:00", relatedId: null },
];

const ACTIVITY_ICON: Record<string, string> = {
  MATCH_START: "⚔",
  MATCH_END: "🏁",
  MEMBER_JOIN: "👤",
  MEMBER_ISSUE: "🔑",
};

const KIND_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  CLASSROOM: { label: "CLASSROOM", bg: "rgba(8,145,178,0.12)", color: "#0891b2" },
  TOURNAMENT: { label: "TOURNAMENT", bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  PUBLIC_LOBBY: { label: "PUBLIC LOBBY", bg: "rgba(245,158,11,0.12)", color: "#b45309" },
};

export default function RoomOverviewPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  const kind = KIND_CONFIG[MOCK_ROOM.kind];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="suzuki_h" displayName="鈴木 花子" role="ROOM_ADMIN" />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={ROOM_NAV} scope="room" roomName={MOCK_ROOM.name} roomNumber={MOCK_ROOM.roomNumber} />
        <main style={{ flex: 1, padding: "32px" }}>
          {/* Room info card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "24px", marginBottom: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--room-admin-accent)", fontFamily: "JetBrains Mono, monospace" }}>{MOCK_ROOM.roomNumber}</span>
                  <span style={{ background: kind.bg, color: kind.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: "JetBrains Mono, monospace" }}>{kind.label}</span>
                  <StatusBadge status={MOCK_ROOM.status} />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>{MOCK_ROOM.name}</h1>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{MOCK_ROOM.description}</p>
              </div>
              <Link
                href={`/admin/rooms/${roomId}/settings`}
                style={{ background: "rgba(8,145,178,0.08)", color: "var(--room-admin-accent)", border: "1px solid rgba(8,145,178,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
              >
                ⚙ 設定を開く
              </Link>
            </div>
            {/* Rule tiles */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {[
                { label: "盤面", value: `${MOCK_ROOM.rules.boardWidth}×${MOCK_ROOM.rules.boardHeight}` },
                { label: "最大ターン", value: `${MOCK_ROOM.rules.maxTurns}T` },
                { label: "AP", value: `${MOCK_ROOM.rules.ap}/turn` },
                { label: "スキャン範囲", value: `${MOCK_ROOM.rules.scanRange}マス` },
                { label: "障害物", value: `${MOCK_ROOM.rules.obstacleCount}個` },
                { label: "コーディング制限", value: `${MOCK_ROOM.rules.codingTimeLimitSec}秒` },
                { label: "有効期限", value: MOCK_ROOM.expiresAt },
              ].map((tile) => (
                <div key={tile.label} style={{ background: "rgba(8,145,178,0.04)", border: "1px solid rgba(8,145,178,0.12)", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 2 }}>{tile.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>{tile.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* KPI tiles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "メンバー総数", value: MOCK_KPIS.memberCount, unit: "名", color: "var(--room-admin-accent)" },
              { label: "今日の対戦数", value: MOCK_KPIS.todayMatches, unit: "試合", color: "#7c3aed" },
              { label: "進行中マッチ", value: MOCK_KPIS.activeMatches, unit: "件", color: "#d97706" },
              { label: "平均勝率", value: `${MOCK_KPIS.avgWinRate}%`, unit: "", color: "#15803d" },
            ].map((kpi) => (
              <div key={kpi.label} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600, marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: kpi.color }}>{kpi.value}</span>
                  <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
            {[
              { label: "メンバーを発行", icon: "🔑", href: `/admin/rooms/${roomId}/members`, desc: "新しい参加コードを発行" },
              { label: "マッチカードを作成", icon: "⚔", href: `/admin/rooms/${roomId}/matches`, desc: "対戦カードを登録" },
              { label: "成績をエクスポート (CSV)", icon: "⬇", href: "#", desc: "全期間の成績データ" },
            ].map((action) => (
              <Link
                key={action.label}
                href={action.href}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 14,
                  padding: "20px",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  transition: "box-shadow 0.15s",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <span style={{ fontSize: 24 }}>{action.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--room-admin-accent)" }}>{action.label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{action.desc}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Active matches + Activity (2 col) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>
            {/* Active matches table */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--ink)" }}>進行中マッチ</h2>
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{MOCK_ACTIVE_MATCHES.length}件</span>
              </div>
              {MOCK_ACTIVE_MATCHES.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-soft)", fontSize: 14 }}>進行中のマッチはありません</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9f8f5" }}>
                      {["マッチNo", "P1", "P2", "ステータス", "経過時間", "観戦"].map((h) => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_ACTIVE_MATCHES.map((match, i) => (
                      <tr key={match.id} style={{ borderBottom: i < MOCK_ACTIVE_MATCHES.length - 1 ? "1px solid var(--line)" : "none" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "var(--room-admin-accent)" }}>#{match.matchNumber}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink)" }}>{match.p1}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink)" }}>{match.p2}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: match.status === "BATTLING" ? "#d97706" : "#1d4ed8", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                            <StatusBadge status={match.status} />
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{match.elapsedMin}分</td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link href={`/watch/${match.id}`} style={{ background: "rgba(8,145,178,0.1)", color: "var(--room-admin-accent)", border: "1px solid rgba(8,145,178,0.2)", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                            👁 観戦する
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Activity timeline */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px", color: "var(--ink)" }}>アクティビティ</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                {MOCK_ACTIVITIES.map((act, i) => (
                  <div key={act.id} style={{ display: "flex", gap: "12px", paddingBottom: i < MOCK_ACTIVITIES.length - 1 ? "16px" : 0, position: "relative" }}>
                    {i < MOCK_ACTIVITIES.length - 1 && (
                      <div style={{ position: "absolute", left: 15, top: 28, bottom: 0, width: 1, background: "var(--line)" }} />
                    )}
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(8,145,178,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, zIndex: 1 }}>
                      {ACTIVITY_ICON[act.type] ?? "•"}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.4 }}>{act.message}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 3, fontFamily: "JetBrains Mono, monospace" }}>{act.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.05em", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" };
