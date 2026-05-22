"use client";

import Link from "next/link";
import { RoleBadge } from "../ui/RoleBadge";
import { UserRole } from "@prisma/client";

interface TopbarAdminProps {
  username?: string;
  displayName?: string;
  role?: UserRole;
  rightContent?: React.ReactNode;
  centerContent?: React.ReactNode;
}

export function TopbarAdmin({
  username,
  displayName,
  role,
  rightContent,
  centerContent,
}: TopbarAdminProps) {
  return (
    <header
      style={{
        background: "var(--admin-bg)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
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
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontFamily: "JetBrains Mono, monospace",
              fontWeight: 700,
              fontSize: 13,
              border: "1px solid rgba(255,255,255,0.15)",
              flexShrink: 0,
            }}
          >
            ⚔
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
            対戦・コーディング
          </span>
        </Link>
        <span
          style={{
            fontSize: "10.5px",
            color: "#c4b5fd",
            fontWeight: 600,
            padding: "2px 8px",
            background: "rgba(124,58,237,0.2)",
            border: "1px solid rgba(124,58,237,0.4)",
            borderRadius: "999px",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          ADMIN
        </span>
      </div>

      {/* Center */}
      <div
        style={{
          textAlign: "center",
          fontWeight: 600,
          fontSize: 15,
          color: "#e5e7eb",
        }}
      >
        {centerContent}
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
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "999px",
                  padding: "4px 12px 4px 4px",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: role === "SYSTEM_ADMIN" ? "#7c3aed" : "#0891b2",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {(displayName ?? username)[0].toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>
                  {displayName ?? username}
                </span>
                {role && <RoleBadge role={role} />}
              </div>
            )}
            <Link
              href="/api/auth/logout"
              style={{
                fontSize: 13,
                color: "#9ca3af",
                textDecoration: "none",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.05)",
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
