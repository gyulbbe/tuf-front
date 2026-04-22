import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "팀배/컨텐츠 드래프트",
};

export default async function DraftPage() {
  await requireServerAuth("/draft");

  return <RpsDraftListPage />;
}
