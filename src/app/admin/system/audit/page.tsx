"use client";

import { useState } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { RoleBadge } from "@/components/ui/RoleBadge";
import { UserRole } from "@prisma/client";

const SYSTEM_NAV = [
  { label: "ホーム", href: "/admin/system", icon: "🏠" },
  { label: "ルーム", href: "/admin/system/rooms", icon: "🏫" },
  { label: "アカウント", href: "/admin/system/users", icon: "👥" },
  { label: "監査ログ", href: "/admin/system/audit", icon: "📋" },
  { label: "設定", href: "/admin/system/settings", icon: "⚙" },
];

const ACTION_CONFIG: Record<string, { label: string; bg: string; color: string; category: string }> = {
  ROOM_CREATE: { label: "ROOM_CREATE", bg: "#dcfce7", color: "#15803d", category: "CREATE" },
  ROOM_UPDATE: { label: "ROOM_UPDATE", bg: "#dbeafe", color: "#1d4ed8", category: "UPDATE" },
  ROOM_DELETE: { label: "ROOM_DELETE", bg: "#fee2e2", color: "#dc2626", category: "DELETE" },
  ROOM_ARCHIVE: { label: "ROOM_ARCHIVE", bg: "#fef3c7", color: "#92400e", category: "UPDATE" },
  ROOM_RESTORE: { label: "ROOM_RESTORE", bg: "#dcfce7", color: "#15803d", category: "UPDATE" },
  USER_INVITE: { label: "USER_INVITE", bg: "#dcfce7", color: "#15803d", category: "CREATE" },
  USER_DISABLE: { label: "USER_DISABLE", bg: "#fee2e2", color: "#dc2626", category: "DELETE" },
  USER_ENABLE: { label: "USER_ENABLE", bg: "#dcfce7", color: "#15803d", category: "UPDATE" },
  USER_PROMOTE: { label: "USER_PROMOTE", bg: "#ede9fe", color: "#7c3aed", category: "PERMISSION" },
  USER_FORCE_PASSWORD_RESET: { label: "USER_FORCE_PWD_RESET", bg: "#fef3c7", color: "#92400e", category: "UPDATE" },
  MEMBER_ISSUE: { label: "MEMBER_ISSUE", bg: "#dcfce7", color: "#15803d", category: "CREATE" },
  MEMBER_REISSUE: { label: "MEMBER_REISSUE", bg: "#dbeafe", color: "#1d4ed8", category: "UPDATE" },
  MATCH_CREATE: { label: "MATCH_CREATE", bg: "#dcfce7", color: "#15803d", category: "CREATE" },
  MATCH_CANCEL: { label: "MATCH_CANCEL", bg: "#fee2e2", color: "#dc2626", category: "DELETE" },
  LOGIN_SUCCESS: { label: "LOGIN_SUCCESS", bg: "#fef3c7", color: "#92400e", category: "AUTH" },
  LOGIN_FAILURE: { label: "LOGIN_FAILURE", bg: "#fecaca", color: "#991b1b", category: "FAIL" },
  LOGOUT: { label: "LOGOUT", bg: "#f3f4f6", color: "#4b5563", category: "AUTH" },
  PERMISSION_GRANT: { label: "PERMISSION_GRANT", bg: "#ede9fe", color: "#7c3aed", category: "PERMISSION" },
};

const MOCK_LOGS = [
  { id: "log-001", action: "ROOM_CREATE", actor: { username: "yamada_t", displayName: "山田 太郎", role: "SYSTEM_ADMIN" as UserRole }, targetType: "ROOM", targetId: "R-2403", summary: "パブリックロビー β を作成", ip: "203.0.113.1", ua: "Mozilla/5.0 (Mac)", createdAt: "2024-03-15 11:05:22", meta: { roomName: "パブリックロビー β", kind: "PUBLIC_LOBBY" } },
  { id: "log-002", action: "USER_INVITE", actor: { username: "yamada_t", displayName: "山田 太郎", role: "SYSTEM_ADMIN" as UserRole }, targetType: "USER", targetId: "u7", summary: "kobayashi_y を GENERAL_USER として招待", ip: "203.0.113.1", ua: "Mozilla/5.0 (Mac)", createdAt: "2024-03-14 16:42:11", meta: { email: "kobayashi@example.com", role: "GENERAL_USER" } },
  { id: "log-003", action: "LOGIN_FAILURE", actor: { username: "kato_n", displayName: "加藤 奈々", role: "ROOM_USER" as UserRole }, targetType: "USER", targetId: "u8", summary: "パスワード認証失敗 (3回目)", ip: "198.51.100.5", ua: "Chrome/120 (Win)", createdAt: "2024-03-14 15:30:00", meta: { attempts: 3, locked: false } },
  { id: "log-004", action: "LOGIN_FAILURE", actor: { username: "kato_n", displayName: "加藤 奈々", role: "ROOM_USER" as UserRole }, targetType: "USER", targetId: "u8", summary: "パスワード認証失敗 (4回目)", ip: "198.51.100.5", ua: "Chrome/120 (Win)", createdAt: "2024-03-14 15:31:02", meta: { attempts: 4, locked: false } },
  { id: "log-005", action: "USER_DISABLE", actor: { username: "yamada_t", displayName: "山田 太郎", role: "SYSTEM_ADMIN" as UserRole }, targetType: "USER", targetId: "u6", summary: "nakamura_s を無効化", ip: "203.0.113.1", ua: "Mozilla/5.0 (Mac)", createdAt: "2024-03-14 14:20:45", meta: { reason: "アカウント侵害の疑い", previousStatus: "ACTIVE" } },
  { id: "log-006", action: "MATCH_CANCEL", actor: { username: "suzuki_h", displayName: "鈴木 花子", role: "ROOM_ADMIN" as UserRole }, targetType: "MATCH", targetId: "M-042", summary: "マッチ #42 をキャンセル (NO_SHOW)", ip: "203.0.113.10", ua: "Firefox/121 (Mac)", createdAt: "2024-03-14 10:15:33", meta: { matchId: "M-042", reason: "NO_SHOW", roomId: "R-2402" } },
  { id: "log-007", action: "PERMISSION_GRANT", actor: { username: "yamada_t", displayName: "山田 太郎", role: "SYSTEM_ADMIN" as UserRole }, targetType: "USER", targetId: "u3", summary: "tanaka_k を ROOM_ADMIN に昇格", ip: "203.0.113.1", ua: "Mozilla/5.0 (Mac)", createdAt: "2024-03-13 09:00:00", meta: { from: "GENERAL_USER", to: "ROOM_ADMIN", roomId: "R-2403" } },
  { id: "log-008", action: "MEMBER_ISSUE", actor: { username: "tanaka_k", displayName: "田中 健二", role: "ROOM_ADMIN" as UserRole }, targetType: "ROOM", targetId: "R-2403", summary: "20件のメンバーコードを発行", ip: "203.0.113.20", ua: "Chrome/120 (Mac)", createdAt: "2024-03-12 13:30:00", meta: { count: 20, expiresAt: "2024-04-12" } },
  { id: "log-009", action: "LOGIN_SUCCESS", actor: { username: "suzuki_h", displayName: "鈴木 花子", role: "ROOM_ADMIN" as UserRole }, targetType: "USER", targetId: "u2", summary: "ログイン成功", ip: "203.0.113.10", ua: "Firefox/121 (Mac)", createdAt: "2024-03-15 18:22:10", meta: { mfa: false } },
  { id: "log-010", action: "ROOM_ARCHIVE", actor: { username: "yamada_t", displayName: "山田 太郎", role: "SYSTEM_ADMIN" as UserRole }, targetType: "ROOM", targetId: "R-2312", summary: "冬季特訓クラス をアーカイブ", ip: "203.0.113.1", ua: "Mozilla/5.0 (Mac)", createdAt: "2024-03-11 17:00:00", meta: { roomName: "冬季特訓クラス" } },
];

const PERIOD_OPTIONS = ["1h", "24h", "7日", "30日"];
const ACTION_CATEGORIES = ["すべて", "CREATE", "UPDATE", "DELETE", "AUTH", "FAIL", "PERMISSION"];
const TARGET_TYPES = ["すべて", "ROOM", "USER", "MATCH"];

const CATEGORY_STYLE: Record<string, { bg: string; color: string }> = {
  CREATE: { bg: "#dcfce7", color: "#15803d" },
  UPDATE: { bg: "#dbeafe", color: "#1d4ed8" },
  DELETE: { bg: "#fee2e2", color: "#dc2626" },
  AUTH: { bg: "#fef3c7", color: "#92400e" },
  FAIL: { bg: "#fecaca", color: "#991b1b" },
  PERMISSION: { bg: "#ede9fe", color: "#7c3aed" },
};

export default function SystemAuditPage() {
  const [period, setPeriod] = useState("24h");
  const [actionFilter, setActionFilter] = useState("すべて");
  const [targetFilter, setTargetFilter] = useState("すべて");
  const [actorSearch, setActorSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedLog, setSelectedLog] = useState<typeof MOCK_LOGS[0] | null>(null);
  const [page, setPage] = useState(1);

  const loginFailures = MOCK_LOGS.filter((l) => l.action === "LOGIN_FAILURE").length;

  const filtered = MOCK_LOGS.filter((log) => {
    const cfg = ACTION_CONFIG[log.action];
    if (actionFilter !== "すべて" && cfg?.category !== actionFilter) return false;
    if (targetFilter !== "すべて" && log.targetType !== targetFilter) return false;
    if (actorSearch && !log.actor.username.includes(actorSearch)) return false;
    if (keyword && !log.summary.includes(keyword) && !log.id.includes(keyword)) return false;
    return true;
  });

  const perPage = 10;
  const totalPages = Math.ceil(filtered.length / perPage);
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="admin_sys" displayName="システム管理者" role="SYSTEM_ADMIN" />
      <ScopeBanner variant="system" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={SYSTEM_NAV} scope="system" />
        <main style={{ flex: 1, padding: "32px", position: "relative" }}>
          {/* Peak warning */}
          {loginFailures >= 2 && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "12px 16px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px", fontSize: 13, color: "#991b1b" }}>
              <span style={{ fontSize: 18 }}>🚨</span>
              <strong>直近でログイン失敗が {loginFailures} 件発生しています。</strong>
              ブルートフォース攻撃の可能性があります。対象アカウントを確認してください。
            </div>
          )}

          {/* Header + Export */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>監査ログ</h1>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={exportBtnStyle}>⬇ CSV エクスポート</button>
              <button style={exportBtnStyle}>⬇ JSON エクスポート</button>
            </div>
          </div>

          {/* Filter bar */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", minWidth: 48 }}>期間:</span>
              {PERIOD_OPTIONS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)} style={filterChipStyle(period === p, "var(--admin-accent)")}>
                  {p}
                </button>
              ))}
              <span style={{ margin: "0 4px", color: "var(--line)" }}>|</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", minWidth: 60 }}>アクション:</span>
              {ACTION_CATEGORIES.map((c) => {
                const cs = CATEGORY_STYLE[c];
                const isActive = actionFilter === c;
                return (
                  <button
                    key={c}
                    onClick={() => setActionFilter(c)}
                    style={{
                      background: isActive ? (cs?.bg ?? "var(--admin-accent)") : "#f3f4f6",
                      color: isActive ? (cs?.color ?? "#fff") : "var(--ink)",
                      border: isActive ? `1px solid ${cs?.color ?? "var(--admin-accent)"}` : "1px solid transparent",
                      borderRadius: 999,
                      padding: "3px 11px",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: c !== "すべて" ? "JetBrains Mono, monospace" : undefined,
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", minWidth: 48 }}>対象:</span>
              {TARGET_TYPES.map((t) => (
                <button key={t} onClick={() => setTargetFilter(t)} style={filterChipStyle(targetFilter === t, "var(--admin-accent)")}>{t}</button>
              ))}
              <input placeholder="アクター検索..." value={actorSearch} onChange={(e) => setActorSearch(e.target.value)} style={{ ...miniInputStyle, width: 160 }} />
              <input placeholder="キーワード検索..." value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ ...miniInputStyle, width: 200 }} />
            </div>
          </div>

          {/* Content: table + detail panel */}
          <div style={{ display: "flex", gap: "20px" }}>
            {/* Table */}
            <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "JetBrains Mono, monospace" }}>
                <thead>
                  <tr style={{ background: "#f9f8f5", borderBottom: "1px solid var(--line)" }}>
                    {["発生時刻", "アクター", "アクション", "対象", "概要", "IP", "UA", "詳細"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((log, i) => {
                    const cfg = ACTION_CONFIG[log.action];
                    const isSelected = selectedLog?.id === log.id;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(isSelected ? null : log)}
                        style={{
                          borderBottom: i < pageItems.length - 1 ? "1px solid var(--line)" : "none",
                          cursor: "pointer",
                          background: isSelected ? "rgba(124,58,237,0.04)" : "transparent",
                          transition: "background 0.1s",
                        }}
                      >
                        <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>{log.createdAt}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--admin-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {log.actor.displayName[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>@{log.actor.username}</div>
                              <RoleBadge role={log.actor.role} size="sm" />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          {cfg && (
                            <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, whiteSpace: "nowrap", display: "inline-block" }}>
                              {cfg.label}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 11, color: "var(--ink)" }}>
                          <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", borderRadius: 4, padding: "1px 5px", marginRight: 4 }}>{log.targetType}</span>
                          {log.targetId}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--ink)", fontFamily: "sans-serif", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.summary}</td>
                        <td style={{ padding: "10px 12px", fontSize: 10, color: "var(--ink-soft)" }}>{log.ip}</td>
                        <td style={{ padding: "10px 12px", fontSize: 10, color: "var(--ink-soft)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.ua}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button style={{ background: isSelected ? "var(--admin-accent)" : "#f3f4f6", color: isSelected ? "#fff" : "var(--ink)", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                            {isSelected ? "閉じる" : "詳細"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Detail panel */}
            {selectedLog && (
              <div style={{ width: 320, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", alignSelf: "flex-start", position: "sticky", top: 120 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--admin-accent)", fontFamily: "JetBrains Mono, monospace" }}>{selectedLog.id}</span>
                  <button onClick={() => setSelectedLog(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--ink-soft)" }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace", marginBottom: "12px" }}>{selectedLog.createdAt}</div>
                {ACTION_CONFIG[selectedLog.action] && (
                  <span style={{ ...(() => { const c = ACTION_CONFIG[selectedLog.action]; return { background: c.bg, color: c.color }; })(), fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, fontFamily: "JetBrains Mono, monospace", display: "inline-block", marginBottom: "16px" }}>
                    {selectedLog.action}
                  </span>
                )}
                <table style={{ width: "100%", marginBottom: "16px", borderCollapse: "collapse" }}>
                  {[
                    ["アクター", `@${selectedLog.actor.username}`],
                    ["対象種別", selectedLog.targetType],
                    ["対象ID", selectedLog.targetId],
                    ["IP", selectedLog.ip],
                  ].map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: "6px 0", fontSize: 11, color: "var(--ink-soft)", width: "40%", fontFamily: "JetBrains Mono, monospace" }}>{k}</td>
                      <td style={{ padding: "6px 0", fontSize: 11, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>{v}</td>
                    </tr>
                  ))}
                </table>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", marginBottom: "6px", letterSpacing: "0.05em" }}>METADATA</div>
                <pre style={{ background: "#1e1e2e", color: "#cdd6f4", borderRadius: 8, padding: "12px", fontSize: 11, overflowX: "auto", lineHeight: 1.6, margin: 0 }}>
                  {JSON.stringify(selectedLog.meta, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>
            <span style={{ fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
              cursor: {(page - 1) * perPage} — {filtered.length === 0 ? "0件" : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)} / ${filtered.length}件`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}>← 前</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1 }}>次 →</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.06em", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" };
const pageBtnStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
const exportBtnStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
const miniInputStyle: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", fontSize: 12, outline: "none" };

function filterChipStyle(active: boolean, activeColor: string): React.CSSProperties {
  return { background: active ? activeColor : "#f3f4f6", color: active ? "#fff" : "var(--ink)", border: "none", borderRadius: 999, padding: "3px 11px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "JetBrains Mono, monospace" };
}
