import type { Metadata } from "next";
import { InfoList } from "@/components/site/info-list";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const leagueCards = [
  {
    title: "시즌 개요",
    description: "현재 시즌 상태, 진행 단계, 다음 경기일을 가장 먼저 보여주는 영역입니다.",
  },
  {
    title: "팀 운영",
    description: "엔트리, 출전 가능 인원, 간단한 팀 메모를 모아둘 수 있습니다.",
  },
  {
    title: "기록 확장",
    description: "전적표, 매치 리포트, 리플레이 링크를 이후 별도 섹션으로 빼기 쉽습니다.",
  },
];

const operationsNotes = [
  "일정과 결과를 같은 탭 안에서 관리",
  "시즌별 데이터 분리 가능하게 설계",
  "경기 상세는 후속 페이지로 확장",
];

export const metadata: Metadata = {
  title: "프로리그",
};

export default function ProleaguePage() {
  return (
    <TabPageShell
      label="League"
      title="프로리그"
      description="리그 탭은 일정, 전적, 참가 멤버가 점점 늘어나는 편이라 초기에 별도 라우트로 분리해 두는 것이 유지보수에 가장 유리합니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">운영 기준</p>
            <InfoList items={operationsNotes} />
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">추천 다음 단계</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              먼저 더미 시즌 데이터를 붙이고, 이후 실제 경기 결과를 연결하면서
              표와 상세 페이지를 분리하면 안정적으로 커집니다.
            </p>
          </SurfaceCard>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {leagueCards.map((card) => (
          <SectionCard
            key={card.title}
            title={card.title}
            description={card.description}
          />
        ))}
      </div>
    </TabPageShell>
  );
}
