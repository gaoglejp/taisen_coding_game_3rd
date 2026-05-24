"use client";

// bind: GET /api/match/:matchId/public
// bind: GET /api/match/:matchId/replay
// bind: WS subscribe (live)

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { connectSocket, disconnectSocket } from "@/lib/socket-client";
import type { TurnSnapshot, Direction } from "@/lib/match-simulator";

/* ===========================================================================
   Default placeholders — live data overrides these once /api/match/:id/public
   resolves and turn_event events start arriving over the socket.
   =========================================================================== */

const META_DEFAULTS = {
  visibility: "PUBLIC" as "PUBLIC" | "LIMITED",
  delaySeconds: 15,
  mode: "LIVE" as "LIVE" | "REPLAY" | "ENDED",
  viewerCount: 0,
  roomName: "—",
  p1: { id: "P1", name: "P1", initials: "P1" },
  p2: { id: "P2", name: "P2", initials: "P2" },
  totalTurns: 20,
  currentTurn: 0,
};

function initialsFor(name: string | null | undefined, fallback: string): string {
  if (!name) return fallback;
  // Take the first 2 chars of the username/displayName; works for both
  // Japanese names (e.g. たろう → たろ) and ASCII (HanaCoder → Ha).
  const trimmed = name.trim();
  return trimmed.slice(0, 2).toUpperCase() || fallback;
}

// Obstacles and items are still mock — the simulator doesn't model them yet.
// Tank positions are now driven by the latest turn_event (passed into Board
// as a prop). Shot line is left out until the simulator surfaces shot rays.
const BOARD = {
  width: 10,
  height: 10,
  obstacles: [
    [2, 6], [2, 7], [4, 4], [4, 5], [7, 3], [7, 4], [1, 2], [8, 7], [5, 8],
  ] as [number, number][],
  items: [
    { x: 5, y: 5, kind: "CROSS" as const },
    { x: 2, y: 1, kind: "BARRIER" as const },
    { x: 8, y: 4, kind: "REPEAT" as const },
  ],
};

interface LiveTank { id: "P1" | "P2"; x: number; y: number; dir: Direction; name: string }

interface TimelineEvent {
  turn: number;
  kind: "hit" | "finish";
  label: string;
  icon: string;
}

function timelineFromTurns(turns: TurnSnapshot[], winnerLabel?: string, endReason?: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const t of turns) {
    if (t.p1.damaged > 0) {
      events.push({
        turn: t.turn,
        kind: "hit",
        label: `P2 が P1 に命中 (T${t.turn}, -${t.p1.damaged})`,
        icon: "●",
      });
    }
    if (t.p2.damaged > 0) {
      events.push({
        turn: t.turn,
        kind: "hit",
        label: `P1 が P2 に命中 (T${t.turn}, -${t.p2.damaged})`,
        icon: "●",
      });
    }
  }
  if (turns.length > 0 && endReason) {
    const finalTurn = turns[turns.length - 1]?.turn ?? turns.length;
    events.push({
      turn: finalTurn,
      kind: "finish",
      label: `T${finalTurn} 決着: ${winnerLabel ?? "引き分け"} (${endReason})`,
      icon: "◆",
    });
  }
  return events;
}

const COMMENTARY = [
  { id: 1, host: true, initials: "NK", name: "中村先生", turn: 3, time: "14:30:11", text: "P1 がいきなり FirstDamage。最初の SCAN を捨てて前進、当てた判断が良いです。", emphasis: "FirstDamage" },
  { id: 2, host: false, initials: "MI", name: "misora.dev", turn: 5, time: "14:31:42", text: "P2 が CROSS_ATTACK を拾った。射程拡張、次のターンは P1 が逃げ場あるか?", emphasis: null },
  { id: 3, host: true, initials: "NK", name: "中村先生", turn: 7, time: "14:33:08", text: "P2 の SHOOT 命中。被ダメージが累積してきました。ここで P1 が 退避ロジック を持っているかが分かれ目。", emphasis: "退避ロジック" },
  { id: 4, host: false, initials: "YK", name: "yukikko", turn: 8, time: "14:33:55", text: "P1 また MISS… 命中率はやや低め。次は SCAN 入れた方がいいかも。", emphasis: null },
];

const CELL_PX = 44;

/* ===========================================================================
   Small helpers
   =========================================================================== */

function TankGlyph({ side, name, dir }: { side: "p1" | "p2"; name: string; dir: "N" | "E" | "S" | "W" }) {
  const rot = dir === "N" ? 0 : dir === "E" ? 90 : dir === "S" ? 180 : -90;
  const base: React.CSSProperties =
    side === "p1"
      ? { background: "linear-gradient(180deg, #3b82f6, var(--p1))", border: "2px solid var(--p1-ink)" }
      : { background: "linear-gradient(180deg, #f87171, var(--p2))", border: "2px solid var(--p2-ink)" };
  return (
    <div
      style={{
        width: "78%",
        height: "78%",
        borderRadius: 6,
        position: "relative",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        boxShadow: "0 2px 0 rgba(0,0,0,.18), 0 0 0 2px #fff inset",
        transform: `rotate(${rot}deg)`,
        transition: "transform .25s ease",
        ...base,
      }}
    >
      {name}
      <span
        aria-hidden
        style={{
          content: '""',
          position: "absolute",
          width: "22%",
          height: "50%",
          background: "rgba(0,0,0,.3)",
          top: "-8%",
          left: "39%",
          borderRadius: "3px 3px 1px 1px",
        }}
      />
    </div>
  );
}

function ItemGlyph({ kind }: { kind: "CROSS" | "BARRIER" | "REPEAT" }) {
  const map = {
    CROSS: { bg: "linear-gradient(180deg, #f59e0b, #d97706)", g: "+" },
    BARRIER: { bg: "linear-gradient(180deg, #15803d, #166534)", g: "■" },
    REPEAT: { bg: "linear-gradient(180deg, #7c3aed, #6d28d9)", g: "↻" },
  }[kind];
  return (
    <div
      style={{
        width: "70%",
        height: "70%",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 12,
        fontWeight: 700,
        color: "#fff",
        border: "2px solid #fff",
        boxShadow: "0 2px 4px rgba(31,35,48,.18)",
        background: map.bg,
      }}
    >
      {map.g}
    </div>
  );
}

function ScopePill({ visibility }: { visibility: "PUBLIC" | "LIMITED" }) {
  const isPublic = visibility === "PUBLIC";
  return (
    <span
      aria-label={isPublic ? "公開試合" : "限定試合"}
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 5,
        border: "1px solid",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        letterSpacing: ".04em",
        background: isPublic ? "var(--accent-soft)" : "var(--bg-2)",
        color: isPublic ? "#92400e" : "var(--ink-soft)",
        borderColor: isPublic ? "#fbd9a5" : "var(--line-2)",
      }}
    >
      {isPublic ? "⌖ 公開" : "🔒 限定"}
    </span>
  );
}

function LivePill() {
  return (
    <span
      aria-label="ライブ配信中"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "var(--danger)",
        color: "#fff",
        padding: "4px 10px",
        borderRadius: 5,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".04em",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "#fff",
          animation: "livepulse 1.4s ease-in-out infinite",
        }}
      />
      LIVE
    </span>
  );
}

function ViewerCount({ count }: { count: number }) {
  return (
    <span
      aria-label="観戦者数"
      style={{
        background: "#fff",
        border: "1px solid var(--line)",
        borderRadius: 999,
        padding: "5px 12px 5px 8px",
        fontSize: 12,
        fontFamily: "JetBrains Mono, monospace",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span aria-hidden style={{ fontFamily: "Plus Jakarta Sans, sans-serif", fontWeight: 400 }}>
        👁
      </span>
      {count}
    </span>
  );
}

/* ===========================================================================
   Recognition panel (P1 / P2)
   =========================================================================== */

interface PanelData {
  side: "p1" | "p2";
  name: string;
  initials: string;
  x: number;
  y: number;
  dir: string;
  hp: number;
  maxHp: number;
  detected: string;
  detectedAge: number;
  actions: { slot: number; kind: "move" | "shoot" | "turn" | "scan"; label: string }[];
  lastTurn: { damaged: string; shootResult: "HIT" | "MISS" | "—"; scanDetected: "true" | "false" };
  score: { dealt: number; taken: number };
}

function RecognitionPanel({ data }: { data: PanelData }) {
  const isP1 = data.side === "p1";
  const headBg = isP1
    ? "linear-gradient(180deg, #f5f9ff, #ecf3ff)"
    : "linear-gradient(180deg, #fff5f5, #ffecec)";
  const avBg = isP1 ? "var(--p1)" : "var(--p2)";
  const avBorder = isP1 ? "var(--p1-ink)" : "var(--p2-ink)";
  const rolePillStyle: React.CSSProperties = isP1
    ? { background: "var(--p1-soft)", color: "var(--p1-ink)", borderColor: "#bfd5fa" }
    : { background: "var(--p2-soft)", color: "var(--p2-ink)", borderColor: "#fbb6b6" };
  const hpFill = isP1
    ? "linear-gradient(90deg, var(--p1), #60a5fa)"
    : "linear-gradient(90deg, var(--p2), #f87171)";
  const playerLabel = isP1 ? "P1" : "P2";

  const actionSlotStyle = (kind: PanelData["actions"][number]["kind"]): React.CSSProperties => {
    const palette = {
      move: { bg: "#eff6ff", color: "var(--p1-ink)", border: "#bfd5fa" },
      shoot: { bg: "#fef2f2", color: "var(--p2-ink)", border: "#fbb6b6" },
      turn: { bg: "#f5f3ff", color: "#6b21a8", border: "#ddd6fe" },
      scan: { bg: "#f0fdf4", color: "var(--success)", border: "#a7f3d0" },
    }[kind];
    return {
      background: palette.bg,
      color: palette.color,
      borderColor: palette.border,
      border: `1px solid ${palette.border}`,
      borderRadius: 6,
      padding: "4px 7px",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 10.5,
      fontWeight: 700,
      flex: 1,
      textAlign: "center" as const,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    };
  };

  return (
    <aside
      aria-label={`${playerLabel} 認識パネル`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(31,35,48,.04)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "12px 14px 10px",
          borderBottom: "1px dashed var(--line)",
          background: headBg,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "JetBrains Mono, monospace",
              border: `2px solid ${avBorder}`,
              background: avBg,
              color: "#fff",
            }}
          >
            {data.initials}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{data.name}</div>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9.5,
              padding: "2px 6px",
              borderRadius: 4,
              fontWeight: 600,
              border: "1px solid",
              ...rolePillStyle,
            }}
          >
            {playerLabel}
          </span>
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--ink-soft)",
            lineHeight: 1.45,
            background: "rgba(255,255,255,.6)",
            border: "1px dashed var(--line-2)",
            borderRadius: 6,
            padding: "6px 8px",
          }}
        >
          ここに表示している情報が <strong style={{ color: "var(--ink)", fontWeight: 700 }}>{playerLabel} のプログラムの判断材料</strong> です。
        </div>
      </header>

      <div style={{ padding: "12px 14px 14px", flex: 1, overflowY: "auto" }}>
        {/* self */}
        <Section heading="// self">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Tile k="座標" v={`x=${data.x} y=${data.y}`} />
            <Tile k="向き" v="" extra={<DirChip dir={data.dir} />} />
          </div>
          <div
            style={{
              background: "var(--bg)",
              border: "1px solid var(--line)",
              borderRadius: 7,
              padding: "7px 9px",
              marginTop: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--ink-soft)" }}>
                HP
              </span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 15 }}>
                {data.hp}
                <small style={{ color: "var(--ink-soft)", fontWeight: 600, fontSize: 11, marginLeft: 2 }}>
                  /{data.maxHp}
                </small>
              </span>
            </div>
            <div
              style={{
                height: 7,
                background: "var(--bg-2)",
                border: "1px solid var(--line)",
                borderRadius: 5,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${(data.hp / data.maxHp) * 100}%`,
                  background: hpFill,
                }}
              />
            </div>
          </div>
        </Section>

        {/* detected */}
        <Section heading="// detected_targets" sub="1 件">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent-soft)",
              border: "1px solid #fbd9a5",
              color: "#92400e",
              borderRadius: 999,
              padding: "3px 6px 3px 8px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {data.detected}{" "}
            <span
              style={{
                background: "rgba(255,255,255,.6)",
                borderRadius: 3,
                padding: "0 5px",
                fontSize: 10,
              }}
            >
              age {data.detectedAge}
            </span>
          </span>
        </Section>

        {/* last_actions */}
        <Section heading="// last_actions">
          <div style={{ display: "flex", gap: 4 }}>
            {data.actions.map((a) => (
              <div key={a.slot} style={actionSlotStyle(a.kind)}>
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--ink-soft)",
                    background: "#fff",
                    padding: "0 4px",
                    borderRadius: 3,
                  }}
                >
                  slot{a.slot}
                </span>
                {a.label}
              </div>
            ))}
          </div>
        </Section>

        {/* last_turn */}
        <Section heading="// last_turn">
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <LtRow k="damaged" v={data.lastTurn.damaged} variant={data.lastTurn.damaged === "0" ? "idle" : "miss"} />
            <LtRow
              k="shoot_result"
              v={data.lastTurn.shootResult}
              variant={data.lastTurn.shootResult === "HIT" ? "hit" : data.lastTurn.shootResult === "MISS" ? "miss" : "idle"}
            />
            <LtRow
              k="scan_detected"
              v={data.lastTurn.scanDetected}
              variant={data.lastTurn.scanDetected === "true" ? "hit" : "idle"}
            />
          </div>
        </Section>

        {/* score */}
        <Section heading="// 累計スコア" last>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <Tile k="dealt" v={String(data.score.dealt)} />
            <Tile k="taken" v={String(data.score.taken)} />
          </div>
        </Section>
      </div>
    </aside>
  );
}

function Section({
  heading,
  sub,
  last,
  children,
}: {
  heading: string;
  sub?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: last ? 0 : 12 }}>
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9.5,
          color: "var(--ink-soft)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          marginBottom: 6,
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
        }}
      >
        <span>{heading}</span>
        {sub ? <span style={{ color: "var(--ink)", fontWeight: 700 }}>{sub}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Tile({ k, v, extra }: { k: string; v: string; extra?: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--line)",
        borderRadius: 7,
        padding: "7px 9px",
      }}
    >
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, color: "var(--ink-soft)" }}>{k}</div>
      {v ? (
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 14, fontWeight: 700, marginTop: 2 }}>{v}</div>
      ) : null}
      {extra}
    </div>
  );
}

function DirChip({ dir }: { dir: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "#fff",
        border: "1px solid var(--line)",
        padding: "1px 6px",
        borderRadius: 5,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        marginTop: 2,
      }}
    >
      {dir}
    </div>
  );
}

function LtRow({ k, v, variant }: { k: string; v: string; variant: "hit" | "miss" | "idle" }) {
  const color = variant === "hit" ? "var(--success)" : variant === "miss" ? "var(--p2)" : "var(--ink-soft)";
  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: "5px 9px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 11.5,
      }}
    >
      <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9.5, color: "var(--ink-soft)" }}>{k}</span>
      <span style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 700, fontSize: 11.5, color }}>{v}</span>
    </div>
  );
}

/* ===========================================================================
   Page
   =========================================================================== */

interface PublicMatch {
  matchId: string;
  matchNumber: number;
  status: string;
  isPublicWatch: boolean;
  player1: { id: string; username: string; displayName: string | null } | null;
  player2: { id: string; username: string; displayName: string | null } | null;
  room: { name: string; roomNumber: string; watchingPublic: string; replayShareEnabled: boolean };
}
interface ReplayPayload {
  replayData?: { turns?: TurnSnapshot[] };
  winnerId?: string | null;
  endReason?: string;
}

const DIR_LABEL: Record<Direction, string> = { N: "↑ NORTH", E: "→ EAST", S: "↓ SOUTH", W: "← WEST" };
const ACTION_KIND: Record<string, PanelData["actions"][number]["kind"]> = {
  MOVE_FORWARD: "move",
  SHOOT_FORWARD: "shoot",
  TURN_LEFT: "turn",
  TURN_RIGHT: "turn",
  SCAN: "scan",
  WAIT: "turn",
};
const ACTION_LABEL: Record<string, string> = {
  MOVE_FORWARD: "MOVE FWD",
  SHOOT_FORWARD: "SHOOT",
  TURN_LEFT: "TURN L",
  TURN_RIGHT: "TURN R",
  SCAN: "SCAN",
  WAIT: "WAIT",
};

export default function WatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = (params?.matchId as string | undefined) ?? "";

  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [copied, setCopied] = useState(false);
  const [publicData, setPublicData] = useState<PublicMatch | null>(null);
  const [turns, setTurns] = useState<TurnSnapshot[]>([]);
  const [ended, setEnded] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [resultSummary, setResultSummary] = useState<{ winnerId: string | null; endReason: string } | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;
    fetch(`/api/match/${matchId}/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.matchId) setPublicData(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  useEffect(() => {
    if (!matchId || publicData?.status !== "FINISHED" || turns.length > 0) return;
    let cancelled = false;
    fetch(`/api/match/${matchId}/replay`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ReplayPayload | null) => {
        if (cancelled || !data) return;
        if (data.replayData?.turns?.length) setTurns(data.replayData.turns);
        if (data.endReason) {
          setEnded(true);
          setResultSummary({ winnerId: data.winnerId ?? null, endReason: data.endReason });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId, publicData?.status, turns.length]);

  useEffect(() => {
    if (!matchId) return;
    const socket = connectSocket(matchId);
    const onTurn = (snap: TurnSnapshot) => {
      setTurns((prev) => (prev.some((t) => t.turn === snap.turn) ? prev : [...prev, snap]));
    };
    const onResult = (payload: { winnerId: string | null; endReason: string }) => {
      setEnded(true);
      setResultSummary(payload);
    };
    const onViewerCount = (payload: { matchId: string; count: number }) => {
      if (payload.matchId === matchId) setViewerCount(payload.count);
    };
    socket.on("turn_event", onTurn);
    socket.on("match_result", onResult);
    socket.on("viewer_count", onViewerCount);
    return () => {
      socket.off("turn_event", onTurn);
      socket.off("match_result", onResult);
      socket.off("viewer_count", onViewerCount);
      disconnectSocket();
    };
  }, [matchId]);
  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/watch/${matchId}` : `/watch/${matchId}`),
    [matchId]
  );

  // Derive display values from live data with default fallbacks so the page
  // never renders blank while data is loading.
  const p1Name = publicData?.player1?.displayName ?? publicData?.player1?.username ?? META_DEFAULTS.p1.name;
  const p2Name = publicData?.player2?.displayName ?? publicData?.player2?.username ?? META_DEFAULTS.p2.name;
  const meta = {
    ...META_DEFAULTS,
    matchId: publicData?.matchId ?? matchId,
    roomName: publicData?.room?.name ?? META_DEFAULTS.roomName,
    p1: { id: "P1", name: p1Name, initials: initialsFor(p1Name, "P1") },
    p2: { id: "P2", name: p2Name, initials: initialsFor(p2Name, "P2") },
    viewerCount,
    currentTurn: turns.length,
    mode: (ended ? "ENDED" : "LIVE") as "LIVE" | "REPLAY" | "ENDED",
  };
  const winnerLabel = resultSummary?.winnerId
    ? resultSummary.winnerId === publicData?.player1?.id
      ? "P1"
      : resultSummary.winnerId === publicData?.player2?.id
        ? "P2"
        : "勝者"
    : "引き分け";
  const timelineEvents = timelineFromTurns(turns, winnerLabel, resultSummary?.endReason);

  const latest = turns[turns.length - 1];
  const fmtAction = (
    action: string | undefined
  ): { kind: PanelData["actions"][number]["kind"]; label: string } => ({
    kind: (action ? ACTION_KIND[action] : undefined) ?? "turn",
    label: (action ? ACTION_LABEL[action] : undefined) ?? "—",
  });

  const p1Data: PanelData = {
    side: "p1",
    name: meta.p1.name,
    initials: meta.p1.initials,
    x: latest?.p1.x ?? 0,
    y: latest?.p1.y ?? 0,
    dir: latest ? DIR_LABEL[latest.p1.dir] : "↑ NORTH",
    hp: latest?.p1.hp ?? 100,
    maxHp: 100,
    detected: latest?.p1.scan_detected && latest.p1.detected_targets[0]
      ? `forward: +${latest.p1.detected_targets[0].distance}`
      : "—",
    detectedAge: 0,
    actions: latest
      ? [{ slot: 1, ...fmtAction(latest.p1.action) }]
      : [{ slot: 1, kind: "move", label: "—" }],
    lastTurn: {
      damaged: latest ? String(latest.p1.damaged) : "0",
      shootResult: latest?.p1.shoot_result ?? "—",
      scanDetected: latest?.p1.scan_detected ? "true" : "false",
    },
    score: { dealt: 0, taken: 0 },
  };

  const p2Data: PanelData = {
    side: "p2",
    name: meta.p2.name,
    initials: meta.p2.initials,
    x: latest?.p2.x ?? 9,
    y: latest?.p2.y ?? 9,
    dir: latest ? DIR_LABEL[latest.p2.dir] : "↓ SOUTH",
    hp: latest?.p2.hp ?? 100,
    maxHp: 100,
    detected: latest?.p2.scan_detected && latest.p2.detected_targets[0]
      ? `forward: +${latest.p2.detected_targets[0].distance}`
      : "—",
    detectedAge: 0,
    actions: latest
      ? [{ slot: 1, ...fmtAction(latest.p2.action) }]
      : [{ slot: 1, kind: "move", label: "—" }],
    lastTurn: {
      damaged: latest ? String(latest.p2.damaged) : "0",
      shootResult: latest?.p2.shoot_result ?? "—",
      scanDetected: latest?.p2.scan_detected ? "true" : "false",
    },
    score: { dealt: 0, taken: 0 },
  };

  // Roll up cumulative damage scores from turns we've received.
  for (const t of turns) {
    p1Data.score.taken += t.p1.damaged;
    p2Data.score.taken += t.p2.damaged;
    p1Data.score.dealt += t.p2.damaged;
    p2Data.score.dealt += t.p1.damaged;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div
      style={{
        background: "var(--bg)",
        backgroundImage:
          "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
        backgroundSize: "32px 32px, 32px 32px",
        backgroundPosition: "-1px -1px",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @keyframes livepulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        @keyframes shotflash { 0% { opacity: 0; } 20% { opacity: 1; } 60% { opacity: .9; } 100% { opacity: 0; } }
        @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
      `}</style>

      {/* ============ Header ============ */}
      <TopbarPaper
        centerContent={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 12.5,
            }}
          >
            <ScopePill visibility={meta.visibility} />
            <MetaBlock label="// MATCH" value={`#${meta.matchId}`} mono />
            <MetaSep />
            <MetaBlock label="// ROOM" value={meta.roomName} />
            <MetaSep />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--ink-soft)",
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: ".04em",
                  textTransform: "uppercase",
                }}
              >
                {"// 対戦カード"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, fontWeight: 700, fontSize: 13 }}>
                <PlayerChip side="p1" initials={meta.p1.initials} name={meta.p1.name} />
                <span
                  style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    color: "var(--ink-soft)",
                    fontWeight: 700,
                  }}
                >
                  vs
                </span>
                <PlayerChip side="p2" initials={meta.p2.initials} name={meta.p2.name} />
              </span>
            </div>
          </div>
        }
        rightContent={
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
            <LivePill />
            <ViewerCount count={meta.viewerCount} />
            <button
              aria-label="リンクをコピー"
              onClick={handleCopy}
              style={{
                background: "#fff",
                color: "var(--ink)",
                border: "1px solid var(--line-2)",
                borderRadius: 8,
                padding: "6px 11px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              ⌘ 共有
            </button>
          </div>
        }
      />

      {/* ============ Delay banner ============ */}
      <div
        role="status"
        style={{
          background: "#fff7ed",
          borderBottom: "1px solid #fbd9a5",
          color: "#92400e",
          padding: "8px 24px",
          fontSize: 12.5,
          display: "flex",
          alignItems: "center",
          gap: 10,
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--accent)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          ⏱
        </div>
        <div>
          <strong style={{ color: "#7c2d12", fontWeight: 700 }}>
            公式戦のため {meta.delaySeconds} 秒遅延配信中
          </strong>
          <span style={{ marginLeft: 6, color: "var(--ink-soft)" }}>
            プレイヤーの公平性を保つため、観戦表示はリアルタイムから少し遅れています。
          </span>
        </div>
      </div>

      {/* ============ Shell (3 columns) ============ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr 320px",
          gap: 14,
          padding: "14px 18px 0",
        }}
      >
        <RecognitionPanel data={p1Data} />

        {/* Board column */}
        <section
          aria-label="実盤面"
          style={{
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(180deg, #fdfaf0, #fbf6e7)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <header
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderBottom: "1px dashed var(--line)",
              background: "rgba(255,255,255,.4)",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              実盤面{" "}
              <small
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "var(--ink-soft)",
                  fontWeight: 500,
                  marginLeft: 6,
                }}
              >
                {"// ground truth"}
              </small>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink-soft)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {BOARD.width} × {BOARD.height}
              </span>
              <span
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  background: "#fff",
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "3px 9px",
                }}
              >
                Turn {meta.currentTurn}
                <small style={{ color: "var(--ink-soft)", fontWeight: 600, fontSize: 10.5 }}>
                  {" "}
                  / {meta.totalTurns}
                </small>
              </span>
            </div>
          </header>

          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "22px 18px",
              minHeight: 0,
            }}
          >
            <Board
              tanks={[
                { id: "P1", x: p1Data.x, y: p1Data.y, dir: (latest?.p1.dir ?? "E") as Direction, name: meta.p1.initials },
                { id: "P2", x: p2Data.x, y: p2Data.y, dir: (latest?.p2.dir ?? "W") as Direction, name: meta.p2.initials },
              ]}
            />
          </div>

          {/* Replay controls */}
          <div
            style={{
              padding: "12px 14px",
              background: "#fff",
              borderTop: "1px solid var(--line)",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <RcBtn aria-label="最初へ">⏮</RcBtn>
              <RcBtn aria-label="1 ターン戻る">⏪</RcBtn>
              <RcBtn aria-label="再生" variant="play">
                ▶
              </RcBtn>
              <RcBtn aria-label="1 ターン進む">⏩</RcBtn>
              <RcBtn aria-label="最後へ">⏭</RcBtn>
            </div>

            {/* Scrubber */}
            <div style={{ position: "relative", height: 22 }}>
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 8,
                  height: 6,
                  background: "var(--bg-2)",
                  border: "1px solid var(--line)",
                  borderRadius: 5,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${(meta.currentTurn / meta.totalTurns) * 100}%`,
                    background: "linear-gradient(90deg, var(--accent), #fbbf24)",
                  }}
                />
              </div>
              <div
                aria-label={`現在ターン ${meta.currentTurn}`}
                style={{
                  position: "absolute",
                  top: 3,
                  width: 16,
                  height: 16,
                  background: "#fff",
                  border: "2px solid var(--accent)",
                  borderRadius: "50%",
                  transform: "translateX(-50%)",
                  boxShadow: "0 1px 4px rgba(31,35,48,.18)",
                  left: `${(meta.currentTurn / meta.totalTurns) * 100}%`,
                }}
              />
              {/* Event ticks */}
              <ScrubTick left={15} variant="first" title="First @ T3" />
              <ScrubTick left={25} variant="item" title="アイテム @ T5" />
              <ScrubTick left={35} variant="hit" title="命中 @ T7" />
              <ScrubTick left={40} variant="hit" title="命中 @ T8" />
            </div>

            {/* Speed selector */}
            <div
              role="group"
              aria-label="再生速度"
              style={{
                display: "flex",
                gap: 4,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 7,
                padding: 3,
              }}
            >
              {([0.5, 1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  style={{
                    appearance: "none",
                    border: "none",
                    background: speed === s ? "var(--accent)" : "transparent",
                    color: speed === s ? "#fff" : "var(--ink-soft)",
                    padding: "4px 8px",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 5,
                    cursor: "pointer",
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Live button */}
            <button
              aria-label="ライブに追従"
              style={{
                background: "var(--danger)",
                color: "#fff",
                border: "none",
                padding: "6px 12px",
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "JetBrains Mono, monospace",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                letterSpacing: ".04em",
              }}
            >
              <span
                aria-hidden
                style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }}
              />
              LIVE に戻る
            </button>
          </div>
        </section>

        <RecognitionPanel data={p2Data} />
      </div>

      {/* ============ Below grid: timeline + commentary ============ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 14,
          padding: "14px 18px 18px",
        }}
      >
        {/* Timeline */}
        <section
          aria-label="試合タイムライン"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 1px 2px rgba(31,35,48,.04)",
          }}
        >
          <header
            style={{
              padding: "12px 16px 9px",
              borderBottom: "1px dashed var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              試合タイムライン{" "}
              <small
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "var(--ink-soft)",
                  fontWeight: 500,
                  marginLeft: 6,
                }}
              >
                {"// 0 → {meta.totalTurns}"}
              </small>
            </h2>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              現在:{" "}
              <strong style={{ color: "var(--ink)" }}>T{meta.currentTurn}</strong>
            </span>
          </header>
          <div style={{ padding: "14px 16px" }}>
            <div
              style={{
                position: "relative",
                height: 36,
                background: "var(--bg)",
                border: "1px solid var(--line)",
                borderRadius: 7,
              }}
            >
              {/* Cursor */}
              <span
                aria-label="現在ターン"
                style={{
                  position: "absolute",
                  width: 2,
                  top: -4,
                  bottom: -4,
                  background: "var(--ink)",
                  borderRadius: 1,
                  transform: "translateX(-50%)",
                  left: `${(meta.currentTurn / meta.totalTurns) * 100}%`,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -16,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "var(--ink)",
                    color: "#fff",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  T{meta.currentTurn}
                </span>
              </span>
              {/* Events */}
              {timelineEvents.map((ev, index) => {
                const bg = ev.kind === "finish" ? "var(--ink)" : "var(--p2)";
                return (
                  <div
                    key={`${ev.turn}-${ev.kind}-${index}`}
                    title={`${ev.label} @ T${ev.turn}`}
                    style={{
                      position: "absolute",
                      top: 4,
                      bottom: 4,
                      width: 14,
                      background: bg,
                      transform: "translateX(-50%)",
                      borderRadius: 4,
                      display: "grid",
                      placeItems: "center",
                      color: "#fff",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1.5px solid #fff",
                      boxShadow: "0 1px 3px rgba(31,35,48,.18)",
                      left: `${(ev.turn / meta.totalTurns) * 100}%`,
                    }}
                  >
                    {ev.icon}
                  </div>
                );
              })}
              {timelineEvents.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--ink-soft)",
                    fontSize: 12,
                  }}
                >
                  まだタイムラインイベントはありません
                </div>
              )}
              {/* Tick labels */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: -16,
                  display: "flex",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 9.5,
                  color: "var(--ink-soft)",
                }}
              >
                {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((n) => (
                  <span key={n} style={{ flex: 1, textAlign: "center" }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: 22,
                fontSize: 11,
                color: "var(--ink-soft)",
                flexWrap: "wrap",
              }}
            >
              <LegendDot color="var(--accent)" label="First Damage" />
              <LegendDot color="#7c3aed" label="アイテム取得" />
              <LegendDot color="var(--p2)" label="命中" />
              <LegendDot color="var(--success)" label="決着" />
            </div>
          </div>
        </section>

        {/* Commentary feed */}
        <section
          aria-label="解説ノート"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 1px 2px rgba(31,35,48,.04)",
          }}
        >
          <header
            style={{
              padding: "12px 16px 9px",
              borderBottom: "1px dashed var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
              解説ノート{" "}
              <small
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 11,
                  color: "var(--ink-soft)",
                  fontWeight: 500,
                  marginLeft: 6,
                }}
              >
                {"// commentary feed"}
              </small>
            </h2>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 10,
                color: "var(--ink-soft)",
              }}
            >
              future: live receive
            </span>
          </header>
          <div style={{ padding: "14px 16px" }}>
            <div
              style={{
                textAlign: "center",
                padding: "18px 6px",
                color: "var(--ink-soft)",
                fontSize: 12,
                border: "1px dashed var(--line-2)",
                borderRadius: 8,
                background: "var(--bg)",
                marginBottom: 12,
              }}
            >
              <strong style={{ color: "var(--ink)", display: "block", fontSize: 12.5, marginBottom: 2 }}>
                📝 解説ライブ受信領域 (今回はモック)
              </strong>
              本番では実況・先生のメモが流れます。
            </div>
            <div style={{ maxHeight: 260, overflowY: "auto", padding: "0 2px" }}>
              {COMMENTARY.map((c, i) => (
                <div
                  key={c.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "32px 1fr",
                    gap: 9,
                    padding: "9px 0",
                    borderBottom: i < COMMENTARY.length - 1 ? "1px dashed var(--line)" : "none",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: c.host ? "var(--accent-soft)" : "var(--bg-2)",
                      color: c.host ? "#92400e" : "var(--ink-soft)",
                      border: `1px solid ${c.host ? "#fbd9a5" : "var(--line)"}`,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {c.initials}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 12.5,
                          color: c.host ? "#92400e" : "var(--ink)",
                        }}
                      >
                        {c.name}
                      </span>
                      <span
                        style={{
                          background: "var(--bg-2)",
                          border: "1px solid var(--line)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 10,
                          color: "var(--ink)",
                          fontWeight: 600,
                        }}
                      >
                        T{c.turn}
                      </span>
                      <span
                        style={{
                          fontFamily: "JetBrains Mono, monospace",
                          fontSize: 10,
                          color: "var(--ink-soft)",
                        }}
                      >
                        {c.time}
                      </span>
                    </div>
                    <div style={{ color: "var(--ink)" }}>
                      {c.emphasis ? (
                        <>
                          {c.text.split(c.emphasis).flatMap((seg, idx, arr) =>
                            idx < arr.length - 1
                              ? [
                                  <span key={`s-${idx}`}>{seg}</span>,
                                  <em
                                    key={`e-${idx}`}
                                    style={{ color: "var(--accent)", fontStyle: "normal", fontWeight: 700 }}
                                  >
                                    {c.emphasis}
                                  </em>,
                                ]
                              : [<span key={`s-${idx}`}>{seg}</span>]
                          )}
                        </>
                      ) : (
                        c.text
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* ============ Share card ============ */}
      <section
        aria-label="シェア"
        style={{
          background: "linear-gradient(180deg, #fdfdf8, #faf7ed)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "14px 16px",
          margin: "0 18px 14px",
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <strong style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
            この試合をシェア
          </strong>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
            リンクをコピーして友達やクラスメイトに共有しましょう。
          </p>
        </div>
        <div style={{ flex: 1, display: "flex", gap: 6, minWidth: 280 }}>
          <div
            aria-label="共有 URL"
            style={{
              flex: 1,
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 7,
              padding: "7px 10px",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11.5,
              color: "var(--ink)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {shareUrl}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleCopy}
              style={{
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 7,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {copied ? "✓ コピー済み" : "⌘ リンクをコピー"}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#fff",
                color: "var(--ink)",
                border: "1px solid var(--line-2)",
                borderRadius: 8,
                padding: "6px 11px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                textDecoration: "none",
              }}
            >
              𝕏 共有
            </a>
          </div>
        </div>
      </section>

      {/* ============ "What is this game?" footer ============ */}
      <aside
        aria-label="ゲームの説明"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 14,
          padding: "16px 22px",
          margin: "0 18px 24px",
          display: "grid",
          gridTemplateColumns: "56px 1fr auto",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "var(--ink)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 800,
            fontSize: 20,
          }}
        >
          ?
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>これは何のゲーム?</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            「対戦・コーディング」は、Blockly でロボットの行動ロジックを組んで自動対戦させる、プログラミング学習ゲームです。
            盤面のロボットは事前に書かれた「もし敵が前方なら攻撃する」のようなルールで動きます。
          </div>
        </div>
        <a
          href="#about"
          style={{
            background: "#fff",
            color: "var(--ink)",
            border: "1px solid var(--line-2)",
            borderRadius: 8,
            padding: "9px 14px",
            fontSize: 12.5,
            fontWeight: 600,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          サービスについて →
        </a>
      </aside>

    </div>
  );
}

/* ===========================================================================
   Header sub-components
   =========================================================================== */

function MetaBlock({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--ink-soft)",
          fontFamily: "JetBrains Mono, monospace",
          letterSpacing: ".04em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontWeight: 700,
          fontSize: 13,
          marginTop: 1,
          fontFamily: mono ? "JetBrains Mono, monospace" : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function MetaSep() {
  return <div style={{ width: 1, height: 26, background: "var(--line-2)" }} />;
}

function PlayerChip({ side, initials, name }: { side: "p1" | "p2"; initials: string; name: string }) {
  const isP1 = side === "p1";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px 3px 4px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 12.5,
        background: isP1 ? "var(--p1-soft)" : "var(--p2-soft)",
        color: isP1 ? "var(--p1-ink)" : "var(--p2-ink)",
        border: `1px solid ${isP1 ? "#bfd5fa" : "#fbb6b6"}`,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: 11,
          fontWeight: 700,
          fontFamily: "JetBrains Mono, monospace",
          background: isP1 ? "var(--p1)" : "var(--p2)",
          color: "#fff",
          border: `1px solid ${isP1 ? "var(--p1-ink)" : "var(--p2-ink)"}`,
        }}
      >
        {initials}
      </span>
      {name}
    </span>
  );
}

/* ===========================================================================
   Board (10x10)
   =========================================================================== */

function Board({ tanks }: { tanks: LiveTank[] }) {
  return (
    <div
      aria-label="10x10 盤面"
      style={{
        position: "relative",
        width: CELL_PX * BOARD.width,
        height: CELL_PX * BOARD.height,
        background: "#fbf7ec",
        backgroundImage:
          "linear-gradient(rgba(31,35,48,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(31,35,48,.07) 1px, transparent 1px)",
        backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
        border: "1px solid var(--line-2)",
        borderRadius: 8,
        boxShadow: "0 1px 0 #fff inset, 0 4px 12px rgba(31,35,48,.06)",
      }}
    >
      {/* Obstacles */}
      {BOARD.obstacles.map(([x, y]) => (
        <div
          key={`obs-${x}-${y}`}
          style={{
            position: "absolute",
            width: CELL_PX,
            height: CELL_PX,
            display: "grid",
            placeItems: "center",
            left: x * CELL_PX,
            top: y * CELL_PX,
          }}
        >
          <div
            style={{
              width: "80%",
              height: "80%",
              background:
                "repeating-linear-gradient(45deg, var(--line-2), var(--line-2) 3px, var(--bg-2) 3px, var(--bg-2) 6px)",
              border: "1px solid var(--ink-soft)",
              borderRadius: 4,
            }}
          />
        </div>
      ))}
      {/* Items */}
      {BOARD.items.map((it) => (
        <div
          key={`it-${it.x}-${it.y}`}
          title={it.kind}
          style={{
            position: "absolute",
            width: CELL_PX,
            height: CELL_PX,
            display: "grid",
            placeItems: "center",
            animation: "floaty 2.4s ease-in-out infinite",
            left: it.x * CELL_PX,
            top: it.y * CELL_PX,
          }}
        >
          <ItemGlyph kind={it.kind} />
        </div>
      ))}
      {/* Tanks */}
      {tanks.map((t) => (
        <div
          key={`tk-${t.id}`}
          style={{
            position: "absolute",
            width: CELL_PX,
            height: CELL_PX,
            display: "grid",
            placeItems: "center",
            left: t.x * CELL_PX,
            top: t.y * CELL_PX,
          }}
        >
          <TankGlyph side={t.id === "P1" ? "p1" : "p2"} name={t.name} dir={t.dir} />
        </div>
      ))}
    </div>
  );
}

/* ===========================================================================
   Misc small helpers
   =========================================================================== */

function RcBtn({
  children,
  variant,
  ...rest
}: {
  children: React.ReactNode;
  variant?: "play";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const isPlay = variant === "play";
  return (
    <button
      {...rest}
      style={{
        appearance: "none",
        border: isPlay ? "1px solid var(--accent)" : "1px solid var(--line-2)",
        background: isPlay ? "var(--accent)" : "#fff",
        color: isPlay ? "#fff" : "var(--ink)",
        borderRadius: 7,
        width: isPlay ? 36 : 30,
        height: isPlay ? 36 : 30,
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 11,
        fontWeight: 700,
        boxShadow: isPlay ? "0 1px 0 #c2740a" : undefined,
      }}
    >
      {children}
    </button>
  );
}

function ScrubTick({
  left,
  variant,
  title,
}: {
  left: number;
  variant: "first" | "item" | "hit";
  title: string;
}) {
  const bg = variant === "first" ? "var(--accent)" : variant === "item" ? "#7c3aed" : "var(--p2)";
  return (
    <span
      title={title}
      style={{
        position: "absolute",
        top: 0,
        width: 5,
        height: 12,
        background: bg,
        borderRadius: 2,
        transform: "translateX(-50%)",
        left: `${left}%`,
      }}
    />
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span>
      <span
        style={{
          display: "inline-block",
          width: 10,
          height: 10,
          borderRadius: 3,
          marginRight: 4,
          verticalAlign: -1,
          background: color,
        }}
      />
      {label}
    </span>
  );
}
