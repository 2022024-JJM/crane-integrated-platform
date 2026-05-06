# AGENTS.md

이 문서는 이 저장소에서 작업하는 AI Agent를 위한 운영 가이드다. 설명은 한글 중심으로 작성하되, 실제 코드에 대응하는 기술 용어와 경로명은 그대로 유지한다.

## Commands

- `npm run dev` — Vite dev server 실행
- `npm run build` — TypeScript check(`tsc -b`) 후 production build 실행
- `npm run lint` — ESLint flat config 기준 정적 검사
- `npm run preview` — production build preview 실행

현재 테스트 프레임워크는 구성되어 있지 않다. 검증은 주로 `npm run lint` 와 `npm run build` 기준으로 수행한다.

## Architecture

이 프로젝트는 **Crane Monitoring Dashboard** 프론트엔드이며, 다음 스택을 사용한다.

- React 19
- TypeScript
- Vite 7
- Tailwind CSS v4
- shadcn/ui + Base UI
- react-router-dom 7
- i18next / react-i18next
- Zustand
- `@react-three/fiber` / `@react-three/drei`

전체 구조는 **Feature-Sliced Design (FSD)** 를 따른다.

### App Shell

- `src/app/main.tsx`
  - React root mount
  - `@/shared/config/i18n` 초기화
  - `@/app/styles/global.css` 로드
- `src/app/index.tsx`
  - `BrowserRouter`
  - `Routes` / `Route`
  - 공통 레이아웃으로 `AppLayout` 사용
- `src/widgets/layout/ui/app-layout.tsx`
  - `ThemeProvider`
  - `SidebarProvider`
  - `AppHeader`, `AppSidebar`, `Outlet`

### Current Routes

- `/` → `DashboardPage`
- `/monitoring/dock-status` → `DockStatusPage`
- `/monitoring/map` → `RegionMapPage`
- `/monitoring/cmms` → `RegionCmmsPage`
- `/region-overview` → `/monitoring/dock-status` 로 redirect (legacy)
- `/outdoor-work/:regionId/*` → `OutdoorWorkPage`
- `/indoor-work/:regionId/*` → `IndoorWorkPage`

`outdoor-work` 와 `indoor-work` 페이지는 `:regionId` 와 서브라우트를 전제로 동작한다. 서브라우트가 없으면 `3d-monitoring` 으로 redirect 된다.

현재 사용 중인 서브라우트는 다음과 같다.

- `3d-monitoring`
- `3d-viewer-edit`
- `crane-status`
- `work-history`

`3d-viewer-edit` 는 `src/pages/3d` 의 scene editor UI를 사용하며, 현재 `outdoor-work` 와 `indoor-work` 양쪽에서 공통으로 재사용한다.

## Layers (`src/`)

- **app/** — 애플리케이션 진입점, 라우팅, 전역 스타일
- **pages/** — 라우트 단위 화면 구성
  - 예: `dashboard`, `monitoring`, `outdoor-work`, `indoor-work`, `3d`
- **widgets/** — 페이지에서 조합하는 큰 UI 블록
  - 예: `layout`, `alarm`, `crane`, `3d`
- **features/** — 사용자 기능 단위
  - 예: `page-settings`, `3d`, `weather`
- **entities/** — 도메인 모델, mock data, domain helper
  - 예: `region`, `crane`, `alarm`, `3d`, `weather`
- **shared/** — 전역 재사용 자원
  - 예: `config`, `lib`, `types`, `ui`, `locales`

Import rule: 상위 레이어는 하위 레이어만 import 할 수 있다.

`shared` → `entities` → `features` → `widgets` → `pages` → `app`

## Apps Layout (Shell + Plugin)

`apps/` 는 Shell 1개 + 사이트 plugin N개 구조다.

- `apps/shell` — 라우팅, 인증 가드, 전역 layout. 모든 사이트별 페이지는 `lazy()` 로 plugin 에서 동적 로드한다. 사이트 전용 비즈니스 로직을 shell 안에 두지 않는다.
- `apps/{site}` (예: `hanwha-ocean`, `goliath-crane`, `philly-shipyard`) — 사이트 전용 page slice 모음. 다른 plugin 을 import 하지 않는다.

각 plugin 의 page slice 표준 구조:

```
apps/{site}/src/pages/{page}/
├── ui/                 # 화면 컴포넌트 (필수)
├── model/              # hooks, aggregations, 비즈니스 로직 (선택)
└── index.ts            # public API
```

- 비즈니스 로직(데이터 집계, hook)은 `model/` 에, JSX 는 `ui/` 에 둔다.
- `ui/` 가 `model/` 을 import 할 수는 있지만 그 반대는 금지.
- 새 page 를 추가하면 plugin 의 `package.json` exports 에 `"./pages/{page}": "./src/pages/{page}/index.ts"` 를 등록한다.
- 새 사이트 plugin 은 `pnpm new-site <slug>` 로 scaffold 한다 (apps/&lt;slug&gt; 와 shell 의존성을 생성). shell 의 `app.tsx` 라우팅 등록과 `navigation.ts` 메뉴 분기는 사이트마다 권한·라우트가 달라서 수동으로 추가한다.

## Current Project State

현재 저장소 기준으로 주의해서 이해해야 할 구현 상태는 다음과 같다.

- 다국어는 `ko`, `en`, `la` 세 언어를 지원한다.
- 언어 리소스는 `src/shared/locales` 아래 namespace 별 JSON으로 관리한다.
- 현재 namespace 는 `common`, `dashboard`, `monitoring`, `monitoring-overview` 이다.
- i18n 초기화와 language persistence 는 `src/shared/config/i18n.ts` 가 담당한다.
- 테마 상태는 `src/shared/lib/theme-context.tsx` 에서 관리한다.
- 사이드바 open/close 상태는 `src/shared/lib/sidebar-context.tsx` 에서 관리한다.
- 헤더 표시 옵션(date/time/health/weather)은 `src/shared/lib/header-display-settings-context.tsx` 에서 관리한다.
- 헤더 우측 날씨 pill 은 `features/weather`, `entities/weather` 를 통해 구성된다.
- 공용 3D viewer shell 은 `src/shared/ui/organisms/three-scene-viewer.tsx` 에 있다.
- 3D simulation/runtime state 일부는 `src/features/3d/model` 의 Zustand store 가 담당한다.
- 3D editor page/session/history/unsaved guard 는 `src/pages/3d` 에 있다.
- 개발 환경에서 scene JSON 저장은 `vite.config.ts` 의 custom dev middleware(`POST /__dev/scene`)가 담당한다.
- region별 scene 파일 매핑은 `src/entities/3d/model/scene-file-registry.ts` 를 기준으로 맞춘다.
- `outdoor-work` / `indoor-work` 의 `crane-status`, `work-history` 는 아직 placeholder 성격의 화면이다.
- 네비게이션 구성은 `src/widgets/layout/config/navigation.ts` 에서 현재 pathname 기준으로 동적으로 만든다.

## FSD Import Rules

다음 규칙은 단순 문서 권고가 아니라, 현재 `eslint.config.js` 의 `no-restricted-imports` 설정으로 실제 강제되는 규칙이다.

- Cross-layer import 는 FSD 레이어 순서를 따라야 한다.
- `pages`, `widgets`, `features`, `entities` 의 cross-slice import 는 가능하면 각 슬라이스의 public API(`index.ts`)를 통해서만 수행한다.
- 다른 슬라이스 내부 구현에 대한 deep import 를 지양한다.
  - 예: `@/widgets/foo/ui/bar`
  - 예: `@/entities/foo/model/types`
- 외부에서 소비되는 슬라이스는 `index.ts` public API 를 제공해야 한다.
- `shared` 는 최하위 레이어이므로 `entities`, `features`, `widgets`, `pages`, `app` 를 import 하면 안 된다.

## Public API / Contract

Agent는 다음 계약을 전제로 수정 범위를 판단한다.

- 외부 소비는 각 슬라이스의 `index.ts` public API 를 우선 사용한다.
- `pages/index.ts` 는 현재 주요 route page export 집합이다.
- `pages/3d` 는 route 직접 진입점이 아니라 `outdoor-work` / `indoor-work` 내부에서 재사용되는 editor page slice 라는 점을 전제로 본다.
- `widgets/layout` 은 앱 공통 shell 역할을 가진다.
- 언어 설정은 `src/shared/config/i18n.ts` 를 기준으로 맞춘다.
- 테마와 사이드바 전역 상태는 각각 `src/shared/lib/theme-context.tsx`, `src/shared/lib/sidebar-context.tsx` 를 기준으로 맞춘다.
- 헤더 표시 옵션은 `src/shared/lib/header-display-settings-context.tsx` 를 기준으로 맞춘다.
- 3D domain type/helper 는 `entities/3d`, 3D feature state/behavior 는 `features/3d` 에 둔다.
- weather API URL 생성, 파싱, 표시 데이터 변환은 `entities/weather` 에 두고, header에서의 조합은 `features/weather` 에 둔다.

## shared/ui 구조 (Atomic Design)

- `src/shared/ui/atoms/*.tsx` — 단일 UI 요소
  - 예: `button`, `badge`, `separator`, `switch`, `toggle`, `spinner`
- `src/shared/ui/molecules/*.tsx` — atoms 조합 컴포넌트
  - 예: `card`, `table`, `scroll-area`, `resizable`, `toggle-group`, `tooltip`
- `src/shared/ui/organisms/*.tsx` — 더 큰 공용 UI 조합
  - 예: `three-scene-viewer`

`components.json` 기준 shadcn CLI 생성 위치는 `src/shared/ui` 이다. 새 컴포넌트를 추가한 뒤에는 적절한 atomic 계층으로 수동 이동하는 것을 기본 원칙으로 한다.

## Conventions

### Path / Config

- Path alias: `@/*` → `src/*`
- Tailwind CSS v4 를 사용하므로 `tailwind.config.*` 는 없다.
- 전역 테마 토큰과 스타일 진입점은 `src/app/styles/global.css` 기준으로 맞춘다.

### Formatting

- Prettier 설정은 `.prettierrc` 기준으로 맞춘다.
- `singleQuote: true`
- `semi: true`
- `trailingComma: all`
- `printWidth: 80`
- `prettier-plugin-tailwindcss` 로 Tailwind class 정렬을 적용한다.

### Commit Message

- 최근 커밋 기준 메시지 컨벤션은 `type : 한글 설명` 형식을 따른다.
- `type` 예시는 `feat`, `fix`, `refact` 이며, 콜론 앞뒤 공백까지 동일하게 맞춘다.
- commit message 본문이 꼭 필요하지 않다면 subject 한 줄만 사용한다.

### UI / Styling

- shadcn/ui 컴포넌트는 `src/shared/ui/atoms` 또는 `src/shared/ui/molecules` 로 정리한다.
- 공용 복합 viewer 성격의 UI는 `src/shared/ui/organisms` 에 둔다.
- 스타일 병합은 `cn()` 유틸리티(`src/shared/lib/utils.ts`)를 우선 사용한다.
- variant 스타일링은 CVA(`class-variance-authority`) 패턴을 따른다.

### State / Data / i18n

- 전역 설정성 상태는 `shared/lib` 컨텍스트 또는 `shared/config` 에 둔다.
- feature 전용 런타임 상태는 해당 feature 내부 model 에 둔다.
- mock data 는 각 entity slice 내부 `model/mock-data.ts` 에 두는 현재 패턴을 따른다.
- 번역 리소스 추가 시 `src/shared/locales/{lang}` 아래 namespace JSON을 함께 맞춘다.
- 언어 추가/변경 시 `SUPPORTED_LANGUAGES`, `resources`, `ns`, locale fallback 을 `src/shared/config/i18n.ts` 와 함께 맞춘다.
- 3D scene 편집 결과는 dev server 경유로 `public/scenes/*.json` 에 저장되므로, 관련 수정 시 scene registry 와 public asset 경로를 함께 확인한다.

### FSD Usage

- 다른 슬라이스의 내부 구현 파일을 직접 import 하지 말고 public API 를 먼저 확인한다.
- 새 슬라이스가 외부에서 소비되면 `index.ts` 를 추가한다.
- 레이어 규칙을 우회하는 편의성 import 는 만들지 않는다.

## Known Caveats

- `README.md` 의 일부 구조/파일 설명은 현재 코드와 다를 수 있다.
- Agent는 문서 간 충돌이 있으면 `실제 코드`, 그다음 `AGENTS.md`, 마지막으로 `README.md` 순서로 신뢰한다.
- 테스트 프레임워크가 없으므로, 변경 검증 시 lint/build 와 실제 파일 구조 대조가 특히 중요하다.
- 현재 ESLint 규칙은 FSD import 제약 외에도 React 19 계열 hook/ref 규칙과 `react-refresh/only-export-components` 를 함께 강하게 검사한다.
- 따라서 단순 동작 수정이어도 ref를 render 중 읽는 패턴, effect 내부 동기 `setState`, component file 내 non-component export 가 lint 실패 원인이 될 수 있다.
- 현재 로컬 환경에서는 `npm run build` 실행 시 `tsc -b` 이후 Vite 단계에서 Rollup optional dependency(`@rollup/rollup-linux-x64-gnu`) 누락으로 실패할 수 있다.
- Agent는 이 알려진 Rollup 누락 이슈만을 이유로 `npm install` 또는 추가 dependency 설치 승인을 요청하지 않는다. 대신 `npx tsc -b` 결과와 `vite build` 실패 원인을 그대로 보고한다.
