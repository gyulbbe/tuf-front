import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "프로리그",
};

export default async function ProleaguePage() {
  redirect("/proleague/draft");
}
