"use client";

// bind: GET /api/match/:matchId/public
// bind: GET /api/match/:matchId/replay
// bind: WS subscribe (live)

import { useState, useMemo, useEffect } from "react";
import { useParams } from "next/navigation";
import { TopbarPaper } from "@/components/layout/TopbarPaper";
import { connectSocket, disconnectSocket } from "@/lib/socket-client";

/* ===========================================================================
   Dummy data — mirrors GET /api/match/:matchId/public + /replay payloads
   =========================================================================== */

const META = {
  matchId: "M-22064",
  visibility: "PUBLIC" as "PUBLIC" | "LIMITED",
  delaySeconds: 15,
  mode: "LIVE" as "LIVE" | "REPLAY" | "ENDED",
  viewerCount: 14,
  viewerDelta: 3,
  roomName: "3-A クラス・5月課題",
  p1: { id: "P1", name: "たろう_06", initials: "TR" },
  p2: { id: "P2", name: "HanaCoder", initials: "HC" },
  totalTurns: 20,
  currentTurn: 8,
  shareUrl: "https://taisen-coding.example.jp/watch/M-22064",
};

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
  tanks: [
    { id: "P1", x: 3, y: 6, dir: "N" as const, name: "TR" },
    { id: "P2", x: 6, y: 3, dir: "S" as const, name: "HC" },
  ],
  shot: { from: { x: 3, y: 6 }, to: { x: 3, y: 3 }, hit: false },
};

const TIMELINE_EVENTS = [
  { turn: 3, kind: "first" as const, label: "P1 が FirstDamage", icon: "★" },
  { turn: 4, kind: "item" as const, label: "P2 アイテム取得", icon: "◇" },
  { turn: 5, kind: "hit" as const, label: "命中", icon: "●" },
  { turn: 6, kind: "item" as const, label: "P1 BARRIER", icon: "◇" },
  { turn: 8, kind: "hit" as const, label: "命中", icon: "●" },
];

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

function ViewerCount({ count, delta }: { count: number; delta: number }) {
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
      <span style={{ color: "var(--success)", fontSize: 10 }}>+{delta}</span>
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
   State-gallery mini board
   =========================================================================== */

function MiniBoard({ blur, p1Pos, p2Pos, p2Faded }: { blur?: boolean; p1Pos: [number, number]; p2Pos: [number, number]; p2Faded?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1",
        background: "#fbf7ec",
        backgroundImage:
          "linear-gradient(rgba(31,35,48,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(31,35,48,.08) 1px, transparent 1px)",
        backgroundSize: "12.5% 12.5%",
        border: "1px solid var(--line-2)",
        borderRadius: 6,
        position: "relative",
        marginTop: 7,
        filter: blur ? "blur(2.5px)" : undefined,
        pointerEvents: blur ? "none" : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "9%",
          height: "9%",
          borderRadius: 2,
          background: "var(--p1)",
          border: "1px solid var(--p1-ink)",
          left: `${p1Pos[0]}%`,
          top: `${p1Pos[1]}%`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: "9%",
          height: "9%",
          borderRadius: 2,
          background: "var(--p2)",
          border: "1px solid var(--p2-ink)",
          left: `${p2Pos[0]}%`,
          top: `${p2Pos[1]}%`,
          opacity: p2Faded ? 0.35 : 1,
        }}
      />
    </div>
  );
}

function MiniPill({
  variant,
  children,
}: {
  variant: "public" | "limited" | "live" | "replay" | "delay" | "ended";
  children: React.ReactNode;
}) {
  const palette: Record<typeof variant, React.CSSProperties> = {
    public: { background: "var(--accent-soft)", color: "#92400e", borderColor: "#fbd9a5" },
    limited: { background: "var(--bg-2)", color: "var(--ink-soft)", borderColor: "var(--line-2)" },
    live: { background: "var(--danger)", color: "#fff", borderColor: "var(--danger)" },
    replay: { background: "var(--ink)", color: "#fff", borderColor: "var(--ink)" },
    delay: { background: "#fff7ed", color: "#92400e", borderColor: "#fbd9a5" },
    ended: { background: "var(--success)", color: "#fff", borderColor: "var(--success)" },
  };
  return (
    <span
      style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9.5,
        fontWeight: 700,
        padding: "2px 6px",
        borderRadius: 4,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        letterSpacing: ".04em",
        border: "1px solid",
        ...palette[variant],
      }}
    >
      {variant === "live" ? (
        <span
          aria-hidden
          style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: "livepulse 1.4s ease-in-out infinite" }}
        />
      ) : null}
      {children}
    </span>
  );
}

/* ===========================================================================
   Page
   =========================================================================== */

export default function WatchPage() {
  const params = useParams<{ matchId: string }>();
  const matchId = (params?.matchId as string | undefined) ?? META.matchId;

  const [speed, setSpeed] = useState<0.5 | 1 | 2 | 4>(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = connectSocket(matchId);
    const onTurn = (data: unknown) => console.log("watch turn_event", data);
    const onResult = (data: unknown) => console.log("watch match_result", data);
    socket.on("turn_event", onTurn);
    socket.on("match_result", onResult);
    return () => {
      socket.off("turn_event", onTurn);
      socket.off("match_result", onResult);
      disconnectSocket();
    };
  }, [matchId]);
  const shareUrl = useMemo(
    () => `https://taisen-coding.example.jp/watch/${matchId}`,
    [matchId]
  );

  const p1Data: PanelData = {
    side: "p1",
    name: META.p1.name,
    initials: META.p1.initials,
    x: 3,
    y: 6,
    dir: "↑ NORTH",
    hp: 84,
    maxHp: 100,
    detected: "forward: +3 · right: +3",
    detectedAge: 0,
    actions: [
      { slot: 1, kind: "move", label: "MOVE FWD" },
      { slot: 2, kind: "shoot", label: "SHOOT" },
    ],
    lastTurn: { damaged: "0", shootResult: "MISS", scanDetected: "true" },
    score: { dealt: 24, taken: 16 },
  };

  const p2Data: PanelData = {
    side: "p2",
    name: META.p2.name,
    initials: META.p2.initials,
    x: 6,
    y: 3,
    dir: "↓ SOUTH",
    hp: 76,
    maxHp: 100,
    detected: "forward: +3 · right: −3",
    detectedAge: 0,
    actions: [
      { slot: 1, kind: "turn", label: "TURN R" },
      { slot: 2, kind: "move", label: "MOVE FWD" },
    ],
    lastTurn: { damaged: "8 ↓", shootResult: "—", scanDetected: "false" },
    score: { dealt: 16, taken: 24 },
  };

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
            <ScopePill visibility={META.visibility} />
            <MetaBlock label="// MATCH" value={`#${META.matchId}`} mono />
            <MetaSep />
            <MetaBlock label="// ROOM" value={META.roomName} />
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
                <PlayerChip side="p1" initials={META.p1.initials} name={META.p1.name} />
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
                <PlayerChip side="p2" initials={META.p2.initials} name={META.p2.name} />
              </span>
            </div>
          </div>
        }
        rightContent={
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
            <LivePill />
            <ViewerCount count={META.viewerCount} delta={META.viewerDelta} />
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
            公式戦のため {META.delaySeconds} 秒遅延配信中
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
                Turn {META.currentTurn}
                <small style={{ color: "var(--ink-soft)", fontWeight: 600, fontSize: 10.5 }}>
                  {" "}
                  / {META.totalTurns}
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
            <Board />
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
                    width: `${(META.currentTurn / META.totalTurns) * 100}%`,
                    background: "linear-gradient(90deg, var(--accent), #fbbf24)",
                  }}
                />
              </div>
              <div
                aria-label={`現在ターン ${META.currentTurn}`}
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
                  left: `${(META.currentTurn / META.totalTurns) * 100}%`,
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
                {"// 0 → {META.totalTurns}"}
              </small>
            </h2>
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
              現在:{" "}
              <strong style={{ color: "var(--ink)" }}>T{META.currentTurn}</strong>
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
                  left: `${(META.currentTurn / META.totalTurns) * 100}%`,
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
                  T{META.currentTurn}
                </span>
              </span>
              {/* Events */}
              {TIMELINE_EVENTS.map((ev) => {
                const bg =
                  ev.kind === "first" ? "var(--accent)" : ev.kind === "item" ? "#7c3aed" : "var(--p2)";
                return (
                  <div
                    key={`${ev.turn}-${ev.kind}`}
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
                      left: `${(ev.turn / META.totalTurns) * 100}%`,
                    }}
                  >
                    {ev.icon}
                  </div>
                );
              })}
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

      {/* ============ State gallery ============ */}
      <section
        aria-label="状態バリエーション"
        style={{ maxWidth: 1440, margin: "28px auto 32px", padding: "0 28px" }}
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
          <h2 style={{ margin: 0, fontSize: 14, fontFamily: "JetBrains Mono, monospace" }}>
            {"// state variations"}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-soft)" }}>
            公開観戦 / 限定 (要ログイン) / アクセス拒否 / Live↔Replay 切替 / 遅延配信 / 試合終了
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 14 }}>
          {/* Public */}
          <StateCard name="公開観戦" tag="public">
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
              <MiniPill variant="public">⌖ 公開</MiniPill>
              <MiniPill variant="live">LIVE</MiniPill>
            </div>
            <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--ink-soft)" }}>
              観戦 14 名
            </div>
            <MiniBoard p1Pos={[30, 60]} p2Pos={[60, 30]} />
            <button style={miniCtaStyle()}>⌘ リンクをコピー</button>
          </StateCard>

          {/* Limited */}
          <StateCard name="限定観戦" tag="login">
            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
              <MiniPill variant="limited">🔒 限定</MiniPill>
              <MiniPill variant="live">LIVE</MiniPill>
            </div>
            <div style={warnBoxStyle()}>このルームの観戦にはログインが必要です。</div>
            <MiniBoard blur p1Pos={[35, 55]} p2Pos={[55, 40]} />
            <button style={miniCtaStyle()}>ログインして観戦</button>
          </StateCard>

          {/* Forbidden */}
          <StateCard name="アクセス拒否" tag="403">
            <div
              style={{
                background: "var(--p2-soft)",
                border: "1px solid #fbb6b6",
                color: "var(--p2-ink)",
                borderRadius: 6,
                padding: "7px 9px",
                fontSize: 10.5,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ display: "block", fontSize: 11, marginBottom: 2 }}>403 Forbidden</strong>
              このマッチは観戦権限がありません。
            </div>
            <div style={{ textAlign: "center", padding: "14px 6px 8px", color: "var(--ink-soft)" }}>
              <div
                aria-hidden
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "var(--bg-2)",
                  border: "1px dashed var(--line-2)",
                  margin: "0 auto 6px",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: 16,
                }}
              >
                ⛔
              </div>
              <strong style={{ display: "block", color: "var(--ink)", fontSize: 11.5, marginBottom: 2 }}>
                表示できません
              </strong>
              <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45 }}>
                ルーム管理者に観戦許可を依頼してください。
              </p>
            </div>
            <button style={miniCtaStyle(true)}>← 戻る</button>
          </StateCard>

          {/* Live ↔ Replay toggle */}
          <StateCard name="Live ↔ Replay" tag="toggle">
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <MiniPill variant="replay">⏵ REPLAY</MiniPill>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--ink-soft)" }}>
                T6 / T8 を巻き戻し中
              </span>
            </div>
            <MiniBoard p1Pos={[30, 55]} p2Pos={[55, 35]} />
            <button style={{ ...miniCtaStyle(), background: "var(--danger)" }}>
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#fff",
                  marginRight: 4,
                }}
              />
              LIVE に戻る
            </button>
          </StateCard>

          {/* Delayed broadcast */}
          <StateCard name="遅延配信" tag="delayed">
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <MiniPill variant="public">⌖ 公開</MiniPill>
              <MiniPill variant="delay">⏱ +15s</MiniPill>
            </div>
            <div style={warnBoxStyle()}>
              <strong style={{ display: "block", fontSize: 11, color: "#7c2d12" }}>
                公式戦のため 15 秒遅延
              </strong>
              公平性のためリアルタイムから少し遅れます。
            </div>
            <MiniBoard p1Pos={[30, 60]} p2Pos={[60, 30]} />
          </StateCard>

          {/* Ended */}
          <StateCard name="試合終了" tag="ended">
            <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <MiniPill variant="public">⌖ 公開</MiniPill>
              <MiniPill variant="ended">✓ ENDED</MiniPill>
            </div>
            <div
              style={{
                background: "linear-gradient(180deg, #fdfdf8, #fef3c7)",
                border: "1px solid #fbd9a5",
                borderRadius: 7,
                padding: "7px 9px",
                marginTop: 5,
                fontSize: 10.5,
                textAlign: "center",
              }}
            >
              <strong style={{ display: "block", fontSize: 11.5, color: "var(--p1-ink)", marginBottom: 2 }}>
                勝者: たろう_06
              </strong>
              <span style={{ color: "var(--ink-soft)" }}>T16 で決着</span>
            </div>
            <MiniBoard p1Pos={[45, 45]} p2Pos={[55, 40]} p2Faded />
            <button style={miniCtaStyle()}>⏵ もう一度リプレイ</button>
          </StateCard>
        </div>
      </section>
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

function Board() {
  const sx = BOARD.shot.from.x * CELL_PX + CELL_PX / 2;
  const sy = BOARD.shot.from.y * CELL_PX + CELL_PX / 2;
  const ex = BOARD.shot.to.x * CELL_PX + CELL_PX / 2;
  const ey = BOARD.shot.to.y * CELL_PX + CELL_PX / 2;
  const dx = ex - sx;
  const dy = ey - sy;
  const shotLen = Math.hypot(dx, dy);
  const shotAng = (Math.atan2(dy, dx) * 180) / Math.PI;

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
      {BOARD.tanks.map((t) => (
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
      {/* Shot line */}
      <div
        style={{
          position: "absolute",
          background:
            "linear-gradient(90deg, rgba(239,68,68,.05), rgba(239,68,68,.85), rgba(239,68,68,.05))",
          height: 3,
          borderRadius: 2,
          transformOrigin: "0 50%",
          boxShadow: "0 0 6px rgba(239,68,68,.4)",
          animation: "shotflash 1.4s ease-out infinite",
          left: sx,
          top: sy - 1.5,
          width: shotLen,
          transform: `rotate(${shotAng}deg)`,
        }}
      />
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

function StateCard({
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
        <span style={{ fontWeight: 700, fontSize: 11 }}>{name}</span>
        <span
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9,
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
      <div style={{ padding: 10 }}>{children}</div>
    </article>
  );
}

function miniCtaStyle(ghost?: boolean): React.CSSProperties {
  return ghost
    ? {
        background: "#fff",
        color: "var(--ink-soft)",
        border: "1px solid var(--line-2)",
        padding: 6,
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        width: "100%",
        marginTop: 7,
        cursor: "pointer",
      }
    : {
        background: "var(--accent)",
        color: "#fff",
        border: "none",
        padding: 6,
        borderRadius: 5,
        fontSize: 10,
        fontWeight: 700,
        width: "100%",
        marginTop: 7,
        cursor: "pointer",
      };
}

function warnBoxStyle(): React.CSSProperties {
  return {
    background: "#fff7ed",
    border: "1px solid #fbd9a5",
    color: "#92400e",
    borderRadius: 6,
    padding: "6px 9px",
    fontSize: 10.5,
    lineHeight: 1.45,
    marginTop: 5,
    marginBottom: 6,
  };
}
