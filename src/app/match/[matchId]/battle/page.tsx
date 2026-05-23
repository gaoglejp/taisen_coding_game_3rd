"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { connectSocket, disconnectSocket } from "@/lib/socket-client";
import type { TurnSnapshot } from "@/lib/match-simulator";

const MOCK_MATCH = {
  matchId: "match-001",
  roomName: "教室A-5限",
  matchNo: 7,
  p1Name: "はなこ",
  p2Name: "たろう",
  spectatorCount: 12,
};

const MAX_TURNS = 20;

// 10x10 grid: null=empty, "WALL"=obstacle, "CROSS"=cross attack item, "BARRIER"=barrier item, "REPEAT"=repeat item
const GRID_DATA: Record<string, string> = {
  "2,3": "WALL",
  "4,4": "WALL",
  "6,2": "WALL",
  "7,7": "WALL",
  "3,8": "WALL",
  "1,4": "CROSS",
  "8,3": "BARRIER",
  "5,6": "REPEAT",
};

interface Player {
  x: number;
  y: number;
  dir: "N" | "E" | "S" | "W";
  hp: number;
  maxHp: number;
}

const INITIAL_P1: Player = { x: 0, y: 0, dir: "E", hp: 100, maxHp: 100 };
const INITIAL_P2: Player = { x: 9, y: 9, dir: "W", hp: 100, maxHp: 100 };

const DIR_ARROW: Record<string, string> = { N: "↑", E: "→", S: "↓", W: "←" };

function HpBar({ hp, max, color }: { hp: number; max: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, fontSize: 11, fontWeight: 600 }}>
        <span>HP</span>
        <span style={{ fontFamily: "JetBrains Mono, monospace" }}>
          {hp} / {max}
        </span>
      </div>
      <div style={{ height: 8, background: "var(--line)", borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            width: `${(hp / max) * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 999,
            transition: "width 0.4s",
          }}
        />
      </div>
    </div>
  );
}

function CompassGrid({ player }: { player: string }) {
  const cells = [
    { pos: "N", label: "↑" },
    { pos: "E", label: "→" },
    { pos: "S", label: "↓" },
    { pos: "W", label: "←" },
  ];
  const mockStates: Record<string, { state: string; color: string }> = {
    N: { state: "OPEN", color: "#dcfce7" },
    E: { state: "PLAYER", color: player === "p1" ? "#dbeafe" : "#fee2e2" },
    S: { state: "WALL", color: "#f3f4f6" },
    W: { state: "OBSTACLE", color: "#fef3c7" },
  };
  const grid = [
    [null, "N", null],
    ["W", "●", "E"],
    [null, "S", null],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 40px)", gap: 2 }}>
      {grid.flat().map((cell, i) => {
        if (!cell)
          return <div key={i} style={{ width: 40, height: 40 }} />;
        if (cell === "●")
          return (
            <div
              key={i}
              style={{
                width: 40,
                height: 40,
                background: player === "p1" ? "var(--p1)" : "var(--p2)",
                borderRadius: 8,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              ●
            </div>
          );
        const s = mockStates[cell];
        return (
          <div
            key={i}
            style={{
              width: 40,
              height: 40,
              background: s.color,
              borderRadius: 6,
              border: "1px solid var(--line)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 700,
            }}
          >
            <span style={{ fontSize: 14 }}>{cell}</span>
            <span style={{ color: "#6b7280", fontSize: 8 }}>{s.state}</span>
          </div>
        );
      })}
    </div>
  );
}

function RecognitionPanel({
  player,
  playerData,
  accentColor,
  softColor,
  inkColor,
}: {
  player: "p1" | "p2";
  playerData: Player;
  accentColor: string;
  softColor: string;
  inkColor: string;
}) {
  const name = player === "p1" ? MOCK_MATCH.p1Name : MOCK_MATCH.p2Name;
  return (
    <div
      style={{
        width: 320,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px 16px",
        background: "var(--surface)",
        borderRight: player === "p1" ? "1px solid var(--line)" : "none",
        borderLeft: player === "p2" ? "1px solid var(--line)" : "none",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            background: accentColor,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
          }}
        >
          {player === "p1" ? "P1" : "P2"} {name}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>
          プログラムの判断材料です
        </span>
      </div>

      {/* Status */}
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 10,
          padding: 12,
          border: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 12 }}>
            <span style={{ color: "var(--ink-soft)" }}>x=</span>
            <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              {playerData.x}
            </span>
          </span>
          <span style={{ fontSize: 12 }}>
            <span style={{ color: "var(--ink-soft)" }}>y=</span>
            <span style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              {playerData.y}
            </span>
          </span>
          <span
            style={{
              background: softColor,
              color: inkColor,
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 8px",
              borderRadius: 999,
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {DIR_ARROW[playerData.dir]}
            {playerData.dir === "N"
              ? "NORTH"
              : playerData.dir === "E"
              ? "EAST"
              : playerData.dir === "S"
              ? "SOUTH"
              : "WEST"}
          </span>
        </div>
        <HpBar hp={playerData.hp} max={playerData.maxHp} color={accentColor} />
      </div>

      {/* Surroundings */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
          周囲情報
        </div>
        <CompassGrid player={player} />
      </div>

      {/* Detected targets */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
          detected_targets
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {[
            { label: "forward:2", color: softColor, textColor: inkColor },
            { label: "right:-1", color: "#fef9c3", textColor: "#92400e" },
            { label: "age:1", color: "#f3f4f6", textColor: "#374151" },
          ].map((chip) => (
            <span
              key={chip.label}
              style={{
                background: chip.color,
                color: chip.textColor,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {chip.label}
            </span>
          ))}
        </div>
      </div>

      {/* Last actions */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 6 }}>
          last_actions
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["MOVE_FORWARD", "SHOOT_FORWARD"].map((a) => (
            <span
              key={a}
              style={{
                background: softColor,
                color: inkColor,
                fontSize: 10,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* Last turn */}
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 10,
          padding: 10,
          border: "1px solid var(--line)",
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--ink-soft)", fontSize: 11 }}>
          last_turn
        </div>
        {[
          { key: "damaged", val: player === "p1" ? "15" : "0" },
          { key: "shoot_result", val: player === "p1" ? "HIT" : "MISS" },
          { key: "scan_detected", val: "true" },
          { key: "moved", val: "true" },
        ].map((row) => (
          <div
            key={row.key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
              {row.key}
            </span>
            <span
              style={{
                fontWeight: 600,
                fontFamily: "JetBrains Mono, monospace",
                color:
                  row.key === "damaged" && row.val !== "0"
                    ? "var(--danger)"
                    : row.val === "HIT" || row.val === "true"
                    ? "var(--success)"
                    : "var(--ink)",
              }}
            >
              {row.val}
            </span>
          </div>
        ))}
      </div>

      {/* Score */}
      <div
        style={{
          background: "var(--bg)",
          borderRadius: 10,
          padding: 10,
          border: "1px solid var(--line)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>スコア</div>
        <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ color: "var(--ink-soft)", fontSize: 10, marginBottom: 2 }}>与ダメ</div>
            <div style={{ fontWeight: 700, color: accentColor, fontFamily: "JetBrains Mono, monospace" }}>
              {player === "p1" ? "15" : "0"}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ color: "var(--ink-soft)", fontSize: 10, marginBottom: 2 }}>被ダメ</div>
            <div style={{ fontWeight: 700, fontFamily: "JetBrains Mono, monospace" }}>
              {player === "p1" ? "0" : "15"}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ color: "var(--ink-soft)", fontSize: 10, marginBottom: 2 }}>First</div>
            <span
              style={{
                background: player === "p1" ? "#fef9c3" : "#f3f4f6",
                color: player === "p1" ? "#92400e" : "#6b7280",
                fontSize: 10,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 6,
              }}
            >
              {player === "p1" ? "★" : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BattlePage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = use(params);
  const [turns, setTurns] = useState<TurnSnapshot[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const socket = connectSocket(matchId);
    const onTurn = (snap: TurnSnapshot) => {
      setTurns((prev) => {
        if (prev.some((t) => t.turn === snap.turn)) return prev;
        return [...prev, snap];
      });
      setCurrentTurn(snap.turn);
    };
    const onResult = () => setEnded(true);
    socket.on("turn_event", onTurn);
    socket.on("match_result", onResult);
    return () => {
      socket.off("turn_event", onTurn);
      socket.off("match_result", onResult);
      disconnectSocket();
    };
  }, [matchId]);

  const activeSnapshot = currentTurn > 0 ? turns[currentTurn - 1] : undefined;
  const p1: Player = activeSnapshot
    ? { x: activeSnapshot.p1.x, y: activeSnapshot.p1.y, dir: activeSnapshot.p1.dir, hp: activeSnapshot.p1.hp, maxHp: 100 }
    : INITIAL_P1;
  const p2: Player = activeSnapshot
    ? { x: activeSnapshot.p2.x, y: activeSnapshot.p2.y, dir: activeSnapshot.p2.dir, hp: activeSnapshot.p2.hp, maxHp: 100 }
    : INITIAL_P2;

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentTurn((t) => {
          if (t >= turns.length) {
            setPlaying(false);
            return t;
          }
          return t + 1;
        });
      }, 1000 / speed);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, turns.length]);

  const COLS = "ABCDEFGHIJ";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        background: "var(--bg)",
        maxWidth: 1440,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "linear-gradient(180deg, #fbf8ef, #f6f1e2)",
          borderBottom: "1px solid var(--line)",
          padding: "12px 24px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
          {MOCK_MATCH.roomName} · 対戦 #{MOCK_MATCH.matchNo}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              background: "var(--p1)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 12px",
              borderRadius: 999,
            }}
          >
            P1 {MOCK_MATCH.p1Name}
          </span>
          <span style={{ fontWeight: 700, color: "var(--ink-soft)" }}>vs</span>
          <span
            style={{
              background: "var(--p2)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 12px",
              borderRadius: 999,
            }}
          >
            P2 {MOCK_MATCH.p2Name}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            👁 {MOCK_MATCH.spectatorCount} 人観戦中
          </span>
          <Link
            href={`/match/${matchId}/result`}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: ended ? "var(--p1-ink)" : "#9ca3af",
              textDecoration: "none",
              padding: "6px 14px",
              borderRadius: 8,
              border: `1px solid ${ended ? "var(--p1)" : "var(--line)"}`,
              background: "var(--surface)",
              pointerEvents: ended ? "auto" : "none",
            }}
          >
            結果へ →
          </Link>
        </div>
      </header>

      {/* Main 3-column layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* P1 Panel */}
        <RecognitionPanel
          player="p1"
          playerData={p1}
          accentColor="var(--p1)"
          softColor="var(--p1-soft)"
          inkColor="var(--p1-ink)"
        />

        {/* Center: Battle Board */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            padding: "16px 12px",
          }}
        >
          {/* Turn indicator */}
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <span
              style={{
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                fontSize: 16,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                padding: "4px 16px",
                borderRadius: 999,
              }}
            >
              TURN {currentTurn} / {MAX_TURNS}
            </span>
          </div>

          {/* Board */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div>
              {/* Column labels */}
              <div style={{ display: "flex", marginLeft: 28 }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 44,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {COLS[i]}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {Array.from({ length: 10 }, (_, row) => (
                <div key={row} style={{ display: "flex", alignItems: "center" }}>
                  <div
                    style={{
                      width: 24,
                      textAlign: "right",
                      paddingRight: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {row + 1}
                  </div>
                  {Array.from({ length: 10 }, (_, col) => {
                    const key = `${col},${row}`;
                    const cell = GRID_DATA[key];
                    const isP1 = p1.x === col && p1.y === row;
                    const isP2 = p2.x === col && p2.y === row;
                    return (
                      <div
                        key={col}
                        style={{
                          width: 44,
                          height: 44,
                          border: "1px solid var(--line)",
                          background: cell === "WALL"
                            ? "repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 3px, #f9fafb 3px, #f9fafb 9px)"
                            : "var(--surface)",
                          display: "grid",
                          placeItems: "center",
                          position: "relative",
                          fontSize: 10,
                        }}
                      >
                        {cell === "CROSS" && (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "#fee2e2",
                              border: "2px solid var(--p2)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                            }}
                          >
                            ✕
                          </div>
                        )}
                        {cell === "BARRIER" && (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "var(--p1-soft)",
                              border: "2px solid var(--p1)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                            }}
                          >
                            🛡
                          </div>
                        )}
                        {cell === "REPEAT" && (
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              background: "#dcfce7",
                              border: "2px solid #16a34a",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 10,
                            }}
                          >
                            ↻
                          </div>
                        )}
                        {isP1 && (
                          <div
                            style={{
                              position: "absolute",
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              background: "var(--p1)",
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: 14,
                              boxShadow: "0 2px 8px rgba(37,99,235,.4)",
                            }}
                          >
                            {DIR_ARROW[p1.dir]}
                          </div>
                        )}
                        {isP2 && (
                          <div
                            style={{
                              position: "absolute",
                              width: 32,
                              height: 32,
                              borderRadius: 6,
                              background: "var(--p2)",
                              color: "#fff",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 700,
                              fontSize: 14,
                              boxShadow: "0 2px 8px rgba(239,68,68,.4)",
                            }}
                          >
                            {DIR_ARROW[p2.dir]}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 16,
              fontSize: 11,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            {[
              { color: "var(--p1)", label: "P1 はなこ" },
              { color: "var(--p2)", label: "P2 たろう" },
              {
                color: "repeating-linear-gradient(45deg, #e5e7eb, #e5e7eb 3px, #f9fafb 3px, #f9fafb 9px)",
                label: "障害物",
              },
              { color: "#fee2e2", label: "CROSS_ATTACK" },
              { color: "var(--p1-soft)", label: "BARRIER" },
              { color: "#dcfce7", label: "REPEAT_ACTIONS" },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: item.color,
                    border: "1px solid var(--line)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "var(--ink-soft)" }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Replay controls */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: "12px 16px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              {/* Buttons */}
              {[
                { icon: "⏮", action: () => setCurrentTurn(0), title: "最初へ" },
                { icon: "⏪", action: () => setCurrentTurn((t) => Math.max(0, t - 1)), title: "前のターン" },
                {
                  icon: playing ? "⏸" : "▶",
                  action: () => setPlaying((p) => !p),
                  title: playing ? "一時停止" : "再生",
                },
                {
                  icon: "⏩",
                  action: () => setCurrentTurn((t) => Math.min(MAX_TURNS, t + 1)),
                  title: "次のターン",
                },
                { icon: "⏭", action: () => setCurrentTurn(MAX_TURNS), title: "最後へ" },
              ].map((btn) => (
                <button
                  key={btn.icon}
                  onClick={btn.action}
                  title={btn.title}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border: "1px solid var(--line)",
                    background: btn.icon === (playing ? "⏸" : "▶") ? "var(--p1)" : "var(--surface)",
                    color: btn.icon === (playing ? "⏸" : "▶") ? "#fff" : "var(--ink)",
                    fontSize: 16,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  {btn.icon}
                </button>
              ))}

              {/* Speed selector */}
              <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                {[0.5, 1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "1px solid var(--line)",
                      background: speed === s ? "var(--ink)" : "var(--surface)",
                      color: speed === s ? "#fff" : "var(--ink)",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Seek bar */}
            <div style={{ position: "relative", marginBottom: 4 }}>
              <input
                type="range"
                min={0}
                max={MAX_TURNS}
                value={currentTurn}
                onChange={(e) => {
                  setPlaying(false);
                  setCurrentTurn(Number(e.target.value));
                }}
                style={{ width: "100%", cursor: "pointer" }}
              />
              {/* Event markers */}
              {[
                { turn: 3, label: "FirstDamage", color: "#f59e0b" },
                { turn: 8, label: "Item取得", color: "#16a34a" },
                { turn: 12, label: "HIT", color: "var(--p2)" },
              ].map((marker) => (
                <div
                  key={marker.turn}
                  title={`T${marker.turn}: ${marker.label}`}
                  style={{
                    position: "absolute",
                    left: `${(marker.turn / MAX_TURNS) * 100}%`,
                    top: -4,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: marker.color,
                    transform: "translateX(-50%)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-soft)", fontFamily: "JetBrains Mono, monospace" }}>
              <span>T0</span>
              <span>T{MAX_TURNS}</span>
            </div>
          </div>

          {/* Turn log */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 12,
              maxHeight: 180,
              overflow: "auto",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "var(--ink-soft)" }}>
              ターンログ (最新5件)
            </div>
            {turns
              .flatMap((snap) =>
                snap.logs.map((log) => ({
                  turn: snap.turn,
                  text: `${log.playerId === "p1" ? MOCK_MATCH.p1Name : MOCK_MATCH.p2Name}: ${log.text}`,
                  color: log.playerId === "p1" ? "var(--p1)" : "var(--p2)",
                }))
              )
              .slice(-5)
              .map((log, i, arr) => (
                <div
                  key={i}
                  style={{
                    fontSize: 12,
                    padding: "4px 0",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      background: log.color,
                      padding: "1px 5px",
                      borderRadius: 4,
                      flexShrink: 0,
                    }}
                  >
                    T{log.turn}
                  </span>
                  <span>{log.text}</span>
                </div>
              ))}
          </div>
        </div>

        {/* P2 Panel */}
        <RecognitionPanel
          player="p2"
          playerData={p2}
          accentColor="var(--p2)"
          softColor="var(--p2-soft)"
          inkColor="var(--p2-ink)"
        />
      </div>

      {/* Timeline bar */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--line)",
          padding: "12px 24px",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
            タイムライン
          </span>
          <div style={{ flex: 1, position: "relative", height: 24 }}>
            {/* Track */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 4,
                background: "var(--line)",
                borderRadius: 999,
                transform: "translateY(-50%)",
              }}
            />
            {/* Progress */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                width: `${(currentTurn / MAX_TURNS) * 100}%`,
                height: 4,
                background: "var(--p1)",
                borderRadius: 999,
                transform: "translateY(-50%)",
                transition: "width 0.3s",
              }}
            />
            {/* Markers */}
            {[
              { turn: 3, label: "FirstDamage", color: "#f59e0b" },
              { turn: 7, label: "Item", color: "#16a34a" },
              { turn: 12, label: "HIT", color: "var(--p2)" },
              { turn: 16, label: "end", color: "var(--ink)" },
            ].map((m) => (
              <div
                key={m.turn}
                title={`T${m.turn}: ${m.label}`}
                style={{
                  position: "absolute",
                  left: `${(m.turn / MAX_TURNS) * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: m.color,
                  border: "2px solid #fff",
                  cursor: "pointer",
                  zIndex: 1,
                }}
              />
            ))}
          </div>
        </div>
        {/* Axis labels */}
        <div style={{ display: "flex", justifyContent: "space-between", marginLeft: 70 }}>
          {Array.from({ length: 11 }, (_, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                color: "var(--ink-soft)",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              {i * 2}
            </span>
          ))}
        </div>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 6, marginLeft: 70 }}>
          {[
            { color: "#f59e0b", label: "FirstDamage" },
            { color: "#16a34a", label: "Item取得" },
            { color: "var(--p2)", label: "HIT" },
            { color: "var(--ink)", label: "終了" },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color }} />
              <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
