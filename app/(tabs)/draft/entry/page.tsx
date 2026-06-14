import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";

export const metadata: Metadata = {
  title: "엔트리 제출",
};

export default function DraftEntryListPage() {
  return <RpsDraftListPage mode="entry" />;
}
