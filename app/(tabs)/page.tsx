import type { Metadata } from "next";
import { HomeMainDashboard } from "@/components/home/home-main-dashboard";
import { createEmptyHomeMain, getHomeMain } from "@/lib/api/home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "메인",
};

async function loadHomeMainData() {
  try {
    const data = await getHomeMain();

    return { data, error: null };
  } catch {
    return {
      data: createEmptyHomeMain(),
      error: "메인 정보를 불러오지 못했습니다.",
    };
  }
}

export default async function HomePage() {
  const { data, error } = await loadHomeMainData();

  return <HomeMainDashboard data={data} error={error} />;
}
