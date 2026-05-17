import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "가위바위보 드래프트",
};

export default async function DraftRpsPage() {
  await requireServerAuth("/draft/rps");

  return <RpsDraftListPage />;
}
