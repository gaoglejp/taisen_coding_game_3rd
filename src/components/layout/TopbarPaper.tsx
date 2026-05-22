"use client";

import Link from "next/link";
import { RoleBadge } from "../ui/RoleBadge";
import { UserRole } from "@prisma/client";

interface TopbarPaperProps {
  title?: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  rightContent?: React.ReactNode;
  centerContent?: React.ReactNode;
}

export function TopbarPaper({
  title,
  username,
  displayName,
  role,
  rightContent,
  centerContent,
}: TopbarPaperProps) {
  return (
    <header
      style={{
        background: "linear-gradient(180deg, #fbf8ef, #f6f1e2)",
        borderBottom: "1px solid var(--line)",
        padding: "14px 32px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "24px",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Brand */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Link
          href="/dashboard"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "var(--ink)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: 13,
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,.25)",
              flexShrink: 0,
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 15 }}>対戦・コーディング</span>
        </Link>
        <span
          style={{
            fontSize: "10.5px",
            color: "#92400e",
            fontWeight: 600,
            padding: "2px 8px",
            background: "var(--accent-soft)",
            border: "1px solid #f3d27d",
            borderRadius: "999px",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          v0.2
        </span>
      </div>

      {/* Center */}
      <div style={{ textAlign: "center", fontWeight: 600, fontSize: 15 }}>
        {centerContent ?? title}
      </div>

      {/* Right: User */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          justifyContent: "flex-end",
        }}
      >
        {rightContent ?? (
          <>
            {username && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "999px",
                  padding: "4px 12px 4px 4px",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "var(--p1-soft)",
                    color: "var(--p1-ink)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(displayName ?? username)[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {displayName ?? username}
                </span>
                {role && <RoleBadge role={role} />}
              </div>
            )}
            <Link
              href="/api/auth/logout"
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--surface)",
              }}
            >
              ログアウト
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
