import type { Metadata } from "next";
import { ProleagueDraftListPage } from "@/components/proleague/proleague-draft-list-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "프로리그 드래프트",
};

export default async function ProleagueDraftPage() {
  await requireServerAuth("/proleague/draft");

  return <ProleagueDraftListPage />;
}
