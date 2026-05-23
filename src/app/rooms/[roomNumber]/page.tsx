"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { TopbarPaper } from "@/components/layout/TopbarPaper";

// <!-- bind: GET /api/rooms/:roomNumber -->
// <!-- bind: GET /api/rooms/:roomNumber/matches?status=open|live -- TODO -->
// <!-- bind: GET /api/me/upcoming-matches?roomNumber=:n -- TODO -->
// <!-- bind: GET /api/rooms/:roomNumber/standings?limit=5 -- TODO -->

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

// Matches list, "あなたの戦績", "あなたの予定", standings, and announcements
// don't have backing APIs yet — left as mocks with this comment so the next
// pass knows where to wire them. See docs/STATUS.md → Next 1–3 PRs.
const MOCK_MATCHES = [
  { id: "m1", no: 12, p1: "たろう", p2: "はなこ", status: "BATTLING", isMyMatch: true },
  { id: "m2", no: 11, p1: "けんじ", p2: "みか", status: "CODING", isMyMatch: false },
  { id: "m3", no: 13, p1: "じゅん", p2: null, status: "WAITING", isMyMatch: false },
  { id: "m4", no: 14, p1: "さやか", p2: "りょう", status: "WAITING", isMyMatch: false },
  { id: "m5", no: 15, p1: null, p2: null, status: "OPEN", isMyMatch: false },
];

const MOCK_RANKING = [
  { rank: 1, name: "たろう", winRate: "78%", w: 14, l: 4, d: 0, isMe: false },
  { rank: 2, name: "みか", winRate: "72%", w: 13, l: 5, d: 0, isMe: false },
  { rank: 3, name: "じゅん", winRate: "61%", w: 11, l: 7, d: 1, isMe: true },
  { rank: 4, name: "はなこ", winRate: "50%", w: 9, l: 9, d: 0, isMe: false },
  { rank: 5, name: "けんじ", winRate: "44%", w: 8, l: 10, d: 1, isMe: false },
];

const ANNOUNCEMENTS = [
  { id: 1, title: "📌 来週は総当たり戦を実施します", body: "5/29（水）〜5/31（金）に全員参加の総当たり戦を行います。コードを準備しておいてください。", time: "2日前", author: "田中先生", pinned: true },
  { id: 2, title: "SCAN の仕様変更について", body: "v0.2.1 より SCAN のコストが1→2 APに変更されました。戦略を見直してください。", time: "5日前", author: "田中先生", pinned: false },
  { id: 3, title: "リーグ戦の参加方法", body: "6月開催のリーグ戦への参加希望者は管理者まで連絡してください。", time: "1週間前", author: "田中先生", pinned: false },
];

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rooms/${roomNumber}`)
      .then(async (r) => {
        if (cancelled) return;
        if (r.ok) {
          const data = await r.json();
          setRoom(data.room);
        } else {
          const data = await r.json().catch(() => null);
          setError(data?.error ?? "ルーム情報を取得できませんでした");
        }
      })
      .catch(() => {
        if (!cancelled) setError("ルーム情報を取得できませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [roomNumber]);

  const filteredMatches = MOCK_MATCHES.filter((m) => {
    if (matchFilter === "ALL") return true;
    if (matchFilter === "LIVE") return m.status === "BATTLING";
    if (matchFilter === "CODING") return m.status === "CODING";
    if (matchFilter === "OPEN") return m.status === "OPEN" || m.status === "WAITING";
    return true;
  });

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
  const liveMatchCount = MOCK_MATCHES.filter((m) => m.status === "BATTLING").length;

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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {filteredMatches.map((m) => (
                <div key={m.id} style={{ background: "var(--surface)", borderRadius: "var(--radius-sm)", border: `1.5px solid ${m.isMyMatch ? "var(--accent)" : "var(--line)"}`, padding: 14, position: "relative" }}>
                  {m.isMyMatch && <span style={{ position: "absolute", top: 8, right: 8, background: "var(--accent)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999 }}>YOU</span>}
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6, fontFamily: "JetBrains Mono, monospace" }}>マッチ #{m.no}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--p1)" }}>{m.p1 ?? "---"}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>vs</span>
                    {m.p2 ? (
                      <span style={{ fontWeight: 700, fontSize: 13, color: "var(--p2)" }}>{m.p2}</span>
                    ) : (
                      <span style={{ fontWeight: 600, fontSize: 12, color: "var(--ink-soft)", background: "var(--bg-2)", padding: "2px 8px", borderRadius: 4, border: "1px dashed var(--line-2)" }}>募集中</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: m.status === "BATTLING" ? "var(--p2-soft)" : m.status === "CODING" ? "var(--p1-soft)" : "var(--bg-2)", color: m.status === "BATTLING" ? "var(--p2-ink)" : m.status === "CODING" ? "var(--p1-ink)" : "var(--ink-soft)" }}>{m.status}</span>
                    {m.isMyMatch ? (
                      <Link href={`/match/${m.id}/coding`} style={{ background: "var(--accent)", color: "#fff", padding: "5px 12px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>▸ 入室する</Link>
                    ) : m.p2 === null ? (
                      <button style={{ background: "var(--accent)", color: "#fff", padding: "5px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>＋ 参加する</button>
                    ) : (
                      <Link href={`/watch/${m.id}`} style={{ background: "rgba(8,145,178,0.1)", color: "var(--room-admin-accent)", padding: "5px 12px", borderRadius: 6, textDecoration: "none", fontSize: 12, fontWeight: 700, border: "1px solid var(--room-admin-accent)" }}>▸ 観戦する</Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Schedule + Ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>あなたの戦績</div>
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{ fontSize: 32, fontWeight: 800 }}>3位</div>
                <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>勝率 61%</div>
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--success)" }}>11W</span>
                  <span style={{ color: "var(--danger)" }}>7L</span>
                  <span style={{ color: "var(--ink-soft)" }}>1D</span>
                </div>
              </div>
            </div>

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
              {MOCK_RANKING.map((r) => (
                <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--line)", background: r.isMe ? "var(--accent-soft)" : "transparent", borderRadius: r.isMe ? 6 : 0, paddingLeft: r.isMe ? 6 : 0 }}>
                  <span style={{ width: 20, fontSize: 12, fontWeight: 700, color: r.rank === 1 ? "#d97706" : "var(--ink-soft)" }}>{r.rank === 1 ? "👑" : r.rank}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: r.isMe ? 700 : 400 }}>{r.name}{r.isMe && " (あなた)"}</span>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{r.winRate}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Announcements */}
        <div style={{ marginTop: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>📢 お知らせ</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ANNOUNCEMENTS.map((a) => (
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
