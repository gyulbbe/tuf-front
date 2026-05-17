import type { Metadata } from "next";
import { PinballDraftPage } from "@/components/pinball-draft/pinball-draft-page";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "핀볼 드래프트",
};

export default async function DraftPinballPage() {
  await requireServerAuth("/draft/pinball");

  return <PinballDraftPage />;
}
