---
name: tuf-front-workspace
description: Use this skill when working in the tuf-front repository and you need the current development environment, runtime, commands, deployment target, or repository-specific implementation context before making changes.
---

# tuf-front workspace

이 스킬은 `tuf-front` 레포에서 작업할 때 현재 개발환경과 구현 컨텍스트를 빠르게 맞추기 위한 용도다.

## 기본 규칙

1. 런타임, 명령어, 배포 방식, 스택 버전이 중요한 작업이면 먼저 [references/development-environment.md](references/development-environment.md)를 읽는다.
2. 개발환경 문서는 빠른 참고용이다. 정확한 버전이나 설정이 중요한 변경은 `package.json`, `tsconfig.json`, `wrangler.jsonc`, `open-next.config.ts`를 다시 확인한다.
3. 이 레포는 Next.js `16.2.4`를 사용한다. 프레임워크 동작에 영향을 주는 코드를 작성할 때는 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다.
4. 라우팅과 화면 구조는 `app/` 기준으로 본다.
5. 스타일 작업은 `app/globals.css`의 기존 Tailwind 4 토큰과 폰트 스택을 우선 따른다.
6. 배포 관련 작업은 Cloudflare Workers + OpenNext 구성을 전제로 한다.

## References

- Backend API docs: https://api.tufclan.com/swagger-ui/index.html#/

- 개발환경 요약: [references/development-environment.md](references/development-environment.md)

---
name: frontend-nextjs-react-tailwind
description: 프론트엔드 개발용 스킬. Next.js(App Router) + React + TypeScript + TailwindCSS + TanStack Query 기반. 컴포넌트 설계, 클라이언트/서버 컴포넌트 경계, 상태 관리(로컬/서버), API 통신, 인증(JWT), 폼 처리(React Hook Form + Zod), 라우팅, 성능 최적화(memo/useMemo/useCallback), 스타일링(Tailwind 우선) 규칙을 다룬다. 사용자가 React, Next.js, useState, useEffect, useMemo, useCallback, Tailwind, TanStack Query, React Query, React Hook Form, Zod, JWT 로그인, 라우팅, 동적 import, SSR/CSR, 페이지 이동, 폼 검증, API 호출, 컴포넌트 분리, 스타일, 반응형 관련 질문을 할 때 반드시 이 스킬을 사용할 것. "페이지 만들어줘", "컴포넌트 분리해줘", "API 연동", "로그인 구현", "폼 만들어줘" 같은 요청도 포함. JSP/jQuery 레거시 질문에는 이 스킬 사용하지 말 것.
---
 
# Frontend (Next.js + React + TS + Tailwind + TanStack Query)
 
## 0. 대화 규칙
 
- 한국어, 반말, 간결.
- **작동하는 TSX 코드** 우선. 설명은 코드 아래 한두 줄.
- 버전/환경 불확실하면 먼저 물어볼 것:
  - Next.js **App Router** vs Pages Router (App이 기본 가정)
  - **TypeScript** 사용 여부 (기본 가정)
  - CSS 방식 (**Tailwind** 기본. 다른 거 쓰면 말해줘)
- `"use client"` 경계 의식적으로 그을 것. 무조건 클라 컴포넌트로 만들지 말 것.
## 1. 프로젝트 구조 (App Router 기준)
 
```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃 (서버 컴포넌트)
│   ├── page.tsx            # 홈
│   ├── providers.tsx       # QueryClient, Theme 등 ("use client")
│   ├── (auth)/             # 라우트 그룹 (URL 영향 없음)
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── matches/
│   │   ├── page.tsx        # /matches 목록 (서버 컴포넌트에서 fetch)
│   │   └── [id]/page.tsx   # /matches/:id
│   └── api/                # 라우트 핸들러 (BFF 필요할 때만)
├── components/
│   ├── ui/                 # Button, Input 등 원자 단위
│   └── feature/            # 도메인별 (MatchCard, LeagueList)
├── hooks/                  # 커스텀 훅 (use로 시작)
├── lib/
│   ├── api.ts              # fetch wrapper
│   ├── auth.ts             # 토큰 관리
│   └── utils.ts            # cn(), formatDate() 등
├── types/                  # 전역 타입
└── styles/globals.css      # Tailwind directives
```
 
**경로 alias** (`tsconfig.json`):
```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```
 
## 2. Server Component vs Client Component
 
**기본은 서버 컴포넌트.** 클라 필요할 때만 `"use client"` 붙이기.
 
**클라이언트 컴포넌트로 만들어야 하는 경우**
- `useState`, `useEffect`, `useRef` 등 훅 사용
- `onClick`, `onChange` 등 이벤트 핸들러
- 브라우저 API (`window`, `localStorage`)
- 서드파티 훅 (TanStack Query `useQuery` 등)
```tsx
// app/matches/page.tsx  (서버 컴포넌트 - 기본)
import { MatchList } from "@/components/feature/match-list";
 
export default async function MatchesPage() {
  // 서버에서 직접 fetch. 빠르고 SEO 유리
  const res = await fetch(`${process.env.API_URL}/matches`, {
    next: { revalidate: 60 },  // 60초 ISR
  });
  const matches = await res.json();
 
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">매치 목록</h1>
      <MatchList initialMatches={matches} />  {/* 서버 데이터를 클라로 전달 */}
    </main>
  );
}
```
 
```tsx
// components/feature/match-list.tsx  (클라 - 인터랙션 있음)
"use client";
 
import { useState } from "react";
 
type Props = { initialMatches: Match[] };
 
export function MatchList({ initialMatches }: Props) {
  const [filter, setFilter] = useState("");
  const filtered = initialMatches.filter(m => m.title.includes(filter));
 
  return (
    <div>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 mb-4"
        placeholder="제목 검색"
      />
      <ul className="space-y-2">
        {filtered.map(m => (
          <li key={m.id} className="rounded border p-3 hover:bg-gray-50">
            {m.title}
          </li>
        ))}
      </ul>
    </div>
  );
}
```
 
**경계 원칙**
- `"use client"`는 **트리의 잎에 가까운 쪽**에 붙일수록 번들 작아짐
- 서버 컴포넌트 안에 클라 컴포넌트 넣는 건 OK. 반대는 children 프롭으로만 가능
- 클라 컴포넌트에 서버 전용 코드(DB 접근, 환경변수 등) 절대 금지
## 3. 컴포넌트 규칙
 
```tsx
// components/ui/button.tsx
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
 
type Variant = "primary" | "secondary" | "danger";
type Size = "sm" | "md" | "lg";
 
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};
 
const variantCls: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
};
 
const sizeCls: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4",
  lg: "h-12 px-6 text-lg",
};
 
export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = "primary", size = "md", className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        variantCls[variant],
        sizeCls[size],
        className
      )}
      {...rest}
    />
  )
);
Button.displayName = "Button";
```
 
**컴포넌트 체크리스트**
- Props에 `any` 금지. 타입 명확히
- 확장 가능한 컴포넌트는 `HTMLAttributes`/`ButtonHTMLAttributes` 등 상속
- 외부에서 스타일 덮어쓸 수 있게 `className` prop 받고 `cn()`으로 병합
- 기본값은 구조분해에서 `= "primary"` 스타일로
- ref 필요하면 `forwardRef` + `displayName`
- 파일명 kebab-case, 컴포넌트명 PascalCase
## 4. 스타일링 (Tailwind 우선)
 
**규칙**
- 기본적으로 Tailwind 유틸리티 클래스만 사용
- 반복되는 조합은 컴포넌트로 추출 (`Button`, `Card`)
- 반복이 아니라 그냥 길어서 불편하면 `cn()` 헬퍼로 분리
- 커스텀 CSS는 `globals.css`에 최소화. 피할 수 없을 때만 `@layer components`
- 조건부 클래스는 `clsx` + `tailwind-merge` (= `cn()`)로
**`lib/utils.ts`**
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
 
**반응형**
```tsx
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
  {/* 모바일 1열 → 768px+ 2열 → 1024px+ 3열 */}
</div>
```
 
**다크모드** (`tailwind.config.js`에 `darkMode: "class"`):
```tsx
<div className="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
```
 
## 5. 상태 관리 (로컬 vs 서버 분리)
 
두 종류 엄격히 분리:
 
| 종류 | 뭘로 | 예시 |
|---|---|---|
| **로컬 UI 상태** | `useState`, `useReducer` | 모달 열림, 입력값, 탭 선택 |
| **서버 상태** | TanStack Query | API 데이터, 캐시, 리패치 |
| **전역 UI 상태** | Zustand / Context | 테마, 로그인 유저 |
 
로컬 상태를 전역으로 끌어올리지 말 것. 서버 상태를 `useState`에 복사하지 말 것.
 
## 6. API 통신 (TanStack Query)
 
**Provider 세팅**
```tsx
// app/providers.tsx
"use client";
 
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
 
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,        // 1분 fresh
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```
 
```tsx
// app/layout.tsx
import { Providers } from "./providers";
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
```
 
**fetch wrapper**
```ts
// lib/api.ts
import { getToken, clearToken } from "./auth";
 
type Options = RequestInit & { params?: Record<string, string | number | undefined> };
 
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { params, headers, ...rest } = opts;
  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}${path}`);
  Object.entries(params ?? {}).forEach(([k, v]) => {
    if (v !== undefined) url.searchParams.set(k, String(v));
  });
 
  const token = getToken();
  const res = await fetch(url, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
 
  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("UNAUTHORIZED");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "API_ERROR");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
```
 
**쿼리/뮤테이션 훅 (도메인별로 모음)**
```ts
// hooks/use-matches.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
 
type Match = { id: number; title: string; status: string };
type SearchCond = { title?: string; status?: string; page?: number };
 
const matchKeys = {
  all: ["matches"] as const,
  list: (cond: SearchCond) => [...matchKeys.all, "list", cond] as const,
  detail: (id: number) => [...matchKeys.all, "detail", id] as const,
};
 
export function useMatches(cond: SearchCond) {
  return useQuery({
    queryKey: matchKeys.list(cond),
    queryFn: () => api<{ content: Match[]; totalElements: number }>("/api/matches", { params: cond }),
  });
}
 
export function useMatch(id: number) {
  return useQuery({
    queryKey: matchKeys.detail(id),
    queryFn: () => api<Match>(`/api/matches/${id}`),
    enabled: !!id,
  });
}
 
export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; leagueId: number }) =>
      api<number>("/api/matches", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: matchKeys.all }),
  });
}
```
 
**사용**
```tsx
"use client";
 
import { useMatches } from "@/hooks/use-matches";
 
export function MatchTable() {
  const { data, isLoading, error } = useMatches({ page: 0 });
 
  if (isLoading) return <div className="p-8 text-center">로딩중...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error.message}</div>;
 
  return (
    <table className="w-full">
      <tbody>
        {data?.content.map(m => (
          <tr key={m.id}><td>{m.title}</td><td>{m.status}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
```
 
**Query 체크리스트**
- `queryKey`는 계층형 + 파라미터 포함. `invalidateQueries({ queryKey: [...prefix] })`로 부분 무효화
- `mutationFn` 성공 후 관련 쿼리 `invalidate` 또는 `setQueryData`로 즉시 반영
- 서버 상태를 `useState`/`useEffect`로 직접 관리하지 말 것
- 무한스크롤은 `useInfiniteQuery`
## 7. 폼 처리 (React Hook Form + Zod)
 
```tsx
"use client";
 
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCreateMatch } from "@/hooks/use-matches";
 
const schema = z.object({
  title: z.string().min(2, "2자 이상").max(100, "100자 이하"),
  leagueId: z.coerce.number().int().positive("리그 선택 필수"),
});
type FormValues = z.infer<typeof schema>;
 
export function MatchCreateForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", leagueId: 0 },
  });
  const createMatch = useCreateMatch();
 
  const onSubmit = handleSubmit(async (values) => {
    await createMatch.mutateAsync(values);
    // 성공 후 라우팅/토스트
  });
 
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">제목</label>
        <input
          {...register("title")}
          className="w-full rounded border border-gray-300 px-3 py-2"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
      </div>
 
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isSubmitting ? "저장중..." : "생성"}
      </button>
    </form>
  );
}
```
 
**폼 체크리스트**
- 검증 스키마는 Zod 한 곳에. 타입도 `z.infer`로 생성
- `z.coerce.number()`로 문자열→숫자 자동 변환
- 제출 중 버튼 `disabled` + 텍스트 바꾸기
- 서버 검증 에러는 `setError("fieldName", { message })`로 표시
## 8. 인증 (JWT) 처리
 
**토큰 저장 위치 선택**
- `localStorage`: 구현 쉬움, XSS 취약
- `httpOnly Cookie`: 보안 강함, BFF/리프레시 필요
- 일반적으로 **httpOnly 쿠키 + 서버 라우트 핸들러** 조합 권장. 간단히 할 땐 localStorage + CSP로 최소 방어
**간단 버전 (localStorage)**
```ts
// lib/auth.ts
const KEY = "access_token";
 
export function setToken(t: string) { localStorage.setItem(KEY, t); }
export function getToken() {
  if (typeof window === "undefined") return null;  // 서버에서 호출 방어
  return localStorage.getItem(KEY);
}
export function clearToken() { localStorage.removeItem(KEY); }
```
 
**미들웨어로 보호 라우트**
```ts
// middleware.ts  (쿠키 기반일 때)
import { NextResponse, type NextRequest } from "next/server";
 
export function middleware(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  if (!token && req.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
 
export const config = { matcher: ["/admin/:path*"] };
```
 
## 9. 라우팅 & 네비게이션
 
```tsx
"use client";
 
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
 
export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
 
  return (
    <nav className="flex gap-4">
      {/* prefetch 자동. 대부분 Link 사용 */}
      <Link href="/matches" className={pathname === "/matches" ? "font-bold" : ""}>
        매치
      </Link>
 
      {/* 프로그래매틱 이동 */}
      <button onClick={() => router.push(`/matches?page=${Number(params.get("page") ?? 0) + 1}`)}>
        다음 페이지
      </button>
    </nav>
  );
}
```
 
- `<a href>` 대신 `<Link>` (클라 네비게이션 + prefetch)
- 동적 라우트: `app/matches/[id]/page.tsx` → `params.id`
- 쿼리스트링은 `useSearchParams` (읽기 전용)
## 10. 성능 최적화
 
**언제 필요한가**
- 실제로 느려진 뒤에. 섣불리 `memo`/`useMemo` 남용하면 복잡도만 올라감
- React DevTools Profiler로 프로파일 먼저
**패턴**
```tsx
// 1) 비싼 계산 메모이제이션
const sortedMatches = useMemo(
  () => matches.slice().sort((a, b) => b.date - a.date),
  [matches]
);
 
// 2) 자식에 넘기는 콜백 안정화 (자식이 memo될 때만 의미 있음)
const handleSelect = useCallback((id: number) => {
  setSelectedId(id);
}, []);
 
// 3) 리스트 아이템
const MatchRow = memo(function MatchRow({ m, onClick }: Props) {
  return <li onClick={() => onClick(m.id)}>{m.title}</li>;
});
 
// 4) 동적 import (번들 분할)
const Chart = dynamic(() => import("@/components/chart"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse bg-gray-100" />,
});
```
 
- `next/image`의 `<Image>`로 자동 최적화 + lazy
- 외부 라이브러리는 dynamic import로 초기 번들에서 제거
## 11. 테스트 (Vitest + RTL)
 
```tsx
// __tests__/button.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";
import { describe, it, expect, vi } from "vitest";
 
describe("Button", () => {
  it("클릭하면 핸들러 호출", async () => {
    // given
    const onClick = vi.fn();
    render(<Button onClick={onClick}>확인</Button>);
 
    // when
    await userEvent.click(screen.getByRole("button", { name: "확인" }));
 
    // then
    expect(onClick).toHaveBeenCalledTimes(1);
  });
 
  it("disabled면 클릭 안 먹음", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>확인</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```
 
- 구현 디테일 말고 **사용자 관점**으로 테스트 (getByRole, getByText 우선)
- 쿼리 훅 테스트는 `QueryClientProvider`로 감싸고 MSW로 API 목킹
## 12. 자주 하는 실수 (리뷰 체크리스트)
 
- [ ] 무조건 `"use client"` 최상단에 붙임 → 트리 잎쪽으로 밀 것
- [ ] 서버 데이터를 `useState` + `useEffect`로 관리 → TanStack Query 써
- [ ] `<a href>`로 내부 이동 → `<Link>`로 (풀 리로드 발생)
- [ ] `useEffect`에서 의존성 배열 빈 채로 상태 참조 → stale closure 버그
- [ ] `key={index}` 리스트에 사용 → 리오더 시 상태 꼬임. 고유 ID 써
- [ ] fetch 에러 안 잡음 → `res.ok` 체크 + try/catch
- [ ] 401 받았는데 리다이렉트 안 함 → api wrapper에서 일괄 처리
- [ ] 토큰을 `localStorage`만 쓰고 SSR에서 접근 시도 → `typeof window` 체크
- [ ] `useMemo`/`useCallback` 아무 데나 붙임 → 프로파일 후 필요한 곳만
- [ ] Tailwind 클래스 동적 조합을 템플릿 리터럴로 (`bg-${color}-500`) → Tailwind가 purge. 전체 클래스 명시적으로 써
- [ ] 이미지 `<img>` 태그 사용 → `<Image>`로 (LCP/CLS 개선)
- [ ] Controller(Link) 바깥에서 `useRouter().push` 남발 → 대부분 Link로 충분
- [ ] 서버 컴포넌트에서 `useState` 같은 훅 사용 → `"use client"` 필요
- [ ] 클라 컴포넌트에서 환경변수 `process.env.SECRET` 참조 → 번들에 노출됨. `NEXT_PUBLIC_` 아닌 건 서버에서만
## 13. 응답 전 자기 검증
 
코드 뽑기 전에 체크:
1. Next.js App Router 맞나? (Pages Router면 규칙 다름)
2. 서버/클라 컴포넌트 경계 의식했나?
3. Tailwind 동적 클래스 문제 없나?
4. TanStack Query로 서버 상태 처리했나? 로컬과 섞지 않았나?
5. 타입 `any` 없나?
6. 접근성 기본(`<button type>`, `label` 연결, `alt`) 챙겼나?