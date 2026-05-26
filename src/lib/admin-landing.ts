import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

// Resolves where an admin should land. Returns null for non-admins — and for a
// room admin with no assigned room — who belong on the player dashboard.
// Shared by `/admin` (where to send an admin) and the dashboard guard (which
// admins to bounce off the player home) so the rule lives in one place.
export async function adminLandingPath(
  session: SessionUser
): Promise<string | null> {
  if (session.role === "SYSTEM_ADMIN") {
    return "/admin/system/rooms";
  }

  if (session.role === "ROOM_ADMIN") {
    const room = await prisma.room.findFirst({
      where: {
        admins: { some: { id: session.id } },
        status: { not: "DELETED" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    return room ? `/admin/rooms/${room.id}` : null;
  }

  return null;
}
