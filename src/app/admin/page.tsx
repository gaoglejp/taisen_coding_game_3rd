import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminLandingPath } from "@/lib/admin-landing";

export default async function AdminIndexPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const landing = await adminLandingPath(session);
  redirect(landing ?? "/dashboard");
}
