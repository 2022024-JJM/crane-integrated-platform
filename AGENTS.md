# AGENTS.md

이 문서는 이 저장소에서 작업하는 AI Agent를 위한 운영 가이드다. 설명은 한글 중심으로 작성하되, 실제 코드에 대응하는 기술 용어와 경로명은 그대로 유지한다.

에이전트 규칙의 단일 소스는 이 파일이다. 루트 `CLAUDE.md` 는 `@AGENTS.md` 한 줄짜리 포인터일 뿐이므로, 규칙을 고칠 때는 이 파일만 고친다. 3D 영역의 상세 동작·불변식은 `docs/agents/*.md` 에 있고, 이 파일은 그 문서를 언제 읽어야 하는지만 안내한다.

### 문서 갱신 규칙

코드와 이 문서(또는 `docs/agents/*.md`)가 어긋난 것을 발견하면 작업 중이라도 해당 항목을 갱신한다. 갱신할 때는 다음을 지킨다.

- **덧붙이기가 아니라 현재 상태로 덮어쓰기**다. "그 전엔 …였다", "첫 버전은 …" 같은 경위는 쓰지 않는다. 경위는 커밋 메시지와 `docs/` 작업보고가 맡는다.
- 날짜를 쓰지 않는다. 없어진 UI·경로는 설명을 지운다. 다시 시도하면 안 되는 접근만 이유 한 줄과 함께 "하지 않기로 한 것" 에 남긴다.
- 코드에서 바로 읽히는 값(각도·ms·px·i18n 키·prop 이름)은 쓰지 않는다. 상수명과 파일 위치만 적는다.
- 한 항목이 3줄을 넘으면 `docs/agents/` 의 해당 문서로 옮기고 여기에는 한 줄 요약·진입 파일·문서 링크만 둔다.

## Commands

pnpm workspace + turbo 모노레포다. 패키지 매니저는 `pnpm@10.11.0` 이며 npm 을 쓰지 않는다.

- `pnpm dev` — 전체 dev (실질적으로 `apps/shell`), 또는 `pnpm dev:shell`
- `pnpm build` — turbo build (`apps/shell` 이 유일한 빌드 대상)
- `pnpm lint` — ESLint flat config
- `pnpm typecheck` — TypeScript check
- `pnpm test` — vitest
- `pnpm new-site <slug>` — 새 사이트 plugin scaffold
- `pnpm optimize:glb`, `pnpm optimize:map`, `node scripts/add-model-lod.mjs`, `pnpm perf:scene` — 3D 자산 최적화·진단. 절차는 `docs/agents/assets-glb.md`

### 검증 커맨드의 실제 커버리지 (주의)

turbo task 는 각 workspace 의 `package.json` scripts 에만 물린다. 현재 정의 상태는 다음과 같고, 이 차이를 모르면 "통과했다"를 잘못 보고하게 된다.

| 커맨드 | 실제로 검사되는 범위 |
|---|---|
| `pnpm lint` | `apps/shell` 만 (`eslint .` 를 해당 디렉토리에서 실행) |
| `pnpm typecheck` | `apps/shell/src` 만. 단 shell 이 import 하는 `@crane/*` 소스는 따라 들어가므로 상당 부분이 간접 검사된다. `apps/shell/vite.config.ts` 와 `vite-plugin-asset-hash.ts` 는 `src` 밖이라 빠지므로 고쳤으면 `npx tsc --noEmit ... <파일>` 또는 dev 서버 기동으로 따로 확인한다 |
| `pnpm test` | `apps/{philly-shipyard,mro2,indoorshop}` + `packages/{core,domain,features,widgets}` — 테스트가 존재하는 곳의 전체 목록이다 |
| `npx tsc -b` (루트) | 루트 `tsconfig.json` 의 project references 전체. 단 `apps/{crane-hmi,mro2,indoorshop}` 은 references 에 없어 검사되지 않는다 |

`packages/{core,domain,features,widgets}` 에는 `test` 스크립트가 있지만, `packages/*` 어디에도 `lint`/`typecheck` 스크립트는 없다. 패키지 코드만 고쳤을 때는 `npx tsc -b` 를 함께 돌려 확인한다.

`pnpm lint` 가 `apps/shell` 안에서만 `eslint .` 를 돌리므로, 아래 **FSD Import Rules 의 ESLint 강제는 `packages/*` 와 `apps/{site}` 에서 실제로 실행되지 않는다.** 루트 `eslint.config.js` 에 규칙은 정의돼 있고 파일을 직접 지정하면 적용되지만, `pnpm lint` 경로로는 그 파일들에 도달하지 않는다. 해당 코드를 고쳤다면 루트에서 `npx eslint <고친 경로>` 로 직접 확인한다.

주의: 루트 전수 검사(`npx eslint packages apps`)에는 기존 위반이 100건 넘게 남아 있다. 대부분 react-hooks v7 컴파일러 규칙(`refs`, `set-state-in-effect`)과 `react-refresh/only-export-components` 이며 **FSD import 위반은 0건**이다. "루트 lint 0건"을 완료 기준으로 삼지 말고, 자신이 건드린 파일만 지정해 새로 생긴 위반이 없는지 본다.

### 테스트 현황

vitest 를 사용한다. 테스트 위치는 위 커버리지 표의 `pnpm test` 행이 전부이며, `lib/`·`model/` 의 순수 함수·스토어·훅을 대상으로 한다. 3D 편집(scene-editor)·모니터링(features/3d)·도메인 헬퍼(domain/3d/lib)는 특성화 테스트로 덮여 있다.

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
- `apps/mro2` 에는 아직 나란히 둔 기존 파일이 남아 있다. 규약 이전의 잔재이며, 손대는 김에 `__tests__/` 로 옮긴다.

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
├── runtime/           # app-runtime-effects, register-asset-hash, zone-alarm-bridge
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
- 공통 서브라우트: `3d-monitoring`, `3d-viewer-edit`, `virtual-tags`, `detection-settings`, `crane-status`, `work-history`, `alarm-history`, `3d-replay`. `goliath-work` 는 여기에 `vision`, `cabin-monitoring` 을 더 가진다. `3d-monitoring` 은 **실시간(WebSocket 만)**, `3d-replay` 는 **3D 플레이**(리플레이 | 시뮬레이션 소스 재생 + 실행 리포트, `docs/agents/3d-play.md`) 페이지다.
- `3d-viewer-edit` 는 `@crane/widgets` 의 scene editor 를, `virtual-tags` 는 `@crane/widgets/virtual-tags` 의 가상 태그 관리 페이지를, `detection-settings` 는 `@crane/widgets/detection-settings` 의 감지 설정 페이지를 쓰며 세 화면이 공유한다. 가상 태그 목록과 감지 설정 값은 region 무관 전역이다.
- `BrowserRouter` 의 basename 은 `import.meta.env.BASE_URL` 에서 온다 (sub-path 배포 `/crane_rnd/`).

## FSD Import Rules

다음은 문서 권고가 아니라 `eslint.config.js` 의 `no-restricted-imports` 로 **실제 강제**되는 규칙이다.

- 레이어 경계: `@crane/core`·`@crane/ui` 는 상위 레이어를 import 할 수 없고, `@crane/domain` 은 core/ui 만, `@crane/features` 는 domain/core/ui 까지, `@crane/widgets` 는 features 까지 import 할 수 있다. 어느 패키지도 `apps/*` 를 import 하지 않는다.
- 다만 "패키지 → app" 금지 목록에 실제로 적혀 있는 app 은 `@crane/hanwha-ocean` 과 `@crane/goliath-crane` 둘뿐이다. `@crane/{philly-shipyard,mro2,indoorshop,crane-hmi,shell}` 을 패키지에서 import 하면 **ESLint 는 잡지 못한다.** 규칙 위반인 것은 같으니 손으로 지킨다.
- Public API 강제: `@crane/{domain,features,widgets}/*/{ui,model,lib,config}/*` 형태의 deep import 는 에러다. 슬라이스의 `index.ts` public API 를 통한다.
- 외부에서 소비되는 슬라이스는 `index.ts` 를 제공해야 한다.
- 레이어 규칙을 우회하는 편의성 import 를 만들지 않는다.
- 같은 레이어의 슬라이스는 서로 import 하지 않는다. `features/3d` ↔ `features/alarm` 처럼 연결이 필요하면 상위(페이지 prop 또는 `apps/shell/src/runtime/`)에서 잇는다.

## Public API / Contract

Agent는 다음 계약을 전제로 수정 범위를 판단한다.

- 외부 소비는 각 슬라이스의 `index.ts` public API 를 우선 사용한다.
- 3D domain type/helper 는 `@crane/domain/3d`, 3D feature state/behavior 는 `@crane/features/3d`, 3D editor 는 `@crane/widgets` 에 둔다.
- weather API URL 생성·파싱·표시 변환은 `@crane/domain` 의 weather 슬라이스에, header 조합은 `@crane/features/weather` 에 둔다.
- `@crane/widgets` 의 `layout` 슬라이스가 앱 공통 shell(`AppLayout`, `AppHeader`, `AppSidebar`) 역할을 가진다.

주요 기준 파일 (진입점만 — 동작·불변식은 오른쪽 `docs/agents/` 문서):

| 관심사 | 위치 |
|---|---|
| i18n 초기화 / 지원 언어 | `packages/core/src/config/i18n.ts` (`SUPPORTED_LANGUAGES = ['ko','en','la']`, fallback `ko`) |
| 번역 리소스 | `apps/shell/src/locales/{ko,en,la}/*.json` — namespace 추가 시 `apps/shell/src/i18n-init.ts` 에 함께 등록 |
| 테마 / 사이드바 / 헤더 표시 옵션 | `packages/core/src/lib/{theme,sidebar,header-display-settings}-context.tsx` |
| 네비게이션 구성 | `packages/widgets/src/layout/config/navigation.ts` |
| 공용 3D viewer shell | `packages/ui/src/organisms/three-scene-viewer.tsx` |
| 검색 가능 콤보박스 | `packages/ui/src/molecules/combobox.tsx` (base-ui `Combobox` 래핑, `usePortalContainer` + `z-9999` 규약) |
| 3D 런타임 상태(Zustand) | `packages/features/src/3d/model/` |
| 씬 JSON 스키마 / 방어 | `packages/domain/src/3d/model/types.ts`, `packages/domain/src/3d/lib/sanitize-scene-info.ts` |
| region → scene 파일 매핑 | `packages/domain/src/3d/model/scene-file-map.ts`(단일 소스), `scene-file-registry.ts` — `docs/agents/3d-editor.md` |
| 3D editor session/history/persistence, 스냅·피벗·탑뷰 포즈 | `packages/widgets/src/scene-editor/model/`, `packages/features/src/3d/lib/snap-transform.ts`, `packages/widgets/src/3d/lib/pivot-transform.ts`, `packages/core/src/lib/top-view-pose.ts` — `docs/agents/3d-editor.md` |
| 태그 맵핑 스키마·방어 / 값 버스 / 편집 UI | `packages/domain/src/3d/model/tag-mapping-types.ts`, `packages/features/src/3d/model/tag-value-bus.ts`, `packages/widgets/src/3d/ui/tag-mapping-section.tsx` — `docs/agents/tag-mapping-rig.md` |
| 가상 태그 정의 / 스토어·러너 / 관리 페이지 | `packages/domain/src/virtual-tag/`, `packages/features/src/3d/model/{use-virtual-tag-store,virtual-tag-runner}.ts`, `packages/widgets/src/virtual-tags/` — `docs/agents/tag-mapping-rig.md` |
| 리깅 스키마 / 런타임 / 편집 UI | `packages/domain/src/3d/model/rig-types.ts`, `packages/features/src/3d/model/{rig-value-store,use-rig-driver}.ts`, `packages/widgets/src/3d/ui/rigging-section.tsx` — `docs/agents/tag-mapping-rig.md` |
| 씬 객체 충돌 감지(모델↔모델, 골리앗 LiDAR collision guard 와 별개) | 기하 `packages/domain/src/3d/lib/collision-volumes.ts`, 런타임 `packages/features/src/3d/model/scene-collision-runtime.ts`, 정지·재개 `model/scene-collision-hold.ts`. 설정 UI 는 감지 설정 페이지뿐 — `docs/agents/3d-collision.md` |
| 감지 설정 페이지(메뉴 "설정", 충돌·영역 감지 스위치, localStorage 영속) | `packages/widgets/src/detection-settings/`, `packages/features/src/3d/lib/detection-settings-storage.ts` — 기본값·키는 `docs/agents/3d-collision.md` 가 단일 소스 |
| 모델 영역(zone) 침범 감지 | 스키마 `SavedModelZone`(`types.ts`), 기하 `packages/domain/src/3d/lib/zone-volumes.ts`, 런타임 `packages/features/src/3d/model/scene-zone-runtime.ts`, 스토어 `model/use-scene-zone-store.ts` — `docs/agents/3d-zone.md` |
| 영역 침범 → 로컬 알람 / 영역·운전 상태 저널 / 씬 unit 스케일 | `apps/shell/src/runtime/zone-alarm-bridge.tsx`, `@crane/domain/journal`, `packages/domain/src/3d/model/scene-unit-scale.ts` — `docs/agents/3d-zone.md` |
| 3D 플레이 페이지(리플레이 + 시뮬레이션, 실행 리포트) / 장비 운전 상태 | `packages/features/src/3d/ui/play3d-view.tsx`, `model/play3d-transport.ts`, `lib/play3d-stats.ts`, `lib/model-runtime-status.ts` — `docs/agents/3d-play.md` |
| 프레임 거버너 / shadow map 온디맨드 / 바다 스텐실 / 낮·밤 태양 / 워밍업 큐 | `packages/features/src/3d/ui/scene-frame-governor.tsx`, `ui/scene-render-preset.tsx`(`SceneLighting`), `lib/sky-lighting.ts`, `packages/domain/src/3d/lib/{scene-stencil,bvh-build-queue}.ts` — `docs/agents/rendering-perf.md` |
| GLB 자산 파이프라인(압축·타일·LOD·KTX2·philly 지도 3장·썸네일) | `assets-src/README.md`, `scripts/*.mjs`, `packages/domain/src/3d/lib/ktx2-loader.ts` — `docs/agents/assets-glb.md` |
| 카메라 이동 범위 제한 / 전체화면 / HUD / 미니맵 / 씬 독 / 경보 알림 / 워밍업 표시 | `packages/features/src/3d/ui/{scene-camera-limits,scene-status-hud,scene-minimap,scene-warmup-indicator}.tsx`, `packages/core/src/lib/{use-fullscreen,alert-notifications}.ts`, `packages/ui/src/organisms/scene-dock.tsx` — `docs/agents/monitoring-ui.md` |

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
- **`ui/*.tsx` 안에서 수치 계산을 하지 않는다.** 좌표 변환·프레이밍·판정 로직은 같은 슬라이스의 `lib/` 로 빼서 테스트 가능하게 유지한다(`react-refresh/only-export-components` 규칙과도 맞물린다. 선례 `packages/features/src/3d/lib/scene-shadow.ts`).

### State / Data / i18n

- 전역 설정성 상태는 `@crane/core` 의 context 또는 config 에 둔다.
- feature 전용 런타임 상태는 해당 feature 내부 `model/` 에 둔다.
- mock data 는 각 domain slice 내부 `model/mock-data.ts` 패턴을 따른다.
- 언어 추가/변경 시 `SUPPORTED_LANGUAGES`, `resources`, `ns`, locale fallback 을 `packages/core/src/config/i18n.ts` 와 `apps/shell/src/i18n-init.ts` 에서 함께 맞춘다.

## 3D 작업

3D 코드는 상세 문서를 **먼저 읽고** 건드린다. 아래 트리거에 해당하면 그 문서 하나만 읽으면 된다.

| 건드리는 것 | 먼저 읽을 문서 |
|---|---|
| 충돌 감지·정지/재개(hold)·감지 설정 페이지 | `docs/agents/3d-collision.md` |
| 영역(zone) 침범·영역 알람·저널·unit 스케일 | `docs/agents/3d-zone.md` |
| 3D 플레이 페이지·트랜스포트·실행 리포트·운전 상태 | `docs/agents/3d-play.md` |
| 프레임루프·조명/낮밤·그림자·바다·LOD 런타임·워밍업 큐·성능 | `docs/agents/rendering-perf.md` |
| GLB 반입·압축·타일·LOD·KTX2·지도 배치·썸네일 | `docs/agents/assets-glb.md` |
| 태그 맵핑·가상 태그·시뮬레이션·시나리오·리깅 | `docs/agents/tag-mapping-rig.md` |
| 씬 편집기(저장 미들웨어·카메라·스냅·피벗·선택·씬 파일 매핑) | `docs/agents/3d-editor.md` |
| 모니터링 화면 요소(카메라 제한·전체화면·HUD·미니맵·독·경보 알림) | `docs/agents/monitoring-ui.md` |

### 3D 불변식 체크리스트

상세 문서를 읽지 않았어도 이것은 지킨다. 각 항목의 근거와 배선 목록은 괄호의 문서에 있다.

- 모델·노드를 새 경로로 움직이면 `invalidateShadows()` 를 부른다. shadow map 은 온디맨드라 빼먹으면 그림자가 안전망 주기까지 동결된다 (rendering-perf).
- 씬을 매 프레임 바꾸는 새 경로는 `SceneFrameGovernor` 소스 목록에 넣거나 스스로 `invalidate()`/`requestSceneFrame()` 한다. 캔버스가 전부 `frameloop='demand'` 다 (rendering-perf).
- `SceneLighting` 에는 `regionId` 를 반드시 넘긴다. 조명·하늘 밝기 기준값은 `lib/sky-lighting.ts` 상수만 고치고 다른 곳에서 같은 값을 세팅하지 않는다 (rendering-perf).
- 새 GLTF 로드 경로는 `extendGltfLoaderWithKtx2` 를 걸고, 불투명 머티리얼이면 `markSceneOpaqueStencil` 을 켠다. 바다 위에 보여야 하는 불투명 오버레이는 `renderOrder ≥ 0.5` (assets-glb, rendering-perf).
- 실루엣 테두리(`ObjectSilhouetteOutline`)를 쓰는 캔버스는 `SCENE_GL_OPTIONS.stencil: true` 가 필요하다 (3d-collision).
- Canvas 안 마운트 순서는 계약이다: `RigDriver` → 충돌 검출기 → `SceneCollisionHighlight` → 영역 검출기 → `SceneZoneRings`, `SceneSurfaceCamera` 바로 다음 `SceneCameraLimits`. 같은 priority 의 useFrame 은 마운트 순으로 돈다 (3d-collision, 3d-zone, monitoring-ui).
- 카메라 `up` 은 항상 +Y, 탑뷰는 `ensureTopViewTilt` 의 미세 tilt 로 만든다 (3d-editor).
- 기즈모 스냅은 `lib/snap-transform.ts` 순수 함수로 저장값 기준으로 한다. three `TransformControls` 의 `*Snap` 은 쓰지 않는다 (3d-editor).
- 씬 스키마 필드를 추가하면 `sanitize-*` 와 `scene-snapshot.ts` 의 동등 비교(`isZoneListEqual` 류)를 함께 고친다. 빠지면 편집이 동등 단락에 먹혀 저장되지 않는다 (3d-editor, 3d-zone).
- region → 씬 파일 표는 `scene-file-map.ts` 하나다. 미등록 region 은 `null` 이며 기본 파일로 fallback 하지 않는다 (3d-editor).
- 새 dev 저장 미들웨어는 `vite-plugin-asset-hash.ts` 의 `DEV_WRITTEN_DIRS` 에 추가한다. `server.watch.ignored` 로 막지 않는다 (3d-editor).
- 관절·태그 값은 항상 rest 기준 Δ 다. `rotation.x = θ` 절대 대입은 금지 (tag-mapping-rig).
- 새 태그 값 생산자는 `publishTagValue` 로만 내보낸다. 버스가 단일 진입점이다 (tag-mapping-rig).
- 값 생산자 정지·재개는 `scene-collision-hold.ts` 한 곳(`holdRunners`/`releaseRunners`/`subscribeRunnerResume`)을 거친다. 실시간 러너는 어떤 감지에서도 자동 정지하지 않는다 (3d-collision).
- 저널·로컬 알람·경보 소리는 실시간 화면의 사건만 받는다(`isRealtimeSceneActive`). 3D 플레이·에디터·미리보기 사건은 어디에도 가지 않는다 (3d-zone).
- GLB 교체는 `assets-src/` 에 새 버전을 먼저 넣고 스크립트를 돌린다. `philly-terrain.glb` 에 `pnpm optimize:map` 을 재실행하지 않는다 (assets-glb).
- GLB·씬 자산을 추가하면 삼각형 수·텍스처 VRAM·로딩 시간 영향을 `pnpm perf:scene` 등으로 직접 확인한다. 자동 성능 게이트는 없다 (assets-glb).

### 다시 시도하지 않는 것

시도했다 되돌린 접근이다. 이유는 한 줄만, 상세는 각 문서의 "하지 않기로 한 것".

- reverse-Z 깊이 — three 의 `reverseDepthBuffer` 는 WebGPU 전용이고 기본 프레임버퍼에선 정밀도 이득이 없다.
- DPR 상한 1.25 — 1.5 를 유지한다(`SCENE_DEFAULT_DPR` 와 `three-scene-viewer.tsx` 기본값을 함께 바꾼다).
- 미등록 region 의 기본 씬 파일 fallback — 남의 씬을 덮어쓴 사고의 원인.
- three `TransformControls` 의 `translationSnap` 류 — local 격자가 객체 회전 프레임에 놓여 저장값이 격자를 벗어난다.
- 탑뷰용 `camera.up` 변경 — OrbitControls 극점이 틀어지고 `{position, target}` 포즈가 up 을 복원할 수 없다.
- 다중 선택용 임시 Group 재부모화·프록시 객체 — `ModelMesh` 가 래퍼 group 을 걷어낸 구조(리그 rest·선택 박스 포털)와 충돌한다.
- 그림자 무효화의 벽시계 스로틀 — 배속 재생에서 자기 그림자가 명멸한다. 상한은 거버너 fps 가 정한다.
- `compileAsync` 셰이더 프리워밍 — 캔버스 언마운트 중 three 내부가 던진다. 동기 `compile` 을 쓴다.

## docs/ 지도

- `docs/agents/*.md` — 3D 영역별 **현재 상태** 문서(진입점·동작·불변식·하지 않기로 한 것). 이 파일과 같은 갱신 규칙을 따르며, 신뢰 순서는 코드 → `AGENTS.md` → `docs/agents/` 다.
- 그 외 `docs/*.md` 는 시점별 계획·작업보고 모음이라 현재 상태를 보증하지 않는다. 배경이 필요할 때만 펼친다.
  - `3D-단위테스트-도입-계획.md` — 3D 테스트 도입 범위·금지사항 (위 "테스트 현황" 의 출처)
  - `3D-뷰어-에디터-개선-백로그.md` — 2026-08-13 전수 감사 결과, 미착수 항목 포함
  - `GLB-압축-파이프라인-작업보고.md`, `지도-GLB-최적화-파이프라인.md` — 자산 최적화 파이프라인 상세
  - `골리앗-충돌방지-센서연동-계획.md` — 충돌 감지의 시뮬레이션 → 실물 센서 교체 계획
  - `전체-코드베이스-개선-목록.md` — 2026-07-07 시점 목록, **미착수**
  - `가상태그-시뮬레이션-태그맵핑-작업보고.md` — 2026-09-02 태그 맵핑 통합(`tagMappings`)·가상 태그 시뮬레이션 도입 경위와 남은 일
  - `MRO-*`, `hmi-mvp-poc.md` — 기능별 결과 보고서

## Known Caveats

- 문서 간 충돌이 있으면 **실제 코드 → `AGENTS.md` → `docs/agents/` → `README.md`** 순서로 신뢰한다. `README.md` 는 단일 앱 PoC 시절 내용이라 현재 모노레포 구조와 크게 다르다.
- ESLint 는 FSD import 제약 외에 React 19 계열 hook/ref 규칙과 `react-refresh/only-export-components` 를 강하게 검사한다. 단순 동작 수정이어도 render 중 ref 를 읽는 패턴, effect 내부 동기 `setState`, 컴포넌트 파일 내 non-component export 가 lint 실패 원인이 될 수 있다.
- `apps/indoorshop` 의 이식 코드(`src/dashboard/**`, `src/pages/inshop-*/**`)는 `react-hooks` 컴파일러 규칙과 `react-refresh/only-export-components` 가 warn 으로 완화돼 있다. 이식 전부터 있던 패턴이고 대부분 three.js 뷰어의 명령형 코드라 검증 없이 고치면 동작이 바뀐다. 자세한 배경과 종료 조건은 `eslint.config.js` 의 해당 블록 주석에 있다.
- `VITE_*` 환경변수는 Vite 가 빌드 시점에 번들로 인라인한다. 운영 서버에서 `.env` 만 바꿔서는 반영되지 않고 재빌드가 필요하다. 반면 백엔드/LiDAR IP·PORT 는 런타임에 nginx envsubst 로 주입되므로 `.env` 수정만으로 바뀐다 (`Dockerfile`, `docker-compose.yml` 주석 참조).
- 배포는 폐쇄망이다. `docker save` 로 만든 tar 를 운영 서버로 옮겨 `docker load` 하며, 운영 서버에는 인터넷이 없다. 도구·의존성을 추가하는 제안을 할 때 이 제약을 전제한다.
