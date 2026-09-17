# 씬 객체 충돌 감지 · 감지 설정 · 러너 정지

씬에 배치된 모델끼리 관통하는지를 삼각형 수준으로 감지하고, 시뮬레이션·3D 플레이 러너를 멈추거나 화면에 경보를 내는 계통. 골리앗 LiDAR 근접 존(`collision-guard*`)과는 별개다. 감지 설정(충돌·영역 공통 5개 스위치)의 영속화·기본값은 **이 문서가 단일 소스**다.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 기하 판정(AABB → OBB → three-mesh-bvh 삼각형) | `packages/domain/src/3d/lib/collision-volumes.ts` |
| 런타임(React 밖 싱글턴, dirty 쌍 검사·기준선·억제·시간 예산) | `packages/features/src/3d/model/scene-collision-runtime.ts` |
| 상수(스캔 주기·예산·`BASELINE_SETTLE_MS`·`SEPARATION_MARGIN`·`HISTORY_MAX`) | `packages/features/src/3d/lib/scene-collision-pairs.ts` |
| 스토어(on/off·정지 여부·기록·활성 쌍·`baselinePending`) | `packages/features/src/3d/model/use-scene-collision-store.ts` |
| 검출기 훅 / Canvas 컴포넌트 | `packages/features/src/3d/model/use-scene-collision-detector.ts`, `ui/scene-collision-detector.tsx` |
| 러너 정지·재개 단일 경로 | `packages/features/src/3d/model/scene-collision-hold.ts` |
| 감지 설정 영속화(충돌·영역 공통) | `packages/features/src/3d/lib/detection-settings-storage.ts` |
| 감지 설정 페이지(메뉴 "설정") | `packages/widgets/src/detection-settings/ui/detection-settings-page.tsx` |
| 화면 경보(가장자리 비네트) | `packages/features/src/3d/ui/scene-collision-alert-overlay.tsx` |
| 씬 안 표시(빨간 실루엣·경고 표지) | `packages/features/src/3d/ui/scene-collision-highlight.tsx`, `packages/domain/src/3d/ui/object-silhouette-outline.tsx`, `packages/domain/src/3d/lib/silhouette-outline.ts` |
| 충돌 시 카메라 포즈 | `computeCollisionViewPose` (`lib/scene-collision-pairs.ts`) |
| 저널 동기화(실시간만) | `packages/features/src/3d/ui/collision-journal-sync.tsx`, `lib/collision-journal-map.ts` |
| 캔버스 GL 옵션(스텐실) | `SCENE_GL_OPTIONS` (`packages/features/src/3d/ui/scene-render-preset.tsx`) |

## 동작

### 감지 설정(충돌·영역 공통)

- 설정 UI 는 감지 설정 페이지 하나다. 스위치 다섯 개: 충돌 감지, 충돌 시 정지, 영역 감지, 영역 이름 표시, 침범 시 정지. 페이지는 스위치만 가지고 기록·침범 목록 같은 런타임 상태는 없다.
- 값은 localStorage `crane:detection-settings` 봉투 하나에 영속된다. region·씬과 무관한 브라우저 전역 설정이다.
- 기본값(`DETECTION_SETTINGS_DEFAULTS`): 감지 둘·이름 표시는 **ON**, 정지 둘(`pauseOnCollision`·`stopOnIntrusion`)은 **OFF**. 기본으로 재생을 멈추면 시뮬레이션·3D 플레이가 첫 사건에서 서 버리기 때문이다.
- 충돌 스토어와 영역 스토어(`use-scene-zone-store.ts`)가 초기값을 `readDetectionSettings` 로 읽고 setter 마다 `writeDetectionSettings` 한다. `write` 는 read → merge → write 라 두 스토어가 서로의 필드를 덮지 않는다. 봉투는 `sanitizeDetectionSettings` 가 필드별 boolean 만 받아 방어한다.
- 영역 쪽 스토어·검출기 동작은 `docs/agents/3d-zone.md`.

### 감지 대상과 기하

- 대상은 씬 모델 **인스턴스 간** 관통이다. 판정은 AABB → OBB → three-mesh-bvh 삼각형 순으로 좁힌다. BVH 는 `collision-volumes.ts` 에서만 접근하고 여기서 빌드하지 않는다(빌드는 워밍업 큐, `docs/agents/rendering-perf.md`).
- 억제 해제(분리 판정)는 모델 AABB 가 아니라 **메쉬 단위**다. `meshesWithinDistance` 가 AABB+margin → OBB → 삼각형 최단 거리로 보므로, 단일 메쉬 크레인처럼 OBB 가 늘 겹치는 모델도 삼각형이 `SEPARATION_MARGIN` 이상 떨어지면 다시 보고된다.

### 런타임(scene-collision-runtime)

- React 밖 싱글턴. 모델 오브젝트 레지스트리의 루트를 항목으로 들고, 메쉬 `matrixWorld` 변화로 dirty 가 된 쌍만 검사한다. 한 틱에 쓰는 시간 예산이 있어 큰 씬에서도 프레임을 세우지 않는다.
- **기준선(baseline)**: 스캔을 시작(재개)하는 전이에서 현재 겹침을 기준선으로 잡고 보고하지 않는다. 기준선은 dirty 큐가 빈 뒤에도 `BASELINE_SETTLE_MS` 안정화 창이 지나야 scanning 상태가 된다. 그래서 정지 중 기즈모·인스펙터·슬라이더로 만든 겹침, 드래그로 놓은 겹침, 로딩 배치, 재생 시작 스무딩은 보고 대신 억제되고, 시뮬레이션이 그 쌍을 떼었다가 다시 붙여야 보고된다. 안정화 창 안에서 시뮬레이션이 만든 겹침도 분리 전까지 보고되지 않으며, 재생 중 편집(opacity 만 바꿔도 참조 교체)마다 짧은 blind 가 생기는 것은 허용된 부작용이다.
- 재기준선 시점: 스캔 재개 전이와 기록 복원(`selectRecord`)은 검출기가 `rebaseline()` 을 부르고, 새 모델 항목(첫 마운트·리마운트·참조 교체)은 런타임 tick 이 스스로 기준선 상태로 되돌린다.
- 런타임은 hit 을 돌려줄 뿐 스스로 멈추지 않는다. 정지 판단은 검출기·스토어 몫이다.

### 검출기(use-scene-collision-detector)

- Canvas 안 `RigDriver` **바로 다음**에 마운트한다. 같은 priority 의 useFrame 은 마운트 순이라, 드라이버가 자세를 쓴 뒤 같은 프레임에 검사한다.
- 감지는 `runner` 가 **재생 중(+기즈모 드래그 아님)** 일 때만 돈다. 판정은 `scene-collision-hold.ts` 의 `isRunnerRunning(runner)` — 시뮬레이션은 가상 태그 스토어 `isRunning`, 3D 플레이는 활성 소스의 러너, 실시간은 진입~이탈 내내 재생으로 본다(`held` 여도 스캔).
- 러너 종류 `SceneCollisionRunner` 는 `'simulation'`(에디터·미리보기) | `'realtime'` | `'play3d'`(활성 소스가 `usePlay3dStore.source` 에 따라 리플레이 러너 또는 가상 태그 러너).
- 스토어 `baselinePending` 은 검출기가 런타임 phase 변화 시에만 갱신하고 **스캔 중일 때만** true 다(러너 정지·드래그 중엔 내린다). 워밍업 표시(`scene-warmup-step.ts`)가 이 값을 "기준선 잡는 중" 단계로 보인다 — 재생 시작·드래그 종료·편집 뒤 안정화 창 동안 잠깐 나타난다.
- 어느 모드든 충돌한 쌍만 억제한 채 다른 쌍 감시는 계속한다.

### 정지·경보·재개

- **정지 모드**(`pauseOnCollision` ON): 러너 pause + freeze + pin. 활성 쌍이 pinned 인 동안 스캔도 멈춘다. **무정지 모드**: 짧은 시간 표시만 하는 박스.
- **실시간 러너는 자동 정지하지 않는다.** 실제 장비는 멈추지 않는데 화면만 얼리는 것은 관제에 해롭다. 검출기가 `runner === 'realtime'` 이면 `pauseOnCollision` 과 무관하게 flash 만 한다.
- 화면 경보는 `scene-collision-alert-overlay.tsx` 의 가장자리 inset box-shadow 비네트 하나다. 재개 조작은 오버레이에 없고 러너 ▶(3D 플레이 트랜스포트 바 등)에 있다.
- 재개는 러너 ▶ 전이다. `subscribeRunnerResume(runner, cb)` 한 곳이 러너별로 구독한다: 시뮬레이션은 가상 태그 `isRunning` false→true, 3D 플레이는 리플레이·가상 태그 어느 쪽이든, 실시간은 자동 정지가 없어 대상이 아니다. ▶ 재생이 스토어 `resume` 으로 재무장한다.
- 값 생산자 정지의 실제 수단은 `scene-collision-hold.ts` 의 `holdRunners`/`releaseRunners` 다. 가상 태그·리플레이는 pause(경과·프레임 index 보존), 실시간(WebSocket)은 `useRealtimeStore.hold()` 로 **화면 반영만 보류**(러너가 수신 값을 drain 만 하고 버림, 장비는 계속 움직임). pinned 을 떠나는 모든 스토어 경로(`resume`·`clearActive`·`clearHistory`·`clear`·`setEnabled(false)`)가 release 한다. 영역 'stop' 침범도 같은 hold 경로를 쓴다(`docs/agents/3d-zone.md`).
- 스토어 `selectRecord`(기록 복원 = `rigValueStore.restore(스냅샷)` + 러너 정지)는 남아 있지만 화면에서 부르는 곳이 없다. 실시간에서 pinned 이 되는 경로는 이것뿐이라 실제로는 실시간이 pinned 이 되지 않는다.

### 씬 안 표시

- 충돌 장비는 일체형 빨간 실루엣 테두리로 표시한다. `@crane/domain/3d` 의 `ObjectSilhouetteOutline` — 스텐실 마스크 + 인플레이션 헐(`lib/silhouette-outline.ts`)이라 캔버스에 `SCENE_GL_OPTIONS.stencil: true` 가 필요하다. 실루엣 마스크·헐은 자기 스텐실 비트만 writeMask/funcMask 로 본다(바다 스텐실 비트와 분리, `docs/agents/rendering-perf.md`).
- 에디터의 **선택 표시**도 같은 컴포넌트를 노랑으로 쓴다 — 모델 전체와 안쪽 노드(계층 목록·drill-in, `selectedMeshTarget`) 모두. `GltfModel` 의 `selectionStyle='outline'` 이며 스텐실 없는 캔버스에선 기본 `'box'` 를 유지한다. 에디터의 **지도**는 `'box'` 다 — 수 km 지형을 실루엣으로 두르면 화면 가장자리 전체가 테두리가 되고 헐이 지형 메시를 매 프레임 두 번 더 그린다.
- 경고 표지는 `scene-collision-highlight.tsx`. 헐 셰이더 프리워밍(`silhouette-outline-warmup.tsx`)은 그 옆에 마운트한다(`docs/agents/rendering-perf.md`).

### 기록·소비자

- 기록은 스토어에 세션 전용으로 최대 `HISTORY_MAX` 개 남는다. 소비자는 하이라이트, 저널(`collision-journal-sync.tsx`, 실시간 화면만 — `isRealtimeSceneActive`), 3D 플레이 실행 리포트(`docs/agents/3d-play.md`), 경보 알림(`scene-alert-notifier.tsx`, `docs/agents/monitoring-ui.md`)이다.
- 마운트 범위: 모니터링은 전 모드(실시간·3D 플레이·미리보기)에서 켠다. 에디터는 러너를 켤 UI 가 없어 충돌 검출기·하이라이트를 마운트하지 않는다.

## 불변식

- 실루엣 테두리(`ObjectSilhouetteOutline`, `selectionStyle='outline'`)를 쓰는 캔버스는 `SCENE_GL_OPTIONS.stencil: true` 여야 한다. 스텐실 없는 캔버스는 `'box'` 로 둔다.
- Canvas 마운트 순서를 지킨다: `RigDriver` → 충돌 검출기(`SceneCollisionDetector`) → `SceneCollisionHighlight`(+`SilhouetteOutlineWarmup`) → 영역 검출기(`SceneZoneDetector`) → `SceneZoneRings`. 같은 priority useFrame 은 마운트 순이라 순서가 바뀌면 한 프레임 늦은 자세를 검사한다.
- 값 생산자를 멈추거나 되살리는 코드는 `scene-collision-hold.ts` 의 `holdRunners`/`releaseRunners`/`subscribeRunnerResume` 만 쓴다. 러너 스토어를 직접 pause 하는 새 경로를 만들지 않는다.
- 실시간 러너(`'realtime'`)는 어떤 감지에서도 자동 정지하지 않는다. 새 정지 조건을 추가해도 `runner === 'realtime'` 은 flash 로 끝낸다.
- 감지 설정 스위치를 추가하면 `DetectionSettings`·`DETECTION_SETTINGS_DEFAULTS`·`sanitizeDetectionSettings` 와 설정 페이지를 함께 고치고, 스토어는 `readDetectionSettings`/`writeDetectionSettings` 로만 읽고 쓴다.
- 스캔 재개·기록 복원처럼 자세가 불연속으로 바뀌는 전이는 `rebaseline()` 을 부른다. 안 부르면 그 순간의 겹침이 충돌로 보고된다.
- 새 모델 항목은 런타임이 스스로 기준선으로 되돌리므로 검출기에서 따로 처리하지 않는다.
- `collision-volumes.ts` 밖에서 BVH 를 빌드하거나 직접 읽지 않는다.

## 하지 않기로 한 것

- 충돌 기록 목록 UI·[충돌 지점 보기]·상단 배너·[이어서 재생] 버튼은 두지 않는다 — HUD 충돌 칸·독 배지·비네트와 겹쳐 보였다. 기록은 하이라이트·저널·실행 리포트만 쓰고 재개는 러너 ▶ 하나다.
- 독(dock) 팝업·에디터 팔레트 탭에 감지 스위치를 흩어 두지 않는다 — 설정은 감지 설정 페이지 하나다.
- 캔버스 위 충돌 오버레이 패널(지점·쌍 목록)은 두지 않는다 — 비네트만.
- 실시간 자동 정지는 넣지 않는다 — 장비는 멈추지 않는데 화면만 얼린다.
- 분리 판정을 모델 AABB 로 하지 않는다 — 단일 메쉬 크레인은 OBB 가 늘 겹쳐 재보고가 영영 나지 않았다.
- 기준선 없이 즉시 보고하지 않는다 — 정지 중 편집·로딩 배치·재생 시작 스무딩이 전부 충돌로 찍혔다.
- 에디터 지도의 선택 표시를 실루엣으로 하지 않는다 — 지형 메시를 매 프레임 두 번 더 그린다.
