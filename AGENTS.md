# AGENTS.md

이 문서는 이 저장소에서 작업하는 AI Agent를 위한 운영 가이드다. 설명은 한글 중심으로 작성하되, 실제 코드에 대응하는 기술 용어와 경로명은 그대로 유지한다.

에이전트 규칙의 단일 소스는 이 파일이다. 루트 `CLAUDE.md` 는 `@AGENTS.md` 한 줄짜리 포인터일 뿐이므로, 규칙을 고칠 때는 이 파일만 고친다. 코드와 이 문서가 어긋난 것을 발견하면 작업 중이라도 해당 항목을 갱신한다.

## Commands

pnpm workspace + turbo 모노레포다. 패키지 매니저는 `pnpm@10.11.0` 이며 npm 을 쓰지 않는다.

- `pnpm dev` — 전체 dev (실질적으로 `apps/shell`), 또는 `pnpm dev:shell`
- `pnpm build` — turbo build (`apps/shell` 이 유일한 빌드 대상)
- `pnpm lint` — ESLint flat config
- `pnpm typecheck` — TypeScript check
- `pnpm test` — vitest
- `pnpm new-site <slug>` — 새 사이트 plugin scaffold
- `pnpm optimize:glb`, `pnpm optimize:map` — 3D 자산 최적화 파이프라인

### 검증 커맨드의 실제 커버리지 (주의)

turbo task 는 각 workspace 의 `package.json` scripts 에만 물린다. 현재 정의 상태는 다음과 같고, 이 차이를 모르면 "통과했다"를 잘못 보고하게 된다.

| 커맨드 | 실제로 검사되는 범위 |
|---|---|
| `pnpm lint` | `apps/shell` 만 (`eslint .` 를 해당 디렉토리에서 실행) |
| `pnpm typecheck` | `apps/shell/src` 만. 단 shell 이 import 하는 `@crane/*` 소스는 따라 들어가므로 상당 부분이 간접 검사된다. `apps/shell/vite.config.ts` 와 `vite-plugin-asset-hash.ts` 는 `src` 밖이라 빠지므로 고쳤으면 `npx tsc --noEmit ... <파일>` 또는 dev 서버 기동으로 따로 확인한다 |
| `pnpm test` | `apps/{philly-shipyard,mro2,indoorshop}` + `packages/{core,domain,features,widgets}` |
| `npx tsc -b` (루트) | 루트 `tsconfig.json` 의 project references 전체. 단 `apps/{crane-hmi,mro2,indoorshop}` 은 references 에 없다 |

`packages/{core,domain,features,widgets}` 에는 `test` 스크립트가 있지만, `packages/*` 어디에도 `lint`/`typecheck` 스크립트는 없다. 패키지 코드만 고쳤을 때는 `npx tsc -b` 를 함께 돌려 확인한다.

`pnpm lint` 가 `apps/shell` 안에서만 `eslint .` 를 돌리므로, 아래 **FSD Import Rules 의 ESLint 강제는 `packages/*` 와 `apps/{site}` 에서 실제로 실행되지 않는다.** 루트 `eslint.config.js` 에 규칙은 정의돼 있고 파일을 직접 지정하면 적용되지만, `pnpm lint` 경로로는 그 파일들에 도달하지 않는다. 해당 코드를 고쳤다면 루트에서 `npx eslint <고친 경로>` 로 직접 확인한다.

주의: 루트 전수 검사(`npx eslint packages apps`)는 2026-09-01 기준 112건(에러 76건)이 이미 남아 있다. 대부분 react-hooks v7 컴파일러 규칙(`refs`, `set-state-in-effect`)과 `react-refresh/only-export-components` 이며 **FSD import 위반은 0건**이다. 그러니 "루트 lint 0건"을 완료 기준으로 삼지 말고, 자신이 건드린 파일만 지정해 새로 생긴 위반이 없는지 본다.

### 테스트 현황

vitest 를 사용한다. 테스트가 존재하는 곳은 `apps/{philly-shipyard,mro2,indoorshop}` 과 `packages/{core,domain,features,widgets}` 이며, `lib/`·`model/` 의 순수 함수·스토어·훅을 대상으로 한다. 3D 편집(scene-editor)·모니터링(features/3d)·도메인 헬퍼(domain/3d/lib)는 특성화 테스트로 덮여 있다.

- 설정 선례: `apps/philly-shipyard/vitest.config.ts` (`environment: 'node'`, `include: ['src/**/*.test.ts']`, `setupFiles` 로 타임존 고정). `vitest.config.ts` 가 있는 곳은 `apps/philly-shipyard` 와 `packages/{core,domain,features,widgets}` 뿐이고(`core` 는 three 가 없어 `setupFiles` 도 없다), `apps/{mro2,indoorshop}` 은 설정 없이 vitest 기본값으로 돈다.
- 패키지 공통 규칙: 기본 환경은 node. DOM·localStorage·React 훅이 필요한 파일에만 `// @vitest-environment jsdom` 을 붙인다 (jsdom 전역 설정 금지). 훅 테스트는 `@testing-library/react` 의 `renderHook` 을 쓴다.
- `packages/{features,widgets}` 의 `src/test-setup.ts` 는 jsdom 캔버스 스텁이다 — three/examples 모듈(lottie 등)이 로드 시점에 2D 컨텍스트를 요구해서 없으면 jsdom 테스트의 모듈 로드가 깨진다.
- R3F `useFrame` 훅(리플레이 러너, 충돌 가드 시뮬레이션)은 `@react-three/fiber` 를 mock 해 콜백을 잡아 두고 delta 를 수동 주입해 결정론적으로 돌린다. 시뮬레이션의 Math.random 은 시드 고정 PRNG 로 대체한다.
- 도입 배경·범위는 `docs/3D-단위테스트-도입-계획.md` 참조.

#### 테스트 작성 체크리스트 (예외·경계가 기본 범위)

성공 경로만 검증한 테스트는 미완성이다. 대상 파일마다 아래를 훑고, 해당하는 항목은 반드시 케이스로 만든다.

- **잘못된 입력 방어**: 결손 필드, 타입 오염(문자열 opacity, `locked: 'yes'`), `NaN`/`Infinity`, 배열 속 `null`, 구버전 포맷(legacy `map`, 봉투 이전 localStorage). 방어 로직이 있는 파일(sanitize 류)은 이게 본론이다.
- **경계값**: 클램프의 min/max 정확값과 그 밖, 랩([0,360)), 최대 개수·깊이(북마크 12, undo 50)의 초과 1개, 빈 배열·빈 문자열·빈 씬. "경계 정확값 = 통과, +1 = 거부"를 쌍으로 검증한다.
- **실패 경로**: fetch reject·HTTP 에러, 저장소 손상 JSON, 로더 reject. 에러 자체만이 아니라 **그 뒤의 상태**까지 본다 — 폴백이 맞는 값인지, 지우면 안 되는 데이터가 남는지(scene-dev-storage의 "fetch 성공 후에만 로컬 삭제"가 선례).
- **no-op 경로**: 같은 내용 재설정, 없는 id 삭제, 빈 스택 undo. 값만이 아니라 **상태 참조 유지**(`toBe(before)`)까지 확인한다 — 참조가 바뀌면 불필요한 리렌더·히스토리 오염·dirty 오탐이 생긴다.
- **수명·정리**: 훅 언마운트 시 스토어 정리, off 전환 시 잔여 상태 제거, 캐시 실패값의 영속 여부.
- **결정론**: 타이머·`Math.random`·`useFrame`·실네트워크에 기대는 테스트 금지. delta 수동 주입, 시드 고정 PRNG, fetch/로더 mock 으로 통제한다.
- **특성화 원칙**: 테스트 중 버그로 보이는 동작을 발견해도 구현을 고치지 않는다. 현재 동작을 그대로 고정하고 `it.todo` 또는 주석으로 보고한다 (선례: preview-render-queue 의 preset 키 `[object Object]` 충돌, use-scene-history 의 present=null 일 때 canUndo=true 이지만 undo 는 no-op).

#### 테스트 파일 배치 규약

테스트는 대상 코드 옆에 나란히 두지 않고 **`__tests__/` 디렉토리로 분리**한다. 소스 트리를 훑을 때 구현 파일만 보이게 하고, 테스트가 슬라이스 public API 를 오염시키지 않게 하려는 것이다.

```
lib/
├── __tests__/
│   └── zone-hit.test.ts
└── zone-hit.ts
```

- `__tests__/` 는 테스트 대상과 **같은 세그먼트**(`lib/`, `model/`) 안에 둔다. 슬라이스 루트에 하나로 몰지 않는다.
- 파일명은 `{대상}.test.ts` 로 대상 파일과 1:1 대응시킨다.
- 테스트 전용 fixture·헬퍼도 같은 `__tests__/` 안에 둔다. `lib/` 나 `model/` 에 테스트 전용 파일을 만들지 않는다.
- `__tests__/` 안의 파일은 슬라이스 `index.ts` 에서 export 하지 않는다.
- `apps/mro2` 에는 아직 나란히 둔 기존 파일이 남아 있다. 규약 이전의 잔재이며, 손대는 김에 `__tests__/` 로 옮긴다. `apps/{philly-shipyard,indoorshop}` 은 이미 규약을 따른다.

## Architecture

**Crane Integrated Platform** 프론트엔드이며, 다음 스택을 사용한다.

- React 19 / TypeScript / Vite 7
- Tailwind CSS v4 (`tailwind.config.*` 없음)
- shadcn/ui + Base UI
- react-router-dom 7
- i18next / react-i18next
- Zustand, TanStack Query
- `@react-three/fiber` / `@react-three/drei` / `three`

전체 구조는 **Feature-Sliced Design (FSD)** 를 pnpm workspace 로 물리 분리한 형태다.

### Workspace = FSD Layer

FSD 레이어가 곧 패키지다. 이 대응이 이 저장소를 읽는 핵심이다.

| FSD 레이어 | 위치 | 패키지명 |
|---|---|---|
| app | `apps/shell` | `@crane/shell` |
| pages | `apps/{site}/src/pages/` | `@crane/{site}` |
| widgets | `packages/widgets/src/` | `@crane/widgets` |
| features | `packages/features/src/` | `@crane/features` |
| entities | `packages/domain/src/` | `@crane/domain` |
| shared | `packages/core/src/`, `packages/ui/src/` | `@crane/core`, `@crane/ui` |

Import 방향: `core`/`ui` → `domain` → `features` → `widgets` → `apps/{site}` → `apps/shell`

### Apps Layout (Shell + Plugin)

`apps/` 는 Shell 1개 + 사이트 plugin N개 구조다.

- `apps/shell` — 라우팅, 인증 가드, 전역 layout, i18n 초기화, 전역 스타일. 모든 사이트별 페이지는 `lazy()` 로 plugin 에서 동적 로드한다. **사이트 전용 비즈니스 로직을 shell 안에 두지 않는다.**
- `apps/{site}` — 사이트 전용 page slice 모음. 다른 plugin 을 import 하지 않는다.
  현재: `hanwha-ocean`, `goliath-crane`, `philly-shipyard`, `mro2`, `indoorshop`, `crane-hmi`

`apps/shell/src` 구조:

```
apps/shell/src/
├── main.tsx           # React root mount
├── app.tsx            # BrowserRouter / Routes / ProtectedRoute / lazy 라우트 정의
├── i18n-init.ts       # namespace JSON 을 모아 @crane/core 의 initI18n 호출
├── locales/{ko,en,la} # namespace 별 JSON
├── styles/            # global.css, design-token.css
├── runtime/           # app-runtime-effects, register-asset-hash
└── pages/             # shell 자체 페이지 (login, not-found) — 사이트 페이지는 여기 두지 않는다
```

각 plugin 의 page slice 표준 구조:

```
apps/{site}/src/pages/{page}/
├── ui/                 # 화면 컴포넌트 (필수)
├── model/              # hooks, aggregations, 비즈니스 로직 (선택)
│   └── __tests__/      # model 테스트
├── lib/                # 순수 함수 (선택) — 테스트 대상
│   └── __tests__/      # lib 테스트
└── index.ts            # public API
```

- 비즈니스 로직은 `model/`·`lib/` 에, JSX 는 `ui/` 에 둔다. `ui/` → `model/` import 는 가능하지만 반대는 금지.
- 새 page 를 추가하면 plugin `package.json` 의 exports 에 `"./pages/{page}": "./src/pages/{page}/index.ts"` 를 등록한다.
- 새 사이트 plugin 은 `pnpm new-site <slug>` 로 scaffold 한다. shell 의 `app.tsx` 라우팅 등록과 `navigation.ts` 메뉴 분기는 사이트마다 권한·라우트가 달라서 **수동으로** 추가한다.

### Routes

라우트는 사이트가 늘어나며 계속 증가한다. **`apps/shell/src/app.tsx` 가 유일한 사실 소스**이므로 이 문서에 목록을 복제하지 않는다. 구조적 규칙만 기억한다.

- 모든 route element 는 `lazy()` + `LazyRoute`(Suspense + `RouteErrorBoundary`) 로 감싼다.
- `login` 을 제외한 전부가 `ProtectedRoute` 하위이고, 그 안에 `AppLayout` 이 있다.
- 현장 작업 화면은 `outdoor-work` / `indoor-work` / `goliath-work` 세 갈래이고, 모두 `:regionId/*` 형태로 `RegionGuard` 하위에 있다. 서브라우트는 `<Route>` 가 아니라 페이지 컴포넌트 안에서 `useParams` 의 `'*'` 를 문자열 비교해 분기한다. 서브라우트가 없으면 각자 `3d-monitoring` 으로 redirect 된다.
- 공통 서브라우트: `3d-monitoring`, `3d-viewer-edit`, `virtual-tags`, `crane-status`, `work-history`, `alarm-history`, `3d-replay`. `goliath-work` 는 여기에 `vision`, `cabin-monitoring` 을 더 가진다.
- `3d-viewer-edit` 는 `@crane/widgets` 의 scene editor 를, `virtual-tags` 는 `@crane/widgets/virtual-tags` 의 가상 태그 관리 페이지를 사용하며 세 화면이 공유한다. 가상 태그 목록은 region 무관 전역이다.
- `BrowserRouter` 의 basename 은 `import.meta.env.BASE_URL` 에서 온다 (sub-path 배포 `/crane_rnd/`).

## FSD Import Rules

다음은 문서 권고가 아니라 `eslint.config.js` 의 `no-restricted-imports` 로 **실제 강제**되는 규칙이다.

- 레이어 경계: `@crane/core`·`@crane/ui` 는 상위 레이어를 import 할 수 없고, `@crane/domain` 은 core/ui 만, `@crane/features` 는 domain/core/ui 까지, `@crane/widgets` 는 features 까지 import 할 수 있다. 어느 패키지도 `apps/*` 를 import 하지 않는다.
- 다만 "패키지 → app" 금지 목록에 실제로 적혀 있는 app 은 `@crane/hanwha-ocean` 과 `@crane/goliath-crane` 둘뿐이다. `@crane/{philly-shipyard,mro2,indoorshop,crane-hmi,shell}` 을 패키지에서 import 하면 **ESLint 는 잡지 못한다.** 규칙 위반인 것은 같으니 손으로 지킨다.
- Public API 강제: `@crane/{domain,features,widgets}/*/{ui,model,lib,config}/*` 형태의 deep import 는 에러다. 슬라이스의 `index.ts` public API 를 통한다.
- 외부에서 소비되는 슬라이스는 `index.ts` 를 제공해야 한다.
- 레이어 규칙을 우회하는 편의성 import 를 만들지 않는다.

## Public API / Contract

Agent는 다음 계약을 전제로 수정 범위를 판단한다.

- 외부 소비는 각 슬라이스의 `index.ts` public API 를 우선 사용한다.
- 3D domain type/helper 는 `@crane/domain/3d`, 3D feature state/behavior 는 `@crane/features/3d`, 3D editor 는 `@crane/widgets` 에 둔다.
- weather API URL 생성·파싱·표시 변환은 `@crane/domain` 의 weather 슬라이스에, header 조합은 `@crane/features/weather` 에 둔다.
- `@crane/widgets` 의 `layout` 슬라이스가 앱 공통 shell(`AppLayout`, `AppHeader`, `AppSidebar`) 역할을 가진다.

주요 기준 파일:

| 관심사 | 위치 |
|---|---|
| i18n 초기화 / 지원 언어 | `packages/core/src/config/i18n.ts` (`SUPPORTED_LANGUAGES = ['ko','en','la']`, fallback `ko`) |
| 번역 리소스 | `apps/shell/src/locales/{ko,en,la}/*.json` — namespace 추가 시 `apps/shell/src/i18n-init.ts` 에 함께 등록 |
| 테마 / 사이드바 / 헤더 표시 옵션 | `packages/core/src/lib/{theme,sidebar,header-display-settings}-context.tsx` |
| 네비게이션 구성 | `packages/widgets/src/layout/config/navigation.ts` |
| 공용 3D viewer shell | `packages/ui/src/organisms/three-scene-viewer.tsx` |
| 탑뷰 포즈 계산(정수직 회피 tilt, 뷰어·편집기 공용) | `packages/core/src/lib/top-view-pose.ts` (`computeTopViewPose`, `ensureTopViewTilt`, 테스트 대상) |
| 3D 런타임 상태(Zustand) | `packages/features/src/3d/model/` |
| 3D editor session/history/persistence | `packages/widgets/src/scene-editor/model/` |
| region → scene 파일 매핑 | `packages/domain/src/3d/model/scene-file-map.ts`, `scene-file-registry.ts` |
| 씬 JSON 스키마 / 방어 | `packages/domain/src/3d/model/types.ts`, `packages/domain/src/3d/lib/sanitize-scene-info.ts` |
| 리깅 스키마(관절·구속조건·바인딩) / 방어 | `packages/domain/src/3d/model/rig-types.ts`, `packages/domain/src/3d/lib/sanitize-rig.ts` |
| 리깅 런타임(값 저장소·드라이버) | `packages/features/src/3d/model/{rig-value-store,use-rig-driver,rig-live-readouts}.ts`, `packages/features/src/3d/lib/{apply-joint,smooth-damp}.ts` |
| 리깅 편집 UI | `packages/widgets/src/3d/ui/rigging-section.tsx`(인스펙터 탭), `packages/widgets/src/3d/lib/model-node-tree.ts`(계층 목록 노드 트리) |
| 태그 맵핑 스키마 / 방어 / 레거시 변환 | `packages/domain/src/3d/model/tag-mapping-types.ts`, `packages/domain/src/3d/lib/sanitize-tag-mappings.ts` |
| 태그 값 버스 / 맵핑 인덱스 / 바인딩 소스 | `packages/features/src/3d/model/tag-value-bus.ts`, `lib/tag-mapping-index.ts`, `model/use-tag-binding-source.ts` |
| 가상 태그 정의·파형·방어 | `packages/domain/src/virtual-tag/` (`model/types.ts`, `lib/{tag-pattern,sanitize-virtual-tags}.ts`) |
| 가상 태그 스토어·러너·카탈로그 / 영속화 어댑터 | `packages/features/src/3d/model/{use-virtual-tag-store,virtual-tag-runner,use-tag-catalog}.ts` / `packages/domain/src/virtual-tag/lib/virtual-tag-storage.ts`(배포 파일 `apps/shell/public/simulation/virtual-tags.json`) |
| 태그 맵핑 편집 UI | `packages/widgets/src/3d/ui/tag-mapping-section.tsx`(인스펙터 탭), `tag-key-combobox.tsx`, `lib/tag-mapping-editor.ts`(충돌 판정·기본값, 테스트 대상), 팔레트 "태그" 탭 `palette-virtual-tag-section.tsx` |
| 가상 태그 관리 페이지 | `packages/widgets/src/virtual-tags/ui/virtual-tags-page.tsx` |
| 검색 가능 콤보박스 | `packages/ui/src/molecules/combobox.tsx` (base-ui `Combobox` 래핑, `usePortalContainer` + `z-9999` 규약) |
| 전체화면(Fullscreen API) | 훅 `packages/core/src/lib/use-fullscreen.ts`(3D 뷰어·편집 페이지 공용, zustand 전역 상태). 요소 하나가 아니라 **문서 전체**를 `requestFullscreen` 하고 `AppLayout` 이 `useIsFullscreenActive()` 로 헤더·사이드바를 숨긴다 — top layer 밖에 남는 DOM 이 없어 body 포털·전역 Toaster 를 따로 챙길 필요가 없다(요소 단위 전체화면 시절엔 `PortalContainerProvider` 와 두 번째 Toaster 가 필요했다). 페이지 일부인 뷰어(`ThreeSceneViewer`)는 `isFullscreen` 일 때 자기 루트를 `fixed inset-0 z-50` 으로 띄운다. 주인(toggle 을 부른 인스턴스)만 `isFullscreen` 이 true 고, 주인이 언마운트되면 전체화면을 끝낸다 |
| 모니터링 씬 독(dock: hover 펼침·고정 우측 레일) | 껍데기 `packages/ui/src/organisms/scene-dock.tsx`(`SceneDockRail`, 완전 제어형, 도킹 프레임은 `three-scene-viewer.tsx` 의 `toolbarPlacement="dock"`), 상태·영속화 `packages/features/src/3d/model/use-scene-dock.ts` + `lib/{dock-hover-state,dock-storage}.ts`(순수 리듀서·pin 영속화, 테스트 대상). 조립은 `Monitoring3dView` 의 `toolbarLayout="dock"`. 하단 독 패널(크레인 실시간 상태 테이블)은 2026-09-03 에 제거됐다 |

## packages/ui 구조 (Atomic Design)

- `packages/ui/src/atoms/*.tsx` — 단일 UI 요소 (`button`, `badge`, `separator`, `switch`, `spinner` 등)
- `packages/ui/src/molecules/*.tsx` — atoms 조합 (`card`, `table`, `scroll-area`, `resizable`, `tooltip` 등)
- `packages/ui/src/organisms/*.tsx` — 더 큰 공용 조합 (`three-scene-viewer` 등)

`components.json` 의 shadcn alias 는 `components`/`ui` → `@crane/ui`, `utils` → `@crane/core/lib/utils` 다. CLI 로 생성한 뒤 적절한 atomic 계층으로 수동 이동하는 것을 기본 원칙으로 한다.

## Conventions

### Path / Config

- 워크스페이스 간 참조는 `@crane/*` 패키지 경로를 쓴다. **`@/*` alias 는 더 이상 존재하지 않는다.**
- 공통 컴파일러 옵션은 `tsconfig.base.json`, 프로젝트 참조는 루트 `tsconfig.json` 에 있다. `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly` 가 켜져 있다.
- Tailwind CSS v4 를 사용하므로 `tailwind.config.*` 는 없다. 전역 토큰과 스타일 진입점은 `apps/shell/src/styles/{global,design-token}.css` 다.

### Formatting

- Prettier 설정은 `.prettierrc` 기준. `singleQuote: true`, `semi: true`, `trailingComma: all`, `printWidth: 80`
- `prettier-plugin-tailwindcss` 로 Tailwind class 를 정렬한다.

### Commit Message

- `type : 한글 설명` 형식. `type` 예시는 `feat`, `fix`, `refact`, `chore` 이며 **콜론 앞뒤 공백까지 동일하게** 맞춘다.
- 본문이 꼭 필요하지 않으면 subject 한 줄만 사용한다.

### UI / Styling

- 스타일 병합은 `cn()`(`packages/core/src/lib/utils.ts`)을 우선 사용한다.
- variant 스타일링은 CVA(`class-variance-authority`) 패턴을 따른다.

### State / Data / i18n

- 전역 설정성 상태는 `@crane/core` 의 context 또는 config 에 둔다.
- feature 전용 런타임 상태는 해당 feature 내부 `model/` 에 둔다.
- mock data 는 각 domain slice 내부 `model/mock-data.ts` 패턴을 따른다.
- 언어 추가/변경 시 `SUPPORTED_LANGUAGES`, `resources`, `ns`, locale fallback 을 `packages/core/src/config/i18n.ts` 와 `apps/shell/src/i18n-init.ts` 에서 함께 맞춘다.

### 3D 작업

- 3D scene 편집 결과는 dev server 경유로 `apps/shell/public/scenes/*.json` 에 저장된다. 미들웨어는 `apps/shell/vite.config.ts` 의 `POST /__dev/scene` 이다. 관련 수정 시 scene registry 와 public asset 경로를 함께 확인한다. 가상 태그도 같은 방식으로 `POST /__dev/virtual-tags` → `public/simulation/virtual-tags.json` 에 저장되며, 경로 문자열이 `vite.config.ts` 와 `virtual-tag-storage.ts` 두 곳에 있으니 함께 바꾼다.
- dev 미들웨어가 `public/` 에 쓰는 디렉토리(`scenes`, `simulation`, `previews`)는 `apps/shell/vite-plugin-asset-hash.ts` 의 `DEV_WRITTEN_DIRS` 에 등록돼 있어야 저장 시 전체 리로드가 나지 않는다(이 플러그인이 public 자산 변경마다 `full-reload` 를 보내는 주체다. Vite 코어는 보내지 않는다). 새 저장 미들웨어를 만들면 그 목록에 추가한다. `server.watch.ignored` 로 막지 않는다 — Vite 는 워처가 유지하는 `publicFiles` 집합에 있는 파일만 서빙해서, 무시된 디렉토리에 기동 후 생긴 파일은 재시작 전까지 404 가 된다.
- **카메라 `up` 은 항상 +Y 로 두고, 탑뷰는 `packages/core/src/lib/top-view-pose.ts` 의 미세 tilt(`TOP_VIEW_TILT`)로 만든다.** 탑뷰용으로 `camera.up` 을 바꾸면 OrbitControls 극점이 틀어져 회전이 어색하고, `{position, target}` 만 저장하는 포즈(포커스 복귀·북마크·`SavedCameraInfo`)가 up 을 되살릴 수 없어 복원 시 화면이 돌아간다. up=+Y 인 채 타깃 정확히 위에 서면 `lookAt` 이 퇴화해 roll 이 부동소수 노이즈로 정해지므로, 뷰어 `applyCameraState` 는 들어오는 모든 포즈를 `ensureTopViewTilt` 로 정규화한다(사이트 프리셋 `topViewPosition: [0,30,0]`·옛 북마크 방어). 2026-09-05 에 뷰어의 `up=(0,0,-1)` 탑뷰를 이 방식으로 통일했다.
- **`ui/*.tsx` 안에서 수치 계산을 하지 않는다.** 좌표 변환·프레이밍·판정 로직은 같은 슬라이스의 `lib/` 로 빼서 테스트 가능하게 유지한다. `packages/features/src/3d/lib/scene-shadow.ts` 가 이 원칙의 선례이고, 그 파일 주석이 이유(react-refresh 규칙)까지 설명한다.
- **기즈모 스냅은 three `TransformControls` 의 `translationSnap`/`rotationSnap`/`scaleSnap` 에 맡기지 않는다.** local 공간에서는 격자가 객체의 회전 프레임에 놓여 yaw 로 돌아간 모델의 X·Z 저장값이 격자를 벗어나고, world 회전은 델타 기준이라 시작 소수점이 남는다. 스냅은 `packages/features/src/3d/lib/snap-transform.ts` 의 순수 함수가 **저장값(부모 프레임 위치 m · 오일러 도 · 배율)** 기준으로 하며, 기즈모 경로(`use-scene-transform.ts` liveSync — 드래그 시작 대비 변한 축만)와 인스펙터 스테퍼(`InputNumber` 의 `stepValue` 에 `stepOnGrid` 주입)가 같은 함수를 쓴다. 직접 타이핑한 값은 스냅하지 않는다.
- 루트 태그 맵핑이 있는 모델은 기즈모 드래그가 끝나는 프레임에 `use-rig-driver.ts` 가 루트 rest 를 **현재 자세**로 다시 잡는다(handoff, `reanchorRootIfMoved`). 커밋된 새 배치값은 React 렌더 + passive effect 를 거쳐야 드라이버에 도착하므로, 그 전 프레임에 옛 rest 로 되돌리면 모델이 이전 위치로 한 번 튄다. 드라이버가 마지막으로 적용한 자세 그대로인 루트(기즈모가 안 건드린 것)는 rest 를 유지한다. 드래그 시작 자세가 rest+Δ 라 커밋값에 Δ 가 흡수되는 문제는 별건으로 남아 있다(`use-rig-driver.test.ts` 의 `it.todo`).
- region → 씬 파일 매핑의 단일 소스는 `packages/domain/src/3d/model/scene-file-map.ts` 다. 브라우저 런타임(`scene-file-registry.ts`)과 Node 컨텍스트인 `apps/shell/vite.config.ts` 의 저장 미들웨어가 **같은 표를 읽어야** 한다. 표를 복제하거나 미등록 region 을 기본 파일로 fallback 시키지 않는다 — 그 fallback 이 남의 씬을 덮어쓴 사고의 원인이었고, 지금은 양쪽 모두 `null` 을 반환한다. 파일 자체 주석에 경위가 있다.
- GLB 자산은 압축본만 `apps/shell/public/{models,maps}/` 에 배포되고, **압축 전 원본은 `assets-src/` 에 보관**한다. 압축은 되돌릴 수 없으므로 이 디렉토리를 지우지 않는다.
  - 신규 반입: `public/` 에 놓고 `pnpm optimize:glb <파일>` (지도는 `pnpm optimize:map`). 원본이 `assets-src/` 로 자동 백업된다.
  - **기존 파일 교체는 순서가 반대다.** 스크립트가 백업본을 원본으로 취급하므로 새 버전을 `assets-src/` 에 먼저 넣고 실행한다. `public/` 에 덮어쓰고 실행하면 옛 백업이 새 파일을 되돌린다.
  - Blender export 에 월드 좌표가 베이크돼 오면 `scripts/unbake-goliath-crane.mjs`(골리앗 전용) 또는 `scripts/unbake-root-transform.mjs`(범용)로 원점을 복원한 뒤 압축한다. 그냥 등록하면 존·기즈모가 수 km 어긋난다.
  - 절차 전문은 `assets-src/README.md`, 파이프라인 상세는 `docs/지도-GLB-최적화-파이프라인.md` 와 `docs/GLB-압축-파이프라인-작업보고.md` 에 있다.
- 모델 팔레트 미리보기는 정적 썸네일(`apps/shell/public/previews/{catalogId}.png`)을 먼저 쓰고, 없으면 런타임 offscreen WebGL 렌더로 폴백한다. `sceneModelCatalog` 항목을 추가·교체하거나 미리보기 렌더 룩(`packages/widgets/src/3d/lib/offscreen-preview-renderer.ts`)을 바꾸면 dev 서버의 씬 편집 페이지 모델 탭에서 썸네일 버튼(dev 전용 토글)으로 썸네일을 재생성해 `public/previews/` 를 함께 커밋한다. 썸네일은 투명 배경 PNG 로 테마 중립이어야 한다 — 씬에 배경·바닥판을 굽지 않는다.
- GLB/씬 자산을 추가하면 삼각형 수·텍스처 VRAM·로딩 시간에 미치는 영향을 직접 확인한다. 자동화된 성능 게이트는 **없다** (2026-09-01 에 관련 작업과 계획 문서를 폐기했다).
- **태그 맵핑(`tagMappings[]`)** 은 "서버(PLC) 태그 값 하나 → 트랜스폼 채널 하나" 의 목록이다(모델 인스턴스 필드). 대상은 `{kind:'node', node, channel:position|rotation|scale, axis}`(`node: ''` = 모델 루트) 또는 `{kind:'joint', jointId}`(할당된 리그의 관절) 이고, 태그는 `tagKey` 문자열(`${craneId}:${tagCode}` 공간)로만 참조한다. 적용 공식은 `offset + value × scale` 을 **rest 기준 Δ** 로 더하는 것 — 루트의 rest 는 씬 배치 transform, 내부 노드는 GLTF rest 다. 같은 대상 중복은 sanitize 가 첫 항목만 남기고(first-wins), 리그 관절이 점유한 노드·축은 드라이버가 관절을 우선한다. UI 는 둘 다 amber 로 경고한다(`tag-mapping-editor.ts`).
  - 레거시 `valueMapList`(루트 6칸 절대 대입)·`rigBindings`(관절 바인딩)는 로드 시 `sanitize-tag-mappings.ts` 가 `tagMappings` 로 변환하고 저장본에서 사라진다. 절대 좌표 → Δ 변환은 `offset' = offset − placement[axis]` (테스트가 좌표 동일성을 고정). 두 필드는 타입에 `@deprecated` 입력 전용으로만 남아 있다.
  - 값 흐름: 생산자(가상 태그 러너 / WebSocket 러너 / 리플레이) → `publishTagValue(key, v)` (`tag-value-bus.ts`, 표시용 `tagLiveValues` 캐시) → `useTagBindingSource` 가 건 `createTagBindingSource(resolve)` → `rigValueStore`(smooth) → `useRigDriver`(Canvas 안 `RigDriver`) 가 매 프레임 노드별로 rest 로 되돌린 뒤 채널 Δ 를 누적(`apply-channel.ts`). 바인딩은 모니터링 뷰·에디터 모두 화면이 떠 있는 동안 항상 켜 두고 언마운트 시 값 저장소를 비운다. 에디터 팔레트 "태그" 탭의 재생 토글은 러너 틱만 켜고 끄므로 일시정지하면 노드가 마지막 값에 머물고, 초기값 복귀는 탭의 리셋 버튼이 한다. 기즈모 드래그 중엔 루트 맵핑을 건너뛴다.
  - **가상 태그**(`@crane/domain/virtual-tag`)는 서버 없이 태그 값을 만드는 정의다(`key`·범위·`initial`·`pattern`: manual|triangle|sine|sawtooth|square). 전역 스토어 `useVirtualTagStore` 가 들고 있으며 영속화는 씬과 같은 규칙(`virtual-tag-storage.ts`)이다 — dev 는 `POST /__dev/virtual-tags` 로 배포 파일 `apps/shell/public/simulation/virtual-tags.json` 에 기록(커밋해 클론·배포의 기준값), 운영은 localStorage `crane:virtual-tags` 에 배포 해시 도장(`baseVersion`)과 함께 봉투로 저장하고 새 배포가 나오면 배포본이 이긴다. 편집은 메모리에만 쌓이고 페이지의 저장 버튼(`save()`)이 기록한다(dirty·미저장 이탈 경고는 씬 편집과 같은 훅 재사용). `virtualTagRuntime`(모듈 전역 `setInterval`, Canvas 불필요)이 틱마다 버스로 내보낸다. 모니터링 `mode='simulation'` 이 이 재생을 켠다. 콤보박스 목록은 `useTagCatalog` 하나를 본다 — 실서버가 붙으면 여기에 `getMonitoringTags()` 결과를 `source:'server'` 로 합치고 WebSocket 러너를 켜면 되며, 씬 JSON·맵핑 UI·드라이버는 무변경이다.
- **리깅(관절 연동)** 은 정의(`RigDefinition`: 관절 `hinge|slide` + 구속조건 `linear` = "출력 관절 = 입력 관절 × factor + offset", 디자이너가 주는 공식 형태 그대로. 출력 관절은 driven 이 되어 슬라이더·태그를 받지 않고, 구속조건은 배열 순서대로 계산돼 체인이 된다)가 자산 단위라 씬 상위 `rigs[]` 에 두고, 모델 인스턴스는 `rigId` 만 가진다(관절 ← 태그는 위 `tagMappings` 의 joint 대상). 관절 값은 **항상 rest pose 기준 Δ** 이며 `rest-pose-cache.ts` 가 clone 직후 잡은 GLTF 원본을 기준으로 매 프레임 `q = rest ∘ Δ` 를 다시 만든다 — `rotation.x = θ` 절대 대입은 Blender Empty 의 비항등 rest 를 파괴하므로 금지. 노드 경로는 `mesh-path.ts` 의 `[index]name/...` 형식 그대로다.
  - 값 소스는 `JointValueSource` 하나로 통한다. 에디터 슬라이더는 `manualJointSource`(씬 데이터·히스토리에 남지 않음), 태그는 `createTagBindingSource`(위 값 흐름). 시뮬레이션 재생 중 태그가 꽂힌 관절의 슬라이더는 잠긴다.
  - 리깅 가능한 자산은 피벗에 Empty 노드가 있어야 한다. `LLC_002.glb` 는 참고 프로젝트의 리깅본으로 교체됐고(루트 scale 을 `unbake-root-transform.mjs --fold-scale` 로 자식에 접어 넣어 실제 미터, 배치 scale 1), 나머지 카탈로그 크레인은 단일 메쉬라 관절을 정의할 수 없다. `pnpm optimize:glb` 는 join/prune 을 쓰지 않아 Empty 계층·이름이 보존된다.
  - 리깅 노드에 `meshOverrides` 가 함께 있으면 드라이버가 이긴다(rest = GLTF 원본).
- **모델 안쪽 노드(계층 목록의 자식, 뷰포트 더블클릭 drill-in)는 읽기 전용**이다. 선택하면 그 노드에 맞는 바운딩 박스만 그리고, 인스펙터는 안내 문구만 보이며 기즈모는 붙지 않는다. 노드 선택은 항상 단일 선택(Ctrl 토글 없음). 박스 점은 `packages/domain/src/3d/lib/selection-bounding-box.ts` 가 마운트 대상의 로컬 좌표로 계산하고, 노드 박스는 `createPortal` 로 노드 자식에 마운트해 리그·기즈모 움직임을 씬 그래프 상속으로 따라간다(포털은 `target.uuid` key 로 재마운트해야 한다 — R3F `Portal` 이 컨테이너 교체 시 이전 노드에 붙이는 문제가 있다, 파일 주석 참고). 저장 씬의 `meshOverrides` 는 렌더에만 쓰이고 에디터에서 새로 만들지 않는다.

## docs/ 지도

`docs/` 는 시점별 계획·작업보고 모음이라 현재 상태를 보증하지 않는다. 배경이 필요할 때만 펼친다.

- `3D-단위테스트-도입-계획.md` — 3D 테스트 도입 범위·금지사항 (위 "테스트 현황" 의 출처)
- `3D-뷰어-에디터-개선-백로그.md` — 2026-08-13 전수 감사 결과, 미착수 항목 포함
- `GLB-압축-파이프라인-작업보고.md`, `지도-GLB-최적화-파이프라인.md` — 자산 최적화 파이프라인 상세
- `골리앗-충돌방지-센서연동-계획.md` — 충돌 감지의 시뮬레이션 → 실물 센서 교체 계획
- `전체-코드베이스-개선-목록.md` — 2026-07-07 시점 목록, **미착수**
- `가상태그-시뮬레이션-태그맵핑-작업보고.md` — 2026-09-02 태그 맵핑 통합(`tagMappings`)·가상 태그 시뮬레이션 도입 경위와 남은 일
- `MRO-*`, `hmi-mvp-poc.md` — 기능별 결과 보고서

## Known Caveats

- 문서 간 충돌이 있으면 **실제 코드 → `AGENTS.md` → `README.md`** 순서로 신뢰한다. `README.md` 는 단일 앱 PoC 시절 내용이라 현재 모노레포 구조와 크게 다르다.
- ESLint 는 FSD import 제약 외에 React 19 계열 hook/ref 규칙과 `react-refresh/only-export-components` 를 강하게 검사한다. 단순 동작 수정이어도 render 중 ref 를 읽는 패턴, effect 내부 동기 `setState`, 컴포넌트 파일 내 non-component export 가 lint 실패 원인이 될 수 있다.
- `apps/indoorshop` 의 이식 코드(`src/dashboard/**`, `src/pages/inshop-*/**`)는 `react-hooks` 컴파일러 규칙과 `react-refresh/only-export-components` 가 warn 으로 완화돼 있다. 이식 전부터 있던 패턴이고 대부분 three.js 뷰어의 명령형 코드라 검증 없이 고치면 동작이 바뀐다. 자세한 배경과 종료 조건은 `eslint.config.js` 의 해당 블록 주석에 있다.
- `apps/{crane-hmi,mro2,indoorshop}` 은 루트 `tsconfig.json` 의 project references 에 등록돼 있지 않다. `npx tsc -b` 로는 검사되지 않는다.
- `VITE_*` 환경변수는 Vite 가 빌드 시점에 번들로 인라인한다. 운영 서버에서 `.env` 만 바꿔서는 반영되지 않고 재빌드가 필요하다. 반면 백엔드/LiDAR IP·PORT 는 런타임에 nginx envsubst 로 주입되므로 `.env` 수정만으로 바뀐다 (`Dockerfile`, `docker-compose.yml` 주석 참조).
- 배포는 폐쇄망이다. `docker save` 로 만든 tar 를 운영 서버로 옮겨 `docker load` 하며, 운영 서버에는 인터넷이 없다. 도구·의존성을 추가하는 제안을 할 때 이 제약을 전제한다.
