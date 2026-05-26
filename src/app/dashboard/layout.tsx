import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminLandingPath } from "@/lib/admin-landing";

// Server-side guard so admins never see the player dashboard, even if the
// client-side login redirect is bypassed (stale bundle, the brand logo's
// `/dashboard` link, or a direct visit). Non-admins (and room admins with no
// assigned room) fall through to the dashboard.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const landing = await adminLandingPath(session);
  if (landing) redirect(landing);

  return children;
}
