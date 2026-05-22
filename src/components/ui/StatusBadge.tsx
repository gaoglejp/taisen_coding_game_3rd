"use client";

interface StatusBadgeProps {
  status: string;
  variant?: "room" | "match" | "member" | "user";
}

const configs: Record<string, { label: string; bg: string; color: string }> = {
  // Room status
  ACTIVE: { label: "ACTIVE", bg: "#dcfce7", color: "#15803d" },
  ARCHIVED: { label: "ARCHIVED", bg: "#fef3c7", color: "#92400e" },
  DELETED: { label: "DELETED", bg: "#fee2e2", color: "#dc2626" },
  // Match status
  WAITING: { label: "WAITING", bg: "#f3f4f6", color: "#4b5563" },
  CODING: { label: "CODING", bg: "#dbeafe", color: "#1d4ed8" },
  BATTLING: { label: "BATTLING", bg: "#fef3c7", color: "#d97706" },
  FINISHED: { label: "FINISHED", bg: "#dcfce7", color: "#15803d" },
  CANCELED: { label: "CANCELED", bg: "#fee2e2", color: "#dc2626" },
  // Member/User status
  DISABLED: { label: "DISABLED", bg: "#fee2e2", color: "#dc2626" },
  EXPIRED: { label: "EXPIRED", bg: "#fef3c7", color: "#92400e" },
  PENDING: { label: "PENDING", bg: "#f0f9ff", color: "#0369a1" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = configs[status] ?? {
    label: status,
    bg: "#f3f4f6",
    color: "#4b5563",
  };

  return (
    <span
      style={{
        background: config.bg,
        color: config.color,
        fontSize: "11px",
        fontWeight: 700,
        padding: "2px 8px",
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
