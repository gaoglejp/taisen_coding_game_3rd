"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UserRole } from "@prisma/client";

// Room-picker index. The dashboard's "⚔ 対戦ルームに入る" CTA and the
// empty-state "ルームを探す" link both point here; per-room navigation then
// goes to /rooms/[roomNumber]. Data is the same `/api/rooms/visible` the
// dashboard uses.

interface Room {
  id: string;
  name: string;
  roomNumber: string;
  kind: "CLASSROOM" | "TOURNAMENT" | "PUBLIC_LOBBY";
  status: string;
  matchCount: number;
}

const T = {
  bg: "#f6f4ee",
  surface: "#ffffff",
  line: "#e7e3d6",
  ink: "#1f2330",
  inkSoft: "#4b5563",
};

function roomKindConfig(kind: Room["kind"]) {
  if (kind === "CLASSROOM") return { label: "CLASSROOM", bg: "rgba(13,148,136,.12)", color: "#0d9488" };
  if (kind === "TOURNAMENT") return { label: "TOURNAMENT", bg: "rgba(126,34,206,.12)", color: "#7e22ce" };
  return { label: "PUBLIC LOBBY", bg: "rgba(245,158,11,.12)", color: "#b45309" };
}

export default function RoomsIndexPage() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [me, setMe] = useState<{ username?: string; displayName?: string | null; role?: UserRole } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetch("/api/me", { credentials: "include" }),
      fetch("/api/rooms/visible", { credentials: "include" }),
    ]).then(async ([meRes, roomsRes]) => {
      if (cancelled) return;
      if (meRes.status === "fulfilled" && meRes.value.ok) {
        const data = await meRes.value.json();
        if (data?.user) setMe({ username: data.user.username, displayName: data.user.displayName, role: data.user.role });
      }
      if (roomsRes.status === "fulfilled" && roomsRes.value.ok) {
        const data = await roomsRes.value.json();
        setRooms(data.rooms ?? []);
      } else {
        setError("ルーム一覧を取得できませんでした");
        setRooms([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <TopbarPaper username={me?.username} displayName={me?.displayName ?? undefined} role={me?.role} />
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "28px 24px 48px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: T.ink }}>⚔ 対戦ルーム</h1>
          <Link href="/dashboard" style={{ fontSize: 13, color: T.inkSoft, textDecoration: "none" }}>
            ← ダッシュボード
          </Link>
        </div>

        {rooms === null ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, height: 150 }} className="skeleton" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 28, textAlign: "center", color: T.inkSoft, fontSize: 14 }}>
            {error ?? "参加できるルームがありません。ルーム管理者に招待を依頼してください。"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px,1fr))", gap: 14 }}>
            {rooms.map((room) => {
              const kc = roomKindConfig(room.kind);
              return (
                <div key={room.id} style={{ background: T.surface, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{room.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: kc.bg, color: kc.color, fontFamily: "JetBrains Mono, monospace" }}>{kc.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: T.inkSoft, fontFamily: "JetBrains Mono, monospace", background: T.bg, border: `1px solid ${T.line}`, borderRadius: 6, padding: "2px 8px" }}>
                      #{room.roomNumber}
                    </span>
                    <StatusBadge status={room.status} />
                  </div>
                  <div style={{ fontSize: 12, color: T.inkSoft }}>{room.matchCount} 対戦</div>
                  <Link
                    href={`/rooms/${room.roomNumber}`}
                    style={{ marginTop: 2, display: "block", textAlign: "center", padding: "8px 0", borderRadius: 8, border: `1px solid ${T.line}`, background: T.bg, fontSize: 13, fontWeight: 700, color: T.ink, textDecoration: "none" }}
                  >
                    入室する
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
