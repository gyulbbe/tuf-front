import type { Metadata } from "next";
import { InfoList } from "@/components/site/info-list";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const gameSections = [
  {
    title: "게임 모집",
    description:
      "클랜 내부 내전, 친선전, 번개 대전처럼 바로 참여할 수 있는 게임 공지를 모아두는 영역으로 확장할 수 있습니다.",
  },
  {
    title: "맵과 룰",
    description:
      "사용 맵, 기본 룰, 경기 방식 같은 정보를 정리해 두면 게임 탭 하나만으로도 진행 공지를 자연스럽게 묶을 수 있습니다.",
  },
  {
    title: "기록 연동",
    description:
      "향후에는 경기 결과나 간단한 전적 링크를 붙여서 게임별 기록 흐름을 이어볼 수 있도록 붙일 수 있습니다.",
  },
];

const quickItems = [
  "내전 일정 안내",
  "맵/룰 요약 정리",
  "경기 결과 링크 연결",
];

export const metadata: Metadata = {
  title: "게임",
};

export default function GamePage() {
  return (
    <TabPageShell
      label="Game"
      title="게임"
      description="게임 관련 공지, 모집, 룰 정리 같은 내용을 한 곳에 모으는 탭입니다. 지금은 기본 구조만 두고, 이후 실제 기능이나 콘텐츠를 자연스럽게 붙일 수 있게 맞춰뒀습니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">빠른 구성</p>
            <InfoList items={quickItems} />
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">메모</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              현재는 기존 탭 스타일에 맞춘 기본 페이지다. 이후 게임 목록, 참가 상태,
              간단한 결과 정리 같은 기능을 붙여도 레이아웃을 크게 바꾸지 않고 확장할
              수 있다.
            </p>
          </SurfaceCard>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {gameSections.map((section) => (
          <SectionCard
            key={section.title}
            title={section.title}
            description={section.description}
          />
        ))}
      </div>
    </TabPageShell>
  );
}
