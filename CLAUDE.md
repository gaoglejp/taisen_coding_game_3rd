@AGENTS.md
@docs/HANDOFF.md

# Inviolable rules

- The 17 prototypes in `project/*.html` are the visual source of truth. React
  pages should be visually equivalent — do not redesign without being asked.
- Role-aware chrome lives in `TopbarPaper` / `TopbarAdmin` / `ScopeBanner`
  only. Do not duplicate role logic into pages.
- Realtime entrypoint is `tsx watch server.ts` (mounts Next + Socket.io on one
  port). Do not switch to `next dev`.
- Cookie sessions via `src/lib/auth.ts`. `next-auth` is unused; remove it if
  you do a dep cleanup, but don't introduce a parallel auth path.

