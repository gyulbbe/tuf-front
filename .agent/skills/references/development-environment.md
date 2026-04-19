# 현재 개발환경

이 문서는 `tuf-front` 레포의 개발환경을 빠르게 파악하기 위한 레퍼런스다. 세부 버전이 바뀌면 `package.json`, 배포 설정, 로컬 런타임 버전을 다시 확인한다.

## 작업 환경

| 항목 | 값 |
| --- | --- |
| OS / Shell | Windows + PowerShell 5.1 |
| Node.js | `22.13.1` |
| npm | `10.9.2` |
| 작업 경로 | `C:\dev\tuf\tuf-front` |

## 애플리케이션 스택

| 항목 | 값 |
| --- | --- |
| Framework | Next.js `16.2.4` (`app/` 기반) |
| UI | React `19.2.4` + React DOM `19.2.4` |
| Language | TypeScript `5` (`strict: true`) |
| Styling | Tailwind CSS `4` + `@tailwindcss/postcss` |
| Lint | ESLint `9` + `eslint-config-next` `16.2.4` |
| HTTP Client | Axios `1.15.0` |

## 배포 / 런타임

| 항목 | 값 |
| --- | --- |
| Target | Cloudflare Workers |
| Adapter | `@opennextjs/cloudflare` `1.19.1` |
| Infra CLI | Wrangler `4.83.0` |
| Worker entry | `.open-next/worker.js` |
| Static assets | `.open-next/assets` |
| Compatibility | `2026-04-17`, `nodejs_compat` |

## 자주 쓰는 명령

- `npm run dev`: 로컬 개발 서버 실행
- `npm run build`: 프로덕션 빌드
- `npm run start`: 빌드 결과 실행
- `npm run lint`: ESLint 실행
- `npm run preview`: OpenNext Cloudflare 미리보기
- `npm run deploy`: OpenNext Cloudflare 배포
- `npm run cf-typegen`: Cloudflare 타입 정의 생성

## 디렉터리 메모

- `app/`: App Router 엔트리와 페이지
- `components/`: UI 컴포넌트
- `lib/`: 유틸리티와 공통 로직
- `content/`: 정적 콘텐츠
- `public/`: 정적 파일

## 설정 메모

- `tsconfig.json`은 `@/*` 경로 별칭을 사용한다.
- `next.config.ts`는 현재 거의 기본 설정만 유지하고 있다.
- `app/globals.css`에서 Tailwind 4와 커스텀 컬러 토큰, 한글 중심 폰트 스택을 사용한다.
- `.env.local` 파일이 존재하므로 로컬 환경변수를 전제로 실행된다.
