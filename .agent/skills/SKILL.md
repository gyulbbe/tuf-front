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

- 개발환경 요약: [references/development-environment.md](references/development-environment.md)
