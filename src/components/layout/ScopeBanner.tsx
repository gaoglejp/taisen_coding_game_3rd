"use client";

interface ScopeBannerProps {
  variant: "system" | "room";
}

export function ScopeBanner({ variant }: ScopeBannerProps) {
  if (variant === "system") {
    return (
      <div className="scope-banner-system">
        <span style={{ fontSize: 14 }}>🔒</span>
        <span>
          <strong>あなたはシステム管理者として閲覧中です。</strong>
          対戦の具体操作（コーディング・対戦開始・対戦終了）はできません。
        </span>
      </div>
    );
  }

  return (
    <div className="scope-banner-room">
      <span style={{ fontSize: 14 }}>👁</span>
      <span>
        <strong>あなたはルーム管理者として閲覧中です。</strong>
        対戦の具体操作はできません（観戦は可能）。
      </span>
    </div>
  );
}
