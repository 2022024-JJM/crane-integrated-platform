# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

저장소는 pnpm + Turborepo 모노레포다. 루트에서 실행한다.

- `pnpm dev` — Turborepo 가 shell dev 서버 (Vite, 보통 `http://localhost:5173`) 를 실행한다.
- `pnpm dev:shell` — shell 만 직접 실행 (`pnpm --filter @crane/shell dev`).
- `pnpm build` — typecheck 선행 후 shell 을 빌드한다 (`turbo run build`). `turbo.json` 의 `build.dependsOn` 에 `typecheck` 가 들어 있어, 빌드 전에 타입 에러가 먼저 잡힌다.
- `pnpm typecheck` — `turbo run typecheck`. 실제로는 `apps/shell` 의 `tsc --noEmit` 하나만 돌지만, shell tsconfig 가 모든 workspace 패키지를 reference 로 끌어와 전체를 검증한다.
- `pnpm lint` — `turbo run lint`. **현재 shell 1개만 실행됨.** 다른 9 개 패키지에는 lint 스크립트가 없어 ESLint 가 돌지 않는다 (의식적으로 손대는 파일은 직접 ESLint 를 돌려 확인).
- `pnpm exec eslint <path>` — 특정 파일/폴더에 직접 ESLint 실행. 신규/수정 코드 검증에 사용한다.
- `pnpm new-site <slug>` — 새 사이트 plugin 을 스캐폴드한다 ([scripts/new-site.mjs](scripts/new-site.mjs)). `apps/<slug>` 디렉토리, 기본 page, shell 의존성까지 자동 생성하지만 `apps/shell/src/app.tsx` 라우팅 등록, `packages/widgets/src/layout/config/navigation.ts` 메뉴 분기, `apps/shell/src/locales/{ko,en,la}` 번역은 수동 추가가 필요하다.

테스트 프레임워크는 구성되어 있지 않다. 검증은 `typecheck` + 신규 코드 ESLint + (UI 변경 시) `pnpm dev` 로 시각 확인이 표준이다.

## Architecture

이 저장소는 **Shell + Plugin 마이크로프론트엔드** 구조의 모노레포이며, 한 개의 호스트(`@crane/shell`)에 사이트별 plugin 앱들을 React.lazy 로 동적 로드한다. 2026-04-03 단일 앱에서 모노레포로 전환되었다.

### 모노레포 레이아웃

`pnpm-workspace.yaml` 기준으로 `apps/*` + `packages/*`:

```
apps/
├── shell/             # 호스트: 라우터, 인증/region 가드, providers, i18n
├── hanwha-ocean/      # 한화오션 도크 모니터링 (실제 구현)
├── goliath-crane/     # 골리앗 크레인 + SOSLAB LiDAR (실제 구현)
├── philly-shipyard/   # 필리 조선소 MRO (7 페이지, 실제 구현)
└── crane-hmi/         # HMI (스캐폴딩 단계)
packages/
├── core/              # 인프라: API/WS 클라이언트, providers, config, lib
├── domain/            # 도메인 엔티티/타입 (alarm, crane, monitoring, region, 3d 등)
├── ui/                # Atomic UI: atoms / molecules / organisms
├── features/          # 기능 모듈 (model = hooks, ui = 기능 컴포넌트)
└── widgets/           # 복합 위젯 (여러 features/도메인 결합)
```

### FSD 레이어 (단방향)

```
widgets → features → domain → core
          ↓         ↑
          └── ui ───┘
```

상위 → 하위 단방향. 이 규칙은 [eslint.config.js](eslint.config.js) 의 `no-restricted-imports` 로 실제 강제된다. 위반하면 lint 가 실패하므로 코드 리뷰 전에 발견된다.

핵심 규칙:
- `features` 는 `widgets` 를 import 할 수 없다 (이 위반은 빈번하며 widgets 의 컴포넌트를 features 로 끌어 올리려 할 때 발생한다).
- 같은 layer 의 sibling slice 는 **공개 API (`@crane/<layer>/<slice>`)** 로만 import. 상대경로 cross-slice (`../../<other-slice>/...`) 는 ESLint 가 차단한다.
- 같은 slice 내부는 상대경로 사용.
- Deep import (`@crane/features/<slice>/model/<file>`) 금지 — 각 slice 의 `index.ts` public API 를 통해서만 소비한다.
- raw `<button>`, `<input>` 직접 사용 금지. `@crane/ui/atoms/*` 사용.

### Shell + Plugin 등록 흐름

- 모든 사이트 페이지는 [apps/shell/src/app.tsx](apps/shell/src/app.tsx) 에서 `React.lazy` 로 등록된다.
- `ProtectedRoute` (인증), `RegionGuard` (regionId 유효성), `LazyRoute` (Suspense + 에러 바운더리) 의 3 단 가드 계층을 거친다.
- 역할 기반 접근 제어: `isMroAllowed`, `isHmiAllowed` 등으로 plugin 단위 차단.
- 신규 plugin 추가는 `pnpm new-site` 로 시작하되 shell 의 routing/navigation/i18n 은 수동 손질이 필요하다.

### Plugin Page Slice 표준

각 사이트의 `apps/<site>/src/pages/<page>/` 구조:

```
pages/<page>/
├── ui/            # JSX (필수). 페이지 컴포넌트 + 하위 컴포넌트
├── model/         # hook, aggregation, 비즈니스 로직 (선택)
└── index.ts       # public API
```

- `ui/` 가 `model/` 을 import 가능. 역방향 금지.
- 새 page 추가 시 plugin 의 `package.json` exports 에 `"./pages/<page>": "./src/pages/<page>/index.ts"` 등록 필수.

### 핵심 공유 자원

- **ThreeSceneViewer** ([packages/ui/src/organisms/three-scene-viewer.tsx](packages/ui/src/organisms/three-scene-viewer.tsx)): 5 개 슬롯 (`overlay`, `fullscreenOverlay`, `fullscreenTopRightOverlay`, `fullscreenTopCenterOverlay`, `toolbarExtras`). **`fullscreenOverlay` 슬롯은 CMMS 가 점유** — 통합 컴포넌트 내부에서 마운트되며 외부 prop 으로 노출하지 않는다.
- **RealtimeMonitoringView / ReplayMonitoringView** ([packages/widgets/src/monitoring](packages/widgets/src/monitoring)): indoor/outdoor/goliath realtime+replay 페이지가 공유하는 통합 위젯. 슬롯 패턴으로 사이트별 차이를 흡수한다 (`layout`, `sideSlot`, `extraTopRightOverlay`, `disableAlarmFeatures` 등). 신규 사이트는 wrapper 한 줄로 재사용.
- **i18n**: ko/en/la 3 개 언어. 키는 [apps/shell/src/locales/{ko,en,la}](apps/shell/src/locales) 에 중앙화되어 있고 모든 plugin 이 공유한다.
- **상태관리**: Zustand. feature 전용 store 는 `packages/features/src/<slice>/model/use-*-store.ts`.
- **API/WebSocket**: [packages/core/src/api](packages/core/src/api), [packages/core/src/ws](packages/core/src/ws). React Query 는 `packages/core/src/providers/query-provider`.
- **3D 편집 결과**: dev server 의 custom middleware (`POST /__dev/scene`) 가 `public/scenes/*.json` 으로 저장. region ↔ scene 매핑은 domain/3d 의 scene-file-registry.

### 섹션 펼침/접힘 패턴

여러 섹션이 펼침/접힘 + "전체 접기"를 함께 지원할 때는 부모가 `Record<key, boolean>` 한 곳에서 관리하는 controlled 패턴을 써야 한다. 공통 hook `useSectionCollapseGroup` (`@crane/core/lib/use-section-collapse-group`) 사용. 자식이 자기 `useState` 를 따로 두고 부모의 globalCollapsed 로 덮어쓰는 방식은 금지 (펼침 상태가 어긋나면 클릭 안 한 다른 섹션이 의도치 않게 펼쳐지는 버그가 난다).

## Conventions

### Path / Build

- 각 plugin app 은 `@crane/<slug>/pages/<page>` 같이 명시적 exports 만 공개한다.
- `tsconfig.base.json` 을 모든 패키지가 extend.
- Vite manual chunks 가 `vendor-react`, `vendor-three`, `vendor-r3f`, `vendor-query`, `vendor-charts` 로 분리되어 있다 (`apps/shell/vite.config.ts`).

### Formatting

- Prettier: `singleQuote: true`, `semi: true`, `trailingComma: all`, `printWidth: 80`.
- `prettier-plugin-tailwindcss` 로 Tailwind class 정렬.

### Commit Message

- 형식: `type : 한글 설명` (콜론 앞뒤 공백 동일).
- type 예시: `feat`, `fix`, `refact`.
- subject 한 줄로 충분하면 본문 생략.

### Styling

- Tailwind CSS v4. `tailwind.config.*` 파일 없음. 전역 스타일 진입점은 `apps/shell/src/styles/global.css`.
- shadcn 컴포넌트 출력 위치는 `@crane/ui` ([components.json](components.json) `aliases.components`). 추가 후 atoms/molecules/organisms 로 수동 분류.
- 클래스 병합은 `cn()` (`@crane/core/lib/utils`).
- variant 는 CVA (class-variance-authority).

## Caveats

- **README.md 와 AGENTS.md 는 단일 앱 시절 문서**다. `src/app/`, `src/pages/`, `npm run dev` 같은 표현이 나오는데 이는 현재 코드와 일치하지 않는다 (현재는 pnpm + 모노레포). 문서 간 충돌 시 신뢰 순서: `실제 코드 > CLAUDE.md > AGENTS.md > README.md`.
- **Lint 부채**: `pnpm lint` 가 shell 만 검사하므로 packages/* 와 다른 apps/* 의 ESLint 위반이 누적되어 있다 (react-hooks/set-state-in-effect, react-hooks/immutability 등 12 건 이상). 신규 코드는 `pnpm exec eslint <path>` 로 직접 검증한다. 손대는 파일이 부채 목록에 있으면 같이 고치는 것이 합리적이다.
- **React 19 strict rules**: ESLint 가 `react-hooks/rules-of-hooks` + `react-refresh/only-export-components` + react-hooks 신규 규칙(set-state-in-effect, immutability)을 강하게 검사한다. effect 내부 동기 setState, render 중 ref 읽기, component 파일 내 non-component export 가 lint 실패 원인이 될 수 있다.
- 보안 항목 (평문 자격증명/토큰 저장/CSP 등) 은 현재 PoC/테스트 단계라 진단에서 제외 중. 배포 결정 시 재도입 예정.
