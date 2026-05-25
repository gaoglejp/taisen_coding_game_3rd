"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserRole } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: UserRole;
  status: string;
  memberships: {
    id: string;
    status: string;
    room: {
      id: string;
      name: string;
      roomNumber: string;
      kind: "CLASSROOM" | "TOURNAMENT" | "PUBLIC_LOBBY";
      status: string;
    };
  }[];
}

interface Stats {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
  avgTurns: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  firstDamageRate: number;
  sparkline: number[];
}

interface RecentMatch {
  id: string;
  matchNumber: number;
  result: "WIN" | "LOSE" | "DRAW";
  endReason: string | null;
  endedAt: string | null;
  opponent: { id: string; username: string; displayName: string | null } | null;
  room: { name: string; roomNumber: string } | null;
}

interface Room {
  id: string;
  name: string;
  roomNumber: string;
  kind: "CLASSROOM" | "TOURNAMENT" | "PUBLIC_LOBBY";
  status: string;
  matchCount: number;
}

// ─── Design tokens (mirrors globals.css) ─────────────────────────────────────

const T = {
  bg: "#f6f4ee",
  surface: "#ffffff",
  line: "#e7e3d6",
  ink: "#1f2330",
  inkSoft: "#4b5563",
  accent: "#f59e0b",
  accentSoft: "#fef3c7",
  p1: "#2563eb",
  p1Soft: "#dbeafe",
  success: "#15803d",
  danger: "#dc2626",
  radius: "14px",
  shadowSm: "0 1px 2px rgba(31,35,48,.04), 0 1px 1px rgba(31,35,48,.03)",
  shadowMd: "0 6px 18px rgba(31,35,48,.06), 0 2px 4px rgba(31,35,48,.04)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roomKindConfig(kind: string) {
  if (kind === "CLASSROOM")
    return { label: "CLASSROOM", bg: "rgba(13,148,136,.12)", color: "#0d9488" };
  if (kind === "TOURNAMENT")
    return { label: "TOURNAMENT", bg: "rgba(126,34,206,.12)", color: "#7e22ce" };
  return { label: "PUBLIC", bg: "rgba(245,158,11,.15)", color: "#b45309" };
}

function getResultConfig(result: "WIN" | "LOSE" | "DRAW") {
  if (result === "WIN") return { label: "WIN", color: "#15803d", bg: "#dcfce7" };
  if (result === "LOSE") return { label: "LOSE", color: "#dc2626", bg: "#fee2e2" };
  return { label: "DRAW", color: "#4b5563", bg: "#f3f4f6" };
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function endReasonLabel(r: string | null) {
  if (!r) return "—";
  const map: Record<string, string> = {
    HP_ZERO: "HP 0",
    TIMEOUT: "時間切れ",
    DISCONNECT: "切断",
    NO_SHOW: "不参加",
    LEAVE: "退出",
    CANCELED: "キャンセル",
  };
  return map[r] ?? r;
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return null;
  const W = 180;
  const H = 48;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  });
  const d = `M ${pts.join(" L ")}`;
  const fill = `M ${pts[0]} L ${pts.join(" L ")} L ${W},${H} L 0,${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="spk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.accent} stopOpacity="0.28" />
          <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#spk)" />
      <path d={d} fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = "100%", h = 18 }: { w?: string | number; h?: number }) {
  return (
    <span
      className="skeleton"
      style={{ display: "inline-block", width: w, height: h, borderRadius: 6 }}
    />
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  unit,
  loading,
}: {
  label: string;
  value: string | number;
  unit?: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.line}`,
        borderRadius: 10,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft }}>{label}</span>
      {loading ? (
        <Skeleton h={22} w={60} />
      ) : (
        <span style={{ fontSize: 20, fontWeight: 800, color: T.ink, lineHeight: 1 }}>
          {value}
          {unit && (
            <span style={{ fontSize: 12, fontWeight: 600, color: T.inkSoft, marginLeft: 3 }}>
              {unit}
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// ─── Room Card ────────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: Room }) {
  const kc = roomKindConfig(room.kind);
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.line}`,
        borderRadius: T.radius,
        boxShadow: T.shadowSm,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3, color: T.ink }}>
          {room.name}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: 999,
            background: kc.bg,
            color: kc.color,
            whiteSpace: "nowrap",
            fontFamily: "JetBrains Mono, monospace",
            flexShrink: 0,
          }}
        >
          {kc.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 11,
            color: T.inkSoft,
            fontFamily: "JetBrains Mono, monospace",
            background: T.bg,
            border: `1px solid ${T.line}`,
            borderRadius: 6,
            padding: "2px 8px",
          }}
        >
          #{room.roomNumber}
        </span>
        <StatusBadge status={room.status} />
      </div>
      <div style={{ fontSize: 12, color: T.inkSoft }}>
        {room.matchCount} 対戦
      </div>
      <Link
        href={`/rooms/${room.roomNumber}`}
        style={{
          marginTop: 2,
          display: "block",
          textAlign: "center",
          padding: "8px 0",
          borderRadius: 8,
          border: `1px solid ${T.line}`,
          background: T.bg,
          fontSize: 13,
          fontWeight: 700,
          color: T.ink,
          textDecoration: "none",
          transition: "background .12s",
        }}
      >
        入室する
      </Link>
    </div>
  );
}

// ─── Mock fallback data ───────────────────────────────────────────────────────

const MOCK_USER: MeUser = {
  id: "mock",
  username: "player1",
  displayName: "Player One",
  email: null,
  role: "GENERAL_USER",
  status: "ACTIVE",
  memberships: [],
};

const MOCK_STATS: Stats = {
  wins: 12, losses: 7, draws: 2, total: 21,
  winRate: 57, avgTurns: 14.3,
  avgDamageDealt: 320, avgDamageTaken: 210,
  firstDamageRate: 62,
  sparkline: [40, 45, 50, 48, 52, 55, 53, 57, 54, 58, 56, 57],
};

const MOCK_MATCHES: RecentMatch[] = [
  { id: "m1", matchNumber: 42, result: "WIN", endReason: "HP_ZERO", endedAt: "2026-05-21T14:23:00Z", opponent: { id: "u2", username: "rival99", displayName: "Rival 99" }, room: { name: "公開ロビー", roomNumber: "PUB001" } },
  { id: "m2", matchNumber: 41, result: "LOSE", endReason: "TIMEOUT", endedAt: "2026-05-20T10:10:00Z", opponent: { id: "u3", username: "coder42", displayName: "Coder 42" }, room: { name: "公開ロビー", roomNumber: "PUB001" } },
  { id: "m3", matchNumber: 40, result: "WIN", endReason: "HP_ZERO", endedAt: "2026-05-19T18:44:00Z", opponent: null, room: null },
  { id: "m4", matchNumber: 39, result: "DRAW", endReason: "TIMEOUT", endedAt: "2026-05-18T09:30:00Z", opponent: { id: "u4", username: "blockman", displayName: "Block Man" }, room: { name: "クラス A", roomNumber: "CLS001" } },
  { id: "m5", matchNumber: 38, result: "WIN", endReason: "HP_ZERO", endedAt: "2026-05-17T16:05:00Z", opponent: { id: "u5", username: "looper", displayName: "Looper" }, room: { name: "クラス A", roomNumber: "CLS001" } },
];

const MOCK_ROOMS: Room[] = [
  { id: "r1", name: "公開ロビー Alpha", roomNumber: "PUB001", kind: "PUBLIC_LOBBY", status: "ACTIVE", matchCount: 88 },
  { id: "r2", name: "クラス A", roomNumber: "CLS001", kind: "CLASSROOM", status: "ACTIVE", matchCount: 34 },
  { id: "r3", name: "春季トーナメント", roomNumber: "TRN001", kind: "TOURNAMENT", status: "ACTIVE", matchCount: 16 },
];

// ─── Dashboard page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [matches, setMatches] = useState<RecentMatch[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [meRes, statsRes, matchesRes, roomsRes] = await Promise.allSettled([
          fetch("/api/me"),
          fetch("/api/me/stats"),
          fetch("/api/me/matches?limit=5"),
          fetch("/api/rooms/visible"),
        ]);

        if (meRes.status === "fulfilled" && meRes.value.ok) {
          const data = await meRes.value.json();
          setUser(data.user);
        } else {
          setUser(MOCK_USER);
        }

        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data = await statsRes.value.json();
          setStats(data.stats);
        } else {
          setStats(MOCK_STATS);
        }

        if (matchesRes.status === "fulfilled" && matchesRes.value.ok) {
          const data = await matchesRes.value.json();
          setMatches(data.matches);
        } else {
          setMatches(MOCK_MATCHES);
        }

        if (roomsRes.status === "fulfilled" && roomsRes.value.ok) {
          const data = await roomsRes.value.json();
          setRooms(data.rooms);
        } else {
          setRooms(MOCK_ROOMS);
        }
      } catch {
        setUser(MOCK_USER);
        setStats(MOCK_STATS);
        setMatches(MOCK_MATCHES);
        setRooms(MOCK_ROOMS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const displayName = user?.displayName ?? user?.username ?? "…";

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      {/* Topbar */}
      <TopbarPaper
        username={user?.username}
        displayName={user?.displayName ?? user?.username}
        role={user?.role}
      />

      {/* Main content */}
      <main
        style={{
          maxWidth: 1440,
          margin: "0 auto",
          padding: "28px 32px",
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 1. Hero card */}
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 16,
              boxShadow: T.shadowMd,
              padding: "28px 32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 800,
                    color: T.ink,
                    lineHeight: 1.2,
                  }}
                >
                  {loading ? (
                    <Skeleton w={220} h={26} />
                  ) : (
                    <>おかえりなさい、<span style={{ color: T.p1 }}>{displayName}</span>さん</>
                  )}
                </h1>
                {user && <RoleBadge role={user.role} />}
                {user && <StatusBadge status={user.status} />}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: T.inkSoft }}>
                {loading ? <Skeleton w={180} /> : `@${user?.username}`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <Link
                href="/rooms"
                style={{
                  padding: "11px 22px",
                  borderRadius: 10,
                  background: T.accent,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(245,158,11,.35)",
                  border: "none",
                  display: "inline-block",
                }}
              >
                ⚔ 対戦ルームに入る
              </Link>
              <Link
                href="/practice"
                style={{
                  padding: "11px 22px",
                  borderRadius: 10,
                  background: T.surface,
                  color: T.ink,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: "none",
                  border: `1px solid ${T.line}`,
                  display: "inline-block",
                }}
              >
                🧩 練習する
              </Link>
            </div>
          </div>

          {/* 2. Rooms grid */}
          <section>
            <h2
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                fontWeight: 700,
                color: T.ink,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              参加中のルーム
            </h2>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      background: T.surface,
                      border: `1px solid ${T.line}`,
                      borderRadius: T.radius,
                      height: 140,
                    }}
                    className="skeleton"
                  />
                ))}
              </div>
            ) : rooms && rooms.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {rooms.map((room) => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  background: T.surface,
                  border: `1px solid ${T.line}`,
                  borderRadius: T.radius,
                  padding: "24px",
                  textAlign: "center",
                  color: T.inkSoft,
                  fontSize: 14,
                }}
              >
                参加中のルームはありません。
                <br />
                <Link href="/rooms" style={{ color: T.p1, fontWeight: 600 }}>
                  ルームを探す →
                </Link>
              </div>
            )}
          </section>

          {/* 3. Recent matches table */}
          <section>
            <h2 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: T.ink }}>
              最近の対戦
            </h2>
            <div
              style={{
                background: T.surface,
                border: `1px solid ${T.line}`,
                borderRadius: T.radius,
                boxShadow: T.shadowSm,
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: T.bg,
                      borderBottom: `1px solid ${T.line}`,
                    }}
                  >
                    {["日時", "相手", "結果", "終了理由", "リプレイ"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 700,
                          color: T.inkSoft,
                          fontFamily: "JetBrains Mono, monospace",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading
                    ? [1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                          {[1, 2, 3, 4, 5].map((j) => (
                            <td key={j} style={{ padding: "12px 16px" }}>
                              <Skeleton w={j === 2 ? 100 : 70} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : (matches ?? []).map((m) => {
                        const rc = getResultConfig(m.result);
                        return (
                          <tr
                            key={m.id}
                            style={{
                              borderBottom: `1px solid ${T.line}`,
                              transition: "background .1s",
                            }}
                          >
                            <td style={{ padding: "12px 16px", fontSize: 12, color: T.inkSoft }}>
                              {fmtDate(m.endedAt)}
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>
                              {m.opponent?.displayName ?? m.opponent?.username ?? "—"}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "3px 10px",
                                  borderRadius: 999,
                                  background: rc.bg,
                                  color: rc.color,
                                  fontFamily: "JetBrains Mono, monospace",
                                }}
                              >
                                {rc.label}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontSize: 12, color: T.inkSoft }}>
                              {endReasonLabel(m.endReason)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <Link
                                href={`/watch/${m.id}`}
                                style={{
                                  fontSize: 12,
                                  color: T.p1,
                                  fontWeight: 600,
                                  textDecoration: "none",
                                }}
                              >
                                再生
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                  {!loading && (!matches || matches.length === 0) && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          padding: "24px 16px",
                          textAlign: "center",
                          fontSize: 13,
                          color: T.inkSoft,
                        }}
                      >
                        対戦履歴がありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* 4. Stats summary */}
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 16,
              boxShadow: T.shadowMd,
              padding: "22px 22px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>
                戦績サマリー
              </h2>
              {!loading && stats && (
                <span style={{ fontSize: 12, color: T.inkSoft }}>
                  {stats.total} 試合
                </span>
              )}
            </div>

            {/* Big win rate + sparkline */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.inkSoft }}>勝率</span>
                {loading ? (
                  <Skeleton w={80} h={48} />
                ) : (
                  <span
                    style={{
                      fontSize: 52,
                      fontWeight: 900,
                      color: T.accent,
                      lineHeight: 1,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {stats?.winRate ?? 0}
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.inkSoft }}>%</span>
                  </span>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  {loading ? (
                    <Skeleton w={120} />
                  ) : (
                    <>
                      <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>
                        {stats?.wins}W
                      </span>
                      <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
                        {stats?.losses}L
                      </span>
                      <span style={{ fontSize: 12, color: T.inkSoft, fontWeight: 600 }}>
                        {stats?.draws}D
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, paddingBottom: 4 }}>
                {loading ? (
                  <Skeleton w="100%" h={48} />
                ) : (
                  <Sparkline data={stats?.sparkline ?? []} />
                )}
              </div>
            </div>

            {/* 4 stat tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <StatTile
                label="平均ターン数"
                value={loading ? "…" : (stats?.avgTurns?.toFixed(1) ?? "—")}
                unit="T"
                loading={loading}
              />
              <StatTile
                label="先制率"
                value={loading ? "…" : `${stats?.firstDamageRate ?? 0}`}
                unit="%"
                loading={loading}
              />
              <StatTile
                label="平均与ダメ"
                value={loading ? "…" : (stats?.avgDamageDealt ?? "—")}
                loading={loading}
              />
              <StatTile
                label="平均被ダメ"
                value={loading ? "…" : (stats?.avgDamageTaken ?? "—")}
                loading={loading}
              />
            </div>
          </div>

          {/* 5. Hints section */}
          <div
            style={{
              background: T.surface,
              border: `1px solid ${T.line}`,
              borderRadius: 16,
              boxShadow: T.shadowSm,
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: T.ink }}>
              ヒント & 改善ポイント
            </h2>

            {/* Defeat tags */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: T.inkSoft }}>
                よく負けるパターン
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["タイムアウト負け", "HP逆転負け", "序盤弱い"].map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 11,
                      padding: "3px 10px",
                      borderRadius: 999,
                      background: "#fee2e2",
                      color: "#dc2626",
                      fontWeight: 600,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommended blocks */}
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: T.inkSoft }}>
                おすすめブロック例
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { name: "くりかえし (ループ)", desc: "連続攻撃に効果的" },
                  { name: "もしも (条件分岐)", desc: "HP < 30% で回復" },
                  { name: "待つ (ディフェンス)", desc: "相手の攻撃をやりすごす" },
                ].map((b) => (
                  <div
                    key={b.name}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "8px 12px",
                      background: T.bg,
                      border: `1px solid ${T.line}`,
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "3px 8px",
                        borderRadius: 6,
                        background: T.p1Soft,
                        color: T.p1,
                        fontFamily: "JetBrains Mono, monospace",
                        flexShrink: 0,
                        alignSelf: "flex-start",
                      }}
                    >
                      BLOCK
                    </span>
                    <div>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: T.ink }}>
                        {b.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: T.inkSoft }}>{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
