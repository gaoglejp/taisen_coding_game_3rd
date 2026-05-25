import { redirect } from "next/navigation";

export default function SystemAdminIndexPage() {
  redirect("/admin/system/rooms");
}
