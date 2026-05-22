"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Tab = "account" | "room" | "quick";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [roomUsername, setRoomUsername] = useState("");
  const [issueCode, setIssueCode] = useState("");
  const [quickName, setQuickName] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload =
        tab === "account"
          ? { mode: "A", identifier, password }
          : tab === "room"
          ? { mode: "B", roomNumber, username: roomUsername, issueCode }
          : { mode: "C", username: quickName };

      // <!-- bind: POST /api/auth/login -->
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  const tabConfig: Record<Tab, { label: string; hint: string; icon: string }> =
    {
      account: {
        label: "通常アカウント",
        hint: "SYSTEM_ADMIN / ROOM_ADMIN / GENERAL_USER の方",
        icon: "👤",
      },
      room: {
        label: "ルームコードで参加",
        hint: "先生から発行されたコードをお持ちの方 (ROOM_USER)",
        icon: "🏫",
      },
      quick: {
        label: "クイック参加",
        hint: "ユーザー名だけですぐに試せます (GENERAL_USER 暫定)",
        icon: "⚡",
      },
    };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(180deg, #fbf8ef, #f6f1e2)",
          borderBottom: "1px solid var(--line)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "var(--ink)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: 14,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,.25)",
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>対戦・コーディング</span>
          <span
            style={{
              fontSize: 11,
              color: "var(--ink-soft)",
              fontWeight: 500,
              padding: "3px 8px",
              background: "var(--accent-soft)",
              border: "1px solid #f3d27d",
              borderRadius: "999px",
            }}
          >
            v0.2
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          <Link href="/signup" style={{ color: "var(--p1)" }}>
            アカウントを作成
          </Link>
          <span style={{ margin: "0 8px" }}>·</span>
          <Link href="/error/404" style={{ color: "var(--ink-soft)" }}>
            ヘルプ
          </Link>
        </div>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          padding: "56px 24px 24px",
          maxWidth: 1440,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 520px 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          {/* Left: product intro */}
          <div style={{ paddingTop: 48 }}>
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                padding: 24,
              }}
            >
              <div
                style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}
              >
                🎮 対戦・コーディングとは
              </div>
              <p style={{ fontSize: 14, color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
                Blocklyでロジックを組み、自動で対戦するコーディング学習ゲームです。
                ターン制の盤面で2つのプログラムが戦い、戦術の差が勝敗を決めます。
              </p>
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  { icon: "🧩", text: "ドラッグ&ドロップでコードを組み立て" },
                  { icon: "⚔", text: "自動対戦で戦略を検証" },
                  { icon: "📊", text: "リプレイで思考を振り返り" },
                ].map((item) => (
                  <div
                    key={item.text}
                    style={{ display: "flex", gap: 8, fontSize: 13 }}
                  >
                    <span>{item.icon}</span>
                    <span style={{ color: "var(--ink-soft)" }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center: login card */}
          <div>
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                boxShadow: "var(--shadow-md)",
                overflow: "hidden",
              }}
            >
              {/* Tabs */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--line)",
                  background: "var(--bg-2)",
                }}
              >
                {(["account", "room", "quick"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTab(t);
                      setError(null);
                    }}
                    style={{
                      flex: 1,
                      padding: "12px 8px",
                      border: "none",
                      background: "transparent",
                      fontWeight: tab === t ? 700 : 500,
                      fontSize: 12,
                      color: tab === t ? "var(--accent)" : "var(--ink-soft)",
                      borderBottom:
                        tab === t
                          ? "2px solid var(--accent)"
                          : "2px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {tabConfig[t].label}
                  </button>
                ))}
              </div>

              {/* Tab hint */}
              <div
                style={{
                  padding: "10px 20px",
                  background: "var(--accent-soft)",
                  borderBottom: "1px solid #f3d27d",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{tabConfig[tab].icon}</span>
                <span style={{ color: "#92400e" }}>{tabConfig[tab].hint}</span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ padding: 24 }}>
                {error && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fca5a5",
                      borderRadius: 8,
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "var(--danger)",
                      marginBottom: 16,
                      display: "flex",
                      gap: 6,
                    }}
                  >
                    <span>⚠</span>
                    <span>{error}</span>
                  </div>
                )}

                {tab === "account" && (
                  <>
                    <label style={labelStyle}>
                      ユーザー名またはメールアドレス
                    </label>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="username または email@example.com"
                      required
                      style={inputStyle}
                    />
                    <label style={labelStyle}>パスワード</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="パスワード"
                      required
                      style={inputStyle}
                    />
                    <div
                      style={{
                        textAlign: "right",
                        fontSize: 12,
                        marginBottom: 16,
                      }}
                    >
                      <Link href="#" style={{ color: "var(--p1)" }}>
                        パスワードを忘れた場合
                      </Link>
                    </div>
                  </>
                )}

                {tab === "room" && (
                  <>
                    <label style={labelStyle}>ルーム番号</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="ROOM-2026-0001"
                      required
                      style={{
                        ...inputStyle,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    />
                    <label style={labelStyle}>ユーザー名</label>
                    <input
                      type="text"
                      value={roomUsername}
                      onChange={(e) => setRoomUsername(e.target.value)}
                      placeholder="管理者から通知されたユーザー名"
                      required
                      style={inputStyle}
                    />
                    <label style={labelStyle}>発行コード</label>
                    <input
                      type="text"
                      value={issueCode}
                      onChange={(e) => setIssueCode(e.target.value)}
                      placeholder="発行コード"
                      required
                      style={{
                        ...inputStyle,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    />
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        margin: "0 0 16px",
                      }}
                    >
                      ルーム番号や発行コードがわからない場合は、ルームの管理者にお問い合わせください。
                    </p>
                  </>
                )}

                {tab === "quick" && (
                  <>
                    <label style={labelStyle}>
                      ユーザー名（16文字以下）
                    </label>
                    <input
                      type="text"
                      value={quickName}
                      onChange={(e) =>
                        setQuickName(e.target.value.slice(0, 16))
                      }
                      placeholder="あなたの名前"
                      maxLength={16}
                      required
                      style={inputStyle}
                    />
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--ink-soft)",
                        margin: "0 0 8px",
                      }}
                    >
                      後からパスワードを設定して本登録できます。
                    </p>
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--ink-soft)",
                        margin: "0 0 16px",
                      }}
                    >
                      ※ 戦績は端末紐付きの簡易保存です
                    </p>
                  </>
                )}

                {/* CAPTCHA placeholder */}
                <div
                  style={{
                    border: "1px dashed var(--line-2)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    background: "var(--bg-2)",
                    fontSize: 12,
                    color: "var(--ink-soft)",
                    textAlign: "center",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  <span>🤖</span>
                  <span>CAPTCHA 検証エリア（本番時に有効化）</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    background: loading ? "var(--line-2)" : "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    padding: "12px",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {loading ? (
                    <>
                      <span className="pulse">●</span>
                      ログイン中...
                    </>
                  ) : (
                    "ログイン"
                  )}
                </button>

                {tab !== "room" && (
                  <p
                    style={{
                      textAlign: "center",
                      fontSize: 13,
                      marginTop: 16,
                      color: "var(--ink-soft)",
                    }}
                  >
                    アカウントをお持ちでない方は{" "}
                    <Link href="/signup" style={{ color: "var(--p1)" }}>
                      サインアップ
                    </Link>
                  </p>
                )}
              </form>
            </div>
          </div>

          {/* Right: role guide */}
          <div style={{ paddingTop: 48 }}>
            <div
              style={{
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                border: "1px solid var(--line)",
                padding: 20,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                ロール早見表
              </div>
              {[
                { role: "SYSTEM_ADMIN", label: "システム管理者", note: "全ルームを管理", color: "#7c3aed" },
                { role: "ROOM_ADMIN", label: "ルーム管理者", note: "担当ルームを管理", color: "#0891b2" },
                { role: "GENERAL_USER", label: "一般ユーザー", note: "PUBLIC_LOBBYに参加", color: "#4b5563" },
                { role: "ROOM_USER", label: "ルームユーザー", note: "発行コードで参加", color: "#2563eb" },
              ].map((r) => (
                <div
                  key={r.role}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                      {r.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "16px 32px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--ink-soft)",
          background: "var(--bg-2)",
        }}
      >
        <Link href="#" style={{ color: "var(--ink-soft)", marginRight: 16 }}>
          利用規約
        </Link>
        <Link href="#" style={{ color: "var(--ink-soft)" }}>
          プライバシーポリシー
        </Link>
      </footer>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
  marginTop: 12,
  color: "var(--ink)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1.5px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  fontSize: 14,
  background: "var(--surface)",
  color: "var(--ink)",
  outline: "none",
  transition: "border-color 0.15s",
  marginBottom: 4,
};
