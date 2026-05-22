"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { StatusBadge } from "@/components/ui/StatusBadge";

const MOCK_MEMBERS = [
  { id: "m1", username: "tanaka_k", displayName: "田中 健二", status: "ACTIVE", expiresAt: "2024-05-31", lastLoginAt: "2024-03-15 11:05", w: 8, l: 3, d: 1 },
  { id: "m2", username: "suzuki_h", displayName: "鈴木 花子", status: "ACTIVE", expiresAt: "2024-05-31", lastLoginAt: "2024-03-14 18:22", w: 6, l: 5, d: 0 },
  { id: "m3", username: "ito_m", displayName: "伊藤 みか", status: "ACTIVE", expiresAt: "2024-05-31", lastLoginAt: "2024-03-13 20:14", w: 4, l: 4, d: 2 },
  { id: "m4", username: "watanabe_r", displayName: "渡辺 涼", status: "ACTIVE", expiresAt: "2024-05-31", lastLoginAt: "2024-03-15 08:55", w: 5, l: 6, d: 0 },
  { id: "m5", username: "nakamura_s", displayName: "中村 俊介", status: "DISABLED", expiresAt: "2024-05-31", lastLoginAt: "2024-02-28 15:30", w: 2, l: 3, d: 1 },
  { id: "m6", username: "kobayashi_y", displayName: "小林 陽一", status: "ACTIVE", expiresAt: "2024-04-30", lastLoginAt: "2024-03-15 10:42", w: 7, l: 2, d: 1 },
  { id: "m7", username: "kato_n", displayName: "加藤 奈々", status: "EXPIRED", expiresAt: "2024-03-01", lastLoginAt: "2024-03-01 09:00", w: 1, l: 2, d: 0 },
  { id: "m8", username: "yoshida_t", displayName: "吉田 達也", status: "ACTIVE", expiresAt: "2024-05-31", lastLoginAt: "2024-03-14 16:30", w: 3, l: 4, d: 2 },
];

export default function RoomMembersPage() {
  const params = useParams();
  const roomId = params.roomId as string;

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showReissueModal, setShowReissueModal] = useState<string | null>(null);
  const [showDisableModal, setShowDisableModal] = useState<string | null>(null);
  const [disableConfirm, setDisableConfirm] = useState("");
  const [maskCodes, setMaskCodes] = useState(true);
  const [issueCsv, setIssueCsv] = useState("");
  const [issueExpiry, setIssueExpiry] = useState("");
  const [page, setPage] = useState(1);

  const STATUS_FILTERS = ["ALL", "ACTIVE", "DISABLED", "EXPIRED"];

  const filtered = MOCK_MEMBERS.filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    if (search && !m.username.includes(search) && !m.displayName.includes(search)) return false;
    return true;
  });

  const perPage = 8;
  const totalPages = Math.ceil(filtered.length / perPage);
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

  const disableTarget = MOCK_MEMBERS.find((m) => m.id === showDisableModal);
  const reissueTarget = MOCK_MEMBERS.find((m) => m.id === showReissueModal);

  const MOCK_ISSUED_CODES = [
    { username: "player_01", code: "ABC-123-DEF" },
    { username: "player_02", code: "XYZ-456-GHI" },
    { username: "player_03", code: "QRS-789-TUV" },
  ];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="suzuki_h" displayName="鈴木 花子" role="ROOM_ADMIN" />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={ROOM_NAV} scope="room" roomName="春季トーナメント2024" roomNumber="R-2402" />
        <main style={{ flex: 1, padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>メンバー</h1>
            <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>{MOCK_MEMBERS.length} 名</span>
          </div>

          {/* Toolbar */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, padding: "16px 20px", marginBottom: "20px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <input placeholder="ユーザー名・表示名で検索..." value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: "6px" }}>
              {STATUS_FILTERS.map((f) => (
                <button key={f} onClick={() => setStatusFilter(f)} style={filterChipStyle(statusFilter === f)}>
                  {f === "ALL" ? "すべて" : f}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <button style={secondaryBtnStyle}>↑ CSV取込</button>
              <button style={secondaryBtnStyle}>↓ CSV出力</button>
              <button onClick={() => setShowIssueModal(true)} style={tealBtnStyle}>+ メンバーを発行</button>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9f8f5", borderBottom: "1px solid var(--line)" }}>
                  {["ユーザー名", "表示名", "ステータス", "期限", "最終ログイン", "戦績 W/L/D", "操作"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map((member, i) => (
                  <tr key={member.id} style={{ borderBottom: i < pageItems.length - 1 ? "1px solid var(--line)" : "none", height: 56 }}>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(8,145,178,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--room-admin-accent)", fontFamily: "JetBrains Mono, monospace" }}>
                          {member.username.slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", fontFamily: "JetBrains Mono, monospace" }}>@{member.username}</span>
                      </div>
                    </td>
                    <td style={{ padding: "0 16px", fontSize: 13, color: "var(--ink)" }}>{member.displayName}</td>
                    <td style={{ padding: "0 16px" }}><StatusBadge status={member.status} /></td>
                    <td style={{ padding: "0 16px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{member.expiresAt}</td>
                    <td style={{ padding: "0 16px", fontSize: 12, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>{member.lastLoginAt}</td>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ display: "flex", gap: "6px", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}>
                        <span style={{ color: "#15803d", fontWeight: 700 }}>{member.w}W</span>
                        <span style={{ color: "#dc2626", fontWeight: 700 }}>{member.l}L</span>
                        <span style={{ color: "#92400e", fontWeight: 700 }}>{member.d}D</span>
                      </div>
                    </td>
                    <td style={{ padding: "0 16px" }}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <button onClick={() => setShowReissueModal(member.id)} style={actionBtnStyle("#0891b2", "rgba(8,145,178,0.08)")}>再発行</button>
                        <button style={actionBtnStyle("#4b5563", "rgba(75,85,99,0.08)")}>期限</button>
                        <button onClick={() => { setShowDisableModal(member.id); setDisableConfirm(""); }} style={actionBtnStyle("#dc2626", "rgba(220,38,38,0.08)")}>無効化</button>
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
              {filtered.length === 0 ? "0件" : `${(page - 1) * perPage + 1}–${Math.min(page * perPage, filtered.length)} / ${filtered.length}件`}
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...pageBtnStyle, opacity: page === 1 ? 0.4 : 1 }}>← 前</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...pageBtnStyle, opacity: page >= totalPages ? 0.4 : 1 }}>次 →</button>
            </div>
          </div>
        </main>
      </div>

      {/* Issue Modal */}
      {showIssueModal && (
        <ModalOverlay onClose={() => setShowIssueModal(false)}>
          <div style={{ width: 560 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 20px" }}>メンバーを発行</h2>
            <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
              {["CSVで一括発行", "1件ずつ発行"].map((tab, idx) => (
                <button key={tab} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: idx === 0 ? "var(--room-admin-accent)" : "#f3f4f6", color: idx === 0 ? "#fff" : "var(--ink)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {tab}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-soft)" }}>CSVファイルの内容を貼り付け</label>
                  <button style={{ fontSize: 12, color: "var(--room-admin-accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>⬇ CSVテンプレートをダウンロード</button>
                </div>
                <textarea
                  value={issueCsv}
                  onChange={(e) => setIssueCsv(e.target.value)}
                  placeholder="username,display_name&#10;player_01,プレイヤー1&#10;player_02,プレイヤー2"
                  rows={6}
                  style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace", fontSize: 12, resize: "vertical" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-soft)", marginBottom: 6 }}>有効期限</label>
                <input type="date" value={issueExpiry} onChange={(e) => setIssueExpiry(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowIssueModal(false)} style={cancelBtnStyle}>キャンセル</button>
              <button onClick={() => { setShowIssueModal(false); setShowResultModal(true); }} style={{ ...submitBtnStyle, background: "var(--room-admin-accent)" }}>発行する</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Result Modal - one-time display */}
      {showResultModal && (
        <ModalOverlay onClose={() => setShowResultModal(false)}>
          <div style={{ width: 600 }}>
            <div style={{ background: "#fee2e2", border: "2px solid #dc2626", borderRadius: 10, padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: 24 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#991b1b" }}>この画面でしか見られません</div>
                <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 2 }}>発行コードはこの画面を閉じると二度と表示されません。必ず今すぐコピーまたは保存してください。</div>
              </div>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 16px" }}>発行結果 ({MOCK_ISSUED_CODES.length}件)</h2>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <button onClick={() => setMaskCodes(!maskCodes)} style={{ ...secondaryBtnStyle, fontSize: 12 }}>
                {maskCodes ? "👁 コードを表示" : "🙈 コードを隠す"}
              </button>
              <button style={{ ...secondaryBtnStyle, fontSize: 12 }}>📋 すべてコピー</button>
              <button style={{ ...secondaryBtnStyle, fontSize: 12 }}>⬇ CSVダウンロード</button>
              <button style={{ ...secondaryBtnStyle, fontSize: 12 }}>🖨 印刷</button>
            </div>
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9f8f5" }}>
                    {["ユーザー名", "発行コード", "コピー"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ISSUED_CODES.map((row, i) => (
                    <tr key={row.username} style={{ borderBottom: i < MOCK_ISSUED_CODES.length - 1 ? "1px solid var(--line)" : "none" }}>
                      <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "JetBrains Mono, monospace", fontWeight: 700, color: "var(--ink)" }}>@{row.username}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "JetBrains Mono, monospace", fontSize: 14, letterSpacing: "0.1em", color: maskCodes ? "transparent" : "var(--ink)", background: maskCodes ? "#f3f4f6" : "transparent", borderRadius: maskCodes ? 4 : 0, userSelect: maskCodes ? "none" : "text" }}>
                        {row.code}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button style={{ ...actionBtnStyle("#0891b2", "rgba(8,145,178,0.08)"), fontSize: 11 }}>コピー</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setShowResultModal(false)} style={{ ...submitBtnStyle, background: "var(--room-admin-accent)" }}>確認して閉じる</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Re-issue Modal */}
      {showReissueModal && reissueTarget && (
        <ModalOverlay onClose={() => setShowReissueModal(null)}>
          <div style={{ width: 440 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", margin: "0 0 12px" }}>コードを再発行</h2>
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "12px 16px", marginBottom: "16px", fontSize: 13, color: "#92400e" }}>
              <strong>⚠ 旧コードは即時無効化されます。</strong>
              <br />再発行後、ユーザーには新しいコードを配布してください。
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)", marginBottom: "16px" }}>
              対象: <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>@{reissueTarget.username}</strong> ({reissueTarget.displayName})
            </p>
            <div style={{ background: "#f9f8f5", border: "1px solid var(--line)", borderRadius: 8, padding: "14px 16px", marginBottom: "16px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>新しい発行コード（発行後に表示）</div>
              <div style={{ fontSize: 16, fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.12em", color: "#6b7280" }}>
                ••• ••• •••
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowReissueModal(null)} style={cancelBtnStyle}>キャンセル</button>
              <button style={{ ...submitBtnStyle, background: "var(--room-admin-accent)" }}>再発行する</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Disable Modal */}
      {showDisableModal && disableTarget && (
        <ModalOverlay onClose={() => setShowDisableModal(null)}>
          <div style={{ width: 440 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", margin: "0 0 12px" }}>メンバーを無効化</h2>
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "12px 16px", marginBottom: "16px", fontSize: 13, color: "#991b1b" }}>
              無効化するとこのルームへのアクセスが即時停止されます。
            </div>
            <p style={{ fontSize: 14, color: "var(--ink)", marginBottom: "12px" }}>
              確認のため <strong style={{ fontFamily: "JetBrains Mono, monospace" }}>@{disableTarget.username}</strong> を入力してください。
            </p>
            <input value={disableConfirm} onChange={(e) => setDisableConfirm(e.target.value)} placeholder={disableTarget.username} style={{ ...inputStyle, fontFamily: "JetBrains Mono, monospace" }} />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowDisableModal(null)} style={cancelBtnStyle}>キャンセル</button>
              <button disabled={disableConfirm !== disableTarget.username} style={{ ...submitBtnStyle, background: "#dc2626", opacity: disableConfirm !== disableTarget.username ? 0.4 : 1 }}>無効化する</button>
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

const inputStyle: React.CSSProperties = { width: "100%", border: "1px solid var(--line)", borderRadius: 8, padding: "9px 12px", fontSize: 14, outline: "none", boxSizing: "border-box" };
const cancelBtnStyle: React.CSSProperties = { background: "#f3f4f6", color: "var(--ink)", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const submitBtnStyle: React.CSSProperties = { color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const pageBtnStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };
const thStyle: React.CSSProperties = { padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", letterSpacing: "0.05em", fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" };
const tealBtnStyle: React.CSSProperties = { background: "var(--room-admin-accent)", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
const secondaryBtnStyle: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink)" };

function filterChipStyle(active: boolean): React.CSSProperties {
  return { background: active ? "var(--room-admin-accent)" : "#f3f4f6", color: active ? "#fff" : "var(--ink)", border: "none", borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" };
}

function actionBtnStyle(color: string, bg: string): React.CSSProperties {
  return { background: bg, color, border: "none", borderRadius: 6, padding: "4px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
}
