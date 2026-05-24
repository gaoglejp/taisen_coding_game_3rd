"use client";

import { use, useCallback, useEffect, useState } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";

type Announcement = { id: string; title: string; body: string; pinned: boolean; createdAt: string; authorName: string };

export default function RoomAnnouncementsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "お知らせ", href: `/admin/rooms/${roomId}/announcements`, icon: "📢" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];
  const [roomName, setRoomName] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [list, setList] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/announcements`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "取得失敗");
        setLoading(false);
        return;
      }
      setRoomName(data.room?.name ?? "");
      setRoomNumber(data.room?.roomNumber ?? "");
      setList(data.announcements ?? []);
      setError(null);
    } catch {
      setError("取得失敗");
    } finally {
      setLoading(false);
    }
  }, [roomId]);
  useEffect(() => {
    const id = setTimeout(() => { void reload(); }, 0);
    return () => clearTimeout(id);
  }, [reload]);

  async function createAnnouncement() {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/announcements`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, body, pinned }) });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setActionError(d?.error ?? "作成失敗");
        return;
      }
      setTitle("");
      setBody("");
      setPinned(false);
      await reload();
    } catch {
      setActionError("作成失敗");
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
    <TopbarAdmin username="suzuki_h" displayName="鈴木 花子" role="ROOM_ADMIN" />
    <ScopeBanner variant="room" />
    <div style={{ display: "flex" }}>
      <AdminSidenav items={ROOM_NAV} scope="room" roomName={roomName} roomNumber={roomNumber} />
      <main style={{ flex: 1, padding: 32 }}>
        <h1 style={{ marginTop: 0 }}>お知らせ</h1>
        {error && <p style={{ color: "#dc2626" }}>{error}</p>}
        {actionError && <p style={{ color: "#dc2626" }}>{actionError}</p>}
        <div style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: "100%", marginBottom: 8 }} disabled={busy} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="本文" style={{ width: "100%", minHeight: 100 }} disabled={busy} />
          <label><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} disabled={busy} /> ピン留め</label>
          <button onClick={() => void createAnnouncement()} disabled={busy || !title.trim() || !body.trim()} style={{ marginLeft: 8 }}>作成</button>
        </div>
        {loading ? <p>読み込み中…</p> : list.length === 0 ? <p>お知らせはまだありません。</p> : list.map((a) => (
          <article key={a.id} style={{ border: `1px solid ${a.pinned ? "var(--admin-accent)" : "var(--line)"}`, background: "var(--surface)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{a.pinned ? "📌 " : ""}{a.title}</strong>
              <div>
                <button disabled={busy} onClick={async () => {
                  setBusy(true);
                  setActionError(null);
                  try {
                    const res = await fetch(`/api/admin/rooms/${roomId}/announcements/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !a.pinned }) });
                    if (!res.ok) {
                      const d = await res.json().catch(() => null);
                      setActionError(d?.error ?? "更新失敗");
                      return;
                    }
                    await reload();
                  } catch {
                    setActionError("更新失敗");
                  } finally {
                    setBusy(false);
                  }
                }}>{a.pinned ? "ピン解除" : "ピン"}</button>
                <button disabled={busy} onClick={async () => {
                  if (!confirm("削除しますか？")) return;
                  setBusy(true);
                  setActionError(null);
                  try {
                    const res = await fetch(`/api/admin/rooms/${roomId}/announcements/${a.id}`, { method: "DELETE" });
                    if (!res.ok) {
                      const d = await res.json().catch(() => null);
                      setActionError(d?.error ?? "削除失敗");
                      return;
                    }
                    await reload();
                  } catch {
                    setActionError("削除失敗");
                  } finally {
                    setBusy(false);
                  }
                }}>削除</button>
              </div>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
            <small>{new Date(a.createdAt).toLocaleString()} / {a.authorName}</small>
          </article>
        ))}
      </main>
    </div>
  </div>;
}
