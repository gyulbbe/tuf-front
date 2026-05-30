import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "엔트리 제출",
};

export default async function DraftEntryListPage() {
  await requireServerAuth("/draft/entry");

  return <RpsDraftListPage mode="entry" />;
}
