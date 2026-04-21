---
name: tuf-back-backend
description: Use when working in the tuf-back Spring Boot backend repository, including controller/service/repository changes, Oracle DB schema work, QueryDSL or JPA changes, JWT auth flow, and backend support for draft, match, league, board, or chat features.
---

# tuf-back Backend

이 스킬은 `tuf-back` 백엔드 작업용이다.

## 먼저 볼 문서

- 개발 환경과 실행 방법: [references/dev-environment.md](references/dev-environment.md)
- DB 구조와 관계: [references/database-schema.md](references/database-schema.md)

## 현재 개발 환경 요약

- Java 25
- Spring Boot 3.5.7
- Gradle Wrapper 기반
- 기본 프로필: `local`
- 기본 포트: `8080`
- 프론트 개발 서버 기본 주소: `http://localhost:5173`
- Oracle Database
- JPA + MyBatis + QueryDSL 혼합 사용
- JWT 기반 stateless 인증
- 로컬 AI는 Ollama, 운영 기본은 Cloudflare Workers AI

## 에이전트 작업 경계 (중요)

이 저장소에서 에이전트는 **빌드/실행/테스트를 직접 수행하지 않는다.**
이유: `./gradlew build`, `bootRun`, `test` 는 `build/`, `.gradle/`, `~/.gradle/`
아래에 대량의 산출물과 캐시를 만들고, 사용자의 IntelliJ 빌더와 충돌한다.

에이전트가 할 수 있는 일
- 소스 읽기, 편집, 신규 파일 생성
- 정적 분석 수준의 검증 (임포트 확인, 시그니처 일치, 엔티티-스키마 대조)
- 테스트 코드 작성 및 수정
- 설정 파일, 스키마 파일 갱신

에이전트가 하지 말아야 할 일
- `gradlew`, `gradle`, `mvn` 계열 명령 실행
- `bootRun`, `build`, `test`, `bootJar`, `check` 태스크 실행
- 의존성을 받는 모든 명령 (`--refresh-dependencies` 포함)
- `build/`, `out/`, `.gradle/` 디렉토리에 파일 쓰기

검증이 필요하면 사용자에게 요청한다. 아래 "사용자에게 요청하기" 참고.

## 작업 원칙

- 설정 변경 전에는 `application.properties`, `application-local.properties`, `application-prod.properties` 를 같이 본다.
- 데이터 조회 경로를 하나로 단정하지 말고 JPA Repository, QueryDSL, MyBatis 사용 지점을 같이 확인한다.
- DB 변경 전에는 항상 [references/database-schema.md](references/database-schema.md), `db-schema.sql`, `db-schema-alter.sql` 을 같이 맞춘다.
- FK 관계가 있는 테이블은 삭제나 컬럼 변경 전에 영향 범위를 먼저 확인한다.
- 민감값은 하드코딩하지 말고 설정 또는 secret 주입 기준으로 둔다.

## 프론트 연동 작업 시 참고 규칙

프론트에서 쓰는 응답 스키마 변경, CORS/쿠키/JWT 설정 변경, 에러 응답 포맷 조정,
API 경로 재설계처럼 **프론트 영향이 있는 작업**에서는 프론트 쪽 스펙과 런타임을
함께 확인한다.

1. 한 단계 밖에 있는 `tuf-front` 레포의 환경 문서를 읽는다.

   경로: `../tuf-front/.agent/references/development-environment.md`

   여기에 프론트의 런타임, 개발 서버 주소, 배포 타겟(Cloudflare Workers + OpenNext),
   API 호출 래퍼의 전제(`NEXT_PUBLIC_API_URL`, 토큰 저장 방식 등)가 정리되어 있다.
   백엔드에서 CORS 허용 Origin, 쿠키 SameSite, 응답 포맷을 결정할 때 근거로 쓴다.

2. 실제 호출 코드를 봐야 할 때는 `tuf-front/src/lib/api.ts`, `tuf-front/src/hooks/`
   의 쿼리 훅들을 직접 읽는다. 문서와 코드가 어긋나면 **코드를 진실의 원천**으로 본다.

3. 프론트 쪽 구현 규칙(서버/클라 컴포넌트 경계, TanStack Query 키 구조 등)까지
   손대야 하는 경우는 이 스킬의 범위를 넘어가므로, 변경 제안만 정리하고
   실제 반영은 프론트 작업 턴에서 하도록 사용자에게 넘긴다.

로컬 프론트가 실제로 떠 있는지 여부는 에이전트가 판단하지 않는다.
통합 확인이 필요한 시점에는 아래 "사용자에게 요청하기"로 넘어간다.

## 드래프트 작업 지침

현재 드래프트는 두 갈래가 공존한다.

### 1. 기존 드래프트

- `draft_*` 테이블을 사용한다.
- `draft_orders` 기반 순서형 드래프트다.
- `FIXED_ORDER`, `MANUAL_CAPTAIN` 구조를 그대로 유지한다.
- 기존 드래프트를 수정할 때는 기존 API/엔티티/서비스와 호환되게 작업한다.

### 2. 가위바위보 드래프트

- `rps_draft_*` 테이블을 사용한다.
- 기존 `draft_*` 와 섞지 않는다.
- `2팀 전용` 이다.
- 세션 생성 시 팀 2개를 자동 생성하는 전제를 둔다.
- 순번 테이블이 없다.
- 제한 시간이 없다.
- 흐름은 `가위바위보 -> 승자 1픽 -> 패자 1픽 -> 다시 가위바위보` 반복이다.

가위바위보 드래프트 작업 시 확인할 포인트

- `rps_draft_sessions.status` 는 `READY`, `RPS_PENDING`, `PICKING`, `FINISHED` 만 쓴다.
- `owner_user_id` 는 세션 등록자이자 라이브 관리 주체다.
- `rps_draft_teams.picker_user_id` 는 실제 RPS 제출과 픽 수행 계정이다.
- 누가 냈는지는 `team1_rps_choice`, `team2_rps_choice` 의 null 여부로 판단할 수 있다.
- 프론트 노출 정책과 DB 저장 구조를 구분해서 본다.
  - DB에는 선택값을 저장할 수 있다.
  - 프론트에는 둘 다 제출되기 전까지 선택값을 숨길 수 있다.

## 사용자에게 요청하기

빌드와 테스트는 사용자가 IntelliJ 또는 터미널에서 직접 수행한다.
에이전트는 필요한 시점에 **무엇을 어떻게** 해야 하는지 정확히 요청한다.

### 서버가 필요한 작업을 할 때

API 동작 확인, 컨트롤러 통합 테스트, 실제 DB 연동 확인 등
서버 기동이 전제인 작업 요청을 받았을 때는, 먼저 서버 상태를 확인한다.

확인 방법: 사용자에게 아래처럼 물어본다.

> `tuf-back` 로컬 서버 지금 켜져있어?

서버가 꺼져 있다고 하면, 아래 스니펫을 **사용자가 실행하도록** 안내한다.
에이전트가 직접 실행하지 않는다.

```powershell
# tuf-back 루트에서
.\gradlew.bat bootRun
```

IntelliJ 에서 실행하고 있다면 Run 구성에서 `local` 프로필로
`TufBackApplication` 을 기동한 상태인지 확인받는다.

기동 후 확인할 것을 같이 알려준다.
- 콘솔에 `Started TufBackApplication` 이 찍혔는지
- `http://localhost:8080/health` 가 200 을 주는지

### 프론트와의 통합 확인이 필요할 때

CORS, 쿠키, 실제 API 응답 소비 방식 등 프론트까지 붙여봐야 검증되는 작업이면
백엔드뿐 아니라 프론트 서버 상태도 같이 묻는다.

> 이거 통합으로 확인해야 해. `tuf-back` 8080 이랑 `tuf-front` dev 서버 둘 다
> 떠 있어? 프론트는 몇 번 포트에서 돌고 있는지 알려줘.

프론트 기동 명령은 **프론트 레포의 `package.json` 스크립트 기준**으로
사용자가 직접 실행한다. 에이전트가 명령을 추정해서 실행하지 않는다.

### 단위 테스트를 돌려야 할 때

단위 테스트도 에이전트가 직접 실행하지 않는다.
테스트 코드를 작성/수정한 뒤, 실행은 사용자에게 넘긴다.

추천 순서 (부하 적은 순)
1. IntelliJ 에서 테스트 클래스 옆 ▶ 버튼으로 실행 (`out/` 만 생김)
2. 특정 테스트만 Gradle 로 필요할 때
```powershell
   $env:GRADLE_USER_HOME='C:\dev\tuf\tuf-back\.gradle-home'
   .\gradlew.bat test --tests "io.github.gyulbbe.draft.service.DraftServiceTest"
```

요청 문구 예시

> `DraftServiceTest#픽_순서_검증` 만 돌려보고 실패 메시지 붙여줘.
> 실패 스택 전체가 필요해.

### 에이전트가 결과를 받는 방법

- 컴파일 에러: IntelliJ `Problems` 탭의 빨간 줄 내용 또는 터미널 출력 전체
- 테스트 실패: 실패한 테스트 이름 + AssertionError 메시지 + 스택
- 런타임 에러: 서버 콘솔 로그에서 예외 스택 전체
- SQL 이슈: 실제 실행된 바인드 쿼리와 오라클 에러 코드 (`ORA-xxxxx`)
- 프론트 통합 이슈: 프론트 DevTools Network 탭의 요청 URL/상태코드/응답 바디
  + 백엔드 콘솔의 대응 로그 (두 쪽을 같은 시점으로 맞춰서)

단편적인 메시지만으로 추정하지 않는다. 부족하면 추가 정보를 다시 요청한다.

## 백엔드 구현 체크리스트

- Controller 는 얇게 두고 비즈니스 로직은 Service 로 모은다.
- Entity 는 상태 변경 메서드를 두고 Setter 남발을 피한다.
- QueryDSL 조건은 메서드로 분리해서 null-safe 하게 만든다.
- 트랜잭션 경계는 Service 기준으로 잡는다.
- Oracle 시퀀스와 PK 전략이 맞는지 확인한다.
- DB 스키마를 바꿨으면 아래 파일을 같이 갱신한다.
  - `references/database-schema.md`
  - `references/db-schema.sql`
  - `references/db-schema-alter.sql`

## References

- Backend 개발환경: [references/dev-environment.md](references/dev-environment.md)
- Backend DB 스키마: [references/database-schema.md](references/database-schema.md)
- Frontend 런타임 환경: `../tuf-front/.agent/references/development-environment.md`