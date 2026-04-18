export type SiteTab = {
  label: string;
  href?: string;
  description: string;
  external?: boolean;
};

const externalSiteLinks = {
  recordManagerUrl: "https://tufelo.vercel.app/",
  bettingUrl: "",
};

export const siteConfig = {
  name: "Starcraft TuF Clan",
  description:
    "공지, 봇, 리그, 갤러리, 계정, 관리자 기능을 탭 단위로 나눠 관리하는 Starcraft TuF Clan 사이트입니다.",
};

export const siteTabs: SiteTab[] = [
  {
    label: "공지사항",
    href: "/notice",
    description: "운영 공지와 업데이트를 정리합니다.",
  },
  {
    label: "터프봇",
    href: "/tuf-bot",
    description: "봇 기능과 자동화 흐름을 정리합니다.",
  },
  {
    label: "프로리그",
    href: "/proleague",
    description: "리그 일정과 운영 상태를 다룹니다.",
  },
  {
    label: "터프갤러리",
    href: "/gallery",
    description: "이미지와 기록을 아카이브합니다.",
  },
  {
    label: "내정보",
    href: "/me",
    description: "로그인, 로그아웃, 계정 상태를 확인합니다.",
  },
  {
    label: "관리자",
    href: "/admin",
    description: "관리자 작업 공간입니다.",
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
