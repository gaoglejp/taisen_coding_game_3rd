# Basic Tutorial

## Purpose

The basic tutorial is a standalone, single-player learning path for coding the
player tank's rules. It teaches only the minimum coding concepts needed to move,
branch, scan, and shoot with Blockly.

It deliberately does not teach screen operation, room flow, advanced tactics, or
general strategy tuning. Those remain the role of normal solo practice at
`/practice`.

## Routes

| Route | Purpose |
| :--- | :--- |
| `/tutorial` | Mission list, progress state, reset operation, and links back to solo practice. |
| `/tutorial/[missionId]` | Shared mission runner for Blockly editing, simulation, result, hints, and next mission navigation. |
| `POST /api/tutorial/simulate` | Runs one tutorial mission strategy against the mission's fixed verification case(s). |

## Progress

Progress is client-local only.

- Storage key: `taisen:tutorial:progress:v1`
- Shape: `completedMissionIds`, `currentMissionId`, `completed`
- Implementation: `src/lib/tutorial-progress.ts`
- No DB tables, Match rows, stats, standings, or Socket.io events are touched.

Mission 1 is unlocked initially. Each cleared mission unlocks the next mission.
The reset operation on `/tutorial` clears only this tutorial storage key.

## Missions

Mission configuration lives in `src/lib/tutorial.ts`. Mission-specific goals,
fixed board settings, allowed Blockly blocks, success conditions, hints, and next
mission linkage are data, not hard-coded in the page components.

| Mission | Goal | Success check |
| :--- | :--- | :--- |
| 1. ルールで前へ進もう | Put a move action inside an always-run rule. | Reach the fixed forward goal within 2 turns. |
| 2. 通れる道を選ぼう | Branch on whether the front cell is passable. | The same strategy must pass both cases: move forward when open, move right when blocked. |
| 3. 周囲の敵を探そう | Use scan to reveal enemy information. | A scan action detects the fixed enemy. |
| 4. 敵のいる方向へ撃とう | Scan first, then choose a shooting direction from enemy distances. | The same strategy must destroy a forward enemy and a right-side enemy in separate cases. |

## Allowed Blocks

The mission runner passes a filtered toolbox into the existing `BlocklyEditor`
via `createStrategyToolbox({ allowedCategories, allowedBlockTypes })`.
Normal coding and solo practice screens keep using the unfiltered toolbox.

The allowed blocks are intentionally narrow:

| Mission | Main categories | Main block types |
| :--- | :--- | :--- |
| 1 | 行動, ルール | `tank_rule_always`, `tank_act_move_forward` |
| 2 | 行動, 状態確認, 論理, ルール | `tank_rule`, `tank_chk_can_move_forward`, `tank_not`, `tank_act_move_forward`, `tank_act_move_right` |
| 3 | 行動, ルール | `tank_rule_always`, `tank_act_scan_around` |
| 4 | 行動, 敵情報, 論理・比較, 数値, ルール | `tank_rule`, enemy-detected/distance blocks, compare/logic blocks, scan, shoot-forward, shoot-right |

## Fixed Boards

Tutorial cases reuse the normal simulator by passing per-case options into
`simulate(...)`:

- `playerInitialState`
- `enemyInitialState`
- `enemyStrategy`
- `obstaclePositions`
- `maxTurns`

Obstacles are applied only to that simulation run. They block movement, shooting
line-of-sight, and scan rays, but the default live-match and solo-practice
behavior is unchanged when no obstacle list is passed.

## Rule Evaluation And Scan State

Tutorial execution follows the existing strategy engine:

- Rules are evaluated in serialized order.
- If multiple rule conditions are true, the first rule that produces an action
  for the turn is the one that matters.
- A turn adopts at most one action from the player strategy. This preserves the
  current AP/action model instead of creating tutorial-only execution rules.
- Fallback actions still run when no rule produces an action.
- `SCAN_AROUND` writes enemy detection and relative distance data into the
  player's scan memory.
- Scan memory is preserved across later turns for the same simulation unless a
  later scan updates or clears it.

This is important for mission 4: a valid strategy may need one turn to scan and
a later turn to shoot based on the retained scan result.

## Tutorial Boundary

Tutorial-specific behavior is kept at the boundary:

- Mission data and evaluation: `src/lib/tutorial.ts`
- Progress persistence: `src/lib/tutorial-progress.ts`
- Tutorial API: `src/app/api/tutorial/simulate/route.ts`
- Tutorial pages: `src/app/tutorial/*`

Shared behavior is reused:

- Blockly editor: `src/components/coding/BlocklyEditor.tsx`
- Toolbox/block definitions and code generation: `src/lib/strategy-blocks.ts`
- Strategy validation: `src/lib/strategy-validation.ts`
- Simulation engine: `src/lib/match-simulator.ts`

Do not duplicate the simulator for future tutorial missions unless the normal
engine cannot express the needed behavior.

## Manual Confirmation Checklist

Use this checklist after tutorial changes:

1. On `/dashboard`, confirm the three actions are visible: `対戦ルームに入る`,
   `練習する`, and `チュートリアル`.
2. Confirm `対戦ルームに入る` remains visually primary.
3. Confirm desktop layout keeps the three actions on one row when space allows,
   and narrow widths wrap without overlap.
4. On `/tutorial`, confirm mission 1 is initially startable and later missions
   are locked until progress unlocks them.
5. Complete each mission and reload the page to confirm localStorage progress is
   retained.
6. Use `最初からやり直す` and confirm progress returns to mission 1.
7. On each mission page, confirm unavailable Blockly blocks are absent from the
   toolbox.
8. Confirm reset on a mission restores the board result and Blockly workspace to
   the mission's initial workspace.
9. Confirm failed runs reveal hints gradually.
10. After mission 4, confirm the normal solo-practice link goes to `/practice`.
11. Confirm `/practice` still shows the full normal toolbox and random/default
    solo-practice setup.
12. Confirm `/rooms` and the match coding flow still submit strategies normally.
