import Link from "next/link";
import { TopbarPaper } from "@/components/layout/TopbarPaper";

export default function PracticePage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarPaper title="練習モード" />
      <main style={{ maxWidth: 820, margin: "0 auto", padding: "36px 24px" }}>
        <section
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>
              練習モード
            </h1>
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 12,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 999,
              }}
            >
              準備中
            </span>
          </div>
          <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.8, color: "var(--ink-soft)" }}>
            練習モード本体は今後のスコープで実装します。現時点ではダッシュボードの導線を維持しつつ、
            404 を避けるための準備中ページです。
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ダッシュボードへ戻る
            </Link>
            <Link
              href="/rooms"
              style={{
                padding: "9px 14px",
                borderRadius: 8,
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                border: "1px solid var(--line)",
              }}
            >
              対戦ルームを見る
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
