import { describe, expect, it } from "vitest";
import { selectMySchedule, type RoomScheduleMatch } from "@/lib/room-schedule";

function createMatch(overrides: Partial<RoomScheduleMatch>): RoomScheduleMatch {
  return {
    id: "m-1",
    matchNumber: 1,
    status: "WAITING",
    codingDeadlineAt: null,
    player1: { id: "u-1", username: "alice", displayName: "Alice" },
    player2: { id: "u-2", username: "bob", displayName: "Bob" },
    ...overrides,
  };
}

describe("selectMySchedule", () => {
  it("returns only active matches that include me", () => {
    const matches: RoomScheduleMatch[] = [
      createMatch({ id: "mine-waiting", status: "WAITING", player1: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "mine-coding", status: "CODING", player2: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "mine-finished", status: "FINISHED", player1: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "not-mine", status: "BATTLING", player1: { id: "x", username: "x", displayName: null }, player2: { id: "y", username: "y", displayName: null } }),
    ];

    const result = selectMySchedule(matches, "me");

    expect(result.map((m) => m.id)).toEqual(["mine-waiting", "mine-coding"]);
  });

  it("sorts by codingDeadlineAt ascending and places null/invalid at end", () => {
    const matches: RoomScheduleMatch[] = [
      createMatch({ id: "no-deadline", matchNumber: 5, codingDeadlineAt: null, player1: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "later", matchNumber: 3, codingDeadlineAt: "2026-06-01T12:00:00.000Z", player1: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "earlier", matchNumber: 2, codingDeadlineAt: "2026-06-01T08:00:00.000Z", player2: { id: "me", username: "me", displayName: null } }),
      createMatch({ id: "invalid", matchNumber: 4, codingDeadlineAt: "not-a-date", player1: { id: "me", username: "me", displayName: null } }),
    ];

    const result = selectMySchedule(matches, "me");

    expect(result.map((m) => m.id)).toEqual(["earlier", "later", "invalid", "no-deadline"]);
  });

  it("returns empty when meId is null", () => {
    const result = selectMySchedule([createMatch({ id: "m" })], null);
    expect(result).toEqual([]);
  });
});
