import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "프로리그",
};

export default async function ProleaguePage() {
  await requireServerAuth("/proleague");
  redirect("/proleague/draft");
}
