"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";

type Tone = "404" | "403" | "500" | "maint" | "maint-interrupt" | "403-admin";

type Variant = {
  tone: Tone;
  code: string;
  glyph: string;
  title: string;
  lead: React.ReactNode;
  /** Severity color token (used by stripe + accents) */
  toneColor: string;
};

const VARIANTS: Record<string, Variant> = {
  "404": {
    tone: "404",
    code: "404",
    glyph: "?",
    title: "お探しのページは見つかりませんでした",
    lead: (
      <>
        URL が変更されたか、削除された可能性があります。
        <br />
        入力ミスでなければ、<strong>ダッシュボード</strong> に戻って探してみてください。
      </>
    ),
    toneColor: "var(--ink-soft)",
  },
  "403": {
    tone: "403",
    code: "403",
    glyph: "!",
    title: "このページにアクセスする権限がありません",
    lead: (
      <>
        必要なロールを持っていません。
        <br />
        担当の <strong>管理者</strong> に依頼してください。
      </>
    ),
    toneColor: "var(--accent)",
  },
  "500": {
    tone: "500",
    code: "500",
    glyph: "!",
    title: "予期しないエラーが発生しました",
    lead: (
      <>
        サーバ側の問題です。少し待ってから <strong>もう一度</strong> お試しください。
        <br />
        繰り返し起きる場合はサポートに連絡してください。
      </>
    ),
    toneColor: "var(--danger)",
  },
  maintenance: {
    tone: "maint",
    code: "メンテナンス中",
    glyph: "🛠",
    title: "現在メンテナンス中です",
    lead: (
      <>
        サービス全体を一時停止しています。
        <br />
        ご不便をおかけしてすみません。終了予定までもう少しお待ちください。
      </>
    ),
    toneColor: "var(--room-admin-accent)",
  },
  websocket: {
    tone: "500",
    code: "切断",
    glyph: "⤬",
    title: "サーバとの接続が切れました",
    lead: (
      <>
        再接続を試みています。
        <br />
        表示中のデータはローカルに保持されています。
      </>
    ),
    toneColor: "var(--danger)",
  },
};

export default function ErrorPage() {
  const params = useParams<{ code: string }>();
  const codeParam = (params?.code ?? "404").toLowerCase();
  const variant = useMemo(
    () => VARIANTS[codeParam] ?? VARIANTS["404"],
    [codeParam]
  );

  const isAdmin = codeParam === "403-admin" || codeParam === "admin";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        backgroundImage:
          "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
        backgroundPosition: "-1px -1px",
        fontFamily:
          '"Plus Jakarta Sans", "Noto Sans JP", system-ui, sans-serif',
        color: "var(--ink)",
      }}
    >
      {/* bind: GET /api/health (general topbar with support link) */}
      {isAdmin ? (
        <>
          <TopbarAdmin username="admin_sys" displayName="管理者" role="SYSTEM_ADMIN" />
          <ScopeBanner variant="system" />
        </>
      ) : (
        <TopbarPaper
          rightContent={
            <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              お困りですか?{" "}
              <Link
                href="/error/500"
                style={{
                  color: "var(--p1-ink, #1e3a8a)",
                  textDecoration: "none",
                  fontWeight: 600,
                  borderBottom: "1px dashed var(--p1-ink, #1e3a8a)",
                }}
              >
                サポート
              </Link>
            </div>
          }
        />
      )}

      {/* ============ Primary hero view ============ */}
      <HeroCard variant={variant} />

      {/* ============ Inline WS banners (disconnect / reconnected) ============ */}
      {/* WS disconnect / reconnect */}
      <WsBanners />

    </div>
  );
}

/* =========================================================
 * Hero card (main view)
 * ========================================================= */
function HeroCard({ variant }: { variant: Variant }) {
  const toneStyles = getToneStyles(variant.tone);

  return (
    <section
      aria-label={`エラー画面 (${variant.code} メインビュー)`}
      style={{ padding: "60px 24px 32px", display: "flex", justifyContent: "center" }}
    >
      <article
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          boxShadow:
            "0 12px 32px rgba(31,35,48,.08), 0 2px 6px rgba(31,35,48,.04)",
          maxWidth: 640,
          width: "100%",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Stripe */}
        <div
          aria-hidden
          style={{ height: 6, background: variant.toneColor }}
        />

        <div style={{ padding: "40px 44px 32px", textAlign: "center" }}>
          {/* Code mark */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "baseline",
              gap: 12,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: variant.tone === "maint" ? 30 : 78,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-.04em",
              marginBottom: 10,
              color: toneStyles.codeColor,
            }}
          >
            <span
              aria-hidden
              style={{
                display: "inline-grid",
                placeItems: "center",
                width: 78,
                height: 78,
                borderRadius: 20,
                fontSize: 38,
                color: "#fff",
                border: "3px solid #fff",
                boxShadow:
                  "0 6px 16px rgba(31,35,48,.18), inset 0 -4px 0 rgba(0,0,0,.18)",
                background: variant.toneColor,
              }}
            >
              {variant.glyph}
            </span>
            {variant.code}
          </div>

          <h1
            style={{
              margin: "12px 0 8px",
              fontSize: 24,
              letterSpacing: "-.01em",
              lineHeight: 1.3,
            }}
          >
            {variant.title}
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "var(--ink-soft)",
              lineHeight: 1.6,
              maxWidth: 480,
              margin: "0 auto",
            }}
          >
            {variant.lead}
          </p>

          {/* Variant-specific detail */}
          {variant.tone === "404" && <DetailBox404 />}
          {variant.tone === "403" && <RoleCompare />}
          {variant.tone === "500" && <DetailBox500 />}
          {variant.tone === "maint" && <MaintCountdown />}

          {/* CTA row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 12,
              flexWrap: "wrap",
              marginTop: 26,
            }}
          >
            {variant.tone === "404" && (
              <>
                <Link href="/dashboard" style={btnPrimary("var(--accent)", "#c2740a")}>
                  ⌂ ダッシュボードへ戻る
                </Link>
                <Link href="/login" style={btnSecondary}>
                  ログイン画面へ
                </Link>
                <Link href="/error/500" style={btnSecondary}>
                  サポートに連絡
                </Link>
              </>
            )}
            {variant.tone === "403" && (
              <>
                <Link href="/dashboard" style={btnPrimary("var(--accent)", "#c2740a")}>
                  ⌂ ダッシュボードへ戻る
                </Link>
                <Link href="/error/500" style={btnSecondary}>
                  管理者に連絡
                </Link>
              </>
            )}
            {variant.tone === "500" && (
              <>
                <Link href="/dashboard" style={btnPrimary("var(--danger)", "#991b1b")}>
                  ⌂ ホームへ戻る
                </Link>
                <Link href="/error/500" style={btnSecondary}>
                  サポートに連絡
                </Link>
              </>
            )}
            {variant.tone === "maint" && (
              <button style={btnPrimary("var(--room-admin-accent)", "#0e7490")}>
                ↻ 状態を再取得
              </button>
            )}
          </div>

          {/* Trace ID for 404 / 500 */}
          {(variant.tone === "404" || variant.tone === "500") && (
            <div
              style={{
                marginTop: 18,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11.5,
                color: "var(--ink-soft)",
                textAlign: "center",
              }}
            >
              trace:{" "}
              <code
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--line)",
                  padding: "2px 7px",
                  borderRadius: 5,
                  color: "var(--ink)",
                  marginLeft: 4,
                }}
              >
                {variant.tone === "404"
                  ? "trc_a7f2_404_2026052214321"
                  : "trc_500_a7f29k3m_2026052214321"}
              </code>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function DetailBox404() {
  return (
    <div style={detailBoxStyle}>
      <div style={detailRow}>
        <span style={detailKey}>{"// path"}</span>
        <span style={detailValMono}>/match/M-99999/coding</span>
      </div>
      <div style={{ ...detailRow, borderBottom: "none" }}>
        <span style={detailKey}>{"// reason"}</span>
        <span style={detailVal}>
          対象のマッチが存在しません。発行されていないか、削除されました。
        </span>
      </div>
    </div>
  );
}

function DetailBox500() {
  return (
    <div style={detailBoxStyle}>
      <div style={detailRow}>
        <span style={detailKey}>{"// when"}</span>
        <span style={detailVal}>2026-05-22 14:32:01 JST</span>
      </div>
      <div style={{ ...detailRow, borderBottom: "none" }}>
        <span style={detailKey}>{"// reason"}</span>
        <span style={detailVal}>
          サーバ内部で予期しない問題が発生しました。再試行か、サポートへの連絡をお願いします。
        </span>
      </div>
    </div>
  );
}

function RoleCompare() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 480,
        margin: "22px auto 0",
      }}
    >
      <div style={roleLine}>
        <span style={roleLineLbl}>{"// あなた"}</span>
        <span style={{ flex: 1 }}>
          <span style={rolePill("var(--p1-soft, #dbeafe)", "var(--p1-ink, #1e3a8a)", "#bfd5fa")}>
            ROOM_USER
          </span>
        </span>
      </div>
      <div style={roleLine}>
        <span style={roleLineLbl}>{"// 必要"}</span>
        <span style={{ flex: 1 }}>
          <span
            style={rolePill(
              "var(--room-admin-accent-soft, #cffafe)",
              "var(--room-admin-accent-ink, #155e75)",
              "#a5f3fc"
            )}
          >
            ROOM_ADMIN
          </span>
        </span>
      </div>
    </div>
  );
}

function MaintCountdown() {
  return (
    <div
      style={{
        margin: "22px auto 0",
        maxWidth: 480,
        background: "linear-gradient(180deg, #f0fdfa, #ecfeff)",
        border: "1px solid #99f6e4",
        borderRadius: 14,
        padding: "18px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10.5,
          color: "var(--room-admin-accent-ink, #155e75)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 6,
        }}
      >
        {"// 終了予定まで"}
      </div>
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 36,
          fontWeight: 800,
          color: "var(--room-admin-accent-ink, #155e75)",
          letterSpacing: "-.01em",
          lineHeight: 1,
        }}
      >
        01:23:45
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--room-admin-accent-ink, #155e75)",
          marginTop: 6,
        }}
      >
        予定終了: <strong>2026-05-22 16:00 JST</strong>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "rgba(255,255,255,.6)",
          border: "1px solid #99f6e4",
          borderRadius: 999,
          padding: "4px 10px",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          color: "var(--room-admin-accent-ink, #155e75)",
          fontWeight: 700,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10,
            height: 10,
            border: "2px solid rgba(8,145,178,.18)",
            borderTopColor: "var(--room-admin-accent)",
            borderRadius: "50%",
            animation: "err-spin .8s linear infinite",
            display: "inline-block",
          }}
        />
        自動再試行中
      </div>
      <style>{`@keyframes err-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* =========================================================
 * WebSocket banners (disconnected + reconnected)
 * ========================================================= */
function WsBanners() {
  const [showReconnected, setShowReconnected] = useState(true);

  return (
    <section
      aria-label="ページ内バナー (WS 切断)"
      style={{ maxWidth: 1280, margin: "12px auto 0", padding: "28px 24px 8px" }}
    >
      {/* WS disconnect */}
      <div style={bannerHead}>{"// inline banner — WebSocket disconnect"}</div>
      <div
        role="alert"
        style={{
          background: "linear-gradient(180deg, #fff, #fef5f5)",
          border: "1px solid var(--danger)",
          borderRadius: 12,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 6px 18px rgba(220,38,38,.10)",
          maxWidth: 760,
          margin: "0 auto 14px",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "var(--danger)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          ⤬
        </div>
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <strong
            style={{
              display: "block",
              fontWeight: 700,
              fontSize: 14,
              color: "var(--ink)",
              marginBottom: 2,
            }}
          >
            サーバとの接続が切れました
          </strong>
          <span>
            再接続を試みています。表示中のデータはローカルに保持されています。
          </span>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11.5,
              color: "var(--ink-soft)",
              marginTop: 4,
            }}
          >
            <BounceDots color="var(--danger)" />
            再接続中… (試行 <strong style={{ color: "var(--ink)" }}>3</strong> / 5) ·
            次の試行まで <strong style={{ color: "var(--ink)" }}>00:04</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              ...wsActionBtn,
              background: "var(--danger)",
              color: "#fff",
              borderColor: "var(--danger)",
            }}
          >
            ↻ いま再接続
          </button>
          <button style={wsActionBtn}>詳細</button>
        </div>
      </div>

      {/* WS reconnected */}
      {showReconnected && (
        <>
          <div style={{ ...bannerHead, borderTop: "none", paddingTop: 0, marginTop: 6 }}>
            {"// inline banner — reconnected (auto)"}
          </div>
          <div
            role="status"
            style={{
              background: "linear-gradient(180deg, #fdfdf8, #fbf6e7)",
              border: "1px solid var(--accent)",
              borderRadius: 12,
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              boxShadow: "0 6px 18px rgba(245,158,11,.10)",
              maxWidth: 760,
              margin: "0 auto 14px",
            }}
          >
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "var(--success, #15803d)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ✓
            </div>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
              <strong
                style={{
                  display: "block",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "var(--success, #15803d)",
                  marginBottom: 2,
                }}
              >
                サーバに再接続しました
              </strong>
              <span>
                切断中に受信できなかったイベントを 1.2 秒で同期しました。続けて操作できます。
              </span>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11.5,
                  color: "var(--ink-soft)",
                  marginTop: 4,
                }}
              >
                sync: <strong style={{ color: "var(--ink)" }}>3 events</strong> · latency 142 ms
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowReconnected(false)} style={wsActionBtn}>
                閉じる
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function BounceDots({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ display: "inline-flex", gap: 4, alignItems: "center", marginRight: 4 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
            animation: "ws-bounce 1.2s ease-in-out infinite",
            animationDelay: `${i * 0.15}s`,
            display: "inline-block",
          }}
        />
      ))}
      <style>{`
        @keyframes ws-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 1; }
          30% { transform: translateY(-3px); opacity: .5; }
        }
      `}</style>
    </span>
  );
}

/* =========================================================
 * State gallery — all variants
 * ========================================================= */

/* =========================================================
 * Style helpers
 * ========================================================= */
function getToneStyles(tone: Tone): { codeColor: string } {
  switch (tone) {
    case "404":
      return { codeColor: "var(--ink)" };
    case "403":
    case "403-admin":
      return { codeColor: "#7c2d12" };
    case "500":
      return { codeColor: "var(--p2-ink, #7f1d1d)" };
    case "maint":
    case "maint-interrupt":
      return { codeColor: "var(--room-admin-accent-ink, #155e75)" };
  }
}

function btnPrimary(bg: string, shadowColor: string): React.CSSProperties {
  return {
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: `0 2px 0 ${shadowColor}, 0 6px 12px rgba(0,0,0,.08)`,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
  };
}

const btnSecondary: React.CSSProperties = {
  background: "#fff",
  color: "var(--ink)",
  border: "1px solid var(--line-2, #d8d3c2)",
  borderRadius: 10,
  padding: "11px 20px",
  fontSize: 13.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  textDecoration: "none",
};

const detailBoxStyle: React.CSSProperties = {
  margin: "22px auto 0",
  maxWidth: 480,
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "14px 16px",
  textAlign: "left",
  fontSize: 12.5,
  color: "var(--ink-soft)",
  lineHeight: 1.6,
};

const detailRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "110px 1fr",
  gap: 12,
  padding: "4px 0",
  borderBottom: "1px dashed var(--line)",
};

const detailKey: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10.5,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: ".04em",
};

const detailVal: React.CSSProperties = { color: "var(--ink)", fontWeight: 500 };
const detailValMono: React.CSSProperties = {
  ...detailVal,
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 12,
};

const roleLine: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  background: "var(--bg)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "10px 12px",
  textAlign: "left",
};

const roleLineLbl: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10.5,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: ".04em",
  width: 90,
  flexShrink: 0,
};

function rolePill(
  bg: string,
  color: string,
  border: string,
  mini = false
): React.CSSProperties {
  return {
    fontFamily: "JetBrains Mono, monospace",
    fontSize: mini ? 8.5 : 10,
    fontWeight: 700,
    padding: mini ? "1px 5px" : "3px 8px",
    borderRadius: 4,
    border: `1px solid ${border}`,
    letterSpacing: ".04em",
    background: bg,
    color,
    display: "inline-block",
  };
}

const bannerHead: React.CSSProperties = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 11.5,
  color: "var(--ink-soft)",
  textTransform: "uppercase",
  letterSpacing: ".06em",
  marginBottom: 10,
  borderTop: "1px dashed var(--line)",
  paddingTop: 22,
};

const wsActionBtn: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid var(--line-2, #d8d3c2)",
  background: "#fff",
  color: "var(--ink)",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

