import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "관리자 드래프트로 이동",
};

export default async function AdminProleaguePage() {
  await requireServerAuth("/admin/draft");
  redirect("/admin/draft/history");
}
