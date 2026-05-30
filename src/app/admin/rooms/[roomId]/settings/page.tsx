"use client";

import { useState, useEffect, use } from "react";
import { TopbarAdmin } from "@/components/layout/TopbarAdmin";
import { ScopeBanner } from "@/components/layout/ScopeBanner";
import { AdminSidenav } from "@/components/layout/AdminSidenav";

/* ============================================================
   Room settings page — ROOM_ADMIN only

   bind: GET    /admin/api/rooms/:id
   bind: PATCH  /admin/api/rooms/:id
   bind: POST   /admin/api/rooms/:id/archive
   bind: POST   /admin/api/rooms/:id/restore
   bind: DELETE /admin/api/rooms/:id
   ============================================================ */

type Kind = "CLASSROOM" | "TOURNAMENT" | "PUBLIC_LOBBY";
type UnsupportedPolicy = "ALLOW" | "WARN" | "BLOCK";
type Visibility = "PUBLIC" | "MEMBERS" | "PRIVATE";
type ItemKey = "CROSS_ATTACK" | "BARRIER" | "REPEAT_ACTIONS";

interface ItemConfig {
  enabled: boolean;
  spawnStartTurn?: number;
  spawnChance?: number;
  maxOnBoard?: number;
}

interface RoomSettings {
  id: string;
  name: string;
  description: string;
  kind: Kind;
  deadline: string;
  rule: {
    width: number;
    height: number;
    maxTurn: number;
    apPerTurn: number;
    scanRange: number;
    obstacles: number;
    seed: string;
    items: Record<ItemKey, ItemConfig>;
  };
  coding: {
    codingTimeLimitSec: number;
    unsupportedBlockPolicy: UnsupportedPolicy;
  };
  visibility: {
    spectate: Visibility;
    standings: Visibility;
    replayShare: boolean;
  };
  status: "ACTIVE" | "ARCHIVED";
}

const DEFAULT_SETTINGS: RoomSettings = {
  id: "ROOM-2026-0142",
  name: "3-A クラス・5月課題",
  description:
    "5 月の課題ルームです。提出期限までに 3 試合をこなしてください。再戦は何度でも可能。",
  kind: "CLASSROOM",
  deadline: "2026-05-31 23:59",
  rule: {
    width: 10,
    height: 10,
    maxTurn: 20,
    apPerTurn: 2,
    scanRange: 3,
    obstacles: 9,
    seed: "",
    items: {
      CROSS_ATTACK: { enabled: true, spawnStartTurn: 4, spawnChance: 0.2, maxOnBoard: 2 },
      BARRIER: { enabled: true, spawnStartTurn: 6, spawnChance: 0.15, maxOnBoard: 1 },
      REPEAT_ACTIONS: { enabled: false },
    },
  },
  coding: {
    codingTimeLimitSec: 300,
    unsupportedBlockPolicy: "WARN",
  },
  visibility: {
    spectate: "MEMBERS",
    standings: "MEMBERS",
    replayShare: true,
  },
  status: "ACTIVE",
};

const TEAL = "var(--room-admin-accent)";
const TEAL_INK = "var(--room-admin-accent-ink)";
const TEAL_SOFT = "var(--room-admin-accent-soft)";

// Schema stores watchingPublic/rankingPublic as free strings; the meaningful
// values used by the access checks are PUBLIC / MEMBERS_ONLY / DISABLED. The
// settings UI models them as PUBLIC / MEMBERS / PRIVATE.
function toVisibility(v: string | null | undefined): Visibility {
  if (v === "PUBLIC") return "PUBLIC";
  if (v === "DISABLED") return "PRIVATE";
  return "MEMBERS";
}
function fromVisibility(v: Visibility): string {
  if (v === "PUBLIC") return "PUBLIC";
  if (v === "PRIVATE") return "DISABLED";
  return "MEMBERS_ONLY";
}
function toDeadlineInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

interface ApiRoom {
  id: string;
  roomNumber: string;
  name: string;
  description: string | null;
  kind: Kind;
  status: "ACTIVE" | "ARCHIVED" | "DELETED";
  expiresAt: string | null;
  rulePreset: Record<string, unknown> | null;
  watchingPublic: string;
  rankingPublic: string;
  replayShareEnabled: boolean;
}

// Build the form model from the API room. Rule/coding/items live in the
// freeform rulePreset blob (still simulator-inert), so they fall back to the
// defaults when the preset is empty.
function settingsFromApi(room: ApiRoom): RoomSettings {
  const preset = (room.rulePreset ?? {}) as Partial<RoomSettings["rule"]> & {
    items?: RoomSettings["rule"]["items"];
    coding?: RoomSettings["coding"];
  };
  return {
    id: room.roomNumber,
    name: room.name,
    description: room.description ?? "",
    kind: room.kind,
    deadline: toDeadlineInput(room.expiresAt),
    rule: {
      width: preset.width ?? DEFAULT_SETTINGS.rule.width,
      height: preset.height ?? DEFAULT_SETTINGS.rule.height,
      maxTurn: preset.maxTurn ?? DEFAULT_SETTINGS.rule.maxTurn,
      apPerTurn: preset.apPerTurn ?? DEFAULT_SETTINGS.rule.apPerTurn,
      scanRange: preset.scanRange ?? DEFAULT_SETTINGS.rule.scanRange,
      obstacles: preset.obstacles ?? DEFAULT_SETTINGS.rule.obstacles,
      seed: preset.seed ?? "",
      items: preset.items ?? DEFAULT_SETTINGS.rule.items,
    },
    coding: preset.coding ?? DEFAULT_SETTINGS.coding,
    visibility: {
      spectate: toVisibility(room.watchingPublic),
      standings: toVisibility(room.rankingPublic),
      replayShare: room.replayShareEnabled,
    },
    status: room.status === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
  };
}

export default function RoomSettingsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);

  const ROOM_NAV = [
    { label: "概要", href: `/admin/rooms/${roomId}`, icon: "📊" },
    { label: "メンバー", href: `/admin/rooms/${roomId}/members`, icon: "👥" },
    { label: "マッチカード", href: `/admin/rooms/${roomId}/matches`, icon: "⚔" },
    { label: "成績", href: `/admin/rooms/${roomId}/standings`, icon: "🏆" },
    { label: "お知らせ", href: `/admin/rooms/${roomId}/announcements`, icon: "📢" },
    { label: "設定", href: `/admin/rooms/${roomId}/settings`, icon: "⚙" },
  ];

  // form state — populated from the API on mount. Starts as null so we can
  // show a loading state and never flash mock defaults at the user.
  const [s, setS] = useState<RoomSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState({ basic: 0, rule: 0, coding: 0, visibility: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string[] | null>(null);
  const [fieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/rooms/${roomId}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setLoadError(
            res.status === 403
              ? "このページはシステム管理者のみ利用できます。"
              : data?.error ?? "ルーム設定を取得できませんでした"
          );
          return;
        }
        const data = await res.json();
        setS(settingsFromApi(data.room as ApiRoom));
        setLoadError(null);
      })
      .catch(() => {
        if (!cancelled) setLoadError("ルーム設定を取得できませんでした");
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const archived = s?.status === "ARCHIVED";
  const totalDirty = dirty.basic + dirty.rule + dirty.coding + dirty.visibility;
  const isDirty = totalDirty > 0;
  const readOnly = archived;

  const markDirty = (key: keyof typeof dirty) => {
    setDirty((d) => ({ ...d, [key]: d[key] + 1 }));
  };

  const handleSave = async () => {
    if (!s) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: s.name,
          description: s.description,
          kind: s.kind,
          expiresAt: s.deadline ? new Date(s.deadline.replace(" ", "T")).toISOString() : null,
          watchingPublic: fromVisibility(s.visibility.spectate),
          rankingPublic: fromVisibility(s.visibility.standings),
          replayShareEnabled: s.visibility.replayShare,
          // Rule/coding/items persist in rulePreset; the simulator doesn't read
          // them yet (post-v0.2), but they round-trip through this form.
          rulePreset: { ...s.rule, coding: s.coding },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setSaveError([data?.error ?? "保存に失敗しました"]);
        return;
      }
      const data = await res.json();
      setS(settingsFromApi(data.room as ApiRoom));
      setDirty({ basic: 0, rule: 0, coding: 0, visibility: 0 });
    } catch {
      setSaveError(["保存に失敗しました"]);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDirty({ basic: 0, rule: 0, coding: 0, visibility: 0 });
    // Re-fetch to drop unsaved edits.
    fetch(`/api/admin/rooms/${roomId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.room && setS(settingsFromApi(data.room as ApiRoom)))
      .catch(() => {});
  };

  const handleResetRules = () => {
    setS((cur) => (cur ? { ...cur, rule: DEFAULT_SETTINGS.rule } : cur));
    markDirty("rule");
  };

  const handleArchive = async () => {
    const res = await fetch(`/api/admin/rooms/${roomId}/archive`, { method: "POST" });
    if (res.ok) setS((cur) => (cur ? { ...cur, status: "ARCHIVED" } : cur));
  };

  const handleRestore = async () => {
    const res = await fetch(`/api/admin/rooms/${roomId}/restore`, { method: "POST" });
    if (res.ok) setS((cur) => (cur ? { ...cur, status: "ACTIVE" } : cur));
  };

  const handleDelete = async () => {
    if (!s) return;
    const entered = window.prompt(`削除するにはルーム番号「${s.id}」を入力してください。`);
    if (entered !== s.id) return;
    const res = await fetch(`/api/admin/rooms/${roomId}`, { method: "DELETE" });
    if (res.ok) {
      window.location.href = "/admin/system/rooms";
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>{loadError}</div>
    );
  }
  if (!s) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--ink-soft)" }}>読み込み中…</div>;
  }

  const dirtyParts: string[] = [];
  if (dirty.basic) dirtyParts.push(`基本情報(${dirty.basic})`);
  if (dirty.rule) dirtyParts.push(`ルール(${dirty.rule})`);
  if (dirty.coding) dirtyParts.push(`コーディング(${dirty.coding})`);
  if (dirty.visibility) dirtyParts.push(`公開設定(${dirty.visibility})`);

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", paddingBottom: 80 }}>
      <TopbarAdmin
        username="nakamura.sensei"
        displayName="中村 先生"
        role="ROOM_ADMIN"
      />
      <ScopeBanner variant="room" />
      <div style={{ display: "flex" }}>
        <AdminSidenav
          items={ROOM_NAV}
          scope="room"
          roomName={s.name}
          roomNumber={s.id}
        />
        <main
          style={{
            flex: 1,
            padding: "24px 32px 32px",
            maxWidth: 1040,
            minWidth: 0,
          }}
        >
          {/* Page head */}
          <header style={{ marginBottom: 20 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                letterSpacing: "-0.01em",
                fontWeight: 800,
                color: "var(--ink)",
              }}
            >
              設定
            </h1>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-soft)",
                marginTop: 4,
              }}
            >
              ルームのルール・期限・公開・アーカイブをチューニングします。変更は下部「変更を保存」で反映されます。
            </div>
          </header>

          {/* Archived banner */}
          {archived && (
            <div
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--line-2)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 12.5,
                color: "var(--ink-soft)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: "var(--ink-soft)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 11,
                  flexShrink: 0,
                }}
              >
                📦
              </div>
              <div>
                <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
                  このルームはアーカイブされています。
                </strong>{" "}
                すべての設定は読み取り専用です。復元するには下部「管理メンテ」から操作してください。
              </div>
            </div>
          )}

          {/* Top error banner (save fail) */}
          {saveError && saveError.length > 0 && (
            <div
              style={{
                background: "var(--danger-soft)",
                border: "1px solid #fbb6b6",
                color: "var(--p2-ink)",
                borderRadius: 12,
                padding: "12px 16px",
                marginBottom: 16,
                display: "flex",
                gap: 12,
                alignItems: "flex-start",
                fontSize: 13,
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: "var(--danger)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                }}
              >
                !
              </div>
              <div>
                <strong
                  style={{
                    display: "block",
                    fontWeight: 700,
                    marginBottom: 2,
                    fontSize: 13.5,
                    color: "var(--p2-ink)",
                  }}
                >
                  保存に失敗しました ({saveError.length} 件のエラー)
                </strong>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {saveError.map((e, i) => (
                    <li key={i} style={{ lineHeight: 1.5 }}>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* ===== 01 基本情報 ===== */}
          {/* bind: GET /admin/api/rooms/:id */}
          {/* bind: PATCH /admin/api/rooms/:id */}
          <SettingCard
            number="01"
            title="基本情報"
            desc="ルームの名称・説明・種別・期限を設定します。"
          >
            <FieldRow cols={2}>
              <Field
                label="ルーム名"
                required
                hint="参加者に表示される名前です。"
                error={fieldErrors["name"]}
              >
                <input
                  type="text"
                  value={s.name}
                  onChange={(e) => {
                    setS({ ...s, name: e.target.value });
                    markDirty("basic");
                  }}
                  disabled={readOnly}
                  style={inputStyle(readOnly)}
                />
              </Field>
              <Field
                label="ルーム番号"
                badge="自動採番 / 変更不可"
                hint="採番されたルーム番号は変更できません。"
              >
                <input
                  type="text"
                  value={s.id}
                  disabled
                  style={{
                    ...inputStyle(true),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                    background: "var(--bg-2)",
                    color: "var(--ink-soft)",
                    cursor: "not-allowed",
                  }}
                />
              </Field>
            </FieldRow>

            <Field
              label="説明 (任意)"
              hint="参加者のルームトップに表示されます。"
            >
              <textarea
                value={s.description}
                onChange={(e) => {
                  setS({ ...s, description: e.target.value });
                  markDirty("basic");
                }}
                disabled={readOnly}
                style={{
                  ...inputStyle(readOnly),
                  resize: "vertical",
                  minHeight: 70,
                }}
              />
            </Field>

            <FieldRow cols={2}>
              <Field
                label="種別"
                required
                hint="種別によりルームトップの配置と既定の公開設定が変わります。"
              >
                <Segmented
                  value={s.kind}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({ ...s, kind: v as Kind });
                    markDirty("basic");
                  }}
                  options={[
                    { value: "CLASSROOM", name: "CLASSROOM", sub: "クラス課題向け" },
                    { value: "TOURNAMENT", name: "TOURNAMENT", sub: "大会形式" },
                    { value: "PUBLIC_LOBBY", name: "PUBLIC_LOBBY", sub: "自由参加" },
                  ]}
                />
              </Field>
              <Field
                label="期限"
                required
                hint="この日時を過ぎると新規マッチが発行できなくなります (既存マッチは継続)。"
              >
                <input
                  type="text"
                  value={s.deadline}
                  onChange={(e) => {
                    setS({ ...s, deadline: e.target.value });
                    markDirty("basic");
                  }}
                  disabled={readOnly}
                  style={{
                    ...inputStyle(readOnly),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                  }}
                />
              </Field>
            </FieldRow>
          </SettingCard>

          {/* ===== 02 ルール ===== */}
          <SettingCard
            number="02"
            title="ルール (rulePreset)"
            desc="対戦の盤面・ターン・AP などを設定します。期限内に未開始のマッチに反映されます。"
            headerRight={
              !readOnly && (
                <button
                  type="button"
                  onClick={handleResetRules}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    color: TEAL_INK,
                    borderBottom: `1px dashed ${TEAL_INK}`,
                    paddingBottom: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  ↺ v0.1 標準にリセット
                </button>
              )
            }
          >
            {/* Board / turn / AP */}
            <FieldRow cols={4}>
              <Field
                label="盤面幅"
                required
                hint="6 〜 16 マス。広いほど索敵が重要になります。"
              >
                <InputWithSuffix
                  suffix="マス"
                  type="number"
                  value={s.rule.width}
                  min={6}
                  max={16}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({ ...s, rule: { ...s.rule, width: Number(v) } });
                    markDirty("rule");
                  }}
                />
              </Field>
              <Field
                label="盤面高さ"
                required
                hint="幅と同じにすると正方形になります。"
              >
                <InputWithSuffix
                  suffix="マス"
                  type="number"
                  value={s.rule.height}
                  min={6}
                  max={16}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({ ...s, rule: { ...s.rule, height: Number(v) } });
                    markDirty("rule");
                  }}
                />
              </Field>
              <Field
                label="最大ターン"
                required
                hint="超えると時間切れ判定。短いほどテンポが上がります。"
              >
                <InputWithSuffix
                  suffix="T"
                  type="number"
                  value={s.rule.maxTurn}
                  min={10}
                  max={60}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({ ...s, rule: { ...s.rule, maxTurn: Number(v) } });
                    markDirty("rule");
                  }}
                />
              </Field>
              <Field
                label="AP / ターン"
                required
                hint="1 ターンで使える合計コスト。MOVE=1, SHOOT=1, SCAN=1, WAIT=1。"
              >
                <input
                  type="number"
                  value={s.rule.apPerTurn}
                  min={1}
                  max={4}
                  disabled={readOnly}
                  onChange={(e) => {
                    setS({
                      ...s,
                      rule: { ...s.rule, apPerTurn: Number(e.target.value) },
                    });
                    markDirty("rule");
                  }}
                  style={{
                    ...inputStyle(readOnly),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                  }}
                />
              </Field>
            </FieldRow>

            {/* Scan / obstacles / seed */}
            <FieldRow cols={3}>
              <Field
                label="scanRange"
                required
                hint="SCAN アクションで前方を見通せる距離です。"
              >
                <InputWithSuffix
                  suffix="マス"
                  type="number"
                  value={s.rule.scanRange}
                  min={1}
                  max={6}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({
                      ...s,
                      rule: { ...s.rule, scanRange: Number(v) },
                    });
                    markDirty("rule");
                  }}
                />
              </Field>
              <Field
                label="障害物数"
                required
                hint="多いほど直線射撃が難しくなり、索敵の重要性が増します。"
              >
                <input
                  type="number"
                  value={s.rule.obstacles}
                  min={0}
                  max={30}
                  disabled={readOnly}
                  onChange={(e) => {
                    setS({
                      ...s,
                      rule: { ...s.rule, obstacles: Number(e.target.value) },
                    });
                    markDirty("rule");
                  }}
                  style={{
                    ...inputStyle(readOnly),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                  }}
                />
              </Field>
              <Field
                label="乱数シード (任意)"
                badge="advanced"
                hint="同じシードで同じ盤面が生成されます。検証用です。"
              >
                <input
                  type="text"
                  value={s.rule.seed}
                  placeholder="空欄でランダム"
                  disabled={readOnly}
                  onChange={(e) => {
                    setS({
                      ...s,
                      rule: { ...s.rule, seed: e.target.value },
                    });
                    markDirty("rule");
                  }}
                  style={{
                    ...inputStyle(readOnly),
                    fontFamily: "JetBrains Mono, monospace",
                    letterSpacing: "0.04em",
                  }}
                />
              </Field>
            </FieldRow>

            {/* Preview info row */}
            <InfoRow icon="i">
              <strong>プレビュー:</strong> {s.rule.width}×{s.rule.height} /{" "}
              {s.rule.maxTurn} ターン / AP {s.rule.apPerTurn} / scan{" "}
              {s.rule.scanRange} — 標準難度です。授業 1 コマ (45 分) で 1 人
              2〜3 試合こなせます。
            </InfoRow>

            {/* Item settings */}
            <div style={{ marginTop: 18 }}>
              <label style={labelStyle}>アイテム設定</label>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <ItemToggle
                  iconChar="+"
                  iconBg="linear-gradient(180deg, #f59e0b, #d97706)"
                  name="CROSS_ATTACK"
                  tag="射程拡張"
                  desc="取得後 1 ターンの間、射撃が十字 (前後左右) に届くようになります。"
                  enabled={s.rule.items.CROSS_ATTACK.enabled}
                  params={[
                    {
                      k: "spawnStartTurn",
                      v: String(s.rule.items.CROSS_ATTACK.spawnStartTurn ?? "—"),
                    },
                    {
                      k: "spawnChance",
                      v:
                        s.rule.items.CROSS_ATTACK.spawnChance != null
                          ? `${Math.round(s.rule.items.CROSS_ATTACK.spawnChance * 100)}% / T`
                          : "—",
                    },
                    {
                      k: "maxOnBoard",
                      v: String(s.rule.items.CROSS_ATTACK.maxOnBoard ?? "—"),
                    },
                  ]}
                  disabled={readOnly}
                  onToggle={() => {
                    setS({
                      ...s,
                      rule: {
                        ...s.rule,
                        items: {
                          ...s.rule.items,
                          CROSS_ATTACK: {
                            ...s.rule.items.CROSS_ATTACK,
                            enabled: !s.rule.items.CROSS_ATTACK.enabled,
                          },
                        },
                      },
                    });
                    markDirty("rule");
                  }}
                />
                <ItemToggle
                  iconChar="■"
                  iconBg="linear-gradient(180deg, #15803d, #166534)"
                  name="BARRIER"
                  tag="防御"
                  desc="取得後 2 ターンの間、被ダメージを半減します。"
                  enabled={s.rule.items.BARRIER.enabled}
                  params={[
                    {
                      k: "spawnStartTurn",
                      v: String(s.rule.items.BARRIER.spawnStartTurn ?? "—"),
                    },
                    {
                      k: "spawnChance",
                      v:
                        s.rule.items.BARRIER.spawnChance != null
                          ? `${Math.round(s.rule.items.BARRIER.spawnChance * 100)}% / T`
                          : "—",
                    },
                    {
                      k: "maxOnBoard",
                      v: String(s.rule.items.BARRIER.maxOnBoard ?? "—"),
                    },
                  ]}
                  disabled={readOnly}
                  onToggle={() => {
                    setS({
                      ...s,
                      rule: {
                        ...s.rule,
                        items: {
                          ...s.rule.items,
                          BARRIER: {
                            ...s.rule.items.BARRIER,
                            enabled: !s.rule.items.BARRIER.enabled,
                          },
                        },
                      },
                    });
                    markDirty("rule");
                  }}
                />
                <ItemToggle
                  iconChar="↻"
                  iconBg="linear-gradient(180deg, #7c3aed, #6d28d9)"
                  name="REPEAT_ACTIONS"
                  tag="反復"
                  desc="前ターンと同じ行動を 1 回だけ追加で実行します。連続使用に上限あり。"
                  enabled={s.rule.items.REPEAT_ACTIONS.enabled}
                  params={[
                    { k: "spawnStartTurn", v: "—" },
                    { k: "spawnChance", v: "—" },
                    { k: "maxOnBoard", v: "—" },
                  ]}
                  disabled={readOnly}
                  onToggle={() => {
                    setS({
                      ...s,
                      rule: {
                        ...s.rule,
                        items: {
                          ...s.rule.items,
                          REPEAT_ACTIONS: {
                            ...s.rule.items.REPEAT_ACTIONS,
                            enabled: !s.rule.items.REPEAT_ACTIONS.enabled,
                          },
                        },
                      },
                    });
                    markDirty("rule");
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: TEAL_INK,
                  marginTop: 8,
                  lineHeight: 1.5,
                }}
              >
                💡 初心者ルームでは CROSS と BARRIER の 2 つに絞ると判断要素が減って学習しやすくなります。
              </div>
            </div>
          </SettingCard>

          {/* ===== 03 コーディング ===== */}
          <SettingCard
            number="03"
            title="コーディング"
            desc="プレイヤーが Blockly でロジックを組む時間と、未対応ブロックの扱いを設定します。"
          >
            <FieldRow cols={2}>
              <Field
                label="codingTimeLimitSec"
                required
                hint="60〜900 秒。標準は 300 秒 (5 分)。低学年は 360 秒以上を推奨します。"
              >
                <InputWithSuffix
                  suffix="秒"
                  type="number"
                  value={s.coding.codingTimeLimitSec}
                  min={60}
                  max={900}
                  step={30}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({
                      ...s,
                      coding: {
                        ...s.coding,
                        codingTimeLimitSec: Number(v),
                      },
                    });
                    markDirty("coding");
                  }}
                />
              </Field>
              <Field
                label="未対応ブロック許可ポリシー"
                required
                hint="学習用には「警告のみ」が無難。コンテスト用には「不可」を推奨。"
              >
                <Segmented
                  value={s.coding.unsupportedBlockPolicy}
                  disabled={readOnly}
                  onChange={(v) => {
                    setS({
                      ...s,
                      coding: {
                        ...s.coding,
                        unsupportedBlockPolicy: v as UnsupportedPolicy,
                      },
                    });
                    markDirty("coding");
                  }}
                  options={[
                    { value: "ALLOW", name: "許可", sub: "そのまま採用" },
                    { value: "WARN", name: "警告のみ", sub: "WAIT に置換" },
                    { value: "BLOCK", name: "不可", sub: "確定不可" },
                  ]}
                />
              </Field>
            </FieldRow>

            <InfoRow icon="⏱">
              <strong>時間切れ時の自動 WAIT 提出は常に ON です。</strong>{" "}
              コーディング時間内に確定されなかった場合、その時点の Workspace が自動確定されます。未配置の場合は WAIT 戦略が提出されます。この挙動は無効化できません。
            </InfoRow>
          </SettingCard>

          {/* ===== 04 公開設定 ===== */}
          <SettingCard
            number="04"
            title="公開設定"
            desc="観戦・ランキング・リプレイ共有の見せ方を切り替えます。"
          >
            <VisGroup
              label="観戦リンクの公開"
              sub="進行中マッチの観戦ページを誰に見せるか。"
            >
              <Segmented
                value={s.visibility.spectate}
                disabled={readOnly}
                onChange={(v) => {
                  setS({
                    ...s,
                    visibility: {
                      ...s.visibility,
                      spectate: v as Visibility,
                    },
                  });
                  markDirty("visibility");
                }}
                options={[
                  { value: "PUBLIC", name: "公開", sub: "誰でも観戦可" },
                  { value: "MEMBERS", name: "メンバーのみ", sub: "ルーム内ログインのみ" },
                  { value: "PRIVATE", name: "非公開", sub: "関係者のみ" },
                ]}
              />
            </VisGroup>

            <VisGroup
              label="ランキング表示の公開"
              sub="ルームトップに表示される Top 5 など、他者の戦績の見せ方。"
            >
              <Segmented
                value={s.visibility.standings}
                disabled={readOnly}
                onChange={(v) => {
                  setS({
                    ...s,
                    visibility: {
                      ...s.visibility,
                      standings: v as Visibility,
                    },
                  });
                  markDirty("visibility");
                }}
                options={[
                  { value: "PUBLIC", name: "公開", sub: "誰でも閲覧可" },
                  { value: "MEMBERS", name: "メンバーのみ", sub: "同ルーム内のみ" },
                  { value: "PRIVATE", name: "非公開", sub: "本人順位のみ" },
                ]}
              />
            </VisGroup>

            <ToggleRow
              title="リプレイ共有 URL の発行"
              desc="終了済みマッチに、誰でも見られる共有 URL を発行できるようにします。URL を渡された人は対象マッチのリプレイのみ閲覧可能 (他マッチ・他データへは到達不可)。"
              enabled={s.visibility.replayShare}
              disabled={readOnly}
              onToggle={() => {
                setS({
                  ...s,
                  visibility: {
                    ...s.visibility,
                    replayShare: !s.visibility.replayShare,
                  },
                });
                markDirty("visibility");
              }}
            />
          </SettingCard>

          {/* ===== 05 管理メンテ (danger zone) ===== */}
          {/* bind: POST /admin/api/rooms/:id/archive */}
          {/* bind: POST /admin/api/rooms/:id/restore */}
          {/* bind: DELETE /admin/api/rooms/:id */}
          <SettingCard
            number="05"
            title="管理メンテ"
            desc="アーカイブ・削除など、ルーム全体に影響する操作。"
            danger
          >
            {!archived ? (
              <DangerAction
                title="ルームをアーカイブ"
                desc="新規マッチの発行・メンバー追加を停止し、読み取り専用にします。戦績・リプレイは残り、後から復元できます。"
              >
                <button
                  type="button"
                  onClick={handleArchive}
                  style={ghostBtnStyle}
                >
                  📦 アーカイブ
                </button>
              </DangerAction>
            ) : (
              <DangerAction
                title="ルームを復元"
                desc="アーカイブを解除し、再びマッチ発行・メンバー追加を可能にします。"
              >
                <button
                  type="button"
                  onClick={handleRestore}
                  style={{
                    ...ghostBtnStyle,
                    background: TEAL,
                    color: "#fff",
                    border: "none",
                    boxShadow: "0 1px 0 #0e7490",
                  }}
                >
                  ↻ 復元する
                </button>
              </DangerAction>
            )}

            <DangerAction
              title="ルームを削除"
              desc="マッチ履歴・リプレイ・メンバー紐付けがすべて閲覧できなくなります。元に戻すことはできません。確認のためルーム番号の再入力が必要です。"
              danger
            >
              <button
                type="button"
                onClick={handleDelete}
                style={dangerBtnStyle}
              >
                🗑 削除…
              </button>
            </DangerAction>
          </SettingCard>

          {/* ===== State gallery ===== */}
          <StateGallery />
        </main>
      </div>

      {/* ===== Sticky save footer ===== */}
      {!archived && (
        <footer
          style={{
            position: "fixed",
            left: 240,
            right: 0,
            bottom: 0,
            background: isDirty
              ? "linear-gradient(180deg, #fffaf0, #fff)"
              : "#fff",
            borderTop: isDirty
              ? "1px solid var(--accent)"
              : "1px solid var(--line)",
            padding: "12px 32px",
            display: "flex",
            alignItems: "center",
            gap: 14,
            boxShadow: "0 -6px 18px rgba(31,35,48,0.06)",
            zIndex: 50,
          }}
          role="status"
          aria-label="保存フッタ"
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flex: 1,
              fontSize: 13,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: isDirty ? "var(--accent)" : "var(--line-2)",
                boxShadow: isDirty
                  ? "0 0 0 3px rgba(245,158,11,0.25)"
                  : "none",
                animation: isDirty
                  ? "pulse-soft 1.8s ease-in-out infinite"
                  : "none",
              }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>
                {isDirty
                  ? "未保存の変更があります"
                  : "すべての変更が保存されています"}
              </div>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11.5,
                  color: "var(--ink-soft)",
                }}
              >
                {isDirty ? (
                  <>
                    <strong
                      style={{
                        color: "var(--accent)",
                        fontWeight: 700,
                      }}
                    >
                      未保存 {totalDirty} 件
                    </strong>{" "}
                    · {dirtyParts.join(" · ")}
                  </>
                ) : (
                  "最終保存 14:32"
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || saving}
            style={{
              background: "transparent",
              color: "var(--ink-soft)",
              border: "1px solid var(--line-2)",
              borderRadius: 9,
              padding: "10px 16px",
              fontSize: 13,
              fontWeight: 600,
              cursor: !isDirty || saving ? "not-allowed" : "pointer",
              opacity: !isDirty || saving ? 0.5 : 1,
            }}
          >
            変更を破棄
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={
              saving
                ? {
                    background: "#fff",
                    color: "var(--ink-soft)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 9,
                    padding: "11px 22px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "not-allowed",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "none",
                  }
                : !isDirty
                  ? {
                      background: "var(--bg-2)",
                      color: "var(--ink-soft)",
                      border: "none",
                      borderRadius: 9,
                      padding: "11px 22px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "not-allowed",
                      boxShadow: "none",
                    }
                  : {
                      background: "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 9,
                      padding: "11px 22px",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 2px 0 #c2740a",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }
            }
          >
            {saving && (
              <span
                aria-hidden="true"
                style={{
                  width: 13,
                  height: 13,
                  border: "2px solid rgba(31,35,48,0.18)",
                  borderTopColor: "var(--ink)",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite",
                }}
              />
            )}
            {saving ? "保存中…" : "変更を保存"}
          </button>
        </footer>
      )}

      {/* Keyframes for footer animations */}
      <style>{`
        @keyframes pulse-soft {
          0%, 100% { box-shadow: 0 0 0 3px rgba(245,158,11,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(245,158,11,0.18); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* =====================================================================
   Reusable sub-components
   ===================================================================== */

function SettingCard({
  number,
  title,
  desc,
  danger,
  headerRight,
  children,
}: {
  number: string;
  title: string;
  desc: string;
  danger?: boolean;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: danger
          ? "linear-gradient(180deg, #fff, #fef9f9)"
          : "var(--surface)",
        border: danger ? "1px solid #fbb6b6" : "1px solid var(--line)",
        borderRadius: 14,
        marginBottom: 16,
        boxShadow: "0 1px 2px rgba(31,35,48,0.04)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: "16px 22px 12px",
          borderBottom: "1px dashed var(--line)",
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: danger ? "var(--danger)" : "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 11,
                background: danger ? "var(--danger-soft)" : TEAL_SOFT,
                color: danger ? "var(--danger)" : TEAL_INK,
                border: danger ? "1px solid #fbb6b6" : "1px solid #a5f3fc",
                padding: "2px 8px",
                borderRadius: 5,
                fontWeight: 700,
              }}
            >
              {number}
            </span>
            {title}
          </h2>
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-soft)",
              marginTop: 4,
              lineHeight: 1.55,
            }}
          >
            {desc}
          </div>
        </div>
        {headerRight}
      </header>
      <div style={{ padding: "18px 22px 20px" }}>{children}</div>
    </section>
  );
}

function FieldRow({
  cols,
  children,
}: {
  cols: 2 | 3 | 4;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 14,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  required,
  badge,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  badge?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label}
        {required && (
          <span style={{ color: "var(--p2)", fontWeight: 700, marginLeft: 2 }}>
            *
          </span>
        )}
        {badge && (
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9.5,
              fontWeight: 600,
              background: "var(--bg)",
              border: "1px solid var(--line)",
              padding: "1px 6px",
              borderRadius: 4,
              color: "var(--ink-soft)",
              marginLeft: 6,
              letterSpacing: "0.04em",
            }}
          >
            {badge}
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-soft)",
            marginTop: 5,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
      {error && (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--danger)",
            marginTop: 5,
            fontWeight: 500,
            display: "flex",
            gap: 5,
            alignItems: "flex-start",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 13,
              height: 13,
              background: "var(--danger)",
              color: "#fff",
              borderRadius: "50%",
              display: "inline-grid",
              placeItems: "center",
              fontSize: 9,
              fontWeight: 700,
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            !
          </span>
          {error}
        </div>
      )}
    </div>
  );
}

function InputWithSuffix({
  suffix,
  type = "text",
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  suffix: string;
  type?: "text" | "number";
  value: string | number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...inputStyle(disabled),
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "0.04em",
          paddingRight: 50,
        }}
      />
      <span
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 11,
          color: "var(--ink-soft)",
          pointerEvents: "none",
        }}
      >
        {suffix}
      </span>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; name: string; sub: string }[];
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 6,
      }}
      role="radiogroup"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            style={{
              border: selected
                ? `1px solid ${TEAL}`
                : "1px solid var(--line-2)",
              background: selected ? TEAL_SOFT : "#fff",
              borderRadius: 8,
              padding: "11px 10px",
              textAlign: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.65 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              fontFamily: "inherit",
            }}
          >
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 12,
                fontWeight: 700,
                color: selected ? TEAL_INK : "var(--ink)",
              }}
            >
              {opt.name}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: selected ? TEAL_INK : "var(--ink-soft)",
                opacity: selected ? 0.8 : 1,
                fontWeight: 500,
                lineHeight: 1.4,
              }}
            >
              {opt.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function InfoRow({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: TEAL_SOFT,
        border: "1px solid #a5f3fc",
        color: TEAL_INK,
        borderRadius: 8,
        padding: "10px 12px",
        display: "flex",
        gap: 10,
        fontSize: 12,
        lineHeight: 1.55,
        marginTop: 4,
        marginBottom: 14,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          background: TEAL,
          color: "#fff",
          display: "grid",
          placeItems: "center",
          fontWeight: 700,
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ItemToggle({
  iconChar,
  iconBg,
  name,
  tag,
  desc,
  params,
  enabled,
  disabled,
  onToggle,
}: {
  iconChar: string;
  iconBg: string;
  name: string;
  tag: string;
  desc: string;
  params: { k: string; v: string }[];
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        border: enabled ? "1px solid #a5f3fc" : "1px solid var(--line)",
        background: enabled
          ? "linear-gradient(180deg, #ffffff, #f0fdfa)"
          : "#fff",
        borderRadius: 10,
        padding: "12px 14px",
        display: "grid",
        gridTemplateColumns: "38px 1fr auto",
        gap: 12,
        alignItems: "center",
        opacity: enabled ? 1 : 0.55,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: "grid",
          placeItems: "center",
          color: "#fff",
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 14,
          fontWeight: 700,
          border: "2px solid #fff",
          boxShadow: "0 1px 3px rgba(31,35,48,0.18)",
          background: iconBg,
        }}
      >
        {iconChar}
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13.5 }}>
          {name}
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10.5,
              color: "var(--ink-soft)",
              marginLeft: 6,
              fontWeight: 500,
            }}
          >
            {tag}
          </span>
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-soft)",
            marginTop: 2,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
        <div
          style={{
            marginTop: 6,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 11,
            color: "var(--ink-soft)",
          }}
        >
          {params.map((p) => (
            <span
              key={p.k}
              style={{
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: 5,
                padding: "2px 8px",
              }}
            >
              {p.k}{" "}
              <strong style={{ color: "var(--ink)", fontWeight: 700 }}>
                {p.v}
              </strong>
            </span>
          ))}
        </div>
      </div>
      <Switch
        on={enabled}
        roomAccent
        disabled={disabled}
        onToggle={onToggle}
        ariaLabel={`${name} を有効化`}
      />
    </div>
  );
}

function Switch({
  on,
  roomAccent,
  disabled,
  onToggle,
  ariaLabel,
}: {
  on: boolean;
  roomAccent?: boolean;
  disabled?: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const onColor = roomAccent ? TEAL : "var(--success)";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={on}
      disabled={disabled}
      onClick={onToggle}
      style={{
        position: "relative",
        width: 40,
        height: 22,
        background: on ? onColor : "var(--line-2)",
        borderRadius: 999,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "none",
        flexShrink: 0,
        transition: "background 0.15s",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 2,
          left: on ? 20 : 2,
          width: 18,
          height: 18,
          background: "#fff",
          borderRadius: "50%",
          transition: "left 0.15s",
          boxShadow: "0 1px 2px rgba(0,0,0,0.18)",
        }}
      />
    </button>
  );
}

function VisGroup({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 5,
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          color: "var(--ink)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--ink-soft)",
          marginBottom: 7,
          lineHeight: 1.5,
        }}
      >
        {sub}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  enabled,
  disabled,
  onToggle,
}: {
  title: string;
  desc: string;
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        padding: "12px 14px",
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 10,
      }}
    >
      <div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-soft)",
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      <Switch
        on={enabled}
        roomAccent
        disabled={disabled}
        onToggle={onToggle}
        ariaLabel={title}
      />
    </div>
  );
}

function DangerAction({
  title,
  desc,
  danger,
  children,
}: {
  title: string;
  desc: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 14,
        padding: "14px 16px",
        background: danger
          ? "linear-gradient(180deg, #fff, #fef2f2)"
          : "#fff",
        border: danger ? "1px solid #fbb6b6" : "1px solid var(--line)",
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13.5,
            color: danger ? "var(--danger)" : "var(--ink)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: "var(--ink-soft)",
            marginTop: 3,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      </div>
      {children}
    </div>
  );
}

function StateGallery() {
  return (
    <section
      style={{
        maxWidth: 1440,
        margin: "36px auto 32px",
        paddingTop: 0,
      }}
      aria-label="状態バリエーション"
    >
      <div
        style={{
          borderTop: "1px solid var(--line)",
          paddingTop: 24,
          marginBottom: 18,
          display: "flex",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 14,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {"// state variations"}
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
          通常 (保存済) / 変更未保存 / 保存中 / 保存失敗 / アーカイブ済み (read-only)
        </p>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0,1fr))",
          gap: 12,
        }}
      >
        {/* Clean */}
        <MiniState name="通常 (保存済)" tag="clean">
          <MiniRow k="name" v="3-A クラス…" />
          <MiniRow k="maxTurn" v="20" />
          <MiniRow k="AP" v="2" />
          <MiniRow k="公開" v="メンバー" />
          <MiniFooter>
            <MiniDot />
            <span style={{ fontSize: 10 }}>最終保存 14:32</span>
            <MiniBtn variant="disabled">保存</MiniBtn>
          </MiniFooter>
        </MiniState>

        {/* Dirty */}
        <MiniState name="変更未保存" tag="dirty">
          <MiniInput variant="normal">name = 3-A クラス…</MiniInput>
          <MiniInput variant="dirty">
            maxTurn = <strong>24</strong> ← 20
          </MiniInput>
          <MiniInput variant="dirty">
            AP = <strong>3</strong> ← 2
          </MiniInput>
          <MiniFooter dirty>
            <MiniDot dirty />
            <span style={{ fontSize: 10 }}>
              <strong>2 件</strong> 未保存
            </span>
            <MiniBtn>保存</MiniBtn>
          </MiniFooter>
        </MiniState>

        {/* Saving */}
        <MiniState name="保存中" tag="saving">
          <MiniInput variant="normal" style={{ opacity: 0.6 }}>
            name = 3-A クラス…
          </MiniInput>
          <MiniInput variant="normal" style={{ opacity: 0.6 }}>
            maxTurn = 24
          </MiniInput>
          <MiniInput variant="normal" style={{ opacity: 0.6 }}>
            AP = 3
          </MiniInput>
          <MiniFooter>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                border: "2px solid rgba(31,35,48,0.18)",
                borderTopColor: "var(--ink)",
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.8s linear infinite",
              }}
            />
            <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
              保存中…
            </span>
            <MiniBtn variant="busy">保存中</MiniBtn>
          </MiniFooter>
        </MiniState>

        {/* Save fail */}
        <MiniState name="保存失敗" tag="400">
          <div
            style={{
              background: "var(--danger-soft)",
              border: "1px solid #fbb6b6",
              color: "var(--p2-ink)",
              borderRadius: 6,
              padding: "6px 8px",
              marginBottom: 8,
              fontSize: 10.5,
              lineHeight: 1.45,
            }}
          >
            <strong style={{ display: "block", fontSize: 11 }}>
              2 件のエラー
            </strong>
            maxTurn は 10 以上にしてください。
          </div>
          <MiniInput variant="normal">name = 3-A クラス…</MiniInput>
          <MiniInput
            variant="normal"
            style={{
              borderColor: "var(--danger)",
              background: "#fef6f6",
            }}
          >
            maxTurn = 4 <span style={{ color: "var(--danger)" }}>✕</span>
          </MiniInput>
          <MiniFooter dirty>
            <MiniDot dirty />
            <span style={{ fontSize: 10, color: "var(--p2-ink)" }}>
              エラー解消後に保存
            </span>
            <MiniBtn variant="disabled">保存</MiniBtn>
          </MiniFooter>
        </MiniState>

        {/* Archived */}
        <MiniState name="アーカイブ済" tag="readonly">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "var(--bg-2)",
              border: "1px solid var(--line-2)",
              color: "var(--ink-soft)",
              borderRadius: 5,
              padding: "3px 7px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 7,
            }}
          >
            📦 ARCHIVED
          </span>
          <MiniInput>name = 3-A クラス…</MiniInput>
          <MiniInput>maxTurn = 20</MiniInput>
          <MiniInput>AP = 2</MiniInput>
          <MiniFooter style={{ background: "var(--bg-2)" }}>
            <MiniDot />
            <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
              読み取り専用
            </span>
            <MiniBtn variant="disabled">復元する</MiniBtn>
          </MiniFooter>
        </MiniState>
      </div>
    </section>
  );
}

function MiniState({
  name,
  tag,
  children,
}: {
  name: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 12,
        overflow: "hidden",
        fontSize: 12,
      }}
    >
      <header
        style={{
          padding: "9px 11px",
          background: "var(--bg)",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 11.5 }}>{name}</span>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9.5,
            padding: "2px 5px",
            borderRadius: 4,
            background: "#fff",
            border: "1px solid var(--line)",
            color: "var(--ink-soft)",
          }}
        >
          {tag}
        </span>
      </header>
      <div style={{ padding: 12 }}>{children}</div>
    </article>
  );
}

function MiniRow({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "5px 0",
        borderBottom: "1px dashed var(--line)",
        fontSize: 11,
      }}
    >
      <span
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10.5,
        }}
      >
        {k}
      </span>
      <span>{v}</span>
    </div>
  );
}

function MiniInput({
  variant = "archived",
  style,
  children,
}: {
  variant?: "archived" | "normal" | "dirty";
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    borderRadius: 5,
    padding: "4px 6px",
    fontSize: 10.5,
    marginBottom: 5,
  };
  if (variant === "normal") {
    return (
      <div
        style={{
          ...base,
          background: "#fdfcf8",
          border: "1px solid var(--line-2)",
          color: "var(--ink)",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  if (variant === "dirty") {
    return (
      <div
        style={{
          ...base,
          background: "#fffdf5",
          border: "1px solid var(--accent)",
          color: "var(--ink)",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      style={{
        ...base,
        background: "var(--bg-2)",
        border: "1px dashed var(--line-2)",
        color: "var(--ink-soft)",
        cursor: "not-allowed",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MiniFooter({
  dirty,
  style,
  children,
}: {
  dirty?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: dirty ? "#fffaf0" : "#fff",
        border: dirty ? "1px solid var(--accent)" : "1px solid var(--line)",
        borderRadius: 7,
        padding: "7px 9px",
        marginTop: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10.5,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function MiniDot({ dirty }: { dirty?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: dirty ? "var(--accent)" : "var(--line-2)",
        animation: dirty ? "pulse-soft 1.8s ease-in-out infinite" : "none",
      }}
    />
  );
}

function MiniBtn({
  variant,
  children,
}: {
  variant?: "busy" | "disabled";
  children: React.ReactNode;
}) {
  const base: React.CSSProperties = {
    marginLeft: "auto",
    border: "none",
    padding: "4px 10px",
    borderRadius: 5,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: "Plus Jakarta Sans, sans-serif",
  };
  if (variant === "busy") {
    return (
      <span
        style={{
          ...base,
          background: "#fff",
          color: "var(--ink-soft)",
          border: "1px solid var(--line-2)",
        }}
      >
        {children}
      </span>
    );
  }
  if (variant === "disabled") {
    return (
      <span
        style={{
          ...base,
          background: "var(--bg-2)",
          color: "var(--ink-soft)",
        }}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      style={{
        ...base,
        background: "var(--accent)",
        color: "#fff",
      }}
    >
      {children}
    </span>
  );
}

/* =====================================================================
   Inline style helpers
   ===================================================================== */

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  marginBottom: 5,
  color: "var(--ink)",
};

function inputStyle(disabled?: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "9px 11px",
    border: "1px solid var(--line-2)",
    borderRadius: 8,
    font: "inherit",
    fontSize: 13,
    background: disabled ? "var(--bg-2)" : "#fdfcf8",
    color: disabled ? "var(--ink-soft)" : "var(--ink)",
    boxSizing: "border-box",
    cursor: disabled ? "not-allowed" : "text",
    outline: "none",
  };
}

const ghostBtnStyle: React.CSSProperties = {
  background: "#fff",
  color: "var(--ink)",
  border: "1px solid var(--line-2)",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  whiteSpace: "nowrap",
};

const dangerBtnStyle: React.CSSProperties = {
  background: "var(--danger)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "9px 14px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  boxShadow: "0 1px 0 #991b1b",
};
