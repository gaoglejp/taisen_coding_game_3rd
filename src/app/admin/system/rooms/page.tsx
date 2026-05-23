"use client";

import { useState, useEffect, useCallback } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { StatusBadge } from "@/components/ui/StatusBadge";

const SYSTEM_NAV = [
  { label: "ホーム", href: "/admin/system", icon: "🏠" },
  { label: "ルーム", href: "/admin/system/rooms", icon: "🏫" },
  { label: "アカウント", href: "/admin/system/users", icon: "👥" },
  { label: "監査ログ", href: "/admin/system/audit", icon: "📋" },
  { label: "設定", href: "/admin/system/settings", icon: "⚙" },
];

interface AdminRoom {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  kind: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  adminCount: number;
  memberCount: number;
  activeMatchCount: number;
}

const KIND_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  CLASSROOM: { label: "CLASSROOM", bg: "rgba(8,145,178,0.12)", color: "#0891b2" },
  TOURNAMENT: { label: "TOURNAMENT", bg: "rgba(124,58,237,0.12)", color: "#7c3aed" },
  PUBLIC_LOBBY: { label: "PUBLIC LOBBY", bg: "rgba(245,158,11,0.12)", color: "#b45309" },
};

const PER_PAGE = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

export default function SystemRoomsPage() {
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("すべて");
  const [statusFilter, setStatusFilter] = useState("すべて");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [page, setPage] = useState(1);
  const [createForm, setCreateForm] = useState({ name: "", kind: "CLASSROOM", expiresAt: "", adminSearch: "" });

  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState({ total: 0, active: 0, archived: 0, deleted: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const kindFilters = ["すべて", "CLASSROOM", "TOURNAMENT", "PUBLIC_LOBBY"];
  const statusFilters = ["すべて", "ACTIVE", "ARCHIVED", "DELETED"];

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (kindFilter !== "すべて") params.set("kind", kindFilter);
      if (statusFilter !== "すべて") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));
      try {
        const res = await fetch(`/api/admin/rooms?${params.toString()}`, { signal });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "ルーム一覧を取得できませんでした");
          setRooms([]);
          return;
        }
        const data = await res.json();
        setRooms(data.rooms ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("ルーム一覧を取得できませんでした");
      } finally {
        setLoading(false);
      }
    },
    [search, kindFilter, statusFilter, page]
  );

  // Global status counts for the header pills — independent of the current
  // search/kind/status filter, so fetched once on mount via limit=1 requests
  // that only read pagination.total.
  useEffect(() => {
    let cancelled = false;
    const countFor = async (status?: string) => {
      const p = new URLSearchParams({ limit: "1" });
      if (status) p.set("status", status);
      const res = await fetch(`/api/admin/rooms?${p.toString()}`);
      if (!res.ok) return 0;
      const data = await res.json();
      return data.pagination?.total ?? 0;
    };
    Promise.all([countFor(), countFor("ACTIVE"), countFor("ARCHIVED"), countFor("DELETED")])
      .then(([t, a, ar, d]) => {
        if (!cancelled) setCounts({ total: t, active: a, archived: ar, deleted: d });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced list fetch (search-as-you-type).
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [load]);

  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const onKind = (v: string) => {
    setKindFilter(v);
    setPage(1);
  };
  const onStatus = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  const pageItems = rooms;
  const deleteTarget = rooms.find((r) => r.id === showDeleteModal);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="admin_sys" displayName="システム管理者" role="SYSTEM_ADMIN" />
      <ScopeBanner variant="system" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={SYSTEM_NAV} scope="system" />
        <main style={{ flex: 1, padding: "32px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>ルーム</h1>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { label: "合計", value: counts.total, color: "#4b5563", bg: "#f3f4f6" },
                { label: "ACTIVE", value: counts.active, color: "#15803d", bg: "#dcfce7" },
                { label: "ARCHIVED", value: counts.archived, color: "#92400e", bg: "#fef3c7" },
                { label: "DELETED", value: counts.deleted, color: "#dc2626", bg: "#fee2e2" },
              ].map((p) => (
                <span
                  key={p.label}
                  style={{
                    background: p.bg,
                    color: p.color,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {p.label} {p.value}
                </span>
              ))}
            </div>
          </div>

          {/* Toolbar */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "16px 20px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
            }}
          >
            <input
              placeholder="ルーム名・番号で検索..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                width: 240,
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>種別:</span>
              {kindFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => onKind(f)}
                  style={{
                    background: kindFilter === f ? "var(--admin-accent)" : "#f3f4f6",
                    color: kindFilter === f ? "#fff" : "var(--ink)",
                    border: "none",
                    borderRadius: 999,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)", fontWeight: 600 }}>状態:</span>
              {statusFilters.map((f) => (
                <button
                  key={f}
                  onClick={() => onStatus(f)}
                  style={{
                    background: statusFilter === f ? "var(--admin-accent)" : "#f3f4f6",
                    color: statusFilter === f ? "#fff" : "var(--ink)",
                    border: "none",
                    borderRadius: 999,
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  background: "var(--admin-accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + ルームを作成
              </button>
            </div>
          </div>

          {/* Table */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9f8f5", borderBottom: "1px solid var(--line)" }}>
                  {["ルーム番号", "名前", "種別", "管理者", "メンバー数", "進行中マッチ", "ステータス", "作成日", "操作"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ink-soft)",
                        letterSpacing: "0.05em",
                        fontFamily: "JetBrains Mono, monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading || error || pageItems.length === 0) && (
                  <tr>
                    <td colSpan={9} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: error ? "#dc2626" : "var(--ink-soft)" }}>
                      {error ? error : loading ? "読み込み中…" : "該当するルームはありません"}
                    </td>
                  </tr>
                )}
                {!loading && !error && pageItems.map((room, i) => {
                  const kind = KIND_CONFIG[room.kind] ?? { label: room.kind, bg: "#f3f4f6", color: "#4b5563" };
                  return (
                    <tr
                      key={room.id}
                      style={{
                        borderBottom: i < pageItems.length - 1 ? "1px solid var(--line)" : "none",
                        height: 56,
                      }}
                    >
                      <td style={{ padding: "0 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 13, fontWeight: 700, color: "var(--admin-accent)" }}>
                        {room.roomNumber}
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                        {room.name}
                      </td>
                      <td style={{ padding: "0 16px" }}>
                        <span
                          style={{
                            background: kind.bg,
                            color: kind.color,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontFamily: "JetBrains Mono, monospace",
                          }}
                        >
                          {kind.label}
                        </span>
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 13, color: "var(--ink)" }}>
                        {room.adminCount > 0 ? `${room.adminCount} 名` : <span style={{ color: "var(--ink-soft)" }}>未任命</span>}
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "var(--ink)", textAlign: "center" }}>
                        {room.memberCount}
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: room.activeMatchCount > 0 ? "#d97706" : "var(--ink-soft)", textAlign: "center" }}>
                        {room.activeMatchCount}
                      </td>
                      <td style={{ padding: "0 16px" }}>
                        <StatusBadge status={room.status} />
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
                        {fmtDate(room.createdAt)}
                      </td>
                      <td style={{ padding: "0 16px" }}>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "nowrap" }}>
                          <button style={actionBtnStyle("#1d4ed8", "rgba(29,78,216,0.08)")}>詳細</button>
                          <button style={actionBtnStyle("#0891b2", "rgba(8,145,178,0.08)")}>任命</button>
                          <button style={actionBtnStyle("#92400e", "rgba(245,158,11,0.08)")}>ｱｰｶｲﾌﾞ</button>
                          <button
                            onClick={() => { setShowDeleteModal(room.id); setDeleteConfirm(""); }}
                            style={actionBtnStyle("#dc2626", "rgba(220,38,38,0.08)")}
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {total === 0 ? "0件" : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total}件`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}
              >
                ← 前
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1 }}
              >
                次 →
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <ModalOverlay onClose={() => setShowCreateModal(false)}>
          <div style={{ width: 520 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 20px" }}>ルームを作成</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="ルーム名">
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="例: プログラミング基礎クラスB"
                  style={inputStyle}
                />
              </FormField>
              <FormField label="種別">
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["CLASSROOM", "TOURNAMENT", "PUBLIC_LOBBY"] as const).map((k) => (
                    <button
                      key={k}
                      onClick={() => setCreateForm({ ...createForm, kind: k })}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 8,
                        border: `2px solid ${createForm.kind === k ? "var(--admin-accent)" : "var(--line)"}`,
                        background: createForm.kind === k ? "rgba(124,58,237,0.06)" : "transparent",
                        color: createForm.kind === k ? "var(--admin-accent)" : "var(--ink-soft)",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    >
                      {KIND_CONFIG[k].label}
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="有効期限">
                <input type="date" value={createForm.expiresAt} onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })} style={inputStyle} />
              </FormField>
              <FormField label="管理者ユーザー検索">
                <input
                  value={createForm.adminSearch}
                  onChange={(e) => setCreateForm({ ...createForm, adminSearch: e.target.value })}
                  placeholder="ユーザー名で検索..."
                  style={inputStyle}
                />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreateModal(false)} style={cancelBtnStyle}>キャンセル</button>
              <button style={{ ...submitBtnStyle, background: "var(--admin-accent)" }}>作成する</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Modal */}
      {showDeleteModal && deleteTarget && (
        <ModalOverlay onClose={() => setShowDeleteModal(null)}>
          <div style={{ width: 480 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: 0 }}>ルームを削除</h2>
            </div>
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: "20px", fontSize: 13, color: "#991b1b" }}>
              この操作は元に戻せません。ルーム内のすべてのデータが削除されます。
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)", marginBottom: "16px" }}>
              確認のため、ルーム番号 <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>{deleteTarget.roomNumber}</strong> を入力してください。
            </p>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={deleteTarget.roomNumber}
              style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowDeleteModal(null)} style={cancelBtnStyle}>キャンセル</button>
              <button
                disabled={deleteConfirm !== deleteTarget.roomNumber}
                style={{
                  ...submitBtnStyle,
                  background: "#dc2626",
                  opacity: deleteConfirm !== deleteTarget.roomNumber ? 0.4 : 1,
                }}
              >
                削除する
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 16,
          padding: "28px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "9px 12px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const cancelBtnStyle: React.CSSProperties = {
  background: "#f3f4f6",
  color: "var(--ink)",
  border: "none",
  borderRadius: 8,
  padding: "9px 18px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const submitBtnStyle: React.CSSProperties = {
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 20px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const pageBtnStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: 8,
  padding: "6px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  color: "var(--ink)",
};

function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return {
    background: bg,
    color: color,
    border: "none",
    borderRadius: 6,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
