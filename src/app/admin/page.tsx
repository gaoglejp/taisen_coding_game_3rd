import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function AdminIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role === "SYSTEM_ADMIN") {
    redirect("/admin/system/rooms");
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
    redirect(room ? `/admin/rooms/${room.id}` : "/dashboard");
  }

  redirect("/dashboard");
}
