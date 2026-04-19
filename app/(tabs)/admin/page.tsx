import type { Metadata } from "next";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "관리자",
};

const adminSections = [
  {
    title: "계정 추가",
    description:
      "사용자 계정은 관리자가 직접 등록하는 방식으로 운영합니다. 이후에는 이 탭에서 계정 생성과 초기 비밀번호 발급을 붙일 수 있습니다.",
  },
  {
    title: "권한 관리",
    description:
      "일반 사용자와 관리자 권한을 나누는 구조를 이 영역에서 확장할 수 있습니다.",
  },
  {
    title: "운영 설정",
    description:
      "공지 노출, 봇 연동, 리그 운영 설정 같은 관리자 전용 기능을 단계적으로 추가할 수 있습니다.",
  },
];

function isAdminRole(role: string) {
  return role.trim().toLowerCase() === "admin";
}

export default async function AdminPage() {
  const session = await requireServerAuth("/admin");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          이 페이지는 `role=admin` 계정만 접근할 수 있다. 현재 JWT 권한으로는
          관리자 기능을 볼 수 없다.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          관리자
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          관리자 탭은 운영 전용 작업 공간이다. 서버에서 JWT 기반 로그인 상태를
          먼저 확인한 뒤, `role` claim이 admin일 때만 관리자 기능을 보여준다.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {adminSections.map((section) => (
            <article
              key={section.title}
              className="rounded-[24px] border border-line bg-surface-strong px-5 py-5"
            >
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                {section.description}
              </p>
            </article>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 기준</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              서버에서 로그인 상태를 먼저 확인
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              `role=admin` 일 때만 관리자 화면 노출
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              JWT 만료/401 시 자동 로그아웃
            </li>
          </ul>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">다음 작업 후보</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            계정 목록 조회, 비밀번호 초기화, 권한 변경, 공지 작성 권한 같은
            운영 기능을 이 탭 기준으로 이어서 붙일 수 있다.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}
