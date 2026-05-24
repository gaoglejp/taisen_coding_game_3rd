"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { TopbarPaper } from "@/components/layout/TopbarPaper";

// <!-- bind: GET /api/rooms/:roomNumber -->
// <!-- bind: GET /api/rooms/:roomNumber/matches -->
// <!-- bind: GET /api/rooms/:roomNumber/standings -->
// <!-- bind: GET /api/rooms/:roomNumber/announcements -->

interface RoomData {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  kind: "CLASSROOM" | "TOURNAMENT" | "PUBLIC_LOBBY";
  status: string;
  expiresAt: string | null;
  activeMemberCount: number;
  totalMatches: number;
}

interface ApiPlayer {
  id: string;
  username: string;
  displayName: string | null;
}

interface ApiMatch {
  id: string;
  matchNumber: number;
  status: string;
  player1: ApiPlayer | null;
  player2: ApiPlayer | null;
}

interface ApiStanding {
  rank: number;
  userId: string;
  username: string;
  displayName: string | null;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  winRate: number;
}

const KIND_CONFIG = {
  CLASSROOM: { label: "CLASSROOM", bg: "rgba(8,145,178,0.12)", color: "#0891b2" },
  TOURNAMENT: { label: "TOURNAMENT", bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  PUBLIC_LOBBY: { label: "PUBLIC LOBBY", bg: "rgba(245,158,11,0.12)", color: "#b45309" },
};

// Rule preset defaults — the schema has `Room.rulePreset` (JSON) but most
// rooms ship with `{}`. Until rule presets are populated, the page shows the
// game's global defaults rather than room-specific values.
const RULE_DEFAULTS = {
  board: "10×10",
  maxTurns: 20,
  ap: 2,
  obstacles: 5,
  items: ["CROSS", "BARRIER"],
  codingLimit: "5分",
};

// "あなたの予定" (schedule) is still intentionally mock-only in this page.
// Announcements are API-wired via GET /api/rooms/:roomNumber/announcements.
// See docs/ROADMAP.md → Milestone C.
interface ApiAnnouncement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  authorName: string;
}


function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "日時不明";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "今日";
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return `${Math.floor(days / 30)}か月前`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export default function RoomTopPage({ params }: { params: Promise<{ roomNumber: string }> }) {
  const { roomNumber } = use(params);
  const [matchFilter, setMatchFilter] = useState("ALL");
  const [room, setRoom] = useState<RoomData | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [standings, setStandings] = useState<ApiStanding[]>([]);
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; body: string; author: string; time: string; pinned: boolean }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // The room fetch governs the error state; matches/standings/me are
    // best-effort enrichments and fail silently (their panels just stay empty).
    Promise.allSettled([
      fetch(`/api/rooms/${roomNumber}`),
      fetch("/api/me"),
      fetch(`/api/rooms/${roomNumber}/matches`),
      fetch(`/api/rooms/${roomNumber}/standings`),
      fetch(`/api/rooms/${roomNumber}/announcements`),
    ]).then(async ([roomRes, meRes, matchesRes, standingsRes, announcementsRes]) => {
      if (cancelled) return;
      if (roomRes.status === "fulfilled" && roomRes.value.ok) {
        const data = await roomRes.value.json();
        setRoom(data.room);
      } else {
        const data =
          roomRes.status === "fulfilled" ? await roomRes.value.json().catch(() => null) : null;
        setError(data?.error ?? "ルーム情報を取得できませんでした");
        return;
      }
      if (meRes.status === "fulfilled" && meRes.value.ok) {
        const data = await meRes.value.json();
        setMeId(data.user?.id ?? null);
      }
      if (matchesRes.status === "fulfilled" && matchesRes.value.ok) {
        const data = await matchesRes.value.json();
        setMatches(data.matches ?? []);
      }
      if (standingsRes.status === "fulfilled" && standingsRes.value.ok) {
        const data = await standingsRes.value.json();
        setStandings(data.standings ?? []);
      }
      if (announcementsRes.status === "fulfilled" && announcementsRes.value.ok) {
        const data = await announcementsRes.value.json();
        setAnnouncements((data.announcements ?? []).map((a: ApiAnnouncement) => ({ id: a.id, title: a.title, body: a.body, pinned: !!a.pinned, author: a.authorName, time: formatRelativeDate(a.createdAt) })));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [roomNumber]);

  const nameOf = (p: ApiPlayer | null) => p?.displayName ?? p?.username ?? null;
  const filteredMatches = matches.filter((m) => {
    if (matchFilter === "ALL") return true;
    if (matchFilter === "LIVE") return m.status === "BATTLING";
    if (matchFilter === "CODING") return m.status === "CODING";
    if (matchFilter === "OPEN") return m.status === "WAITING";
    return true;
  });
  const liveMatchCount = matches.filter((m) => m.status === "BATTLING").length;
  const myStanding = meId ? standings.find((s) => s.userId === meId) ?? null : null;

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

  if (!room) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>読み込み中…</div>;
  }

  const kc = KIND_CONFIG[room.kind];
  const daysLeft = daysUntil(room.expiresAt);

  return (
    <div style={{ minHeight: "100vh" }}>
      <TopbarPaper
        centerContent={
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-soft)" }}>
            <Link href="/dashboard" style={{ color: "var(--p1)", textDecoration: "none" }}>ダッシュボード</Link>
            <span>/</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{room.roomNumber}</span>
          </div>
        }
      />

      <main style={{ maxWidth: 1440, margin: "0 auto", padding: "24px 24px" }}>
        {/* Hero */}
        <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--line)", padding: "24px 28px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>{room.roomNumber}</span>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: kc.bg, color: kc.color }}>{kc.label}</span>
                <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#dcfce7", color: "#15803d" }}>{room.status}</span>
              </div>
              <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800 }}>{room.name}</h1>
              <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--ink-soft)" }}>
                <span>
                  📅 {formatDate(room.expiresAt)} まで
                  {daysLeft != null && `（残${daysLeft}日）`}
                </span>
                <span>👥 {room.activeMemberCount}名</span>
                <span>⚔ 進行中 {liveMatchCount}マッチ</span>
              </div>
            </div>
          </div>

          {/* Rule summary — defaults until rulePreset is populated */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {[
              { k: "盤面", v: RULE_DEFAULTS.board },
              { k: "最大ターン", v: `${RULE_DEFAULTS.maxTurns}T` },
              { k: "AP上限", v: `${RULE_DEFAULTS.ap} AP/T` },
              { k: "障害物", v: `${RULE_DEFAULTS.obstacles}個` },
              { k: "コーディング制限", v: RULE_DEFAULTS.codingLimit },
            ].map((r) => (
              <div key={r.k} style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 600 }}>{r.k}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{r.v}</div>
              </div>
            ))}
            <div style={{ background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px" }}>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", fontWeight: 600 }}>アイテム</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                {RULE_DEFAULTS.items.map((it) => (
                  <span key={it} style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 4, background: "#dbeafe", color: "var(--p1-ink)" }}>{it}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
          {/* Left: Matches */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>進行中・募集中のマッチ</h2>
              <div style={{ display: "flex", gap: 4 }}>
                {["ALL", "LIVE", "CODING", "OPEN"].map((f) => (
                  <button key={f} onClick={() => setMatchFilter(f)} style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid", fontSize: 11, fontWeight: matchFilter === f ? 700 : 500, background: matchFilter === f ? "var(--accent)" : "var(--surface)", color: matchFilter === f ? "#fff" : "var(--ink-soft)", borderColor: matchFilter === f ? "var(--accent)" : "var(--line)", cursor: "pointer" }}>{f}</button>
                ))}
              </div>
            </div>
            {filteredMatches.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px dashed var(--line-2)", borderRadius: "var(--radius-sm)", padding: "28px 16px", textAlign: "center", color: "var(--ink-soft)", fontSize: 13 }}>
                該当するマッチはありません
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                {filteredMatches.map((m) => {
                  const p1 = nameOf(m.player1);
                  const p2 = nameOf(m.player2);
                  const isMyMatch = !!meId && (m.player1?.id === meId || m.player2?.id === meId);
                  const isOpen = m.player2 === null;
                  return (
                    <div key={m.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", border: `1.5px solid ${isMyMatch ? "var(--accent)" : "var(--line)"}`, padding: 14, position: "relative" }}>
                      {isMyMatch && <span style={{ position: "absolute", top: 8, right: 8, background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999 }}>YOU</span>}
                      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>マッチ #{m.matchNumber}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "var(--p1)" }}>{p1 ?? "---"}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>vs</span>
                        {p2 ? (
                          <span style={{ fontWeight: 700, fontSize: 13, color: "var(--p2)" }}>{p2}</span>
                        ) : (
                          <span style={{ fontWeight: 600, fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-2)", padding: "2px 8px", borderRadius: 4, border: "1px dashed var(--line-2)" }}>募集中</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: m.status === "BATTLING" ? "var(--p2-soft)" : m.status === "CODING" ? "var(--p1-soft)" : "var(--bg-2)", color: m.status === "BATTLING" ? "var(--p2-ink)" : m.status === "CODING" ? "var(--p1-ink)" : "var(--ink-soft)" }}>{m.status}</span>
                        {isMyMatch ? (
                          <Link href={`/match/${m.id}/coding`} style={{ background: "var(--accent)", color: "#fff", padding: "5px 12px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>▸ 入室する</Link>
                        ) : isOpen ? (
                          <button style={{ background: "var(--accent)", color: "#fff", padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ 参加する</button>
                        ) : (
                          <Link href={`/watch/${m.id}`} style={{ background: "rgba(8,145,178,0.1)", color: "var(--room-admin-accent)", padding: "5px 12px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 700, border: "1px solid var(--room-admin-accent)" }}>▸ 観戦する</Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Schedule + Ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>あなたの戦績</div>
              {myStanding ? (
                <div style={{ textAlign: "center", padding: "10px 0" }}>
                  <div style={{ fontSize: 32, fontWeight: 800 }}>{myStanding.rank}位</div>
                  <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>勝率 {Math.round(myStanding.winRate * 100)}%</div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--success)" }}>{myStanding.wins}W</span>
                    <span style={{ color: "var(--danger)" }}>{myStanding.losses}L</span>
                    <span style={{ color: "var(--ink-soft)" }}>{myStanding.draws}D</span>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: "var(--ink-soft)" }}>
                  このルームでの対戦記録はまだありません
                </div>
              )}
            </div>

            {/* "あなたの予定" is still mock — no schedule API yet (ROADMAP C). */}
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>あなたの予定</div>
              {[
                { label: "マッチ #12 進行中", time: "現在", accent: "var(--p2)" },
                { label: "マッチ #16 vs みか", time: "水 15:00" },
                { label: "コーディング締切", time: "5/31 23:59", accent: "var(--accent)" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
                  <span style={{ color: s.accent ?? "var(--ink)" }}>{s.label}</span>
                  <span style={{ color: "var(--ink-soft)" }}>{s.time}</span>
                </div>
              ))}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Top 5 ランキング</div>
              {standings.length === 0 ? (
                <div style={{ padding: "12px 0", fontSize: 12, color: "var(--ink-soft)" }}>
                  まだランキングはありません
                </div>
              ) : (
                standings.slice(0, 5).map((r) => {
                  const isMe = r.userId === meId;
                  const name = r.displayName ?? r.username;
                  return (
                    <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)", background: isMe ? "var(--accent-soft)" : "transparent", borderRadius: isMe ? 6 : 0, paddingLeft: isMe ? 6 : 0 }}>
                      <span style={{ width: 20, fontSize: 12, fontWeight: 700, color: r.rank === 1 ? "#d97706" : "var(--ink-soft)" }}>{r.rank === 1 ? "👑" : r.rank}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: isMe ? 700 : 400 }}>{name}{isMe && " (あなた)"}</span>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{Math.round(r.winRate * 100)}%</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>📢 お知らせ</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {announcements.map((a) => (
              <div key={a.id} style={{ background: "var(--surface)", border: `1px solid ${a.pinned ? "var(--accent)" : "var(--line)"}`, borderRadius: "var(--radius-sm)", padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{a.title}</span>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-soft)" }}>{a.body}</p>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{a.author} · {a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
