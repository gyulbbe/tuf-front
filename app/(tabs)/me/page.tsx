import type { Metadata } from "next";
import { AccountWorkspace } from "@/components/account/account-workspace";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "내 계정",
};

export default async function MePage() {
  await requireServerAuth("/me");

  return <AccountWorkspace />;
}
