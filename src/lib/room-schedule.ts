export interface RoomSchedulePlayer {
  id: string;
  username: string;
  displayName: string | null;
}

export interface RoomScheduleMatch {
  id: string;
  matchNumber: number;
  status: string;
  codingDeadlineAt?: string | null;
  player1: RoomSchedulePlayer | null;
  player2: RoomSchedulePlayer | null;
}

const ACTIVE_MATCH_STATUSES = new Set(["WAITING", "CODING", "BATTLING"]);

function scheduleTime(iso: string | null | undefined): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

export function selectMySchedule(matches: RoomScheduleMatch[], meId: string | null): RoomScheduleMatch[] {
  if (!meId) return [];

  return matches
    .filter((match) => {
      if (!ACTIVE_MATCH_STATUSES.has(match.status)) return false;
      return match.player1?.id === meId || match.player2?.id === meId;
    })
    .sort((a, b) => {
      const ta = scheduleTime(a.codingDeadlineAt);
      const tb = scheduleTime(b.codingDeadlineAt);
      if (ta !== tb) return ta - tb;
      return a.matchNumber - b.matchNumber;
    });
}
