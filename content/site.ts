export type SiteSubTab = {
  label: string;
  href?: string;
  description: string;
  external?: boolean;
  requiresAdmin?: boolean;
};

export type SiteTab = SiteSubTab & {
  items?: SiteSubTab[];
};

const externalSiteLinks = {
  recordManagerUrl: "https://tufelo.vercel.app/",
  bettingUrl: "https://tufpl.vercel.app/",
};

export const siteConfig = {
  name: "Starcraft TuF Clan",
  description:
    "공지, 채팅, 프로리그, 갤러리, 계정, 관리자 기능을 한 화면에서 관리하는 Starcraft TuF Clan 사이트입니다.",
};

export const siteTabs: SiteTab[] = [
  {
    label: "공지사항",
    href: "/notice",
    description: "운영 공지와 업데이트를 확인합니다.",
  },
  {
    label: "투프챗",
    href: "/chat",
    description: "채팅 기능과 자동 응답 흐름을 확인합니다.",
  },
  {
    label: "프로리그",
    href: "/proleague",
    description: "리그 운영 상태와 주요 기능으로 이동합니다.",
    items: [
      {
        label: "드래프트",
        href: "/proleague/draft",
        description: "실시간 드래프트 화면으로 이동합니다.",
      },
    ],
  },
  {
    label: "터프 갤러리",
    href: "/gallery",
    description: "이미지와 기록을 모아둔 보관 탭입니다.",
  },
  {
    label: "내 정보",
    href: "/me",
    description: "로그인 상태와 계정 정보를 확인합니다.",
  },
  {
    label: "관리자",
    href: "/admin",
    description: "관리자 작업 공간입니다.",
    requiresAdmin: true,
    items: [
      {
        label: "드래프트",
        href: "/admin/draft",
        description: "드래프트 관리와 이력을 확인합니다.",
        requiresAdmin: true,
      },
    ],
  },
  {
    label: "전적관리",
    href: externalSiteLinks.recordManagerUrl,
    description: "외부 전적관리 사이트로 이동합니다.",
    external: true,
  },
  {
    label: "배팅",
    href: externalSiteLinks.bettingUrl,
    description: "외부 배팅 사이트로 이동합니다.",
    external: true,
  },
];
