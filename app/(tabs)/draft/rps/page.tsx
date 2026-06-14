import type { Metadata } from "next";
import { RpsDraftListPage } from "@/components/rps-draft/rps-draft-list-page";

export const metadata: Metadata = {
  title: "컨텐츠 드래프트",
};

export default function DraftRpsPage() {
  return <RpsDraftListPage mode="draft" />;
}
