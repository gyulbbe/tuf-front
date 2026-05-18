import { redirect } from "next/navigation";

export default function AdminPersonalLeaguePage() {
  redirect("/admin/league?type=PERSONAL");
}
