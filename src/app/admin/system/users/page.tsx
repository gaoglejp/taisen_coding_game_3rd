"use client";

import { useState, useEffect, useCallback } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserRole } from "@prisma/client";

const SYSTEM_NAV = [
  { label: "ホーム", href: "/admin/system", icon: "🏠" },
  { label: "ルーム", href: "/admin/system/rooms", icon: "🏫" },
  { label: "アカウント", href: "/admin/system/users", icon: "👥" },
  { label: "監査ログ", href: "/admin/system/audit", icon: "📋" },
  { label: "設定", href: "/admin/system/settings", icon: "⚙" },
];

interface AdminUser {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  role: UserRole;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  membershipCount: number;
  memberships: { id: string; room: { id: string; name: string; roomNumber: string; kind: string } }[];
}

const ROLE_FILTERS = ["ALL", "SYSTEM_ADMIN", "ROOM_ADMIN", "GENERAL_USER", "ROOM_USER"];
const STATUS_FILTERS = ["すべて", "ACTIVE", "DISABLED", "PENDING", "EXPIRED"];
const PER_PAGE = 20;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export default function SystemUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("すべて");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState("");
  const [page, setPage] = useState(1);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "ROOM_ADMIN", message: "" });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (statusFilter !== "すべて") params.set("status", statusFilter);
      params.set("page", String(page));
      params.set("limit", String(PER_PAGE));
      try {
        const res = await fetch(`/api/admin/users?${params.toString()}`, { signal });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error ?? "ユーザー一覧を取得できませんでした");
          setUsers([]);
          return;
        }
        const data = await res.json();
        setUsers(data.users ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("ユーザー一覧を取得できませんでした");
        }
      } finally {
        setLoading(false);
      }
    },
    [search, roleFilter, statusFilter, page]
  );

  // Debounce so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(() => load(controller.signal), 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [load]);

  // Filter changes reset to page 1 (done in the handlers, not an effect, to
  // avoid a cascading setState-in-effect render).
  const onSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };
  const onRole = (v: string) => {
    setRoleFilter(v);
    setPage(1);
  };
  const onStatus = (v: string) => {
    setStatusFilter(v);
    setPage(1);
  };

  const pageItems = users;
  const disableTarget = users.find((u) => u.id === showDisableModal);
  const resetTarget = users.find((u) => u.id === showResetModal);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="admin_sys" displayName="システム管理者" role="SYSTEM_ADMIN" />
      <ScopeBanner variant="system" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={SYSTEM_NAV} scope="system" />
        <main style={{ flex: 1, padding: "32px" }}>
          {/* Audit notice */}
          <div
            style={{
              background: "rgba(124,58,237,0.08)",
              border: "1px solid rgba(124,58,237,0.2)",
              borderRadius: 10,
              padding: "12px 16px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: 13,
              color: "#5b21b6",
            }}
          >
            <span style={{ fontSize: 16 }}>🔐</span>
            <strong>アカウント操作はすべて記録されます</strong>
            <span style={{ color: "#7c3aed" }}>— 操作前に監査ログを確認してください。</span>
          </div>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>アカウント</h1>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{total} 件</span>
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
              placeholder="ユーザー名・メールで検索..."
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {ROLE_FILTERS.map((f) => (
                <button key={f} onClick={() => onRole(f)} style={filterChipStyle(roleFilter === f)}>
                  {f === "ALL" ? "すべて" : f.replace("_", " ")}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f} onClick={() => onStatus(f)} style={filterChipStyle(statusFilter === f)}>
                  {f}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button
                onClick={() => setShowInviteModal(true)}
                style={{ background: "var(--admin-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                + アカウントを招待
              </button>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9f8f5", borderBottom: "1px solid var(--line)" }}>
                  {["識別子", "表示名・メール", "種別", "ステータス", "所属ルーム", "作成日", "最終ログイン", "操作"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(loading || error || pageItems.length === 0) && (
                  <tr>
                    <td colSpan={8} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: error ? "#dc2626" : "var(--ink-soft)" }}>
                      {error ? error : loading ? "読み込み中…" : "該当するアカウントはありません"}
                    </td>
                  </tr>
                )}
                {!loading && !error && pageItems.map((user, i) => (
                  <tr key={user.id} style={{ borderBottom: i < pageItems.length - 1 ? "1px solid var(--line)" : "none", height: 56 }}>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: user.role === "SYSTEM_ADMIN" ? "var(--admin-accent)" : user.role === "ROOM_ADMIN" ? "var(--room-admin-accent)" : "#6b7280",
                          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 13, fontWeight: 700,
                        }}>
                          {(user.displayName ?? user.username)[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>
                            @{user.username}
                          </div>
                          {user.twoFactorEnabled && (
                            <span style={{ fontSize: 10, background: "#dcfce7", color: "#15803d", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>2FA</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{user.displayName}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{user.email}</div>
                    </td>
                    <td style={{ padding: "0 16px" }}><RoleBadge role={user.role} /></td>
                    <td style={{ padding: "0 16px" }}><StatusBadge status={user.status} /></td>
                    <td style={{ padding: "0 16px" }}>
                      {user.memberships.length > 0 ? (
                        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                          {user.memberships.map((m) => (
                            <span key={m.id} title={m.room.name} style={{ fontSize: 11, background: "rgba(8,145,178,0.1)", color: "#0891b2", borderRadius: 999, padding: "1px 7px", fontFamily: "JetBrains Mono, monospace", fontWeight: 700 }}>{m.room.roomNumber}</span>
                          ))}
                          {user.membershipCount > user.memberships.length && (
                            <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>+{user.membershipCount - user.memberships.length}</span>
                          )}
                        </div>
                      ) : <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>—</span>}
                    </td>
                    <td style={{ padding: "0 16px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{fmtDate(user.createdAt)}</td>
                    <td style={{ padding: "0 16px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{fmtDateTime(user.lastLoginAt)}</td>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button style={actionBtnStyle("#1d4ed8", "rgba(29,78,216,0.08)")}>詳細</button>
                        <button onClick={() => setShowResetModal(user.id)} style={actionBtnStyle("#d97706", "rgba(217,119,6,0.08)")}>ﾘｾｯﾄ</button>
                        <button onClick={() => { setShowDisableModal(user.id); setDisableConfirm(""); }} style={actionBtnStyle("#dc2626", "rgba(220,38,38,0.08)")}>無効化</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              {total === 0 ? "0件" : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total}件`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}>← 前</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1 }}>次 →</button>
            </div>
          </div>
        </main>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <ModalOverlay onClose={() => setShowInviteModal(false)}>
          <div style={{ width: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 20px" }}>アカウントを招待</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <FormField label="メールアドレス">
                <input value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="user@example.com" style={inputStyle} />
              </FormField>
              <FormField label="役割">
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["ROOM_ADMIN", "SYSTEM_ADMIN"] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setInviteForm({ ...inviteForm, role })}
                      style={{
                        flex: 1, padding: "12px",
                        borderRadius: 10,
                        border: `2px solid ${inviteForm.role === role ? "var(--admin-accent)" : "var(--line)"}`,
                        background: inviteForm.role === role ? "rgba(124,58,237,0.06)" : "transparent",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: inviteForm.role === role ? "var(--admin-accent)" : "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace", marginBottom: 4 }}>{role.replace("_", " ")}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {role === "ROOM_ADMIN" ? "ルームの管理が可能" : "システム全体の管理が可能"}
                      </div>
                    </button>
                  ))}
                </div>
              </FormField>
              <FormField label="招待メッセージ（任意）">
                <textarea
                  value={inviteForm.message}
                  onChange={(e) => setInviteForm({ ...inviteForm, message: e.target.value })}
                  placeholder="招待の目的や説明を記入..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </FormField>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowInviteModal(false)} style={cancelBtnStyle}>キャンセル</button>
              <button style={{ ...submitBtnStyle, background: "var(--admin-accent)" }}>招待メールを送信</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Disable Modal */}
      {showDisableModal && disableTarget && (
        <ModalOverlay onClose={() => setShowDisableModal(null)}>
          <div style={{ width: 440 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: "0 0 12px" }}>アカウントを無効化</h2>
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: "20px", fontSize: 13, color: "#991b1b" }}>
              無効化するとそのユーザーはログインできなくなります。
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)", marginBottom: "12px" }}>
              確認のため、ユーザー名 <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>@{disableTarget.username}</strong> を入力してください。
            </p>
            <input value={disableConfirm} onChange={(e) => setDisableConfirm(e.target.value)} placeholder={disableTarget.username} style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowDisableModal(null)} style={cancelBtnStyle}>キャンセル</button>
              <button disabled={disableConfirm !== disableTarget.username} style={{ ...submitBtnStyle, background: "#dc2626", opacity: disableConfirm !== disableTarget.username ? 0.4 : 1 }}>無効化する</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Reset Modal */}
      {showResetModal && resetTarget && (
        <ModalOverlay onClose={() => setShowResetModal(null)}>
          <div style={{ width: 440 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 12px" }}>パスワードをリセット</h2>
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: "16px", fontSize: 13, color: "#92400e" }}>
              <strong>実行すること:</strong>
              <ul style={{ margin: "8px 0 0", paddingLeft: 16 }}>
                <li>現在のパスワードを無効化</li>
                <li>パスワードリセットメールを送信</li>
                <li>すべてのアクティブセッションを終了</li>
              </ul>
            </div>
            <div style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 8, padding: "12px 16px", marginBottom: "16px", fontSize: 12, color: "#5b21b6" }}>
              📋 この操作は監査ログに記録されます (USER_FORCE_PASSWORD_RESET)
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)" }}>
              対象: <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>@{resetTarget.username}</strong> ({resetTarget.displayName})
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowResetModal(null)} style={cancelBtnStyle}>キャンセル</button>
              <button style={{ ...submitBtnStyle, background: "#d97706" }}>リセットメールを送信</button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "var(--surface)", borderRadius: 16, padding: "28px 32px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6, letterSpacing: "0.04em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" };
const cancelBtnStyle: React.CSSProperties = { background: "#f3f4f6", color: "var(--ink)", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const submitBtnStyle: React.CSSProperties = { color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const pageBtnStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.05em", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" };

function filterChipStyle(active: boolean): React.CSSProperties {
  return { background: active ? "var(--admin-accent)" : "#f3f4f6", color: active ? "#fff" : "var(--ink)", border: "none", borderRadius: 999, padding: "4px 11px", fontSize: 11, fontWeight: 600, cursor: "pointer" };
}

function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return { background: bg, color, border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
}
