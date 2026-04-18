import type { Metadata } from "next";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";

const botBlocks = [
  {
    title: "명령 안내",
    description: "나중에 `!공지`, `!일정`, `!전적` 같은 봇 명령을 붙이기 좋은 자리입니다.",
  },
  {
    title: "자동화 흐름",
    description: "디스코드, 경기 결과, 공지 등록을 어디와 연결할지 단계별로 관리합니다.",
  },
  {
    title: "배포 상태",
    description: "현재는 설계 단계 탭으로 두고, 실제 봇 연결 시 운영 문서 역할도 겸할 수 있습니다.",
  },
];

export const metadata: Metadata = {
  title: "터프봇",
};

export default function TufBotPage() {
  return (
    <TabPageShell
      label="Bot"
      title="터프봇"
      description="봇 기능은 공지와 리그 데이터를 연결하는 허브가 되기 쉬운 영역이라, 별도 탭으로 떼어 두는 편이 이후 개발과 운영에 모두 유리합니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">추천 확장 순서</p>
            <ol className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <li className="rounded-2xl bg-surface-muted px-4 py-3">
                1. 공지사항 연동
              </li>
              <li className="rounded-2xl bg-surface-muted px-4 py-3">
                2. 경기 일정 조회
              </li>
              <li className="rounded-2xl bg-surface-muted px-4 py-3">
                3. 전적 수집 및 알림
              </li>
            </ol>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">현재 상태</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              기능 구현 전 단계라서, 이 탭은 요구사항과 연결 흐름을 정리하는
              설계 보드로 먼저 활용할 수 있습니다.
            </p>
          </SurfaceCard>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        {botBlocks.map((block) => (
          <article
            key={block.title}
            className="rounded-[24px] border border-line bg-surface-strong px-5 py-5"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {block.title}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              {block.description}
            </p>
          </article>
        ))}
      </div>
    </TabPageShell>
  );
}
