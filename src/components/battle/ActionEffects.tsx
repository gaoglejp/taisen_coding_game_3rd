"use client";

import type React from "react";
import { GRID_SIZE, type ActionType, type Direction, type RelDir, type TurnSnapshot } from "@/lib/match-simulator";

const SHOOT_ACTIONS: Partial<Record<ActionType, RelDir>> = {
  SHOOT_FORWARD: "FORWARD",
  SHOOT_BACK: "BACK",
  SHOOT_LEFT: "LEFT",
  SHOOT_RIGHT: "RIGHT",
};

const MOVE_ACTIONS: Partial<Record<ActionType, RelDir>> = {
  MOVE_FORWARD: "FORWARD",
  MOVE_BACK: "BACK",
  MOVE_LEFT: "LEFT",
  MOVE_RIGHT: "RIGHT",
};

const SCAN_RANGE = 3;

const DIR_DELTA: Record<Direction, [number, number]> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

const TURN_RIGHT_OF: Record<Direction, Direction> = { N: "E", E: "S", S: "W", W: "N" };
const TURN_LEFT_OF: Record<Direction, Direction> = { N: "W", W: "S", S: "E", E: "N" };

type Side = "p1" | "p2";

interface EffectPlayer {
  x: number;
  y: number;
  dir: Direction;
  action: ActionType;
  moved: boolean;
  shoot_result: "HIT" | "MISS" | null;
  scan_detected: boolean;
}

function relDirection(facing: Direction, rel: RelDir): Direction {
  if (rel === "FORWARD") return facing;
  if (rel === "BACK") return TURN_RIGHT_OF[TURN_RIGHT_OF[facing]];
  if (rel === "RIGHT") return TURN_RIGHT_OF[facing];
  return TURN_LEFT_OF[facing];
}

function relDelta(facing: Direction, rel: RelDir): [number, number] {
  return DIR_DELTA[relDirection(facing, rel)];
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function cellCenter(x: number, y: number, cellSize: number): [number, number] {
  return [(x + 0.5) * cellSize, (y + 0.5) * cellSize];
}

function rayEnd(
  shooter: EffectPlayer,
  target: EffectPlayer,
  delta: [number, number],
  cellSize: number,
  obstacles: ReadonlySet<string>
): { x: number; y: number; impact: "enemy" | "obstacle" | "wall" } {
  let lastInBounds: [number, number] = [shooter.x, shooter.y];

  for (let step = 1; step <= GRID_SIZE; step++) {
    const x = shooter.x + delta[0] * step;
    const y = shooter.y + delta[1] * step;
    if (!inBounds(x, y)) {
      const [cx, cy] = cellCenter(lastInBounds[0], lastInBounds[1], cellSize);
      return { x: cx, y: cy, impact: "wall" };
    }
    if (target.x === x && target.y === y) {
      const [cx, cy] = cellCenter(x, y, cellSize);
      return { x: cx, y: cy, impact: "enemy" };
    }
    if (obstacles.has(`${x},${y}`)) {
      const [cx, cy] = cellCenter(x, y, cellSize);
      return { x: cx, y: cy, impact: "obstacle" };
    }
    lastInBounds = [x, y];
  }

  const [cx, cy] = cellCenter(lastInBounds[0], lastInBounds[1], cellSize);
  return { x: cx, y: cy, impact: "wall" };
}

function blockedMovePoint(player: EffectPlayer, cellSize: number): { x: number; y: number; wall: boolean } | null {
  const rel = MOVE_ACTIONS[player.action];
  if (!rel || player.moved) return null;
  const [dx, dy] = relDelta(player.dir, rel);
  const targetX = player.x + dx;
  const targetY = player.y + dy;
  const wall = !inBounds(targetX, targetY);
  const x = Math.max(0, Math.min(GRID_SIZE - 1, targetX));
  const y = Math.max(0, Math.min(GRID_SIZE - 1, targetY));
  const [cx, cy] = cellCenter(x, y, cellSize);
  return {
    x: wall ? cx + dx * cellSize * 0.42 : cx,
    y: wall ? cy + dy * cellSize * 0.42 : cy,
    wall,
  };
}

function scanCells(player: EffectPlayer): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let y = player.y - SCAN_RANGE; y <= player.y + SCAN_RANGE; y++) {
    for (let x = player.x - SCAN_RANGE; x <= player.x + SCAN_RANGE; x++) {
      if (!inBounds(x, y)) continue;
      const distance = Math.abs(x - player.x) + Math.abs(y - player.y);
      if (distance <= SCAN_RANGE) cells.push([x, y]);
    }
  }
  return cells;
}

function ComicExplosion({ x, y, side }: { x: number; y: number; side: Side }) {
  const border = side === "p1" ? "var(--p1)" : "var(--p2)";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 82,
        height: 82,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        animation: "battle-comic-pop .76s ease-out both",
        zIndex: 7,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: border,
          clipPath:
            "polygon(50% 0%, 59% 28%, 85% 12%, 72% 39%, 100% 50%, 72% 61%, 85% 88%, 59% 72%, 50% 100%, 41% 72%, 15% 88%, 28% 61%, 0% 50%, 28% 39%, 15% 12%, 41% 28%)",
          filter: "drop-shadow(0 3px 5px rgba(31,35,48,.24))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 8,
          background: "#fff176",
          clipPath:
            "polygon(50% 0%, 59% 28%, 85% 12%, 72% 39%, 100% 50%, 72% 61%, 85% 88%, 59% 72%, 50% 100%, 41% 72%, 15% 88%, 28% 61%, 0% 50%, 28% 39%, 15% 12%, 41% 28%)",
        }}
      />
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: "#7c2d12",
          fontSize: 17,
          fontWeight: 900,
          transform: "rotate(-10deg)",
          textShadow: "1px 1px #fff",
          letterSpacing: 0,
        }}
      >
        ドカン!
      </span>
    </div>
  );
}

function ImpactSpark({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translate(-50%, -50%) rotate(-8deg)",
        minWidth: 42,
        height: 26,
        padding: "0 9px",
        borderRadius: 999,
        background: "#fff",
        border: "2px solid var(--ink)",
        color: "var(--ink)",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 900,
        boxShadow: "0 2px 8px rgba(31,35,48,.18)",
        animation: "battle-wall-bump .76s ease-out both",
        zIndex: 7,
        pointerEvents: "none",
      }}
    >
      {label}
    </div>
  );
}

function ProjectileEffect({
  side,
  player,
  opponent,
  cellSize,
  obstacles,
}: {
  side: Side;
  player: EffectPlayer;
  opponent: EffectPlayer;
  cellSize: number;
  obstacles: ReadonlySet<string>;
}) {
  const rel = SHOOT_ACTIONS[player.action];
  if (!rel) return null;
  const [sx, sy] = cellCenter(player.x, player.y, cellSize);
  const delta = relDelta(player.dir, rel);
  const end = rayEnd(player, opponent, delta, cellSize, obstacles);
  const dx = end.x - sx;
  const dy = end.y - sy;
  const length = Math.max(cellSize * 0.45, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const color = side === "p1" ? "var(--p1)" : "var(--p2)";

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: length,
          height: 0,
          borderTop: `4px solid ${color}`,
          borderRadius: 999,
          transform: `rotate(${angle}deg)`,
          transformOrigin: "0 50%",
          opacity: 0,
          filter: `drop-shadow(0 0 6px ${side === "p1" ? "rgba(37,99,235,.38)" : "rgba(239,68,68,.38)"})`,
          animation: "battle-shot-line .74s ease-out both",
          zIndex: 5,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: sx,
          top: sy,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: "50%",
          background: "#fff",
          border: `4px solid ${color}`,
          boxShadow: "0 0 0 2px rgba(255,255,255,.75), 0 0 12px rgba(251,191,36,.9)",
          animation: `battle-projectile .74s cubic-bezier(.2,.8,.2,1) both`,
          ["--tx" as string]: `${dx}px`,
          ["--ty" as string]: `${dy}px`,
          zIndex: 6,
        } as React.CSSProperties}
      />
      {end.impact === "enemy" ? <ComicExplosion x={end.x} y={end.y} side={side} /> : null}
      {end.impact === "obstacle" ? <ImpactSpark x={end.x} y={end.y} label="ガン!" /> : null}
      {end.impact === "wall" ? <ImpactSpark x={end.x} y={end.y} label="カン!" /> : null}
    </>
  );
}

function ScanEffect({ player, cellSize, side }: { player: EffectPlayer; cellSize: number; side: Side }) {
  if (player.action !== "SCAN_AROUND") return null;
  const border = side === "p1" ? "rgba(37,99,235,.72)" : "rgba(239,68,68,.72)";
  const fill = side === "p1" ? "rgba(37,99,235,.18)" : "rgba(239,68,68,.18)";
  const [cx, cy] = cellCenter(player.x, player.y, cellSize);

  return (
    <>
      {scanCells(player).map(([x, y]) => (
        <div
          key={`${side}-scan-${x}-${y}`}
          aria-hidden
          style={{
            position: "absolute",
            left: x * cellSize,
            top: y * cellSize,
            width: cellSize,
            height: cellSize,
            background: fill,
            boxShadow: `inset 0 0 0 1px ${border}`,
            animation: "battle-scan-cell .78s ease-out both",
            zIndex: 2,
          }}
        />
      ))}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          width: cellSize * (SCAN_RANGE * 2 + 1),
          height: cellSize * (SCAN_RANGE * 2 + 1),
          transform: "translate(-50%, -50%)",
          border: `2px dashed ${border}`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${fill} 0%, rgba(255,255,255,0) 68%)`,
          animation: "battle-scan-ring .78s ease-out both",
          zIndex: 3,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function BlockedMoveEffect({ player, cellSize, side }: { player: EffectPlayer; cellSize: number; side: Side }) {
  const point = blockedMovePoint(player, cellSize);
  if (!point) return null;
  const color = side === "p1" ? "var(--p1-ink)" : "var(--p2-ink)";
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: point.x,
        top: point.y,
        transform: "translate(-50%, -50%)",
        minWidth: 42,
        height: 26,
        borderRadius: 999,
        background: "#fff",
        border: `2px solid ${color}`,
        color,
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 900,
        boxShadow: "0 2px 8px rgba(31,35,48,.18)",
        animation: "battle-wall-bump .76s ease-out both",
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      {point.wall ? "ガン!" : "STOP"}
    </div>
  );
}

export function ActionEffects({
  snapshot,
  cellSize,
  obstacles = [],
}: {
  snapshot?: TurnSnapshot;
  cellSize: number;
  obstacles?: Array<[number, number]>;
}) {
  if (!snapshot) return null;
  const p1 = snapshot.p1;
  const p2 = snapshot.p2;
  const obstacleSet = new Set(obstacles.map(([x, y]) => `${x},${y}`));

  return (
    <div
      key={snapshot.turn}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <style>{`
        @keyframes battle-projectile {
          0% { opacity: 0; transform: translate(0, 0) scale(.65); }
          12% { opacity: 1; }
          78% { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(.7); }
        }
        @keyframes battle-shot-line {
          0% { opacity: 0; clip-path: inset(0 100% 0 0); }
          15% { opacity: .95; }
          72% { opacity: .75; clip-path: inset(0 0 0 0); }
          100% { opacity: 0; clip-path: inset(0 0 0 100%); }
        }
        @keyframes battle-comic-pop {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.25) rotate(-12deg); }
          18% { opacity: 1; transform: translate(-50%, -50%) scale(1.18) rotate(5deg); }
          72% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-4deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.82) rotate(8deg); }
        }
        @keyframes battle-scan-cell {
          0% { opacity: 0; transform: scale(.7); }
          22% { opacity: 1; transform: scale(1); }
          74% { opacity: .75; }
          100% { opacity: 0; transform: scale(1.04); }
        }
        @keyframes battle-scan-ring {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.35); }
          28% { opacity: 1; transform: translate(-50%, -50%) scale(.9); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes battle-wall-bump {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(.5) rotate(-8deg); }
          18% { opacity: 1; transform: translate(-50%, -50%) scale(1.14) rotate(5deg); }
          55% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(-2deg); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(.85) rotate(6deg); }
        }
      `}</style>
      <ScanEffect player={p1} cellSize={cellSize} side="p1" />
      <ScanEffect player={p2} cellSize={cellSize} side="p2" />
      <ProjectileEffect side="p1" player={p1} opponent={p2} cellSize={cellSize} obstacles={obstacleSet} />
      <ProjectileEffect side="p2" player={p2} opponent={p1} cellSize={cellSize} obstacles={obstacleSet} />
      <BlockedMoveEffect player={p1} cellSize={cellSize} side="p1" />
      <BlockedMoveEffect player={p2} cellSize={cellSize} side="p2" />
    </div>
  );
}
