import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// GET /api/me/stats
// Returns aggregated battle statistics for the authenticated user.
// Currently returns mock data; will be replaced with real Match aggregation.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "未ログインです" }, { status: 401 });
  }

  // TODO: replace with real aggregation from Match table:
  //   SELECT COUNT(*), winnerId, endReason FROM Match
  //   WHERE player1Id = ? OR player2Id = ?
  //   GROUP BY ...
  const mockStats = {
    wins: 12,
    losses: 7,
    draws: 2,
    total: 21,
    winRate: Math.round((12 / 21) * 100),          // 57%
    avgTurns: 14.3,
    avgDamageDealt: 320,
    avgDamageTaken: 210,
    firstDamageRate: 62,                             // % of matches where user dealt damage first
    // 12 historical win-rate data points (newest last) for sparkline
    sparkline: [40, 45, 50, 48, 52, 55, 53, 57, 54, 58, 56, 57],
  };

  return NextResponse.json({ stats: mockStats });
}
