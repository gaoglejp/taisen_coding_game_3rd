"use client";

import { useState, useMemo, useEffect, use } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";

type MatchStatus = "WAITING" | "CODING" | "BATTLING" | "FINISHED" | "CANCELED";
type Side = { i: string; n: string } | null;
type Match = {
  id: string;       // real match id (keys, watch links, cancel target)
  label: string;    // display "#<matchNumber>"
  round: string;
  p1: Side;
  p2: Side;
  p1Id: string | null;
  p2Id: string | null;
  due: string;
  status: MatchStatus;
  winner: "P1" | "P2" | null;
  reason: string;
};

interface ApiPlayer {
  id: string;
  username: string;
  displayName: string | null;
}
interface ApiMatch {
  id: string;
  matchNumber: number;
  status: MatchStatus;
  round: number | null;
  endReason: string | null;
  winnerId: string | null;
  codingDeadlineAt: string | null;
  player1: ApiPlayer | null;
  player1Id: string | null;
  player2: ApiPlayer | null;
  player2Id: string | null;
}

const STATUS_FILTERS: (MatchStatus | "ALL")[] = ["ALL", "WAITING", "CODING", "BATTLING", "FINISHED", "CANCELED"];

const END_REASON_LABEL: Record<string, string> = {
  HP_ZERO: "相手 HP 0",
  TIMEOUT: "ターン上限",
  DISCONNECT: "切断",
  NO_SHOW: "不参加",
  LEAVE: "退出",
  CANCELED: "キャンセル",
};

function initials(p: ApiPlayer): string {
  const base = p.displayName ?? p.username;
  return base.slice(0, 2).toUpperCase();
}
function toSide(p: ApiPlayer | null): Side {
  return p ? { i: initials(p), n: p.displayName ?? p.username } : null;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function toMatchRow(m: ApiMatch): Match {
  return {
    id: m.id,
    label: `#${m.matchNumber}`,
    round: m.round != null ? `R${m.round}` : "—",
    p1: toSide(m.player1),
    p2: toSide(m.player2),
    p1Id: m.player1Id,
    p2Id: m.player2Id,
    due: fmtDate(m.codingDeadlineAt),
    status: m.status,
    winner:
      m.winnerId && m.winnerId === m.player1Id
        ? "P1"
        : m.winnerId && m.winnerId === m.player2Id
          ? "P2"
          : null,
    reason: m.endReason ? END_REASON_LABEL[m.endReason] ?? m.endReason : "—",
  };
}

interface Member {
  id: string;
  username: string;
  displayName: string | null;
}

type PublicWatchChoice = "default" | "private" | "public";

type ViewMode = "LIST" | "TOURNAMENT" | "ROUND_ROBIN";
type CreateMode = "MANUAL" | "RANDOM" | "ROUND_ROBIN" | "TOURNAMENT";
type CancelReason = "NO_SHOW" | "CANCELED" | "DISCONNECT" | "LEAVE";

export default function RoomMatchesPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "お知らせ", href: `/admin/rooms/${roomId}/announcements`, icon: "📢" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  const [statusFilter, setStatusFilter] = useState<MatchStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("LIST");
  const [showCreate, setShowCreate] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Match | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>("ROUND_ROBIN");
  const [cancelReason, setCancelReason] = useState<CancelReason>("CANCELED");
  const [confirmText, setConfirmText] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [roomName, setRoomName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Create-modal state
  const [members, setMembers] = useState<Member[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [startDeadline, setStartDeadline] = useState("");
  const [publicWatch, setPublicWatch] = useState<PublicWatchChoice>("default");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/rooms/${roomId}/matches`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "マッチ一覧を取得できませんでした");
          return;
        }
        const data = await res.json();
        setRoomName(data.room?.name ?? "");
        setRoomNumber(data.room?.roomNumber ?? "");
        const rows: Match[] = (data.matches as ApiMatch[]).map(toMatchRow);
        setMatches(rows);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) setError("マッチ一覧を取得できませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { ALL: matches.length, WAITING: 0, CODING: 0, BATTLING: 0, FINISHED: 0, CANCELED: 0 };
    for (const m of matches) c[m.status] = (c[m.status] ?? 0) + 1;
    return c;
  }, [matches]);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          m.label.toLowerCase().includes(q) ||
          (m.p1?.n.toLowerCase().includes(q) ?? false) ||
          (m.p2?.n.toLowerCase().includes(q) ?? false);
        if (!hit) return false;
      }
      return true;
    });
  }, [matches, statusFilter, search]);

  // Load the room roster the first time the create modal opens.
  useEffect(() => {
    if (!showCreate || members.length > 0) return;
    const controller = new AbortController();
    fetch(`/api/admin/rooms/${roomId}/members?status=ACTIVE`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        const roster: Member[] = (data.members ?? [])
          .map((m: { user?: Member }) => m.user)
          .filter((u: Member | undefined): u is Member => !!u);
        setMembers(roster);
      })
      .catch(() => {
        /* leave roster empty; the modal shows the empty hint */
      });
    return () => controller.abort();
  }, [showCreate, roomId, members.length]);

  const reloadMatches = async () => {
    const res = await fetch(`/api/admin/rooms/${roomId}/matches`);
    if (!res.ok) return;
    const data = await res.json();
    setMatches((data.matches as ApiMatch[]).map(toMatchRow));
  };

  const openCreate = () => {
    setSelectedPlayerIds([]);
    setMemberSearch("");
    setStartDeadline("");
    setPublicWatch("default");
    setCreateError(null);
    setShowCreate(true);
  };

  const selectedPlayers = selectedPlayerIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);

  const addPlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(id)) return prev;
      if (createMode === "MANUAL" && prev.length >= 2) return prev;
      return [...prev, id];
    });
    setMemberSearch("");
  };
  const removePlayer = (id: string) => setSelectedPlayerIds((prev) => prev.filter((x) => x !== id));

  const memberLabel = (m: Member) => m.displayName ?? m.username;
  const memberInitials = (m: Member) => memberLabel(m).slice(0, 2).toUpperCase();
  const suggestions = memberSearch.trim()
    ? members
        .filter((m) => !selectedPlayerIds.includes(m.id))
        .filter((m) => {
          const q = memberSearch.toLowerCase();
          return m.username.toLowerCase().includes(q) || (m.displayName ?? "").toLowerCase().includes(q);
        })
        .slice(0, 8)
    : [];

  // How many matches the current mode + selection will generate.
  const previewCount = (() => {
    const n = selectedPlayerIds.length;
    if (createMode === "MANUAL") return n === 2 ? 1 : 0;
    if (createMode === "ROUND_ROBIN") return n >= 2 ? (n * (n - 1)) / 2 : 0;
    // RANDOM + TOURNAMENT both produce one round of pairings.
    return n >= 2 ? Math.floor(n / 2) : 0;
  })();

  const createValid =
    createMode === "MANUAL" ? selectedPlayerIds.length === 2 : selectedPlayerIds.length >= 2;

  const handleCreate = async () => {
    if (!createValid) {
      setCreateError(
        createMode === "MANUAL" ? "プレイヤーを2名選択してください" : "プレイヤーを2名以上選択してください"
      );
      return;
    }
    setCreating(true);
    setCreateError(null);
    const isPublicWatch = publicWatch === "private" ? false : true;
    let payload: Record<string, unknown>;
    if (createMode === "MANUAL") {
      payload = {
        mode: "MANUAL",
        player1Id: selectedPlayerIds[0],
        player2Id: selectedPlayerIds[1],
        isPublicWatch,
        ...(startDeadline ? { startDeadline } : {}),
      };
    } else if (createMode === "RANDOM") {
      payload = { mode: "RANDOM", playerIds: selectedPlayerIds, count: previewCount, isPublicWatch };
    } else {
      payload = { mode: createMode, playerIds: selectedPlayerIds, isPublicWatch };
    }
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCreateError(data?.error ?? "マッチを作成できませんでした");
        return;
      }
      await reloadMatches();
      setShowCreate(false);
    } catch {
      setCreateError("マッチを作成できませんでした");
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/matches/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCancelError(data?.error ?? "マッチをキャンセルできませんでした");
        return;
      }
      const endReason: string = data?.match?.endReason ?? cancelReason;
      const targetId = cancelTarget.id;
      setMatches((prev) =>
        prev.map((m) =>
          m.id === targetId
            ? { ...m, status: "CANCELED", reason: END_REASON_LABEL[endReason] ?? endReason }
            : m
        )
      );
      setCancelTarget(null);
    } catch {
      setCancelError("マッチをキャンセルできませんでした");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="nakamura.sensei" displayName="中村 先生" role="ROOM_ADMIN" />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={ROOM_NAV} scope="room" roomName={roomName} roomNumber={roomNumber} />
        <main style={{ flex: 1, padding: "24px 32px 32px", minWidth: 0 }}>
          {/* Page head */}
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 16 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--ink)" }}>マッチカード</h1>
              <div style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
                対戦の組み合わせ・進行状況を管理。進行中マッチの操作は MatchSession 自動遷移に委ねられ、ここでは観戦・キャンセルのみ可能です。
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
              <span style={counterPillStyle()}>合計 <strong style={{ color: "var(--ink)" }}>{statusCounts.ALL}</strong></span>
              <span style={counterPillStyle(true)}>LIVE <strong style={{ color: "#7c2d12" }}>{statusCounts.BATTLING}</strong></span>
              <span style={counterPillStyle()}>FINISHED <strong style={{ color: "var(--ink)" }}>{statusCounts.FINISHED}</strong></span>
              <span style={counterPillStyle()}>CANCELED <strong style={{ color: "var(--ink)" }}>{statusCounts.CANCELED}</strong></span>
            </div>
          </header>

          {/* Toolbar */}
          {/* bind: GET /admin/api/rooms/:id/matches?status=&q= */}
          <section style={toolbarStyle}>
            <div style={filterGroupStyle} role="group" aria-label="ステータスフィルタ">
              {STATUS_FILTERS.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} style={filterChipStyle(statusFilter === s)}>
                  {s === "ALL" ? "すべて" : s}
                  <span style={filterNumStyle(statusFilter === s)}>{statusCounts[s]}</span>
                </button>
              ))}
            </div>
            <div style={searchWrapStyle}>
              <span style={{ color: "var(--ink-soft)", fontSize: 13 }} aria-hidden>⌕</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="マッチ No. / プレイヤー名"
                aria-label="検索"
                style={{ flex: 1, border: "none", background: "transparent", font: "inherit", fontSize: 13, color: "var(--ink)", outline: "none" }}
              />
            </div>
            <div style={viewSwitcherStyle} role="group" aria-label="表示モード">
              <button onClick={() => setViewMode("LIST")} style={viewBtnStyle(viewMode === "LIST")}>
                <span style={glyphStyle}>☰</span>一覧
              </button>
              <button onClick={() => setViewMode("TOURNAMENT")} style={viewBtnStyle(viewMode === "TOURNAMENT")}>
                <span style={glyphStyle}>⫷</span>トーナメント
              </button>
              <button onClick={() => setViewMode("ROUND_ROBIN")} style={viewBtnStyle(viewMode === "ROUND_ROBIN")}>
                <span style={glyphStyle}>⊞</span>総当たり
              </button>
            </div>
            <button onClick={openCreate} style={primaryRoomBtnStyle}>＋ マッチカードを作成</button>
          </section>

          {/* List view */}
          {viewMode === "LIST" && (
            <section style={tableCardStyle} aria-label="マッチカード一覧">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "linear-gradient(180deg, #fdfaf0, #fbf6e7)" }}>
                  <tr>
                    <th style={{ ...thStyle, width: 140 }}>ラウンド-No.</th>
                    <th style={thStyle}>P1</th>
                    <th style={thStyle}>P2</th>
                    <th style={{ ...thStyle, width: 130 }}>開始期限</th>
                    <th style={{ ...thStyle, width: 110 }}>ステータス</th>
                    <th style={{ ...thStyle, width: 150 }}>結果</th>
                    <th style={{ ...thStyle, width: 130 }}>終了理由</th>
                    <th style={{ ...thStyle, width: 200, textAlign: "right" }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: error ? "#dc2626" : "var(--ink-soft)", padding: "32px 16px" }}>
                        {error ? error : "マッチカードはありません"}
                      </td>
                    </tr>
                  )}
                  {filtered.map((m, idx) => {
                    const isLast = idx === filtered.length - 1;
                    const p1Win = m.winner === "P1";
                    const p2Win = m.winner === "P2";
                    const winLabel = m.winner === "P1" ? m.p1?.n : m.winner === "P2" ? m.p2?.n : "—";
                    const watchAvailable = m.status === "BATTLING" || m.status === "CODING" || m.status === "FINISHED";
                    const cancelAvailable = m.status !== "FINISHED" && m.status !== "CANCELED";
                    return (
                      <tr key={m.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--line)", transition: "background .12s" }}>
                        <td style={tdStyle}>
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                            <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{m.round}</strong>
                            <br />{m.label}
                          </div>
                        </td>
                        <td style={tdStyle}><PlayerCell side={m.p1} colorVariant="p1" winner={p1Win} /></td>
                        <td style={tdStyle}><PlayerCell side={m.p2} colorVariant="p2" winner={p2Win} /></td>
                        <td style={tdStyle}>
                          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--ink-soft)" }}>
                            {m.due}
                          </span>
                        </td>
                        <td style={tdStyle}><MatchStatusBadge status={m.status} /></td>
                        <td style={tdStyle}>
                          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>{winLabel}</div>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "var(--ink-soft)" }}>{m.reason}</td>
                        <td style={tdStyle}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center", flexWrap: "nowrap" }}>
                            {watchAvailable ? (
                              <a href={`/watch/${m.id}`} style={actBtnWatchStyle}>▸ 観戦</a>
                            ) : (
                              <span style={actBtnDisabledStyle}>▸ 観戦</span>
                            )}
                            <button style={actBtnStyle}>詳細</button>
                            {cancelAvailable ? (
                              <button
                                onClick={() => { setCancelTarget(m); setCancelReason("CANCELED"); setConfirmText(""); setCancelError(null); }}
                                style={actBtnDangerStyle}
                              >
                                キャンセル
                              </button>
                            ) : (
                              <span style={actBtnDisabledStyle}>キャンセル</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Footer count */}
              <div style={paginationStyle}>
                <div>
                  {filtered.length === 0 ? "0" : `1 - ${filtered.length}`} / <strong style={{ color: "var(--ink)" }}>{filtered.length}</strong> 件
                </div>
              </div>
            </section>
          )}

          {/* Tournament view */}
          {viewMode === "TOURNAMENT" && <TournamentView />}

          {/* Round-robin view */}
          {viewMode === "ROUND_ROBIN" && <RoundRobinView matches={matches} />}

          {/* State gallery */}
          <StateGallery />
        </main>
      </div>

      {/* Create modal */}
      {showCreate && (
        <ModalOverlay onClose={() => setShowCreate(false)}>
          <div style={{ width: 640, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>マッチカードを作成</h3>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.55 }}>作成モードを選んで対象プレイヤーを指定してください。</div>
              </div>
              <button onClick={() => setShowCreate(false)} style={modalCloseStyle} aria-label="閉じる">×</button>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={sectionLabelStyle}>{"// 作成モード"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 }} role="radiogroup">
                {([
                  { id: "MANUAL", gl: "1v1", nm: "手動", meta: "P1 vs P2" },
                  { id: "RANDOM", gl: "🎲", nm: "ランダム抽選", meta: "N 試合" },
                  { id: "ROUND_ROBIN", gl: "⊞", nm: "総当たり", meta: "N × (N-1) / 2" },
                  { id: "TOURNAMENT", gl: "⫷", nm: "トーナメント", meta: "シード設定" },
                ] as { id: CreateMode; gl: string; nm: string; meta: string }[]).map((c) => {
                  const sel = createMode === c.id;
                  return (
                    <div key={c.id} onClick={() => setCreateMode(c.id)} style={modeCardStyle(sel)}>
                      <div style={modeGlyphStyle(sel)}>{c.gl}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2, color: "var(--ink)" }}>{c.nm}</div>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, color: "var(--ink-soft)" }}>{c.meta}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginBottom: 14, position: "relative" }}>
                <label style={fieldLabelStyle}>対象プレイヤー ({selectedPlayerIds.length} 名選択中)</label>
                <div style={chipInputStyle}>
                  {selectedPlayers.map((p) => (
                    <span key={p.id} style={playerChipStyle}>
                      <span style={playerChipAvStyle}>{memberInitials(p)}</span>
                      {memberLabel(p)}
                      <span
                        onClick={() => removePlayer(p.id)}
                        style={{ color: "var(--p1-ink, #1e3a8a)", cursor: "pointer", fontSize: 11, padding: "0 4px" }}
                      >
                        ×
                      </span>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder={members.length === 0 ? "メンバーがいません" : "ユーザー名で追加…"}
                    disabled={members.length === 0}
                    style={{ flex: 1, border: "none", background: "transparent", font: "inherit", fontSize: 12, outline: "none", minWidth: 100, padding: 4 }}
                  />
                </div>
                {suggestions.length > 0 && (
                  <div style={suggestionBoxStyle}>
                    {suggestions.map((m) => (
                      <div key={m.id} onClick={() => addPlayer(m.id)} style={suggestionRowStyle}>
                        <span style={playerChipAvStyle}>{memberInitials(m)}</span>
                        <span style={{ fontSize: 12, color: "var(--ink)", fontWeight: 600 }}>{memberLabel(m)}</span>
                        <span style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>@{m.username}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={fieldLabelStyle}>開始期限{createMode !== "MANUAL" && " (手動のみ)"}</label>
                  <input
                    type="text"
                    value={startDeadline}
                    onChange={(e) => setStartDeadline(e.target.value)}
                    placeholder="2026-05-25 23:59"
                    disabled={createMode !== "MANUAL"}
                    style={{ ...fieldInputStyle, opacity: createMode !== "MANUAL" ? 0.5 : 1 }}
                  />
                </div>
                <div>
                  <label style={fieldLabelStyle}>自動公開観戦</label>
                  <select
                    value={publicWatch}
                    onChange={(e) => setPublicWatch(e.target.value as PublicWatchChoice)}
                    style={fieldInputStyle}
                  >
                    <option value="default">自動公開 (ルーム既定)</option>
                    <option value="private">このバッチのみ非公開</option>
                    <option value="public">このバッチのみ公開</option>
                  </select>
                </div>
              </div>

              <div style={{ ...sectionLabelStyle, marginTop: 14 }}>{"// プレビュー"}</div>
              <div style={previewBoxStyle}>
                <div>
                  <div style={previewKStyle}>生成件数</div>
                  <div style={previewVStyle}>{previewCount}<small style={previewSmallStyle}>試合</small></div>
                </div>
                <div>
                  <div style={previewKStyle}>所要時間目安</div>
                  <div style={previewVStyle}>約 {previewCount * 5}<small style={previewSmallStyle}>分</small></div>
                </div>
                <div>
                  <div style={previewKStyle}>公開設定</div>
                  <div style={{ ...previewVStyle, fontSize: 13 }}>
                    {publicWatch === "private" ? "非公開" : publicWatch === "public" ? "公開" : "公開 (既定)"}
                  </div>
                </div>
              </div>

              {createError && (
                <div style={{ marginTop: 14, background: "#fef2f2", border: "1px solid #fbb6b6", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#dc2626" }}>
                  {createError}
                </div>
              )}
            </div>
            <div style={modalFootStyle}>
              <button onClick={() => setShowCreate(false)} disabled={creating} style={btnGhostModalStyle}>キャンセル</button>
              <button
                onClick={handleCreate}
                disabled={creating || !createValid}
                style={{ ...primaryRoomBtnStyle, opacity: creating || !createValid ? 0.5 : 1, cursor: creating || !createValid ? "not-allowed" : "pointer" }}
              >
                {creating ? "発行中…" : `${previewCount} 試合を発行`}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <ModalOverlay onClose={() => setCancelTarget(null)}>
          <div style={{ width: 480, background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--danger)" }}>マッチをキャンセル</h3>
                <div style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4, lineHeight: 1.55 }}>対戦に進む前の状態に戻し、戦績には残しません。</div>
              </div>
              <button onClick={() => setCancelTarget(null)} style={modalCloseStyle} aria-label="閉じる">×</button>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={targetBlockStyle}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink)" }}>{cancelTarget.id}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 4 }}>
                  {cancelTarget.p1?.n ?? "?"} vs {cancelTarget.p2?.n ?? "? (募集中)"} · {cancelTarget.status}
                </div>
              </div>

              <div style={sectionLabelStyle}>{"// 終了理由"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }} role="radiogroup">
                {([
                  { id: "NO_SHOW", desc: "期限までに対戦相手が見つからなかった" },
                  { id: "CANCELED", desc: "管理者の判断でキャンセル" },
                  { id: "DISCONNECT", desc: "通信切断によりキャンセル" },
                  { id: "LEAVE", desc: "プレイヤーが離席" },
                ] as { id: CancelReason; desc: string }[]).map((r) => {
                  const sel = cancelReason === r.id;
                  return (
                    <label key={r.id} onClick={() => setCancelReason(r.id)} style={reasonRowStyle(sel)}>
                      <span style={reasonRadioStyle(sel)} aria-hidden />
                      <span>
                        <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 12, color: "var(--ink)" }}>{r.id}</span>
                        <small style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 500, color: "var(--ink-soft)", marginLeft: 6 }}>{r.desc}</small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <div style={warnCalloutStyle}>
                <div style={warnIconStyle} aria-hidden>!</div>
                <div>
                  <strong style={{ display: "block", fontSize: 13, marginBottom: 2, fontWeight: 700, color: "var(--p2-ink, #7f1d1d)" }}>戻すことはできません。</strong>
                  キャンセルしたマッチは戦績集計から除外されます。
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabelStyle}>確認のため、マッチ No. を入力してください</label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={cancelTarget.id}
                  style={{
                    ...fieldInputStyle,
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.03em",
                    ...(confirmText === cancelTarget.id ? { borderColor: "var(--success)", background: "var(--success-soft, #ecfdf5)" } : {}),
                  }}
                />
              </div>
              {cancelError && (
                <div style={{ background: "#fef2f2", border: "1px solid #fbb6b6", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#dc2626", marginBottom: 4 }}>
                  {cancelError}
                </div>
              )}
            </div>
            <div style={modalFootStyle}>
              <button onClick={() => setCancelTarget(null)} disabled={cancelling} style={btnGhostModalStyle}>戻る</button>
              <button
                disabled={confirmText !== cancelTarget.id || cancelling}
                onClick={handleCancel}
                style={{ ...btnDangerStyle, opacity: confirmText !== cancelTarget.id || cancelling ? 0.4 : 1, cursor: confirmText !== cancelTarget.id || cancelling ? "not-allowed" : "pointer", boxShadow: confirmText !== cancelTarget.id || cancelling ? "none" : "0 1px 0 #991b1b" }}
              >
                {cancelling ? "処理中…" : "キャンセルする"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <style>{`
        @keyframes matchPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .45; transform: scale(.85); }
        }
      `}</style>
    </div>
  );
}

/* ============ Sub components ============ */

function PlayerCell({ side, colorVariant, winner }: { side: Side; colorVariant: "p1" | "p2"; winner: boolean }) {
  if (!side) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-soft)", fontStyle: "italic", fontWeight: 500 }}>
        <span style={avEmptyStyle} />
        ? 募集中
      </span>
    );
  }
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: winner ? "var(--success, #15803d)" : "var(--ink)" }}>
      <span style={colorVariant === "p1" ? avP1Style : avP2Style}>{side.i}</span>
      {side.n}
      {winner && <span style={winMarkStyle}>WIN</span>}
    </span>
  );
}

function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { bg: string; color: string; border: string; dotColor: string; pulse: boolean }> = {
    WAITING: { bg: "#efece3", color: "#4b5563", border: "#d8d3c2", dotColor: "#4b5563", pulse: false },
    CODING: { bg: "#fef3c7", color: "#92400e", border: "#fbd9a5", dotColor: "var(--accent, #f59e0b)", pulse: true },
    BATTLING: { bg: "#fee2e2", color: "#7f1d1d", border: "#fbb6b6", dotColor: "#ef4444", pulse: true },
    FINISHED: { bg: "#ecfdf5", color: "#15803d", border: "#a7f3d0", dotColor: "#15803d", pulse: false },
    CANCELED: { bg: "#fef2f2", color: "#dc2626", border: "#fbb6b6", dotColor: "#dc2626", pulse: false },
  };
  const cfg = map[status];
  return (
    <span style={{
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 10.5,
      fontWeight: 700,
      padding: "3px 8px",
      borderRadius: 4,
      border: `1px solid ${cfg.border}`,
      background: cfg.bg,
      color: cfg.color,
      letterSpacing: "0.04em",
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
    }}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: cfg.dotColor,
          boxShadow: cfg.pulse ? `0 0 0 2px ${status === "BATTLING" ? "rgba(239,68,68,.25)" : "rgba(245,158,11,.25)"}` : undefined,
          animation: cfg.pulse ? "matchPulse 1.6s ease-in-out infinite" : undefined,
        }}
        aria-hidden
      />
      {status}
    </span>
  );
}

function TournamentView() {
  return (
    <section style={altViewCardStyle} aria-label="トーナメント表">
      <header style={altViewHeadStyle}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8, color: "var(--ink)" }}>
          トーナメント表
          <small style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>{"// view: TOURNAMENT — 8 名シングル"}</small>
        </h2>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-soft)" }}>view モード切替時のプレビュー</span>
      </header>
      <div style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 20, alignItems: "stretch", overflowX: "auto", paddingBottom: 8 }}>
          {/* Round 1 */}
          <div style={bracketRoundStyle}>
            <div style={bracketRoundHeadStyle}>{"// R1 (8 → 4)"}</div>
            <BracketMatch
              rows={[
                { variant: "p1", code: "HC", name: "HanaCoder", score: "100", winner: true },
                { variant: "p2", code: "YU", name: "yu_8", score: "0", loser: true },
              ]}
              metaLeft="#M-22001 · T14"
              metaRight="▸ 観戦"
              metaRightHref="#w-22001"
            />
            <BracketMatch
              live
              rows={[
                { variant: "p1", code: "MI", name: "misora.dev", score: "—" },
                { variant: "p2", code: "K9", name: "K-9bot", score: "—" },
              ]}
              metaLeft="BATTLING · T8"
              metaLeftColor="#92400e"
              metaRight="▸ 観戦"
              metaRightHref="#w-22002"
            />
            <BracketMatch
              rows={[
                { variant: "p1", code: "TR", name: "たろう_06", score: "72", winner: true },
                { variant: "p2", code: "KN", name: "kuroneko", score: "0", loser: true },
              ]}
              metaLeft="#M-22003 · T18"
              metaRight="▸ 観戦"
              metaRightHref="#w-22003"
            />
            <BracketMatch
              rows={[
                { variant: "p1", code: "TN", name: "tanu_55", score: "36", winner: true },
                { variant: "p2", code: "MK", name: "miki_dev", score: "0", loser: true },
              ]}
              metaLeft="#M-22004 · T20"
              metaRight="▸ 観戦"
              metaRightHref="#w-22004"
            />
          </div>

          {/* Round 2 */}
          <div style={bracketRoundStyle}>
            <div style={bracketRoundHeadStyle}>{"// R2 (4 → 2)"}</div>
            <BracketMatch
              rows={[
                { variant: "p1", code: "HC", name: "HanaCoder", score: "—" },
                { variant: "empty", code: "", name: "待機中", score: "—", muted: true },
              ]}
              metaLeft="#M-22011 · WAITING"
              metaRight="詳細"
              metaRightGhost
            />
            <BracketMatch
              rows={[
                { variant: "p1", code: "TR", name: "たろう_06", score: "—" },
                { variant: "p2", code: "TN", name: "tanu_55", score: "—" },
              ]}
              metaLeft="#M-22012 · WAITING"
              metaRight="詳細"
              metaRightGhost
            />
          </div>

          {/* Final */}
          <div style={bracketRoundStyle}>
            <div style={bracketRoundHeadStyle}>{"// FINAL (2 → 1)"}</div>
            <BracketMatch
              isFinal
              rows={[
                { variant: "empty", code: "", name: "勝者 R2-1", score: "—", muted: true },
                { variant: "empty", code: "", name: "勝者 R2-2", score: "—", muted: true },
              ]}
              metaLeft="#M-22021 · 未生成"
              metaRight="詳細"
              metaRightGhost
            />
          </div>

          {/* Winner placeholder */}
          <div style={bracketRoundStyle}>
            <div style={bracketRoundHeadStyle}>{"// 🏆 優勝"}</div>
            <div style={{ ...bracketMatchStyle, background: "repeating-linear-gradient(45deg, var(--bg), var(--bg) 4px, var(--bg-2, #efece3) 4px, var(--bg-2, #efece3) 8px)", borderStyle: "dashed" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "18px 10px", borderBottom: "none", gap: 7, fontSize: 12, color: "var(--ink-soft)" }}>
                <span style={avEmptyStyle} />
                <span style={{ flex: 1, fontStyle: "italic" }}>未決定</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type BracketRow = {
  variant: "p1" | "p2" | "empty";
  code: string;
  name: string;
  score: string;
  winner?: boolean;
  loser?: boolean;
  muted?: boolean;
};

function BracketMatch({
  rows,
  metaLeft,
  metaLeftColor,
  metaRight,
  metaRightHref,
  metaRightGhost,
  live,
  isFinal,
}: {
  rows: BracketRow[];
  metaLeft: string;
  metaLeftColor?: string;
  metaRight: string;
  metaRightHref?: string;
  metaRightGhost?: boolean;
  live?: boolean;
  isFinal?: boolean;
}) {
  const style: React.CSSProperties = {
    ...bracketMatchStyle,
    ...(live ? { borderColor: "var(--accent, #f59e0b)", boxShadow: "0 0 0 2px var(--accent-soft, #fef3c7)" } : {}),
    ...(isFinal ? { background: "linear-gradient(180deg, #fefbf0, #fef3c7)", borderColor: "#fbd9a5" } : {}),
  };
  return (
    <div style={style}>
      {rows.map((r, i) => {
        const rowStyle: React.CSSProperties = {
          display: "flex",
          alignItems: "center",
          padding: "6px 10px",
          fontSize: 12,
          borderBottom: i < rows.length - 1 ? "1px dashed var(--line)" : "none",
          gap: 7,
          ...(r.winner ? { background: isFinal ? "linear-gradient(90deg, var(--accent-soft, #fef3c7), transparent)" : "linear-gradient(90deg, #ecfdf5, transparent)", color: isFinal ? "#92400e" : "var(--success, #15803d)", fontWeight: 700 } : {}),
          ...(r.loser ? { color: "var(--ink-soft)" } : {}),
          ...(r.muted ? { color: "var(--ink-soft)" } : {}),
        };
        return (
          <div key={i} style={rowStyle}>
            <span style={r.variant === "p1" ? bracketAvP1Style : r.variant === "p2" ? bracketAvP2Style : bracketAvEmptyStyle}>
              {r.code}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: r.muted ? "italic" : "normal" }}>{r.name}</span>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 12 }}>{r.score}</span>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", background: "var(--bg)", borderTop: "1px solid var(--line)", fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--ink-soft)" }}>
        <span style={metaLeftColor ? { color: metaLeftColor, fontWeight: 700 } : undefined}>{metaLeft}</span>
        {metaRightHref ? (
          <a href={metaRightHref} style={{ textDecoration: "none", color: "var(--room-admin-accent-ink, #155e75)", background: "var(--room-admin-accent-soft, #cffafe)", border: "1px solid #a5f3fc", padding: "1px 7px", borderRadius: 4, fontWeight: 700 }}>
            {metaRight}
          </a>
        ) : metaRightGhost ? (
          <span style={{ background: "transparent", color: "var(--ink-soft)", border: "1px dashed var(--line-2, #d8d3c2)", padding: "1px 7px", borderRadius: 4 }}>
            {metaRight}
          </span>
        ) : (
          <span>{metaRight}</span>
        )}
      </div>
    </div>
  );
}

function RoundRobinView({ matches }: { matches: Match[] }) {
  type Cell = "self" | "W" | "L" | "D" | "live" | "pending";

  const { players, matrix, summary } = useMemo(() => {
    const roster = new Map<string, { id: string; i: string; n: string }>();
    for (const m of matches) {
      if (m.p1Id && m.p1) roster.set(m.p1Id, { id: m.p1Id, i: m.p1.i, n: m.p1.n });
      if (m.p2Id && m.p2) roster.set(m.p2Id, { id: m.p2Id, i: m.p2.i, n: m.p2.n });
    }

    const stat = new Map<string, { w: number; l: number; d: number }>();
    const ensure = (id: string) => {
      let s = stat.get(id);
      if (!s) {
        s = { w: 0, l: 0, d: 0 };
        stat.set(id, s);
      }
      return s;
    };
    for (const m of matches) {
      if (m.status !== "FINISHED" || !m.p1Id || !m.p2Id) continue;
      const s1 = ensure(m.p1Id);
      const s2 = ensure(m.p2Id);
      if (m.winner === "P1") {
        s1.w++;
        s2.l++;
      } else if (m.winner === "P2") {
        s2.w++;
        s1.l++;
      } else {
        s1.d++;
        s2.d++;
      }
    }

    const winRate = (id: string) => {
      const s = stat.get(id) ?? { w: 0, l: 0, d: 0 };
      const played = s.w + s.l + s.d;
      return played ? s.w / played : 0;
    };
    const players = [...roster.values()].sort((a, b) => {
      const sa = stat.get(a.id) ?? { w: 0, l: 0, d: 0 };
      const sb = stat.get(b.id) ?? { w: 0, l: 0, d: 0 };
      return sb.w - sa.w || winRate(b.id) - winRate(a.id) || a.n.localeCompare(b.n);
    });

    // matches are sorted by matchNumber desc, so find() returns the latest head-to-head.
    const between = (a: string, b: string) =>
      matches.find(
        (m) => (m.p1Id === a && m.p2Id === b) || (m.p1Id === b && m.p2Id === a)
      );

    const matrix: { cell: Cell; matchId: string | null }[][] = players.map((row) =>
      players.map((col) => {
        if (row.id === col.id) return { cell: "self" as Cell, matchId: null };
        const m = between(row.id, col.id);
        if (!m) return { cell: "pending" as Cell, matchId: null };
        if (m.status === "FINISHED") {
          if (m.winner === null) return { cell: "D" as Cell, matchId: m.id };
          const rowWon =
            (m.winner === "P1" && m.p1Id === row.id) ||
            (m.winner === "P2" && m.p2Id === row.id);
          return { cell: (rowWon ? "W" : "L") as Cell, matchId: m.id };
        }
        if (m.status === "BATTLING" || m.status === "CODING")
          return { cell: "live" as Cell, matchId: m.id };
        return { cell: "pending" as Cell, matchId: null };
      })
    );

    const summary = players.map((p, idx) => {
      const s = stat.get(p.id) ?? { w: 0, l: 0, d: 0 };
      const played = s.w + s.l + s.d;
      return {
        id: p.id,
        nm: p.n,
        w: s.w,
        l: s.l,
        d: s.d,
        pct: played ? `${Math.round((s.w / played) * 100)}%` : "—",
        first: idx === 0 && s.w > 0,
      };
    });

    return { players, matrix, summary };
  }, [matches]);

  const cellBgMap: Record<string, { bg: string; color: string; label: string }> = {
    W: { bg: "#ecfdf5", color: "#15803d", label: "W" },
    L: { bg: "#fee2e2", color: "#7f1d1d", label: "L" },
    D: { bg: "#efece3", color: "#4b5563", label: "D" },
    live: { bg: "#fef3c7", color: "#92400e", label: "⏵" },
    pending: { bg: "transparent", color: "#d8d3c2", label: "–" },
  };

  if (players.length === 0) {
    return (
      <section style={altViewCardStyle} aria-label="総当たり表">
        <header style={altViewHeadStyle}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>総当たり表</h2>
        </header>
        <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: "var(--ink-soft)" }}>
          総当たりに表示できるマッチがありません
        </div>
      </section>
    );
  }

  return (
    <section style={altViewCardStyle} aria-label="総当たり表">
      <header style={altViewHeadStyle}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "baseline", gap: 8, color: "var(--ink)" }}>
          総当たり表
          <small style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-soft)", fontWeight: 500 }}>{`// view: ROUND_ROBIN — ${players.length} 名`}</small>
        </h2>
        <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--ink-soft)" }}>セルをクリックで観戦</span>
      </header>
      <div style={{ padding: 18 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", margin: "0 auto", fontSize: 12 }} aria-label="総当たり表">
            <thead>
              <tr>
                <th style={matrixThStyle} />
                {players.map((p) => (
                  <th key={p.id} style={{ ...matrixThStyle, background: "var(--bg)", fontWeight: 600, color: "var(--ink)", fontSize: 11.5 }}>
                    <div style={matrixAvMiniStyle}>{p.i}</div>
                    <div>{p.n}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, ri) => (
                <tr key={p.id}>
                  <th style={matrixThRowStyle}>
                    <div style={{ ...matrixAvMiniStyle, display: "inline-grid", verticalAlign: "middle", margin: "0 6px 0 0" }}>{p.i}</div>
                    {p.n}
                  </th>
                  {matrix[ri].map((c, ci) => {
                    if (c.cell === "self") {
                      return <td key={ci} style={{ ...matrixTdStyle, background: "repeating-linear-gradient(45deg, var(--bg), var(--bg) 3px, var(--bg-2, #efece3) 3px, var(--bg-2, #efece3) 6px)" }} />;
                    }
                    const cfg = cellBgMap[c.cell];
                    const cellStyle: React.CSSProperties = {
                      display: "grid",
                      placeItems: "center",
                      width: "100%",
                      height: 50,
                      textDecoration: "none",
                      color: cfg.color,
                      fontFamily: "JetBrains Mono, monospace",
                      fontWeight: 700,
                      fontSize: c.cell === "pending" ? 11 : 14,
                      position: "relative",
                    };
                    const liveDot = c.cell === "live" && (
                      <span
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--accent, #f59e0b)",
                          animation: "matchPulse 1.6s ease-in-out infinite",
                        }}
                        aria-hidden
                      />
                    );
                    return (
                      <td key={ci} style={{ ...matrixTdStyle, background: cfg.bg, padding: 0 }}>
                        {c.matchId ? (
                          <a href={`/watch/${c.matchId}`} style={cellStyle}>
                            {cfg.label}
                            {liveDot}
                          </a>
                        ) : (
                          <div style={cellStyle}>{cfg.label}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginTop: 14 }} aria-label="プレイヤー集計">
          {summary.map((s) => (
            <div
              key={s.id}
              style={{
                background: s.first ? "var(--accent-soft, #fef3c7)" : "var(--bg)",
                border: s.first ? "1px solid #fbd9a5" : "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 11.5, color: "var(--ink)" }}>{s.first ? "👑 " : ""}{s.nm}</div>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 12, marginTop: 2 }}>
                <span style={{ color: "var(--success, #15803d)" }}>{s.w}</span> / <span style={{ color: "#ef4444" }}>{s.l}</span> / {s.d}
                <span style={{ marginLeft: 6, color: "var(--ink-soft)" }}>{s.pct}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StateGallery() {
  return (
    <section style={{ margin: "30px 0 32px" }} aria-label="状態バリエーション">
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 24, marginBottom: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontFamily: "JetBrains Mono, monospace", color: "var(--ink)" }}>{"// state variations"}</h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>通常 / マッチゼロ / 進行中ゼロ / 一括生成直後 / 観戦不許可ルーム</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 14 }}>
        {/* Normal */}
        <article style={stateCardStyle}>
          <header style={stateHeadStyle}>
            <span style={stateNameStyle}>通常</span>
            <span style={stateTagStyle}>ok</span>
          </header>
          <div style={stateBodyStyle}>
            <MiniRow nm="#M-22064" status="CODING" />
            <MiniRow nm="#M-22062" status="BATTLING" />
            <MiniRow nm="#M-22055" status="FINISHED" />
            <MiniRow nm="#M-22054" status="FINISHED" />
            <MiniRow nm="#M-22070" status="WAITING" last />
          </div>
        </article>

        {/* Zero */}
        <article style={stateCardStyle}>
          <header style={stateHeadStyle}>
            <span style={stateNameStyle}>マッチゼロ</span>
            <span style={stateTagStyle}>empty</span>
          </header>
          <div style={stateBodyStyle}>
            <div style={miniEmptyStyle}>
              <div style={miniIllStyle} aria-hidden>▦</div>
              <strong style={{ display: "block", color: "var(--ink)", fontSize: 11.5, marginBottom: 2 }}>まだマッチがありません</strong>
              <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45 }}>「＋ マッチカードを作成」から<br />最初のマッチを発行しましょう。</p>
              <button style={{ background: "var(--room-admin-accent)", color: "#fff", border: "none", padding: "5px 11px", fontSize: 10.5, fontWeight: 700, borderRadius: 5, marginTop: 7, cursor: "pointer" }}>＋ 作成する</button>
            </div>
          </div>
        </article>

        {/* No active */}
        <article style={stateCardStyle}>
          <header style={stateHeadStyle}>
            <span style={stateNameStyle}>進行中ゼロ</span>
            <span style={stateTagStyle}>idle</span>
          </header>
          <div style={stateBodyStyle}>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--ink-soft)", marginBottom: 5 }}>{"// 進行中: 0"}</div>
            <div style={miniEmptyStyle}>
              <div style={miniIllStyle} aria-hidden>⏸</div>
              <strong style={{ display: "block", color: "var(--ink)", fontSize: 11.5, marginBottom: 2 }}>進行中マッチなし</strong>
              <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45 }}>すべて終了済みです。</p>
            </div>
            <div style={{ marginTop: 6 }}>
              <MiniRow nm="#M-22055" status="FINISHED" />
              <MiniRow nm="#M-22054" status="FINISHED" last />
            </div>
          </div>
        </article>

        {/* Bulk created */}
        <article style={stateCardStyle}>
          <header style={stateHeadStyle}>
            <span style={stateNameStyle}>一括生成直後</span>
            <span style={stateTagStyle}>201</span>
          </header>
          <div style={stateBodyStyle}>
            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "var(--success, #15803d)", borderRadius: 6, padding: "7px 9px", fontSize: 10.5, marginBottom: 6 }}>
              <strong style={{ display: "block", fontSize: 11.5 }}>✓ 15 試合を発行</strong>
              総当たり: 6 名 / 公開: 既定
            </div>
            <MiniRow nm="#M-22091" status="WAITING" />
            <MiniRow nm="#M-22092" status="WAITING" />
            <MiniRow nm="#M-22093" status="WAITING" />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "none", fontSize: 10.5 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>… +12</span>
              <span style={{ color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace", fontSize: 9.5 }}>WAITING</span>
            </div>
          </div>
        </article>

        {/* Spectate disabled */}
        <article style={stateCardStyle}>
          <header style={stateHeadStyle}>
            <span style={stateNameStyle}>観戦不許可</span>
            <span style={stateTagStyle}>no-watch</span>
          </header>
          <div style={stateBodyStyle}>
            <div style={{ background: "#fef3c7", border: "1px solid #fbd9a5", color: "#92400e", borderRadius: 6, padding: "6px 8px", fontSize: 10.5, marginBottom: 6, lineHeight: 1.45 }}>
              <strong style={{ display: "block", fontSize: 11 }}>🔒 観戦無効化中</strong>
              このルームでは観戦 CTA を表示しません。
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px dashed var(--line)", fontSize: 10.5 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>#M-22064</span>
              <span style={{ display: "flex", gap: 3 }}>
                <MiniStatus status="CODING" />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8.5, color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px" }}>詳細のみ</span>
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "none", fontSize: 10.5 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace" }}>#M-22062</span>
              <span style={{ display: "flex", gap: 3 }}>
                <MiniStatus status="BATTLING" />
                <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 8.5, color: "var(--ink-soft)", border: "1px solid var(--line)", borderRadius: 3, padding: "1px 4px" }}>詳細のみ</span>
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function MiniRow({ nm, status, last }: { nm: string; status: MatchStatus; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: last ? "none" : "1px dashed var(--line)", fontSize: 10.5 }}>
      <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{nm}</span>
      <MiniStatus status={status} />
    </div>
  );
}

function MiniStatus({ status }: { status: MatchStatus }) {
  const map: Record<MatchStatus, { bg: string; color: string; border: string }> = {
    WAITING: { bg: "#efece3", color: "#4b5563", border: "#d8d3c2" },
    CODING: { bg: "#fef3c7", color: "#92400e", border: "#fbd9a5" },
    BATTLING: { bg: "#fee2e2", color: "#7f1d1d", border: "#fbb6b6" },
    FINISHED: { bg: "#ecfdf5", color: "#15803d", border: "#a7f3d0" },
    CANCELED: { bg: "#fef2f2", color: "#dc2626", border: "#fbb6b6" },
  };
  const cfg = map[status];
  return (
    <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, padding: "1px 5px", borderRadius: 3, letterSpacing: "0.04em", fontWeight: 700, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {status}
    </span>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(31,35,48,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

/* ============ Styles ============ */

const toolbarStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: 12,
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 14,
  boxShadow: "0 1px 2px rgba(31,35,48,.04)",
};

const filterGroupStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: 3,
};

function filterChipStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    border: "none",
    background: active ? "#fff" : "transparent",
    padding: "6px 11px",
    fontSize: 12,
    fontWeight: 600,
    color: active ? "#155e75" : "var(--ink-soft)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "JetBrains Mono, monospace",
    letterSpacing: "0.02em",
    boxShadow: active ? "0 1px 2px rgba(0,0,0,.05)" : "none",
    display: "inline-flex",
    alignItems: "center",
  };
}

function filterNumStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 10,
    background: active ? "#cffafe" : "#efece3",
    color: active ? "#155e75" : "var(--ink-soft)",
    padding: "1px 5px",
    borderRadius: 4,
    marginLeft: 5,
    fontWeight: 600,
  };
}

const searchWrapStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "#fdfcf8",
  border: "1px solid #d8d3c2",
  borderRadius: 8,
  padding: "8px 12px",
};

const viewSwitcherStyle: React.CSSProperties = {
  display: "inline-flex",
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: 3,
};

function viewBtnStyle(active: boolean): React.CSSProperties {
  return {
    appearance: "none",
    border: "none",
    background: active ? "var(--ink)" : "transparent",
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: active ? "#fff" : "var(--ink-soft)",
    borderRadius: 6,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    boxShadow: active ? "0 1px 2px rgba(0,0,0,.1)" : "none",
  };
}

const glyphStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontWeight: 700,
  width: 14,
  textAlign: "center",
};

const primaryRoomBtnStyle: React.CSSProperties = {
  background: "var(--room-admin-accent)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  boxShadow: "0 1px 0 #0e7490",
};

function counterPillStyle(live: boolean = false): React.CSSProperties {
  return {
    background: live ? "#fef3c7" : "#fff",
    border: live ? "1px solid #fbd9a5" : "1px solid var(--line)",
    borderRadius: 999,
    padding: "5px 11px",
    color: live ? "#92400e" : "var(--ink-soft)",
  };
}

const tableCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 1px 2px rgba(31,35,48,.04)",
  marginBottom: 18,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid var(--line)",
  fontSize: 10.5,
  color: "var(--ink-soft)",
  fontWeight: 700,
  fontFamily: "JetBrains Mono, monospace",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  verticalAlign: "middle",
};

const avP1Style: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 700,
  fontFamily: "JetBrains Mono, monospace",
  border: "1px solid #bfd5fa",
  background: "#dbeafe",
  color: "#1e3a8a",
  flexShrink: 0,
};

const avP2Style: React.CSSProperties = {
  ...avP1Style,
  background: "#fee2e2",
  color: "#7f1d1d",
  borderColor: "#fbb6b6",
};

const avEmptyStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: "50%",
  display: "inline-block",
  background: "#efece3",
  border: "1px dashed #d8d3c2",
  flexShrink: 0,
};

const winMarkStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  background: "#15803d",
  color: "#fff",
  fontSize: 9,
  padding: "1px 5px",
  borderRadius: 3,
  marginLeft: 4,
  letterSpacing: "0.04em",
  fontWeight: 700,
};

const actBtnStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid var(--line)",
  background: "#fff",
  borderRadius: 6,
  padding: "5px 9px",
  fontSize: 11.5,
  fontWeight: 600,
  color: "var(--ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const actBtnWatchStyle: React.CSSProperties = {
  ...actBtnStyle,
  background: "#cffafe",
  color: "#155e75",
  borderColor: "#a5f3fc",
};

const actBtnDangerStyle: React.CSSProperties = {
  ...actBtnStyle,
  background: "#fef2f2",
  color: "#dc2626",
  borderColor: "#fbb6b6",
};

const actBtnDisabledStyle: React.CSSProperties = {
  ...actBtnStyle,
  opacity: 0.35,
  cursor: "not-allowed",
};

const paginationStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 16px",
  borderTop: "1px solid var(--line)",
  background: "var(--bg)",
  fontSize: 12,
  color: "var(--ink-soft)",
};


const altViewCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 14,
  boxShadow: "0 1px 2px rgba(31,35,48,.04)",
  marginBottom: 18,
  overflow: "hidden",
};

const altViewHeadStyle: React.CSSProperties = {
  padding: "12px 18px 10px",
  borderBottom: "1px dashed var(--line)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
};

const bracketRoundStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-around",
  gap: 16,
  minWidth: 0,
  position: "relative",
};

const bracketRoundHeadStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10.5,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  textAlign: "center",
  paddingBottom: 6,
  borderBottom: "1px dashed var(--line)",
  marginBottom: 4,
};

const bracketMatchStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 10,
  overflow: "hidden",
  boxShadow: "0 1px 2px rgba(31,35,48,.04)",
  position: "relative",
};

const bracketAvP1Style: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 700,
  fontFamily: "JetBrains Mono, monospace",
  border: "1px solid #bfd5fa",
  background: "#dbeafe",
  color: "#1e3a8a",
  flexShrink: 0,
};

const bracketAvP2Style: React.CSSProperties = {
  ...bracketAvP1Style,
  background: "#fee2e2",
  color: "#7f1d1d",
  borderColor: "#fbb6b6",
};

const bracketAvEmptyStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: "50%",
  display: "inline-block",
  background: "#efece3",
  border: "1px dashed #d8d3c2",
  flexShrink: 0,
};

const matrixThStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  padding: 0,
  width: 50,
  height: 50,
  textAlign: "center",
  verticalAlign: "middle",
};

const matrixThRowStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  padding: "0 10px",
  height: 50,
  textAlign: "right",
  verticalAlign: "middle",
  background: "var(--bg)",
  fontWeight: 600,
  color: "var(--ink)",
  fontSize: 12,
  whiteSpace: "nowrap",
};

const matrixTdStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  padding: 0,
  width: 50,
  height: 50,
  textAlign: "center",
  verticalAlign: "middle",
};

const matrixAvMiniStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  margin: "0 auto",
  borderRadius: "50%",
  background: "#dbeafe",
  color: "#1e3a8a",
  border: "1px solid #bfd5fa",
  display: "grid",
  placeItems: "center",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10,
  fontWeight: 700,
};

const stateCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line)",
  borderRadius: 12,
  overflow: "hidden",
  fontSize: 12,
};

const stateHeadStyle: React.CSSProperties = {
  padding: "9px 11px",
  background: "var(--bg)",
  borderBottom: "1px solid var(--line)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const stateNameStyle: React.CSSProperties = { fontWeight: 700, fontSize: 11, color: "var(--ink)" };

const stateTagStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 9,
  padding: "2px 5px",
  borderRadius: 4,
  background: "#fff",
  border: "1px solid var(--line)",
  color: "var(--ink-soft)",
};

const stateBodyStyle: React.CSSProperties = { padding: 10 };

const miniEmptyStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "18px 6px 12px",
  color: "var(--ink-soft)",
};

const miniIllStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "#efece3",
  border: "1px dashed #d8d3c2",
  margin: "0 auto 6px",
  display: "grid",
  placeItems: "center",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 16,
};

const modalCloseStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--ink-soft)",
  cursor: "pointer",
  fontSize: 18,
  padding: "4px 8px",
  borderRadius: 6,
  lineHeight: 1,
};

const modalFootStyle: React.CSSProperties = {
  padding: "14px 22px",
  background: "var(--bg)",
  borderTop: "1px solid var(--line)",
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
};

const btnGhostModalStyle: React.CSSProperties = {
  background: "#fff",
  color: "var(--ink)",
  border: "1px solid #d8d3c2",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnDangerStyle: React.CSSProperties = {
  background: "#dc2626",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const sectionLabelStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10.5,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 6,
};

function modeCardStyle(selected: boolean): React.CSSProperties {
  return {
    background: selected ? "#cffafe" : "#fff",
    border: selected ? "1.5px solid var(--room-admin-accent)" : "1.5px solid #d8d3c2",
    borderRadius: 10,
    padding: "12px 10px",
    cursor: "pointer",
    textAlign: "center",
  };
}

function modeGlyphStyle(selected: boolean): React.CSSProperties {
  return {
    width: 30,
    height: 30,
    margin: "0 auto 5px",
    borderRadius: 8,
    background: selected ? "var(--room-admin-accent)" : "var(--bg)",
    border: selected ? "1px solid var(--room-admin-accent)" : "1px solid var(--line)",
    display: "grid",
    placeItems: "center",
    fontFamily: "JetBrains Mono, monospace",
    fontWeight: 700,
    color: selected ? "#fff" : "var(--ink-soft)",
  };
}

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 5,
  color: "var(--ink)",
};

const fieldInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid #d8d3c2",
  borderRadius: 8,
  fontSize: 13,
  background: "#fdfcf8",
  color: "var(--ink)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const chipInputStyle: React.CSSProperties = {
  border: "1px solid #d8d3c2",
  background: "#fdfcf8",
  borderRadius: 8,
  padding: "6px 8px",
  display: "flex",
  flexWrap: "wrap",
  gap: 5,
  minHeight: 60,
  alignItems: "flex-start",
};

const playerChipStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "#dbeafe",
  border: "1px solid #bfd5fa",
  color: "#1e3a8a",
  borderRadius: 999,
  padding: "2px 4px",
  fontSize: 11.5,
  fontWeight: 600,
};

const suggestionBoxStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  zIndex: 10,
  marginTop: 4,
  background: "#fff",
  border: "1px solid #d8d3c2",
  borderRadius: 8,
  boxShadow: "0 8px 24px rgba(31,35,48,.12)",
  maxHeight: 220,
  overflowY: "auto",
};

const suggestionRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "7px 10px",
  cursor: "pointer",
  borderBottom: "1px solid var(--line)",
};

const playerChipAvStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: "#2563eb",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 8.5,
  fontFamily: "JetBrains Mono, monospace",
  fontWeight: 700,
};

const previewBoxStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #fdfdf8, #f7f5ed)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "12px 14px",
  marginTop: 6,
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 12,
};

const previewKStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const previewVStyle: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 17,
  fontWeight: 800,
  marginTop: 2,
  color: "var(--ink)",
};

const previewSmallStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--ink-soft)",
  fontWeight: 600,
  marginLeft: 2,
};

const targetBlockStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "10px 12px",
  marginBottom: 14,
};

function reasonRowStyle(selected: boolean): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    gap: 10,
    padding: "10px 12px",
    border: selected ? "1px solid #dc2626" : "1px solid #d8d3c2",
    borderRadius: 8,
    background: selected ? "#fef2f2" : "#fff",
    cursor: "pointer",
    fontSize: 12.5,
    alignItems: "center",
  };
}

function reasonRadioStyle(selected: boolean): React.CSSProperties {
  return {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: selected ? "2px solid #dc2626" : "2px solid #d8d3c2",
    background: selected ? "#dc2626" : "#fff",
    boxShadow: selected ? "inset 0 0 0 3px #fff" : "none",
    display: "inline-block",
  };
}

const warnCalloutStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fbb6b6",
  color: "#7f1d1d",
  borderRadius: 10,
  padding: "11px 14px",
  marginBottom: 14,
  display: "flex",
  gap: 10,
  fontSize: 12.5,
  lineHeight: 1.5,
};

const warnIconStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  background: "#dc2626",
  color: "#fff",
  borderRadius: 6,
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  flexShrink: 0,
};
