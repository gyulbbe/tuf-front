# tuf-front workspace

이 스킬은 `tuf-front` 레포에서 작업할 때 현재 개발환경과 구현 컨텍스트를 빠르게 맞추기 위한 용도다.

## 기본 규칙

1. 런타임, 명령어, 배포 방식, 스택 버전이 중요한 작업이면 먼저 [references/development-environment.md](references/development-environment.md)를 읽는다.
2. 개발환경 문서는 빠른 참고용이다. 정확한 버전이나 설정이 중요한 변경은 `package.json`, `tsconfig.json`, `wrangler.jsonc`, `open-next.config.ts`를 다시 확인한다.
3. 이 레포는 Next.js `16.2.4`를 사용한다. 프레임워크 동작에 영향을 주는 코드를 작성할 때는 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다.
4. 라우팅과 화면 구조는 `app/` 기준으로 본다.
5. 스타일 작업은 `app/globals.css`의 기존 Tailwind 4 토큰과 폰트 스택을 우선 따른다.
6. 배포 관련 작업은 Cloudflare Workers + OpenNext 구성을 전제로 한다.
7. 유저에 대한 정보를 보여줄 때, 특별한 요구사항 없이 pk나 사용자 이름이 밖에 보이게 하지 않는다. 웬만하면 user id로 보여준다.

## 에이전트 작업 경계 (중요)

이 저장소에서 에이전트는 **개발 서버 기동/빌드/프리뷰를 직접 수행하지 않는다.**
이유: `next dev`, `next build`, `wrangler dev`, `opennextjs-cloudflare build` 같은
명령은 `.next/`, `.open-next/`, `node_modules/.cache/` 아래 대량의 산출물을 만들고,
사용자가 이미 띄워 둔 개발 서버와 포트를 충돌시킨다.

에이전트가 할 수 있는 일
- 소스 읽기, 편집, 신규 파일 생성
- 타입/임포트 정합 수준의 정적 검증
- 단위 테스트 코드 작성 및 수정
- 설정 파일(`next.config.*`, `tsconfig.json`, `wrangler.jsonc`) 갱신

에이전트가 하지 말아야 할 일
- `npm run dev`, `pnpm dev`, `next dev`, `wrangler dev`
- `next build`, `opennextjs-cloudflare build`, `wrangler deploy`
- 의존성 설치 (`npm install`, `pnpm install` 등) — 필요하면 사용자에게 요청
- `.next/`, `.open-next/`, `node_modules/` 에 파일 쓰기

## 백엔드 연동 작업 시 참고 규칙

API 연동, 에러 응답 스키마, 인증 흐름, CORS/쿠키 정책처럼
**백엔드 스펙 확인이 필요한 작업**에서는 다음 순서로 참고한다.

1. Swagger 먼저: https://api.tufclan.com/swagger-ui/index.html#/
2. 런타임 동작(포트/프로필/환경변수/JWT 설정 등)이 궁금하면
   한 단계 밖에 있는 `tuf-back` 레포의 환경 문서를 읽는다.

   경로: `../tuf-back/.agent/references/development-environment.md`

   이 문서는 실제로 돌고 있는 백엔드의 기본 포트, 프로필, DB, 인증 방식을
   요약하고 있으므로 프론트에서 API 호출 규약을 정할 때 근거로 쓴다.
3. 문서와 실제 응답이 어긋나면 Swagger 를 진실의 원천으로 본다.
   그래도 모호하면 사용자에게 실제 응답 샘플을 요청한다.

로컬 백엔드가 실제로 떠 있는지 여부는 에이전트가 판단하지 않는다.
API 호출 동작을 확인해야 하는 시점에는 아래 "사용자에게 요청하기"로 넘어간다.

## 사용자에게 요청하기

### 프론트 개발 서버가 필요한 작업

실제 라우팅, SSR/CSR 경계, 하이드레이션, 스타일 적용 여부, 네트워크 요청 흐름 등
**브라우저에서 확인해야 하는 검증**이 필요하면, 기동 상태를 먼저 물어본다.

> `tuf-front` 개발 서버 지금 떠 있어? 몇 번 포트에서 돌고 있는지 알려줘.

꺼져 있다고 하면 사용자가 직접 띄우도록 요청한다. 에이전트가 실행하지 않는다.
정확한 스크립트는 `package.json` 의 `scripts` 섹션을 기준으로 안내한다.

확인 요청 예시
- 특정 경로가 렌더되는지: `http://localhost:<port>/matches` 열어서 콘솔 에러 있는지
- 네트워크 흐름: DevTools Network 탭에서 해당 호출의 상태코드/요청 헤더/응답 바디
- 스타일: 해당 요소의 computed class, 실제 렌더된 박스

### 백엔드 API 가 필요한 작업

프론트 코드 검증이 실제 API 응답에 의존하면 (예: TanStack Query 훅,
JWT 로그인 플로우, 폼 제출 후 서버 검증) 백엔드 서버 상태도 같이 묻는다.

> 이거 확인하려면 백엔드도 떠 있어야 해. `tuf-back` 지금 `8080` 에 떠 있어?

프로덕션 API(`https://api.tufclan.com`) 대상으로 붙여서 확인할 건지,
로컬 `tuf-back` 대상으로 확인할 건지 사용자에게 선택을 맡긴다.
`.env.local` 의 `NEXT_PUBLIC_API_URL` 을 임시로 바꿔야 하는 상황이면
그 변경도 사용자가 직접 하도록 안내한다.

### 테스트 실행

Vitest/RTL 기반 단위 테스트도 에이전트가 직접 실행하지 않는다.
테스트 코드를 작성한 뒤, 사용자에게 실행을 요청한다.

요청 예시
> `__tests__/match-list.test.tsx` 만 돌려보고 실패 메시지 붙여줘.

### 에이전트가 결과를 받는 방법

- 타입 에러: `Problems` 탭의 TS 에러 전체 (코드 `TSxxxx` 포함)
- 런타임 에러: 브라우저 콘솔 스택 또는 Next.js 오버레이 전체 메시지
- 네트워크 이슈: 상태코드 + 요청 URL + 응답 바디
- 스타일 이슈: 실제 렌더된 엘리먼트의 최종 class 문자열과 computed style
- API 응답 의문: Swagger 기준 스펙이 아니라 **실제 응답의 JSON 샘플**

단편적인 메시지만으로 추정하지 않는다. 부족하면 추가 정보를 다시 요청한다.

## References

- Backend API docs: https://api.tufclan.com/swagger-ui/index.html#/
- Backend 런타임 환경: `../tuf-back/.agent/references/development-environment.md`
- 개발환경 요약: [references/development-environment.md](references/development-environment.md)

## 백엔드 수정이 더 적절한 경우

프론트에서 억지로 우회/구현하려 할 때 다음 중 하나에 해당하면,
**구현을 시작하지 말고** 사용자에게 백엔드 수정 요청을 먼저 제안한다.

- 한 화면에 필요한 데이터를 모으려고 API 를 여러 번 호출해야 하거나 N+1 호출 패턴이 되는 경우
- 프론트에서 가공/집계/정렬/필터링하기 위해 페이지 범위 이상의 데이터를 다 내려받아야 하는 경우
- 인증/권한 체크, 민감 계산, 비즈니스 규칙을 프론트에서 재구현해야 하는 경우
- Swagger 스펙과 실제 응답이 불일치하거나, 응답 스키마가 화면 요구사항과 구조적으로 어긋나는 경우
- 에러 응답 포맷이 엔드포인트마다 달라서 프론트 분기 로직이 급격히 복잡해지는 경우
- CORS, 쿠키(Secure/SameSite), 커스텀 헤더 등 브라우저 레벨에서 막혀서 프론트 코드만으로는 해결 불가능한 경우
- 화면 확정 전 임시 데이터를 위해 프론트에 하드코딩/매핑 테이블을 쌓아야 하는 경우

판단이 애매하면 **구현을 시작하기 전에** 사용자에게 선택지를 제시한다.

예시 메시지
> 이 화면 데이터는 지금 스펙으론 `GET /matches` + `GET /users/{id}` 두 번 호출 후
> 프론트에서 머지해야 해. 호출 횟수/렌더 지연을 고려하면 `GET /matches/summary`
> 같은 집계 엔드포인트를 `tuf-back` 에 추가하는 게 더 깔끔해 보여.
> 옵션 A: 프론트에서 병렬 호출 + 머지로 우회
> 옵션 B: 백엔드에 엔드포인트 추가 요청 후 대기
> 어느 쪽으로 갈지 정해줘.

이 판단을 에이전트가 단독으로 내리지 않는다. 근거(호출 횟수, 응답 크기, 불일치 지점)를
짧게 정리해서 제시하고, 구현 방향은 사용자의 결정을 따른다.

우회 구현으로 합의된 경우에도, 나중에 백엔드에서 정리돼야 할 지점은
코드에 `// TODO(backend): ...` 주석으로 남긴다.