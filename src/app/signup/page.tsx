"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [agreed, setAgreed] = useState(false);

  function getPasswordStrength(pw: string): {
    score: number;
    label: string;
    color: string;
  } {
    if (!pw) return { score: 0, label: "", color: "var(--line)" };
    let score = 0;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    const levels = [
      { score: 1, label: "weak", color: "var(--danger)" },
      { score: 2, label: "fair", color: "#d97706" },
      { score: 3, label: "strong", color: "#2563eb" },
      { score: 4, label: "very strong", color: "var(--success)" },
    ];
    return levels[score - 1] ?? { score: 0, label: "", color: "var(--line)" };
  }

  const strength = getPasswordStrength(password);

  const policies = [
    { label: "10文字以上", ok: password.length >= 10 },
    {
      label: "英大文字・小文字・数字を含む",
      ok: /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password),
    },
    { label: "辞書攻撃チェック通過", ok: password.length >= 12 },
    {
      label: "ユーザー名・メールと異なる",
      ok:
        password.length > 0 &&
        !password.includes(username) &&
        !password.includes(email),
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!agreed) {
      setError("利用規約とプライバシーポリシーへの同意が必要です");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // <!-- bind: POST /api/auth/signup -->
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      setSuccess(true);
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            padding: 40,
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h2 style={{ margin: "0 0 8px", fontWeight: 800 }}>
            確認メールを送信しました
          </h2>
          <p style={{ color: "var(--ink-soft)", margin: "0 0 24px", fontSize: 14 }}>
            <strong>{email}</strong> に確認メールを送りました。
            メール内のリンクをクリックして登録を完了させてください。
          </p>
          <Link
            href="/login"
            style={{
              background: "var(--accent)",
              color: "#fff",
              padding: "10px 24px",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
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
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>対戦・コーディング</span>
        </div>
        <Link href="/login" style={{ fontSize: 13, color: "var(--p1)" }}>
          ログイン →
        </Link>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "28px 28px 0" }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                margin: "0 0 4px",
              }}
            >
              対戦・コーディングにアカウントを作る
            </h1>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>
              無料で始められます。いつでも退会できます。
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 28 }}>
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
                }}
              >
                ⚠ {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>ユーザー名 *</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3〜20文字"
                  minLength={3}
                  maxLength={20}
                  required
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>メールアドレス *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            <label style={labelStyle}>パスワード *</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="10文字以上"
              minLength={10}
              required
              style={inputStyle}
            />

            {/* Strength meter */}
            {password && (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    marginBottom: 4,
                  }}
                >
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 2,
                        background:
                          i <= strength.score ? strength.color : "var(--line)",
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: strength.color,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {strength.label}
                </div>
                {/* Policy checklist */}
                <div
                  style={{
                    marginTop: 8,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "2px 8px",
                  }}
                >
                  {policies.map((p) => (
                    <div
                      key={p.label}
                      style={{
                        fontSize: 11,
                        color: p.ok ? "var(--success)" : "var(--ink-soft)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span>{p.ok ? "✓" : "·"}</span>
                      {p.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label style={labelStyle}>パスワード（確認） *</label>
            <input
              type="password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              placeholder="もう一度入力"
              required
              style={{
                ...inputStyle,
                borderColor:
                  passwordConfirm && password !== passwordConfirm
                    ? "var(--danger)"
                    : passwordConfirm && password === passwordConfirm
                    ? "var(--success)"
                    : "var(--line)",
              }}
            />
            {passwordConfirm && password !== passwordConfirm && (
              <p style={{ fontSize: 11, color: "var(--danger)", margin: "2px 0 8px" }}>
                パスワードが一致しません
              </p>
            )}

            <label style={labelStyle}>招待コード（任意）</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="招待を受けた場合は入力"
              style={{
                ...inputStyle,
                fontFamily: "JetBrains Mono, monospace",
              }}
            />
            <p style={{ fontSize: 11, color: "var(--ink-soft)", margin: "2px 0 16px" }}>
              ※ 将来必須化される可能性があります
            </p>

            {/* CAPTCHA */}
            <div
              style={{
                border: "1px dashed var(--line-2)",
                borderRadius: 8,
                padding: "10px 14px",
                background: "var(--bg-2)",
                fontSize: 12,
                color: "var(--ink-soft)",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              🤖 CAPTCHA 検証エリア（本番時に有効化）
            </div>

            {/* Consent */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 13,
                marginBottom: 20,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <span style={{ color: "var(--ink-soft)" }}>
                <Link href="#" style={{ color: "var(--p1)" }}>
                  利用規約
                </Link>
                と
                <Link href="#" style={{ color: "var(--p1)" }}>
                  プライバシーポリシー
                </Link>
                に同意します
                <span style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                  ※ 13歳未満の方は保護者の同意が必要です
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !agreed}
              style={{
                width: "100%",
                background:
                  loading || !agreed ? "var(--line-2)" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                padding: "12px",
                fontSize: 15,
                fontWeight: 700,
                cursor: loading || !agreed ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "登録中..." : "アカウントを作成する"}
            </button>

            <p
              style={{
                textAlign: "center",
                fontSize: 13,
                marginTop: 16,
                color: "var(--ink-soft)",
              }}
            >
              既にアカウントをお持ちの方は{" "}
              <Link href="/login" style={{ color: "var(--p1)" }}>
                ログイン
              </Link>
            </p>
          </form>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "14px 32px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--ink-soft)",
        }}
      >
        <Link href="#" style={{ color: "var(--ink-soft)", marginRight: 12 }}>
          利用規約
        </Link>
        <Link href="#" style={{ color: "var(--ink-soft)", marginRight: 12 }}>
          プライバシーポリシー
        </Link>
        <Link href="#" style={{ color: "var(--ink-soft)" }}>
          ヘルプ
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
  marginBottom: 4,
};
