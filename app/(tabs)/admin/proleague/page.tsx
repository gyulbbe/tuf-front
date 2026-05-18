import { redirect } from "next/navigation";

export default function AdminProleaguePage() {
  redirect("/admin/league?mode=create&type=PROLEAGUE");
}
