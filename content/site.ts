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
    "채팅, 드래프트, 게임, 갤러리, 관리자 기능을 한 화면에서 관리하는 Starcraft TuF Clan 사이트입니다.",
};

export const siteTabs: SiteTab[] = [
  {
    label: "채팅",
    href: "/chat",
    description: "채팅 기능과 자동 응답 흐름을 확인합니다.",
  },
  {
    label: "드래프트",
    description: "드래프트 화면과 운영 화면으로 이동합니다.",
    items: [
      {
        label: "프로리그 드래프트",
        href: "/proleague/draft",
        description: "프로리그 드래프트 화면으로 이동합니다.",
      },
      {
        label: "팀배/컨텐츠 드래프트",
        href: "/draft",
        description: "팀배/컨텐츠 드래프트 화면으로 이동합니다.",
      },
    ],
  },
  {
    label: "게임",
    href: "/game",
    description: "게임 관련 안내와 준비 중인 기능을 확인합니다.",
  },
  {
    label: "TuF 갤러리",
    href: "/gallery",
    description: "게시물과 기록을 확인합니다.",
  },
  {
    label: "관리자",
    href: "/admin",
    description: "관리자 작업 공간입니다.",
    requiresAdmin: true,
    items: [
      {
        label: "드래프트 관리",
        href: "/admin/draft",
        description: "드래프트 등록과 운영을 관리합니다.",
        requiresAdmin: true,
      },
    ],
  },
  {
    label: "전적관리",
    href: externalSiteLinks.recordManagerUrl,
    description: "전적관리 사이트로 이동합니다.",
    external: true,
  },
  {
    label: "배팅",
    href: externalSiteLinks.bettingUrl,
    description: "배팅 사이트로 이동합니다.",
    external: true,
  },
];
