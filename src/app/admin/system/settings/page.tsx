import Link from "next/link";
import { AdminSidenav } from "@/components/layout/AdminSidenav";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";

const SYSTEM_NAV = [
  { label: "ホーム", href: "/admin/system", icon: "🏠" },
  { label: "ルーム", href: "/admin/system/rooms", icon: "🏫" },
  { label: "アカウント", href: "/admin/system/users", icon: "👥" },
  { label: "監査ログ", href: "/admin/system/audit", icon: "📋" },
  { label: "設定", href: "/admin/system/settings", icon: "⚙" },
];

export default function SystemSettingsPage() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <TopbarAdmin username="admin_sys" displayName="システム管理者" role="SYSTEM_ADMIN" />
      <ScopeBanner variant="system" />
      <div style={{ display: "flex" }}>
        <AdminSidenav items={SYSTEM_NAV} scope="system" />
        <main style={{ flex: 1, padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: 0 }}>
              システム設定
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

          <section
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: "24px",
              maxWidth: 720,
            }}
          >
            <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>
              設定画面は準備中です
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, lineHeight: 1.8, color: "var(--ink-soft)" }}>
              システム設定は v0.2 では未実装です。ナビゲーション先としては残し、実装範囲が固まるまで
              404 にならない最小ページにしています。
            </p>
            <Link
              href="/admin/system/rooms"
              style={{
                display: "inline-block",
                padding: "9px 14px",
                borderRadius: 8,
                background: "var(--admin-accent, #7c3aed)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ルーム管理へ戻る
            </Link>
          </section>
        </main>
      </div>
    </div>
  );
}
