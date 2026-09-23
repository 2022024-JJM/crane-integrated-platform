# 태그 맵핑 · 가상 태그 시뮬레이션 · 리깅

서버(PLC) 태그 값이 3D 모델의 트랜스폼·관절을 움직이는 경로 전체 — 맵핑 스키마, 값 버스, 가상 태그 러너·시나리오, 리그 정의·드라이버.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 태그 맵핑 스키마 / 방어 / 레거시 변환 | `packages/domain/src/3d/model/tag-mapping-types.ts`, `packages/domain/src/3d/lib/sanitize-tag-mappings.ts` |
| 태그 값 버스 / 맵핑 인덱스 / 바인딩 소스 | `packages/features/src/3d/model/tag-value-bus.ts`, `packages/features/src/3d/lib/tag-mapping-index.ts`, `packages/features/src/3d/model/use-tag-binding-source.ts` |
| 채널 Δ 적용 / 루트 Δ 벗기기 / 배치 프레임 | `packages/features/src/3d/lib/apply-channel.ts`, `packages/features/src/3d/lib/strip-channel-delta.ts`, `packages/features/src/3d/model/root-placement.ts` |
| 태그 맵핑 편집 UI(인스펙터 탭) | `packages/widgets/src/3d/ui/tag-mapping-section.tsx`, `packages/widgets/src/3d/ui/tag-key-combobox.tsx`, `packages/widgets/src/3d/lib/tag-mapping-editor.ts`(충돌 판정·기본값, 테스트 대상) |
| 가상 태그 정의·파형·방어·시나리오·한계 | `packages/domain/src/virtual-tag/model/types.ts`, `packages/domain/src/virtual-tag/lib/tag-pattern.ts`, `packages/domain/src/virtual-tag/lib/sanitize-virtual-tags.ts`, `packages/domain/src/virtual-tag/lib/scenario.ts`, `packages/domain/src/virtual-tag/lib/rate-limit.ts` |
| 가상 태그 영속화 어댑터 / 배포 파일 | `packages/domain/src/virtual-tag/lib/virtual-tag-storage.ts`, `apps/shell/public/simulation/virtual-tags.json` |
| 가상 태그 스토어 · 러너 · 카탈로그 · 종료 | `packages/features/src/3d/model/use-virtual-tag-store.ts`, `packages/features/src/3d/model/virtual-tag-runner.ts`, `packages/features/src/3d/model/use-tag-catalog.ts`, `packages/features/src/3d/model/stop-simulation.ts` |
| 시뮬레이션 UI | 공용 패널 `packages/features/src/3d/ui/scene-simulation-panel.tsx`, 배지 `packages/features/src/3d/ui/scene-simulation-badge.tsx`, HUD 라벨 `packages/features/src/3d/lib/sim-clock.ts` |
| 가상 태그 관리 페이지 / 시나리오 편집 | `packages/widgets/src/virtual-tags/ui/virtual-tags-page.tsx`, `packages/widgets/src/virtual-tags/ui/scenario-section.tsx` |
| 리깅 스키마(관절·구속조건) / 방어 | `packages/domain/src/3d/model/rig-types.ts`, `packages/domain/src/3d/lib/sanitize-rig.ts` |
| 리깅 런타임(값 저장소·드라이버·readout) | `packages/features/src/3d/model/rig-value-store.ts`, `packages/features/src/3d/model/use-rig-driver.ts`, `packages/features/src/3d/model/rig-live-readouts.ts` |
| 관절 적용 / 스무딩 / rest 캐시 / 노드 경로 | `packages/features/src/3d/lib/apply-joint.ts`, `packages/features/src/3d/lib/smooth-damp.ts`, `packages/domain/src/3d/lib/rest-pose-cache.ts`, `packages/domain/src/3d/lib/mesh-path.ts` |
| 리깅 편집 UI(인스펙터 탭·계층 노드 트리) | `packages/widgets/src/3d/ui/rigging-section.tsx`, `packages/widgets/src/3d/lib/model-node-tree.ts` |

## 동작

### 태그 맵핑 `tagMappings[]`

모델 인스턴스 필드. "서버(PLC) 태그 값 하나 → 트랜스폼 채널 하나" 의 목록이다.

- 대상은 두 종류다. `{kind:'node', node, channel:position|rotation|scale, axis}` — `node: ''` 는 모델 루트. `{kind:'joint', jointId}` — 할당된 리그의 관절.
- 태그는 `tagKey` 문자열(`${craneId}:${tagCode}` 공간)로만 참조한다.
- 적용 공식은 `offset + value × scale` 을 **rest 기준 Δ** 로 더하는 것. 루트의 rest 는 씬 배치 transform, 내부 노드는 GLTF rest 다.
- 같은 대상 중복은 sanitize 가 첫 항목만 남기고(first-wins), 리그 관절이 점유한 노드·축은 드라이버가 관절을 우선한다. 편집 UI 는 둘 다 amber 로 경고한다(`tag-mapping-editor.ts`).
- 레거시 `valueMapList`(루트 6칸 절대 대입)·`rigBindings`(관절 바인딩)는 로드 시 `sanitize-tag-mappings.ts` 가 `tagMappings` 로 변환하고 저장본에서 사라진다. 절대 좌표 → Δ 변환은 `offset' = offset − placement[axis]` 이며 테스트가 좌표 동일성을 고정한다. 두 필드는 타입에 `@deprecated` 입력 전용으로만 남아 있다.

### 값 흐름

생산자(가상 태그 러너 / WebSocket 러너 / 리플레이) → `publishTagValue(key, v)`(`tag-value-bus.ts`, 표시용 `tagLiveValues` 캐시) → `useTagBindingSource` 가 건 `createTagBindingSource(resolve)` → `rigValueStore`(smooth) → `useRigDriver`(Canvas 안 `RigDriver`) 가 매 프레임 노드별로 rest 로 되돌린 뒤 채널 Δ 를 누적한다(`apply-channel.ts`).

- 바인딩은 모니터링 뷰·에디터 모두 화면이 떠 있는 동안 항상 켜 두고 언마운트 시 값 저장소를 비운다.
- 재생 토글(가상 태그 관리 페이지·3D 플레이 트랜스포트 바)은 러너 틱만 켜고 끈다. 일시정지하면 노드가 마지막 값에 머물고, 초기값 복귀는 리셋 버튼이 한다.
- 기즈모 드래그 중엔 루트 맵핑을 건너뛴다. 드래그 종료 프레임의 루트 rest handoff 는 `docs/agents/3d-editor.md`.
- 버스 관찰자 `subscribeTagValues` 는 소비자 슬롯과 별개의 다중 구독이다(3D 플레이 통계 등이 쓴다 — `docs/agents/3d-play.md`).
- 값 저장소의 set/reset/restore 와 스무딩 잔여는 프레임 요청·그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

### 가상 태그 `@crane/domain/virtual-tag`

서버 없이 태그 값을 만드는 정의다. `key`·범위·`initial`·`pattern`(manual|triangle|sine|sawtooth|square).

- 전역 스토어 `useVirtualTagStore` 가 들고 있다. 편집은 메모리에만 쌓이고 관리 페이지의 저장 버튼(`save()`)이 기록한다. dirty·미저장 이탈 경고는 씬 편집과 같은 훅을 재사용한다.
- 영속화는 씬과 같은 규칙(`virtual-tag-storage.ts`). dev 는 `POST /__dev/virtual-tags` 로 배포 파일 `apps/shell/public/simulation/virtual-tags.json` 에 기록하며 이 파일이 클론·배포의 기준값이라 커밋한다. 운영은 localStorage `crane:virtual-tags` 에 배포 해시 도장(`baseVersion`)과 함께 봉투로 저장하고, 새 배포가 나오면 배포본이 이긴다. API 경로 문자열은 `vite.config.ts` 와 `virtual-tag-storage.ts` 두 곳에 있다 — `docs/agents/3d-editor.md`.
- `virtualTagRuntime`(모듈 전역 `setInterval`, Canvas 불필요)이 틱마다 버스로 내보낸다.
- 재생을 켜는 곳: 모니터링 `mode='simulation'` 은 `useSceneData` 의 `autoStartSimulation`(기본 true — 대시보드 3D 미리보기 모달은 ▶ 토글이 없는 뷰라 false 로 정지 상태로 연다). 3D 플레이(`mode='play3d'`, 소스 시뮬레이션)은 상단 트랜스포트 바 ▶ 가 켠다(자동 재생 없음). 실시간 페이지(`mode='realtime'`)에는 시뮬레이션 UI 가 없다.
- 콤보박스 목록은 `useTagCatalog` 하나를 본다. 실서버가 붙으면 여기에 `getMonitoringTags()` 결과를 `source:'server'` 로 합치고 WebSocket 러너를 켜면 되며, 씬 JSON·맵핑 UI·드라이버는 무변경이다.

### 시뮬레이션 시계·시나리오

- 러너(`virtual-tag-runner.ts`)는 벽시계 dt × `speed`(스토어 세션값, 선택지 `SIMULATION_SPEED_OPTIONS`)를 누적한다. `seek(ms)` 는 경과를 옮겨 모든 값을 그 시각으로 다시 계산해 내보낸다 — 정지 중에도 동작하도록 `attachConfig` 로 getter 만 붙여 둔다.
- `start()` 는 현재 상태값만 내보내고 시각 기준 재계산(evaluateAll)을 하지 않는다.
- **시나리오** `VirtualScenario`(id·name·loop·tracks[key, keyframes[atMs,value,ease?]])는 세트 `scenarios[]` 에 태그와 함께 저장된다. `sanitizeScenario*`·`normalizeKeyframes` 가 정렬·중복 제거·상한을 맡는다. `activeScenarioId`(세션)로 하나만 활성이다.
- 트랙이 있는 태그는 `evaluateScenarioTrack`(첫/마지막 값 유지, 구간 ease linear/hold/smooth)이 파형을 대신하고, 트랙 없는 태그는 파형 그대로다. loop 아닌 시나리오가 끝에 닿으면 러너 `onFinished` → 스토어 `pause()`. 시나리오 선택은 `seek(0)`.
- **종료(관제 복귀)** 는 `stop-simulation.ts` 의 `stopSimulation()` 한 곳이다 — 패널 ■·배지·화면 진입/이탈이 전부 이걸 부른다. 내용은 충돌 세션 기록·정지 상태 `clearHistory()` + 스토어 `stop()`(러너 정지·시간 0 — publish 없는 `resetValues(false)`·시나리오 해제) + `rigValueStore.reset()`(rest 복귀) + `tagLiveValues.clear()`(운전 상태 unknown) + 실시간 `release()`. 일시정지(자세 유지)와 다른 경로다. 모니터링의 ■ 은 `onStop` 으로 카메라 원래 위치·포커스 해제까지 = 처음 화면.
- 모니터링 `useSceneData` 와 에디터 페이지는 **진입·이탈 모두** `stopSimulation()` 을 불러 화면마다 깨끗한 시뮬레이션으로 시작한다.
- UI: 공용 패널 `scene-simulation-panel.tsx`(재생·리셋·배속·시나리오·반복·스크럽)를 3D 플레이 트랜스포트 바 팝오버가 쓴다. 편집은 관리 페이지의 `scenario-section.tsx`(목록·이름·반복·실행, 트랙별 키프레임 표 — 초 단위 입력·태그 단위 값·보간, SVG 미리보기). HUD 연결 칸 라벨의 `×배속 mm:ss` 는 `sim-clock.ts`.
- **시뮬레이션 중 표시** `scene-simulation-badge.tsx` 는 스토어 `hasSession`(start 에 true, stop 에 false, 일시정지 중에도 true)을 본다 — 캔버스 가장자리 하늘색 inset 테두리(재생 진하게·정지 흐리게) + 좌측 상단 배지(맥동 점·시나리오 이름·배속·■ 종료). `Monitoring3dView` 좌측 상단 열 첫 항목이고 `toolbarLayout='none'` 은 제외.
- 배포 세트에 필리 데모 시나리오 1개(`scenario-philly-block-demo`)가 있다.

### 속도·가속 한계

- `VirtualTagDefinition.limits?: {maxSpeed?, maxAccel?}` — 태그 단위/초·초², 양수만. 관리 표의 두 열.
- 러너가 파형·시나리오 **목표값**을 향해 `rateLimitSteps`(`rate-limit.ts` — `rateLimitStep` 은 속도 상한, 가속 상한 + 정지 거리 √(2a·d) 상한, 오버슈트 클램프, 상태에 `velocity`)를 틱 길이 이하 서브스텝으로 반복해 램프한다.
- dt 는 배속을 곱한 시뮬레이션 시간이라 한계는 배속과 무관하게 시뮬레이션 초 기준이고, 서브스텝 덕에 가속 프로파일도 배속과 무관하다.
- manual 슬라이더·seek·리셋은 즉시(텔레포트).
- 배포 필리 태그에 한계가 들어 있어 sine 파형은 한계에 잘려 평평해진다(의도 — 순간이동 방지).

### 리깅(관절 연동)

- 정의 `RigDefinition` = 관절 `hinge|slide` + 구속조건 `linear`("출력 관절 = 입력 관절 × factor + offset", 디자이너가 주는 공식 형태 그대로). 출력 관절은 driven 이 되어 슬라이더·태그를 받지 않고, 구속조건은 배열 순서대로 계산돼 체인이 된다.
- 정의는 자산 단위라 씬 상위 `rigs[]` 에 두고, 모델 인스턴스는 `rigId` 만 가진다. 관절 ← 태그는 `tagMappings` 의 joint 대상.
- 관절 값은 **항상 rest pose 기준 Δ** 다. `rest-pose-cache.ts` 가 clone 직후 잡은 GLTF 원본을 기준으로 매 프레임 `q = rest ∘ Δ` 를 다시 만든다. 노드 경로는 `mesh-path.ts` 의 `[index]name/...` 형식 그대로.
- 값 소스는 `JointValueSource` 하나로 통한다. 에디터 슬라이더는 `manualJointSource`(씬 데이터·히스토리에 남지 않음), 태그는 `createTagBindingSource`. 시뮬레이션 재생 중 태그가 꽂힌 관절의 슬라이더는 잠긴다.
- 리깅 가능한 자산은 피벗에 Empty 노드가 있어야 한다. `LLC_002.glb` 는 참고 프로젝트의 리깅본(루트 scale 을 `scripts/unbake-root-transform.mjs --fold-scale` 로 자식에 접어 넣어 실제 미터, 배치 scale 1)이다. 옥포 OC(`okpo_oc.glb`, `Base/Top/Link_*` Empty)도 피벗 계층이 있고, 옥포 Goliath·TC·TTC 는 `Trolly_*`·`*_Top` 노드를 노드 맵핑 대상으로 쓸 수 있다. 그 외 카탈로그 크레인은 단일 메쉬라 관절을 정의할 수 없다. `pnpm optimize:glb` 는 join/prune 을 쓰지 않아 Empty 계층·이름이 보존된다.
- 리깅 노드에 `meshOverrides` 가 함께 있으면 드라이버가 이긴다(rest = GLTF 원본).
- 관절·맵핑 정의 편집으로 드라이버 인스턴스가 해체·재생성되면 rest 점프가 생기므로 그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

## 불변식

- 관절·태그 값은 항상 rest 기준 Δ 로 적용한다. `rotation.x = θ` 같은 절대 대입은 Blender Empty 의 비항등 rest 를 파괴하므로 금지.
- 태그 값 생산자를 새로 만들면 `publishTagValue` 로만 내보낸다 — 버스가 단일 진입점이고, 표시 캐시·바인딩·운전 상태 판정·3D 플레이 통계가 전부 여기서 갈라진다.
- 시뮬레이션을 끝내는 코드는 `stopSimulation()` 을 부른다. 스토어 `stop()` 만 부르면 값 저장소·충돌 기록·실시간 보류가 남는다.
- 같은 대상(노드·채널·축 / 관절)에 맵핑을 두 개 만들지 않는다 — sanitize 가 뒤 항목을 조용히 버린다.
- 가상 태그 배포 파일 `virtual-tags.json` 을 바꿨으면 커밋한다 — 운영 localStorage 는 `baseVersion` 이 다르면 배포본으로 덮인다.
- 러너가 한계를 적용하는 대상은 목표값이다. 한계를 우회해 값을 즉시 넣어야 하면 manual·seek·리셋 경로(텔레포트)를 쓴다.

## 하지 않기로 한 것

- 러너 `start()` 에서 시각 기준 재계산(evaluateAll) — 한계로 뒤처진 값이 재개 순간 목표로 점프해 미끄러진다. 현재 상태값만 내보낸다.
- 한 스텝에 큰 dt 를 넣는 rate limit — 가속 프로파일이 1~2틱으로 붕괴해 stop‑go 히치가 난다. 틱 길이 이하 서브스텝으로 나눈다.
- 에디터에 시뮬레이션·시나리오 UI 를 두지 않는다 — 진입·이탈의 `stopSimulation()` 은 관리 페이지에서 켜진 러너가 넘어오지 않게 하는 방어다. 재생 UI 는 관리 페이지와 3D 플레이 트랜스포트 바에만 있다.
- 시뮬레이션 알림 toast — 배너·HUD·헤더 배지와 겹쳐 보여 소리·브라우저 알림만 쓴다(`docs/agents/monitoring-ui.md`).
- 레거시 `valueMapList`·`rigBindings` 를 저장본에 다시 쓰는 것 — 입력 전용, 로드 시 변환 후 소멸.

## 미룬 것

- 실서버 태그 합류: `useTagCatalog` 에 `getMonitoringTags()` 결과를 `source:'server'` 로 합치고 WebSocket 러너를 켜는 것. 씬 JSON·맵핑 UI·드라이버는 그대로 둔다.
- 감지·3D 플레이 리포트가 의미 있는 씬은 `tagMappings` 가 있는 philly-2dock(가상 태그만)·dock-in(서버 리플레이만)뿐이다. 옥포 실외·골리앗 씬은 맵핑이 없어 아무것도 움직이지 않는다.
