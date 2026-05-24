"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { StatusBadge } from "@/components/ui/StatusBadge";

interface RoomData {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  expiresAt: string | null;
  rulePreset: Record<string, unknown> | null;
  admins: { id: string; username: string; displayName: string | null }[];
  _count: { memberships: number; matches: number };
}

interface ActiveMatch {
  id: string;
  matchNumber: number;
  status: string;
  player1: { id: string; username: string; displayName: string | null } | null;
  player2: { id: string; username: string; displayName: string | null } | null;
  startedAt: string | null;
}

// Game-wide rule defaults — Room.rulePreset is JSON and usually ships empty,
// so the overview shows these unless the preset overrides a field.
const RULE_DEFAULTS = {
  boardWidth: 10,
  boardHeight: 10,
  maxTurns: 20,
  ap: 2,
  scanRange: 3,
  obstacleCount: 5,
  codingTimeLimitSec: 300,
};

// Activity timeline has no API yet (RoomActivity model exists but isn't
// exposed) — kept as a mock with this note. See docs/ROADMAP.md Milestone D.
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

function fmtDate(iso: string | null): string {
  if (!iso) return "無期限";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function elapsedMin(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  return `${Math.floor(ms / 60000)}分`;
}

function nameOf(p: { username: string; displayName: string | null } | null): string {
  return p?.displayName ?? p?.username ?? "募集中";
}

export default function RoomOverviewPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [activeMatches, setActiveMatches] = useState<ActiveMatch[]>([]);
  const [avgWinRate, setAvgWinRate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/admin/rooms/${roomId}`);
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "ルーム情報を取得できませんでした");
          return;
        }
        const { room: r } = await res.json();
        setRoom(r);
        // Active matches + standings come from the player endpoints (admins
        // are privileged on them), keyed by roomNumber rather than id.
        const [matchesRes, standingsRes] = await Promise.allSettled([
          fetch(`/api/rooms/${r.roomNumber}/matches`),
          fetch(`/api/rooms/${r.roomNumber}/standings`),
        ]);
        if (cancelled) return;
        if (matchesRes.status === "fulfilled" && matchesRes.value.ok) {
          const d = await matchesRes.value.json();
          setActiveMatches(d.matches ?? []);
        }
        if (standingsRes.status === "fulfilled" && standingsRes.value.ok) {
          const d = await standingsRes.value.json();
          const list: { winRate: number }[] = d.standings ?? [];
          if (list.length > 0) {
            const avg = list.reduce((a, s) => a + s.winRate, 0) / list.length;
            setAvgWinRate(Math.round(avg * 1000) / 10); // 0–1 fraction → percent, 1 decimal
          } else {
            setAvgWinRate(0);
          }
        }
      } catch {
        if (!cancelled) setError("ルーム情報を取得できませんでした");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "お知らせ", href: `/admin/rooms/${roomId}/announcements`, icon: "📢" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>
        {error}
        <div style={{ marginTop: 16 }}>
          <Link href="/admin/system/rooms" style={{ color: "var(--room-admin-accent)" }}>ルーム一覧へ</Link>
        </div>
      </div>
    );
  }
  if (!room) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>読み込み中…</div>;
  }

  const kind = KIND_CONFIG[room.kind] ?? { label: room.kind, bg: "#f3f4f6", color: "#4b5563" };
  const rules = { ...RULE_DEFAULTS, ...(room.rulePreset ?? {}) } as typeof RULE_DEFAULTS;
  const liveMatchCount = activeMatches.filter((m) => m.status === "BATTLING").length;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="suzuki_h" displayName="鈴木 花子" role="ROOM_ADMIN" />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={ROOM_NAV} scope="room" roomName={room.name} roomNumber={room.roomNumber} />
        <main style={{ flex: 1, padding: "32px" }}>
          {/* Room info card */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "24px", marginBottom: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--room-admin-accent)", fontFamily: "JetBrains Mono, monospace" }}>{room.roomNumber}</span>
                  <span style={{ background: kind.bg, color: kind.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: "JetBrains Mono, monospace" }}>{kind.label}</span>
                  <StatusBadge status={room.status} />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", margin: 0 }}>{room.name}</h1>
                <p style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>{room.description ?? "—"}</p>
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
                { label: "盤面", value: `${rules.boardWidth}×${rules.boardHeight}` },
                { label: "最大ターン", value: `${rules.maxTurns}T` },
                { label: "AP", value: `${rules.ap}/turn` },
                { label: "スキャン範囲", value: `${rules.scanRange}マス` },
                { label: "障害物", value: `${rules.obstacleCount}個` },
                { label: "コーディング制限", value: `${rules.codingTimeLimitSec}秒` },
                { label: "有効期限", value: fmtDate(room.expiresAt) },
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
              { label: "メンバー総数", value: room._count.memberships, unit: "名", color: "var(--room-admin-accent)" },
              { label: "総対戦数", value: room._count.matches, unit: "試合", color: "#7c3aed" },
              { label: "進行中マッチ", value: liveMatchCount, unit: "件", color: "#d97706" },
              { label: "平均勝率", value: avgWinRate == null ? "—" : `${avgWinRate}%`, unit: "", color: "#15803d" },
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
                <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{activeMatches.length}件</span>
              </div>
              {activeMatches.length === 0 ? (
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
                    {activeMatches.map((match, i) => (
                      <tr key={match.id} style={{ borderBottom: i < activeMatches.length - 1 ? "1px solid var(--line)" : "none" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "var(--room-admin-accent)" }}>#{match.matchNumber}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink)" }}>{nameOf(match.player1)}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink)" }}>{nameOf(match.player2)}</td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: match.status === "BATTLING" ? "#d97706" : "#1d4ed8", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                            <StatusBadge status={match.status} />
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{elapsedMin(match.startedAt)}</td>
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
