"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

interface AdminSidenavProps {
  items: NavItem[];
  scope?: "system" | "room";
  roomName?: string;
  roomNumber?: string;
}

export function AdminSidenav({
  items,
  scope = "system",
  roomName,
  roomNumber,
}: AdminSidenavProps) {
  const pathname = usePathname();
  const accentColor =
    scope === "system" ? "var(--admin-accent)" : "var(--room-admin-accent)";
  const accentSoft =
    scope === "system"
      ? "rgba(124,58,237,0.1)"
      : "rgba(8,145,178,0.1)";

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        minHeight: "calc(100vh - 100px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Room scope header */}
      {scope === "room" && roomName && (
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid var(--line)",
            background: "rgba(8,145,178,0.04)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--room-admin-accent)",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            {roomNumber}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {roomName}
          </div>
        </div>
      )}

      <nav style={{ padding: "8px 0", flex: 1 }}>
        {items.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== "/admin/system" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 16px",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                color: active ? accentColor : "var(--ink)",
                background: active ? accentSoft : "transparent",
                borderLeft: active ? `3px solid ${accentColor}` : "3px solid transparent",
                transition: "all 0.1s",
              }}
            >
              {item.icon && <span style={{ fontSize: 16 }}>{item.icon}</span>}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--line)",
          fontSize: 11,
          color: "var(--ink-soft)",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {scope === "system"
          ? "観戦リンクは各マッチから利用可能"
          : "観戦はマッチカードから可能"}
      </div>
    </aside>
  );
}
