import { describe, expect, it } from "vitest";

import { secondsUntil } from "@/lib/coding-timer";

describe("secondsUntil", () => {
  const NOW = Date.UTC(2026, 4, 25, 0, 0, 0);

  it("returns positive seconds for a future deadline", () => {
    expect(secondsUntil(new Date(NOW + 20_000).toISOString(), NOW)).toBe(20);
  });

  it("returns 0 for a past deadline", () => {
    expect(secondsUntil(new Date(NOW - 1_000).toISOString(), NOW)).toBe(0);
  });

  it("returns null for null deadline", () => {
    expect(secondsUntil(null, NOW)).toBeNull();
  });

  it("returns null for invalid deadline", () => {
    expect(secondsUntil("not-a-date", NOW)).toBeNull();
  });

  it("rounds up fractional seconds", () => {
    expect(secondsUntil(new Date(NOW + 1_100).toISOString(), NOW)).toBe(2);
  });
});
