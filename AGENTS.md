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
- `pnpm perf:scene [씬.json] [--json]` — 씬별 GLB 드로우콜·삼각형·텍스처 VRAM 진단 리포트 (항상 exit 0 — 게이트 아님, 경고와 join 후보만 표기. 모델 추가·교체 후 한 번 돌려 본다)

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
| 씬 객체 충돌 감지(시뮬레이션·실시간 모니터링과 에디터, 모델↔모델 관통 감지. 골리앗 LiDAR 근접 존인 collision guard 와는 별개) | 기하 `packages/domain/src/3d/lib/collision-volumes.ts`(AABB→OBB→three-mesh-bvh 삼각형, BVH 는 여기서만 접근·빌드 안 함), 런타임 `packages/features/src/3d/model/scene-collision-runtime.ts`(React 밖 싱글턴, 메쉬 matrixWorld 변화 기반 dirty 쌍만 검사, 기준선·억제·시간 예산. hit 을 돌려줄 뿐 스스로 멈추지 않는다), 스토어 `model/use-scene-collision-store.ts`(세션 전용 전역: on/off·충돌 시 정지 여부 — 둘 다 기본 ON(2026-09-08, 새로고침 시 다시 ON)·기록 최대 10개·활성 기록. 기록 클릭 = `rigValueStore.restore(스냅샷)` + 러너 정지, ▶ 재생이 `resume` 으로 재무장), 훅 `model/use-scene-collision-detector.ts`(**`RigDriver` 바로 다음에 마운트** — 같은 priority useFrame 은 마운트 순. **감지는 `runner` 가 재생 중(+기즈모 드래그 아님)일 때만 돈다**(2026-09-08, `scene-collision-hold.ts` 의 `isRunnerRunning` — 시뮬레이션은 가상 태그 `isRunning`, 실시간은 진입~이탈 내내 재생이라 `held` 여도 스캔). 스캔 재개 전이·기록 복원(`selectRecord`)은 `rebaseline()`, 새 모델 항목(첫 마운트·리마운트·참조 교체)은 런타임 tick 이 스스로 기준선으로 되돌리고, 기준선은 큐가 빈 뒤에도 `BASELINE_SETTLE_MS`(1s) 안정화 창이 지나야 scanning 이 된다 — 정지 중 기즈모·인스펙터·슬라이더로 만든 겹침, 드래그로 놓은 겹침, 로딩 배치, 재생 시작 스무딩은 보고 대신 억제되고 시뮬레이션이 떼었다 다시 붙여야 보고된다. 창 안에서 시뮬레이션이 만든 겹침도 분리 전까지 보고되지 않으며, 재생 중 편집(opacity 만 바꿔도 참조 교체)마다 1초 blind 가 생기는 것은 허용된 부작용이다. 어느 모드든 그 쌍만 억제한 채 감시 계속 — 정지 모드는 러너 pause+freeze+pin(스캔도 멈춤), 무정지는 3초 박스. 억제 해제는 모델 AABB 가 아니라 **메쉬 단위**(AABB+margin → OBB → 삼각형 최단 거리 `meshesWithinDistance`)라, 단일 메쉬 크레인처럼 OBB 가 늘 겹치는 모델도 삼각형이 0.05 unit 이상 떨어지면 재보고된다), 편집 UI 는 `packages/features/src/3d/ui/scene-collision-panel.tsx`(감지 on/off·충돌 시 정지·기록 10개·초기화) 하나를 에디터 팔레트 "충돌" 탭과 모니터링 독 `AlertTriangle` 팝업 `ui/scene-collision-menu.tsx`(감지 켜짐 amber·정지 중 red)이 공유한다(충돌 시 캔버스 위 오버레이 패널은 2026-09-07 에 제거. 화면 수준 경보는 `ui/scene-collision-alert-overlay.tsx` — 가장자리 inset box-shadow 비네트 + 상단 배너, 아이콘·독 버튼은 깜빡이지 않고 실시간 정지도 제목은 "충돌 감지". 배너의 재개 버튼 "이어서 재생"은 두 모드 모두 가상 태그 러너 재생(독 ▶ 와 동일, 2026-09-08 — 실시간 페이지에서도 값은 독 ▶ 가 켠 시뮬레이션이 만들어, 보류만 풀던 옛 "최신 값 복귀"는 아무것도 움직이지 않았다) — 와 씬 안 충돌 장비 일체형 빨간 실루엣 테두리(`@crane/domain/3d` 의 `ObjectSilhouetteOutline` — 스텐실 마스크 + 인플레이션 헐 `lib/silhouette-outline.ts`, `SCENE_GL_OPTIONS.stencil: true` 필요. 에디터의 선택 표시도 같은 컴포넌트를 노랑으로 쓴다 — 모델 전체와 안쪽 노드(계층 목록·drill-in) 모두: `GltfModel` 의 `selectionStyle='outline'`, 스텐실 없는 캔버스에선 기본 'box' 유지. 에디터의 **지도**는 'box' — 수 km 지형을 실루엣으로 두르면 화면 가장자리 전체가 테두리가 되고 헐이 지형 메시를 매 프레임 두 번 더 그린다)·경고 표지 `scene-collision-highlight.tsx`). 모니터링은 시뮬레이션·실시간 모드에서 켜지고 리플레이는 제외. 값 생산자 정지는 `model/scene-collision-hold.ts` 한 곳 — 가상 태그는 pause, 실시간(WebSocket)은 `useRealtimeStore.hold()` 로 **화면 반영만 보류**(러너가 수신 값을 drain 만 하고 버림, 장비는 계속 움직임)하며 pinned 을 떠나는 모든 스토어 경로(resume·clearActive·clearHistory·clear·setEnabled(false))가 release 한다. 패널은 `runner='realtime'` 이면 실시간 문구를 보이고, 정지 해제는 고정된 기록 행 재클릭(`selectRecord` → `resume`)이다(독 ▶ 도 풀지만 실시간에선 가상 태그 러너를 켜는 부작용이 있어 안내하지 않는다). 상수 `lib/scene-collision-pairs.ts` |
| 카메라 이동 범위 제한(모니터링·리플레이·에디터 공용) | 적용 `packages/features/src/3d/ui/scene-camera-limits.tsx`(`SceneCameraLimits`, `SceneSurfaceCamera` **바로 다음 형제**에 마운트 — 같은 priority useFrame 은 마운트 순), 수식 `lib/camera-limits.ts`(테스트 대상). 바닥은 **카메라 아래 지도 표면**(씬의 모든 지도에 `raycastMapSurfaceY`, 카메라 XZ 가 0.5m 움직일 때만 재측정, 히트 없으면 `SEA_LEVEL_Y`) + 5m 로 EXR 유무 무관(옛 `CameraAboveSea` 흡수) — 회전은 `maxPolarAngle` 을 매 프레임 갱신(바닥 기준 동적 상한과 고정 75° 중 작은 쪽)해 막는다. 이동 범위는 **타깃이 아니라 카메라 XZ** 를 기준 지도들의 월드 AABB 합집합 안으로 제한 — 기준 지도는 지도 인스펙터 **카메라 탭**의 "카메라 영역 제한" 체크(`SavedMapInfo.cameraBounds`, 옵트인·true 만 저장)가 켜진 것들이고 하나도 없으면 씬의 모든 지도(`resolveCameraBoundsMaps`/`unionObjectBounds`/`collectCameraBoundsBox`, `packages/domain/src/3d/lib/camera-bounds-maps.ts`). 팔레트로 ground 지도를 추가하면 `addSceneMap` 이 체크된 채 넣고, `resolveGroundMaps` 는 드롭 raycast 바닥면에만 남는다. 뷰어·리플레이 `getTopViewBounds` 와 에디터 `topView` 도 같은 합집합을 본다(표면 피벗이 타깃을 지도 밖 지형·바다에 놓으므로 타깃 기준이면 드래그마다 튄다. 여유·여백 비율은 두지 않는다 — 지도가 작업 구역보다 훨씬 넓은 philly 조선소에서 바깥 여유는 무의미하고 안쪽 여백은 가장자리 모델을 잘라냈다). 위반 처리는 되밀기가 아니라 **그 프레임의 평행이동 취소**(카메라·타깃 델타가 같으면 팬·dolly → update 직전 자세로 복원, 경계에서 그냥 멈춤)이고, 그래도 밖이면(회전·프레임 밖 명령·로드 직후) 경계로 투영한다. `controls.maxDistance` 는 그 합집합의 탑뷰 fit 거리 × 1.0(탑뷰가 곧 가장 먼 시점, 상한 `CAMERA_MAX_DISTANCE` 30000 — 2026-09-09 에 3000 에서 올림, 지도 없으면 30000)로 여기서 정하고 휠 dolly 상한·표면 피벗 거리 cap(`placePivot`, 밖 지형을 볼 때 반경 clamp 로 튀는 것 방지)·뷰어와 에디터의 탑뷰 상한(반높이 차감)이 같은 값을 읽는다. 제한 뒤 `controls.update()` 금지(damping 이중 적용), `change` 이벤트만 발행해 에디터 카메라 상태가 따라온다. `minPolarAngle` 은 0(정수직 탑뷰 허용). 2026-09-09 도입 |
| 낮/밤·태양 위치(현장 시각 연동, 2026-09-11 도입) | 씬 설정 `lighting.sunMode: 'solar'`(기본 `manual` = 기존 수동 방위·고도 패드, 필드 생략. 'solar' 만 저장, 수동 각도는 보존돼 되돌리면 복원. sanitize·에디터 dirty·`setLighting` 모두 같은 규칙). 현장 위치·시간대 표 `packages/domain/src/3d/model/scene-site-geo.ts`(region → 위경도·IANA tz. 씬 파일이 등록된 region 은 전부 있어야 한다 — 테스트가 강제. 미등록 region 은 solar 설정이어도 런타임이 manual 로 폴백하고 에디터 토글이 비활성). 천문 `packages/domain/src/3d/lib/solar-position.ts`(태양·달 방위/고도·달 위상·일출/일몰, Meeus 축약식, 의존성 0), 시간대 변환 `packages/core/src/lib/time-zone.ts`(Intl 기반, 라이브러리 없음 — 폐쇄망), 조명 곡선 `packages/features/src/3d/lib/sky-lighting.ts`(고도 → 방향광 세기·색, 환경광, 하늘 배율. 낮 기준값 `SCENE_LIGHTING_BASE` 가 `SCENE_LIGHTING` 의 단일 소스, 환경맵 `SCENE_ENVIRONMENT_INTENSITY` 도 여기. **밤은 야간 작업등이 밝힌다** — 해가 지면(`YARD_LIGHT_FADE` 5°→−5°) 따뜻한 백색 투광등이 고정 마스트 방향(`YARD_LIGHT_AZIMUTH/ELEVATION` 210°/62°)에서 낮 태양의 60% 세기로 켜지고 환경광도 난색 0.85 로 오른다. 반대편(`FILL_LIGHT_*` 20°/50°)에 그림자 없는 보조 투광등(주 작업등의 50%)과 위 남색·아래 난색의 반구광(0.55)이 더해져 그림자 면이 새까맣지 않다. 하늘(EXR)은 0.12 로 어두워지고 그 위에 남색 틴트 돔(`NIGHT_SKY_TINT_*`, 카메라 추종 BackSide 구, EXR 있을 때만)이 덮여 "구름 낀 밤하늘 아래 조명 켜진 야드" 로 읽힌다. 밤 전용 요소는 낮에 전부 0 이라 한낮 화면은 수동 모드와 같다. 달빛만 두었던 첫 버전은 관제용으로 너무 어두웠다(2026-09-11). 방향광은 하나뿐이라 박명엔 태양·작업등 세기의 합을 세기로, 비율(`keyYardBlend`)로 방향·색을 섞어 그림자가 수십 분에 걸쳐 마스트 방향으로 돈다. 작업등은 `useSceneClockStore.yardLights`(세션, 기본 ON, 팝업 스위치)로 끌 수 있고 끄면 달·별빛 수준의 푸른 바닥값 `NIGHT_*_DARK`. 달은 표식·위상 표시용), 합성 `lib/solar-lighting.ts`(시각+위치(+옵션) → 스냅샷. 방향광 고도 하한 `KEY_LIGHT_ELEVATION_MIN` 10°, 방향은 0.05° 격자 양자화 — 정지 화면에서 shadow map 이 매 프레임 다시 그려지지 않는 근거). 적용은 `ui/scene-render-preset.tsx` 의 `SceneLighting` (`regionId`·`timeSource` prop — 세 캔버스가 넘긴다. useFrame 에서 초 단위로 재계산해 방향광·환경광·`scene.backgroundIntensity`·`environmentIntensity` 를 직접 쓰고, 바다 평면은 `backgroundIntensity` 를 `uEnvIntensity` 로 미러링해 수평선 이음새 없음. 하늘의 태양 글로우·달 표식은 카메라 추종 스프라이트로 EXR 배경이 있을 때만. 모드를 떠나면 `resetToManualLook`). 시각 출처: 씬 시계 `model/use-scene-clock-store.ts`(세션 전역 live/manual — 에디터·모니터링 공유, 저장 안 됨) 또는 리플레이 프레임 타임스탬프(`model/scene-time-source.ts` + `@crane/domain/monitoring` 의 `parseReplayTimestamp` — `Z` 없는 값은 현장 벽시계로 해석). UI 는 `ui/scene-clock-panel.tsx`(위상·현장 시각·태양/달 위치·일출/일몰, 실시간/시각 지정 토글, 날짜·시각 슬라이더·프리셋) 하나를 모니터링 독 팝업 `ui/scene-clock-menu.tsx`(아이콘이 위상을 따라 해·일출·일몰·달, 시각 고정 중엔 하늘색)와 에디터 배경 탭(`palette-environment-section.tsx`, 방식 토글 수동/현장 시각 연동)이 공유하고, UI 상태는 `model/use-scene-sun-state.ts`(live 는 20초마다 갱신 — 렌더 중 `Date.now()` 금지라 스토어 `liveNowMs` 캐시). 배포 씬은 실외 4개(dock-1·dock-2·goliath·philly-dock-2)가 `sunMode: 'solar'` + `shadows: true`, 실내 dock-in 은 수동 유지 |
| 모니터링 씬 독(dock: hover 펼침·고정 우측 레일) | 껍데기 `packages/ui/src/organisms/scene-dock.tsx`(`SceneDockRail`, 완전 제어형, 도킹 프레임은 `three-scene-viewer.tsx` 의 `toolbarPlacement="dock"`), 상태·영속화 `packages/features/src/3d/model/use-scene-dock.ts` + `lib/{dock-hover-state,dock-storage}.ts`(순수 리듀서·pin 영속화, 테스트 대상). 조립은 `Monitoring3dView` 의 `toolbarLayout="dock"`. 하단 독 패널(크레인 실시간 상태 테이블)은 2026-09-03 에 제거됐다 |
| 씬 로딩 뒤 후처리(워밍업) 상태 표시 | 전역 워밍업 큐 `packages/domain/src/3d/lib/bvh-build-queue.ts`(`ModelMesh` 가 넣고 프레임급 간격의 고정 예산(8ms) 슬라이스로 처리, 작업 종류 `bvh`(클릭 raycast BVH) → `outline`(실루엣 테두리용 스무딩 노멀 사본, `enqueue` 옵션 `outline: true` 인 메시만 — `GltfModel`/`ModelMesh` 의 `prepareOutline`, 에디터·모니터링의 **모델**만 켜고 지도는 제외. 2026-09-08 추가 — 첫 선택·첫 충돌에서 사본 생성(골리앗+LLC 약 180ms)이 프레임을 세웠다) 순, 각 종류 안에서 삼각형 수 오름차순이라 큰 지형이 마지막, `(지오메트리, 종류)` 참조 카운트라 `cancel` 은 `enqueue` 와 같은 옵션으로, 테스트 대상. 인스턴스별 유휴 콜백 체인은 2026-09-08 에 이 큐로 통합 — 유휴 시간에만 맡기면 로딩 직후엔 콜백이 타임아웃으로만 돌아 지오메트리 90개 씬이 수십 초 걸렸다), 셰이더 프리워밍 `packages/domain/src/3d/ui/silhouette-outline-warmup.tsx`(Canvas 안, 헐·마스크 프로그램을 `compileAsync` 로 미리 컴파일하고 헐 머티리얼을 캔버스 수명 동안 들고 있는다 — three 는 같은 셰이더의 마지막 머티리얼이 dispose 되면 프로그램을 지워, 이게 없으면 재선택마다 재컴파일된다. `SceneCollisionHighlight` 옆에 마운트), 단계 선택 `packages/features/src/3d/lib/scene-warmup-step.ts`(bvh 잔여 → outline 잔여 → 충돌 런타임 `baseline`(스토어 `baselinePending`, 검사기가 phase 변화 시에만 갱신하며 **스캔 중일 때만** true — 러너 정지·드래그 중엔 내린다. 재생 시작·드래그 종료·편집 뒤 안정화 창 동안 잠깐 보인다) → drei `useProgress` 활성 순, 타이머 추측 없음), 훅 `model/use-scene-warmup-step.ts`, 표시 `ui/scene-warmup-indicator.tsx`(스피너+문구 한 줄, 비차단, `common:viewer3d.warmup.*`). 모니터링·리플레이는 overlay 슬롯의 좌측 상단 열(포커스 복귀 버튼과 세로 스택), 편집은 캔버스 컨테이너 좌측 상단에 둔다. 초기 로딩 오버레이(`scene-loading-overlay.tsx`)는 그대로이며 이 표시는 오버레이가 걷힌 뒤 이어진다 |

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
- **조명·하늘 밝기를 새 경로로 바꾸는 코드는 solar 모드(낮/밤)와 겹친다.** `SceneLighting` 이 solar 모드에서 방향광 세기·색, 환경광, `scene.backgroundIntensity`·`environmentIntensity` 를 매 프레임 덮어쓰므로, 같은 값을 다른 곳에서 세팅하면 프레임마다 서로 되돌린다. 기준값은 `lib/sky-lighting.ts` 상수를 고치고, 환경맵 세기는 `SCENE_ENVIRONMENT_INTENSITY` 하나를 쓴다. 새 캔버스에 `SceneLighting` 을 놓을 때 `regionId` 를 빼면 solar 씬이 수동 태양으로 조용히 떨어진다.
- **shadow map 은 온디맨드로만 다시 그려진다** (2026-09-09). `SceneLighting` 이 `gl.shadowMap.autoUpdate=false` 로 끄고, 캐스터를 움직이는 코드가 `@crane/domain/3d` 의 `invalidateShadows()` 를 불러야 그 프레임의 shadow pass 가 돈다. 기존 경로는 전부 배선돼 있다 — rigValueStore(set/reset/step 누적 드리프트 판정), useActiveTransformStore(기즈모), ModelMesh(배치 props·meshOverrides·마운트), 리그 드라이버 인스턴스 해체/재생성(관절·맵핑 정의 편집 시 rest 점프), SceneLighting 자신(frustum·태양각) + 4초 주기 안전망. **모델·노드를 새 경로로 움직이는 코드를 추가하면 invalidateShadows() 를 함께 불러야 한다** — 빼먹으면 그림자가 최대 4초 동결된다(안전망이 상한). 컨텍스트 지형(kind 'context')은 cast/receiveShadow 모두 꺼져 있다 — 178만 삼각형이 매 shadow pass 에 들어가던 것을 뺀 것(모니터링·에디터 동일 규칙).
- **`ui/*.tsx` 안에서 수치 계산을 하지 않는다.** 좌표 변환·프레이밍·판정 로직은 같은 슬라이스의 `lib/` 로 빼서 테스트 가능하게 유지한다. `packages/features/src/3d/lib/scene-shadow.ts` 가 이 원칙의 선례이고, 그 파일 주석이 이유(react-refresh 규칙)까지 설명한다.
- **기즈모 스냅은 three `TransformControls` 의 `translationSnap`/`rotationSnap`/`scaleSnap` 에 맡기지 않는다.** local 공간에서는 격자가 객체의 회전 프레임에 놓여 yaw 로 돌아간 모델의 X·Z 저장값이 격자를 벗어나고, world 회전은 델타 기준이라 시작 소수점이 남는다. 스냅은 `packages/features/src/3d/lib/snap-transform.ts` 의 순수 함수가 **저장값(부모 프레임 위치 m · 오일러 도 · 배율)** 기준으로 하며, 기즈모 경로(`use-scene-transform.ts` liveSync — 드래그 시작 대비 변한 축만)와 인스펙터 스테퍼(`InputNumber` 의 `stepValue` 에 `stepOnGrid` 주입)가 같은 함수를 쓴다. 직접 타이핑한 값은 스냅하지 않는다.
- **다중 선택 변형 피벗**은 `useSceneEditorViewStore.transformPivot`(세션 전용, 기본 `individual` = 각자 제자리 회전·크기, `primary` = 프라이머리(마지막 Ctrl 클릭) 배치 위치를 피벗으로 강체 변형)이다. 툴바 UI 는 `packages/features/src/3d/ui/scene-transform-pivot-menu.tsx`(`SceneTransformPivotMenu`, "피벗" 팝업 하나에 좌표축 로컬/월드 행과 원점 개별/마지막 선택 행. 크기 모드에서도 좌표축을 잠그지 않는다 — three 가 scale 에서 local 로 동작할 뿐이고 선택값은 다음 모드에 이어진다). 기즈모는 어느 쪽이든 프라이머리에 붙고, `primary` 는 `use-scene-transform.ts` 의 liveSync 가 세컨더리 위치를 `lib/pivot-transform.ts`(`orbitAroundPivot`·`scaleAboutPivot`, 테스트 대상)로 궤도 이동시킨 뒤 **배치 프레임**으로 써넣으며(`readRootPlacement`→`writeRootPlacement`, 루트 태그 Δ 흡수 방지) 세컨더리를 개별 스냅하지 않는다(프라이머리가 먼저 스냅돼 델타가 격자 기준, 각자 스냅하면 강체성이 깨짐). 커밋은 회전·크기와 함께 `position` 을 담는다. 임시 Group 재부모화·프록시 객체는 쓰지 않는다 — `ModelMesh` 가 래퍼 group 을 의도적으로 걷어낸 구조라(리그 rest·선택 박스 포털이 씬 그래프 상속에 기댐) 재부모화가 그것과 충돌한다.
- 루트 태그 맵핑이 있는 모델은 기즈모 드래그가 끝나는 프레임에 `use-rig-driver.ts` 가 루트 rest 를 **현재 자세**로 다시 잡는다(handoff, `reanchorRootIfMoved`). 커밋된 새 배치값은 React 렌더 + passive effect 를 거쳐야 드라이버에 도착하므로, 그 전 프레임에 옛 rest 로 되돌리면 모델이 이전 위치로 한 번 튄다. 드라이버가 마지막으로 적용한 자세 그대로인 루트(기즈모가 안 건드린 것)는 rest 를 유지한다. 기즈모가 잡는 자세는 rest+Δ 이므로 handoff 와 커밋(`use-scene-transform.ts`)·스냅은 드라이버가 readout 에 남긴 `rootDeltas`(루트에 마지막으로 적용한 Δ, 드래그 중엔 드래그 직전 값)를 벗겨 배치값을 얻는다(`lib/strip-channel-delta.ts`, `model/root-placement.ts`). 그대로 저장하면 Δ 가 한 번 더 더해져 모델이 Δ 만큼 더 가서 멈춘다(2026-09-07 수정).
- region → 씬 파일 매핑의 단일 소스는 `packages/domain/src/3d/model/scene-file-map.ts` 다. 브라우저 런타임(`scene-file-registry.ts`)과 Node 컨텍스트인 `apps/shell/vite.config.ts` 의 저장 미들웨어가 **같은 표를 읽어야** 한다. 표를 복제하거나 미등록 region 을 기본 파일로 fallback 시키지 않는다 — 그 fallback 이 남의 씬을 덮어쓴 사고의 원인이었고, 지금은 양쪽 모두 `null` 을 반환한다. 파일 자체 주석에 경위가 있다.
- GLB 자산은 압축본만 `apps/shell/public/{models,maps}/` 에 배포되고, **압축 전 원본은 `assets-src/` 에 보관**한다. 압축은 되돌릴 수 없으므로 이 디렉토리를 지우지 않는다.
  - 예외: `assets-src/maps/philly-terrain.glb`(175MB) 는 GitHub 100MB 한도 때문에 **커밋하지 않는다**(`.gitignore`). 원본은 컨플루언스에서 별도 관리하며, 재압축·롤백은 거기서 받아 `assets-src/maps/` 에 놓고 돌린다. 경위·반입 명령은 `assets-src/README.md`.
  - **배포된 philly-terrain 은 8×8 공간 타일 + LOD 체인 구조다** (2026-09-09, `node scripts/tile-terrain-glb.mjs --lod` 산출물 — 2026-09-11 3차 전달본 기준 64타일 × LOD0~3(오차 0/2/4/8m) 형제 노드, extras `{tile,lod,lodError}`. 무텍스처 머티리얼 27개는 COLOR_0 unorm16 정점색으로 1개 병합하고 텍스처 머티리얼 overlay·Vegetation Area 는 유지(타일당 최대 3 프리미티브), LOD0 은 삼각형·bbox 완전 보존, LOD1~3 은 정점 accessor 를 LOD0 과 공유하고 인덱스만 별도). 단일 노드 시절엔 frustum 컬링이 전무해 어느 방위든 씬 251만 tris 전량 렌더였고, 타일+LOD 후 83만~157만(2차 전달본 45타일 시절 실측, worst 다운타운 정면 −38%)이다. 런타임 전환은 `@crane/features/3d` 의 `SceneTerrainLod`(스크린 오차 1 device px 미만 레벨 선택, 수식은 `lib/terrain-lod.ts`) — 세 캔버스에 마운트돼 있고, LOD>0 노드는 clone 시점에 숨김+raycast 제외된다(model-mesh.tsx — **최상위 캐리어만** 끈다. GLTFLoader 가 extras 를 다중 프리미티브의 자식 Mesh 에도 복제하므로 자식까지 끄면 그룹을 켜도 타일이 사라진다, 실측 결함). raycast·BVH 는 항상 LOD0 담당이라 표면 높이·드롭·클릭은 LOD 상태와 무관하다. **이 파일에 `pnpm optimize:map` 재실행 금지** — 데시메이션·정리 스테이지가 타일·LOD·정점색을 훼손한다. 재반입 순서: 컨플루언스 원본 → `optimize:map philly-terrain.glb`(파일명 필수 — 인자 없이 돌리면 모든 지도가 대상) → `tile-terrain-glb --lod`. 다른 대형 컨텍스트 지형도 같은 스크립트를 검토한다.
  - 신규 반입: `public/` 에 놓고 `pnpm optimize:glb <파일>` (지도는 `pnpm optimize:map`). 원본이 `assets-src/` 로 자동 백업된다.
  - **드로우콜이 많은 정적 장식 모델**(노드 수백~수천 개, meshOverrides·tagMappings 내부 노드·리그 참조가 전혀 없는 것)은 `node scripts/join-static-glb.mjs <파일>` 로 프리미티브를 병합한 뒤 `pnpm optimize:glb <파일>` 를 이어 돌린다. 노드 계층이 사라지므로 위 참조가 하나라도 있으면 **금지** — 판정 기준·경위는 스크립트 주석, 적격 여부는 `pnpm perf:scene` 이 자동 판정해 준다. 병합 전 계층 원본은 `assets-src/models/<파일>.orig` 로 남는다. 선례: `hanwha-ocean-lngc-174k.glb` 드로우콜 2,193→11, `crane.glb` 91→7 (2026-09-09).
  - `node scripts/shrink-flat-textures.mjs <파일>` — 진짜 단색(모든 픽셀 동일) 텍스처만 4×4 로 무손실 축소한다. perf:scene 의 FLAT_TEXTURE 경고는 파일 크기 기반 **후보**일 뿐이라 오탐이 있다(crane.glb 의 소형 webp 15장은 실측 편차 10~255 의 실제 콘텐츠였다) — 이 스크립트의 픽셀 검증이 최종 판정이며, 불균일이면 건드리지 않는다.
  - **KTX2(GPU 압축 텍스처)**: 디코드 배선은 완료 상태다 — 모든 GLTF 로드 경로가 `extendGltfLoaderWithKtx2`(`packages/domain/src/3d/lib/ktx2-loader.ts`)를 물고 있고 트랜스코더는 `apps/shell/public/basis/r<three REVISION>/` 에 커밋돼 있다(three 업그레이드 시 새 REVISION 디렉터리로 재복사 — 경로에 버전을 넣어 고정 URL stale 캐시를 막는다, ktx2-loader.ts 주석). 에셋 변환은 `node scripts/encode-ktx2.mjs <입력> <출력> [--srgb-only]` (UASTC+zstd, 슬롯별 sRGB/normal 프리셋). **주의: UASTC 는 고품질이지만 무손실이 아니고 파일이 커진다(실측 phillyshipyard 8.0→13.8MB, VRAM 181→45MB)** — 실 운영 장비에서 육안 A/B·BC7 지원 확인 전에 배포 GLB 를 일괄 전환하지 않는다. 새 GLTF 로드 경로(useGLTF·GLTFLoader)를 추가하면 반드시 이 배선을 같이 건다 — 누락된 경로가 KTX2 GLB 를 열면 통째로 throw 된다.
  - **기존 파일 교체는 순서가 반대다.** 스크립트가 백업본을 원본으로 취급하므로 새 버전을 `assets-src/` 에 먼저 넣고 실행한다. `public/` 에 덮어쓰고 실행하면 옛 백업이 새 파일을 되돌린다.
  - Blender export 에 월드 좌표가 베이크돼 오면 `scripts/unbake-goliath-crane.mjs`(골리앗 전용) 또는 `scripts/unbake-root-transform.mjs`(범용)로 원점을 복원한 뒤 압축한다. 그냥 등록하면 존·기즈모가 수 km 어긋난다.
  - 절차 전문은 `assets-src/README.md`, 파이프라인 상세는 `docs/지도-GLB-최적화-파이프라인.md` 와 `docs/GLB-압축-파이프라인-작업보고.md` 에 있다.
- philly 두 씬(`goliath.json`, `philly-2dock.json`)은 지도가 **3장**이다 — 조선소 두 장(`philly-area-1.glb`·`philly-area-2.glb`, 2026-09-11 에 옛 `phillyshipyard.glb` 를 디자이너가 분할한 것으로 옛 좌표계 그대로라 옛 배치값을 공유한다. 둘 다 드롭 raycast 기준이자 `cameraBounds: true` 로 카메라 범위·탑뷰 기준)과 주변 지형(`philly-terrain.glb`, 조선소 자리가 구멍으로 잘린 시 전역 OSM 지형). 에디터 팔레트 "맵" 탭은 타일별 **추가/제거 토글**이라 지도를 여러 장 놓을 수 있고(`addSceneMap` append · 제거는 `deletePlacedMap`, 같은 경로는 한 장), 터레인도 카탈로그(`scene-map-catalog.ts`)에 `kind:'context'` + `defaultPosition`(goliath 기준 오프셋)으로 등록돼 있다. 드롭 raycast 의 기준인 **바닥 지도는 배열 인덱스가 아니라 카탈로그 `kind` 로 판정**한다(`resolveGroundMaps`: `ground` 전부 — 분할 지도 대응, 없으면 `maps[0]` 한 장 폴백. `use-scene-drop.ts` 가 그 전부를 `intersectObjects` 해 최근접 표면을 쓴다). 카메라 이동 범위·탑뷰 bounds 는 kind 가 아니라 씬 데이터 `cameraBounds`(인스펙터 카메라 탭)로 고른다 — 폭 수 km 짜리 컨텍스트 지형이 탑뷰 프레이밍을 잡아먹지 않게 하려는 구분이고, 두 씬 모두 조선소 두 장만 체크돼 있다. 타일 상태 파생은 `packages/widgets/src/3d/lib/map-palette-tiles.ts`. 잠긴 지도 타일은 클릭을 무시하고, 계층 목록·타일 자물쇠로 해제한다. 터레인 배치값은 디자이너 Blender 씬의 조선소 V4 오프셋을 보정한 값이라 조선소 지도를 다시 반입해 좌표계가 바뀌면 터레인도 함께 옮긴다.
- 모델 팔레트 미리보기는 정적 썸네일(`apps/shell/public/previews/{catalogId}.png`)을 먼저 쓰고, 없으면 런타임 offscreen WebGL 렌더로 폴백한다. `sceneModelCatalog` 항목을 추가·교체하거나 미리보기 렌더 룩(`packages/widgets/src/3d/lib/offscreen-preview-renderer.ts`)을 바꾸면 dev 서버의 씬 편집 페이지 모델 탭에서 썸네일 버튼(dev 전용 토글)으로 썸네일을 재생성해 `public/previews/` 를 함께 커밋한다. 썸네일은 투명 배경 PNG 로 테마 중립이어야 한다 — 씬에 배경·바닥판을 굽지 않는다.
- GLB/씬 자산을 추가하면 삼각형 수·텍스처 VRAM·로딩 시간에 미치는 영향을 직접 확인한다. 자동화된 성능 게이트는 **없다** (2026-09-01 에 관련 작업과 계획 문서를 폐기했다).
- **태그 맵핑(`tagMappings[]`)** 은 "서버(PLC) 태그 값 하나 → 트랜스폼 채널 하나" 의 목록이다(모델 인스턴스 필드). 대상은 `{kind:'node', node, channel:position|rotation|scale, axis}`(`node: ''` = 모델 루트) 또는 `{kind:'joint', jointId}`(할당된 리그의 관절) 이고, 태그는 `tagKey` 문자열(`${craneId}:${tagCode}` 공간)로만 참조한다. 적용 공식은 `offset + value × scale` 을 **rest 기준 Δ** 로 더하는 것 — 루트의 rest 는 씬 배치 transform, 내부 노드는 GLTF rest 다. 같은 대상 중복은 sanitize 가 첫 항목만 남기고(first-wins), 리그 관절이 점유한 노드·축은 드라이버가 관절을 우선한다. UI 는 둘 다 amber 로 경고한다(`tag-mapping-editor.ts`).
  - 레거시 `valueMapList`(루트 6칸 절대 대입)·`rigBindings`(관절 바인딩)는 로드 시 `sanitize-tag-mappings.ts` 가 `tagMappings` 로 변환하고 저장본에서 사라진다. 절대 좌표 → Δ 변환은 `offset' = offset − placement[axis]` (테스트가 좌표 동일성을 고정). 두 필드는 타입에 `@deprecated` 입력 전용으로만 남아 있다.
  - 값 흐름: 생산자(가상 태그 러너 / WebSocket 러너 / 리플레이) → `publishTagValue(key, v)` (`tag-value-bus.ts`, 표시용 `tagLiveValues` 캐시) → `useTagBindingSource` 가 건 `createTagBindingSource(resolve)` → `rigValueStore`(smooth) → `useRigDriver`(Canvas 안 `RigDriver`) 가 매 프레임 노드별로 rest 로 되돌린 뒤 채널 Δ 를 누적(`apply-channel.ts`). 바인딩은 모니터링 뷰·에디터 모두 화면이 떠 있는 동안 항상 켜 두고 언마운트 시 값 저장소를 비운다. 에디터 팔레트 "태그" 탭의 재생 토글은 러너 틱만 켜고 끄므로 일시정지하면 노드가 마지막 값에 머물고, 초기값 복귀는 탭의 리셋 버튼이 한다. 기즈모 드래그 중엔 루트 맵핑을 건너뛴다.
  - **가상 태그**(`@crane/domain/virtual-tag`)는 서버 없이 태그 값을 만드는 정의다(`key`·범위·`initial`·`pattern`: manual|triangle|sine|sawtooth|square). 전역 스토어 `useVirtualTagStore` 가 들고 있으며 영속화는 씬과 같은 규칙(`virtual-tag-storage.ts`)이다 — dev 는 `POST /__dev/virtual-tags` 로 배포 파일 `apps/shell/public/simulation/virtual-tags.json` 에 기록(커밋해 클론·배포의 기준값), 운영은 localStorage `crane:virtual-tags` 에 배포 해시 도장(`baseVersion`)과 함께 봉투로 저장하고 새 배포가 나오면 배포본이 이긴다. 편집은 메모리에만 쌓이고 페이지의 저장 버튼(`save()`)이 기록한다(dirty·미저장 이탈 경고는 씬 편집과 같은 훅 재사용). `virtualTagRuntime`(모듈 전역 `setInterval`, Canvas 불필요)이 틱마다 버스로 내보낸다. 모니터링 `mode='simulation'` 이 이 재생을 켠다(`useSceneData` 의 `autoStartSimulation`, 기본 true. 대시보드 3D 미리보기 모달은 ▶ 토글이 없는 뷰라 false 로 정지 상태로 연다). 콤보박스 목록은 `useTagCatalog` 하나를 본다 — 실서버가 붙으면 여기에 `getMonitoringTags()` 결과를 `source:'server'` 로 합치고 WebSocket 러너를 켜면 되며, 씬 JSON·맵핑 UI·드라이버는 무변경이다.
- **리깅(관절 연동)** 은 정의(`RigDefinition`: 관절 `hinge|slide` + 구속조건 `linear` = "출력 관절 = 입력 관절 × factor + offset", 디자이너가 주는 공식 형태 그대로. 출력 관절은 driven 이 되어 슬라이더·태그를 받지 않고, 구속조건은 배열 순서대로 계산돼 체인이 된다)가 자산 단위라 씬 상위 `rigs[]` 에 두고, 모델 인스턴스는 `rigId` 만 가진다(관절 ← 태그는 위 `tagMappings` 의 joint 대상). 관절 값은 **항상 rest pose 기준 Δ** 이며 `rest-pose-cache.ts` 가 clone 직후 잡은 GLTF 원본을 기준으로 매 프레임 `q = rest ∘ Δ` 를 다시 만든다 — `rotation.x = θ` 절대 대입은 Blender Empty 의 비항등 rest 를 파괴하므로 금지. 노드 경로는 `mesh-path.ts` 의 `[index]name/...` 형식 그대로다.
  - 값 소스는 `JointValueSource` 하나로 통한다. 에디터 슬라이더는 `manualJointSource`(씬 데이터·히스토리에 남지 않음), 태그는 `createTagBindingSource`(위 값 흐름). 시뮬레이션 재생 중 태그가 꽂힌 관절의 슬라이더는 잠긴다.
  - 리깅 가능한 자산은 피벗에 Empty 노드가 있어야 한다. `LLC_002.glb` 는 참고 프로젝트의 리깅본으로 교체됐고(루트 scale 을 `unbake-root-transform.mjs --fold-scale` 로 자식에 접어 넣어 실제 미터, 배치 scale 1), 나머지 카탈로그 크레인은 단일 메쉬라 관절을 정의할 수 없다. `pnpm optimize:glb` 는 join/prune 을 쓰지 않아 Empty 계층·이름이 보존된다.
  - 리깅 노드에 `meshOverrides` 가 함께 있으면 드라이버가 이긴다(rest = GLTF 원본).
- **모델 안쪽 노드(계층 목록의 자식, 뷰포트 더블클릭 drill-in)는 읽기 전용**이다. 인스펙터는 안내 문구만 보이며 기즈모는 붙지 않고, 노드 선택은 항상 단일 선택(Ctrl 토글 없음)이다. 표시는 모델 선택과 같은 실루엣 테두리이며 대상만 그 노드 서브트리로 좁힌다(2026-09-09, `GltfModel` 의 `selectedMeshTarget` 이 `ObjectSilhouetteOutline` 대상이 된다 — `selectionStyle='outline'` 인 에디터 한정). `selectionStyle='box'` 인 캔버스(에디터의 지도, 모니터링·리플레이·존 뷰어)는 그대로 노드 바운딩 박스다 — 박스 점은 `packages/domain/src/3d/lib/selection-bounding-box.ts` 가 마운트 대상의 로컬 좌표로 계산하고, 노드 박스는 `createPortal` 로 노드 자식에 마운트해 리그·기즈모 움직임을 씬 그래프 상속으로 따라간다(포털은 `target.uuid` key 로 재마운트해야 한다 — R3F `Portal` 이 컨테이너 교체 시 이전 노드에 붙이는 문제가 있다, 파일 주석 참고. 실루엣 쪽도 같은 이유로 `node.uuid`·`mesh.uuid` 를 key 로 쓴다). 어느 쪽이든 하위에 메시가 없는 리프 Empty 노드는 그릴 것이 없어 아무 표시도 나오지 않는다. 저장 씬의 `meshOverrides` 는 렌더에만 쓰이고 에디터에서 새로 만들지 않는다.

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
