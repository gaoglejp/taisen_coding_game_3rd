"use client";

import { UserRole } from "@prisma/client";

interface RoleBadgeProps {
  role: UserRole;
  size?: "sm" | "md";
}

const roleConfig: Record<
  UserRole,
  { label: string; bg: string; color: string }
> = {
  SYSTEM_ADMIN: {
    label: "SYSTEM ADMIN",
    bg: "rgba(124,58,237,0.12)",
    color: "#7c3aed",
  },
  ROOM_ADMIN: {
    label: "ROOM ADMIN",
    bg: "rgba(8,145,178,0.12)",
    color: "#0891b2",
  },
  GENERAL_USER: {
    label: "GENERAL",
    bg: "rgba(75,85,99,0.1)",
    color: "#4b5563",
  },
  ROOM_USER: {
    label: "ROOM USER",
    bg: "rgba(37,99,235,0.1)",
    color: "#2563eb",
  },
};

export function RoleBadge({ role, size = "sm" }: RoleBadgeProps) {
  const config = roleConfig[role];
  const fontSize = size === "sm" ? "10px" : "12px";
  const padding = size === "sm" ? "2px 7px" : "3px 9px";

  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        fontSize,
        fontWeight: 700,
        padding,
        borderRadius: "999px",
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "0.04em",
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}
