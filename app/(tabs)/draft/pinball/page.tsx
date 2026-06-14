import type { Metadata } from "next";
import { PinballDraftPage } from "@/components/pinball-draft/pinball-draft-page";

export const metadata: Metadata = {
  title: "핀볼 드래프트",
};

export default function DraftPinballPage() {
  return <PinballDraftPage />;
}
