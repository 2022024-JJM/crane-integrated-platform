# 태그 맵핑 · 상태 태그 · 시뮬레이션 시나리오 · 리깅

서버(PLC) 태그 값이 3D 모델의 트랜스폼·관절을 움직이고 라벨을 칠하고 장비에 외곽선을 두르는 경로 전체 — 맵핑 스키마(코드 하나), 크레인 ID, 상태 태그, 값 버스와 소스 게이트, 시뮬레이션 시나리오(씬 맵핑에서 고른 태그별 동작)·러너, 리그 정의·드라이버.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 태그 맵핑 스키마(코드 하나) / 키 조립 / 모델의 코드 목록 / 방어·레거시 변환 | `packages/domain/src/3d/model/tag-mapping-types.ts`(`TagMapping`·`normalizeTagCode`·`resolveMappingTagKey`), `packages/domain/src/3d/lib/model-tag-codes.ts`(`collectModelTagCodes`), `packages/domain/src/3d/lib/sanitize-tag-mappings.ts`(`parseTagKeyRef`·`resolveTagRef`·`finalizeModelTagKeys`) |
| 활성 소스 해석 / 소스 게이트 훅 | `packages/features/src/3d/lib/tag-source.ts`(`resolveActiveTagSource`·`EDITOR_TAG_SOURCE`, 테스트 대상), `packages/features/src/3d/model/use-active-tag-source.ts`(`useActiveTagSource`) |
| 크레인 태그 키 조립·파싱(`${craneId}.${tagCode}`) | `packages/core/src/lib/crane-tag-key.ts`(`buildCraneTagKey`·`parseCraneTagKey`·`normalizeCraneKey`·`normalizeLegacyCraneTagKey`; `@crane/domain/monitoring` 이 재export) |
| 인스펙터 크레인 콤보박스 옵션(크레인 스냅샷 스토어 기준) / 빈 목록 이유 | `packages/widgets/src/3d/lib/crane-id-options.ts`(`buildCraneIdOptions`·`isListedCraneId`·`craneListEmptyReason`, 테스트 대상) + `model/use-crane-id-options.ts` |
| 라벨의 태그 값 줄(목록 구성·표기 / 값 읽기 / 표시) | `packages/domain/src/3d/lib/label-reading.ts`(`buildLabelReadings(model)`, 테스트 대상), `packages/features/src/3d/model/tag-value-bus.ts`(`readTagLiveValue`), `packages/domain/src/3d/ui/model-label.tsx` |
| 상태 태그 스키마 / 방어 / 편집 로직 / 미리보기 | `packages/domain/src/3d/model/status-tag-types.ts`(`ModelStatusTags`·`resolveStatusTagKeys`), `packages/domain/src/3d/lib/sanitize-status-tags.ts`(`sanitizeStatusTagEntries`), `packages/widgets/src/3d/lib/status-tag-editor.ts`(`setStatusTagCode`), `packages/features/src/3d/model/use-label-preview-store.ts` |
| 서버 값 → 버스 숫자 | `packages/domain/src/monitoring/lib/tag-number.ts` (`toTagNumber`) |
| 태그 값 버스(소스 게이트 포함) / 맵핑 인덱스 / 바인딩 소스 | `packages/features/src/3d/model/tag-value-bus.ts`(`publishTagValue`·`setActiveTagSource`), `packages/features/src/3d/lib/tag-mapping-index.ts`, `packages/features/src/3d/model/use-tag-binding-source.ts` |
| 채널 Δ 적용 / 루트 Δ 벗기기 / 배치 프레임 | `packages/features/src/3d/lib/apply-channel.ts`, `packages/features/src/3d/lib/strip-channel-delta.ts`, `packages/features/src/3d/model/root-placement.ts` |
| 태그 맵핑 편집 UI(인스펙터 탭 — 크레인 칸·맵핑 카드·상태 카드) / 태그 줄 / 태그 연결 다이얼로그 | `packages/widgets/src/3d/ui/tag-mapping-section.tsx`(`CraneIdField`), `packages/widgets/src/3d/ui/tag-code-field.tsx`, `packages/widgets/src/3d/ui/tag-pick-dialog.tsx`(+ `tag-sparkline.tsx`), `packages/widgets/src/3d/lib/tag-mapping-editor.ts`(충돌 판정·기본값·대상 설명, 테스트 대상), `packages/widgets/src/3d/lib/tag-pick.ts`(`findSnapshotEntry`·`filterPickTags`·`describeCodeChip`·`splitChipTail`, 테스트 대상), `packages/widgets/src/3d/lib/tag-history.ts` + `model/use-tag-value-history.ts`(미리보기 최근 60초, 테스트 대상) |
| 인스펙터 편집 채널(크레인 ID·맵핑·상태 태그) | `packages/widgets/src/scene-editor/model/use-selected-scene-object-editor.ts`(`updateSelectedCraneId`·`updateSelectedTagMappings`·`updateSelectedStatusTags`) |
| 시나리오 정의·태그 코드·파형·방어 | `packages/domain/src/virtual-tag/model/types.ts`(`ScenarioTag`·`SimulationScenario`·`ScenarioSet`·상한 상수), `packages/domain/src/virtual-tag/lib/{tag-code,tag-pattern,sanitize-scenarios}.ts` |
| 시나리오 영속화 어댑터 / 배포 파일 | `packages/domain/src/virtual-tag/lib/scenario-storage.ts`, `apps/shell/public/simulation/scenarios.json` |
| 시나리오 스토어 · 엔트리(키 조립) · 새 태그 기본값 · 러너 · 종료 | `packages/features/src/3d/model/use-scenario-store.ts`, `packages/features/src/3d/lib/scenario-entries.ts`(`collectScenarioEntries`), `packages/features/src/3d/lib/scenario-defaults.ts`(`createScenarioTagDefaults`), `packages/features/src/3d/model/virtual-tag-runner.ts`, `packages/features/src/3d/model/stop-simulation.ts` |
| 시뮬레이션 UI(트랜스포트 바의 시나리오 선택, 배지, 시계 문구) | `packages/features/src/3d/ui/simulation-scenario-select.tsx`, `packages/features/src/3d/ui/scene-simulation-badge.tsx`, `packages/features/src/3d/lib/sim-clock.ts` |
| 3D 플레이 우측 패널(리포트 | 시나리오 탭) / 편집본 수명 / 시나리오 패널·행·선택 다이얼로그 / 순수 로직 | `packages/widgets/src/scenario/ui/{play3d-side-panel,scenario-panel,scenario-tag-row,scenario-tag-settings,scenario-pick-dialog}.tsx`, `packages/widgets/src/scenario/model/use-scenario-draft.ts`, `packages/widgets/src/scenario/lib/{scenario-rows,scenario-pick,pick-selection}.ts`(테스트 대상) |
| 태그 페이지(실시간 태그) / 서브라우트 | `packages/widgets/src/tags/ui/tags-page.tsx`, `packages/widgets/src/tags/lib/tags-route.ts`(`matchTagsSubRoute`·`realtimeTagsPath`, 테스트 대상) |
| 실시간 태그 피드 — STOMP 래퍼 / 스냅샷 방어·REST / 스토어·피드 훅·관측치 / 태그 페이지 UI | `packages/core/src/ws/stomp-client.ts`(`craneStompClient`), `packages/domain/src/monitoring/lib/crane-snapshot.ts`, `packages/domain/src/monitoring/api/get-crane-snapshots.ts`, `packages/features/src/3d/model/use-crane-snapshot-store.ts`, `packages/features/src/3d/model/use-crane-snapshot-feed.ts`, `packages/features/src/3d/lib/crane-snapshot-stats.ts`, `packages/widgets/src/tags/ui/realtime-tags-view.tsx` |
| 실시간 태그 표 헬퍼(행 구성·분류·불리언 표기 / 구역 칩·크레인 필터 / 시계·숫자 표기 / 상태 점·구역 칩 UI) — 태그 페이지와 태그 연결 다이얼로그가 같이 쓴다 | `packages/features/src/3d/lib/tag-rows.ts`, `packages/features/src/3d/lib/crane-filter.ts`, `packages/features/src/3d/lib/format-clock.ts`(셋 다 테스트 대상), `packages/features/src/3d/ui/{crane-live-dot,bay-chip}.tsx`, 벽시계 틱 `packages/core/src/lib/use-now.ts` |
| 리깅 스키마(관절·구속조건) / 방어 | `packages/domain/src/3d/model/rig-types.ts`, `packages/domain/src/3d/lib/sanitize-rig.ts` |
| 블록 운반 — 훅 스키마·방어 / 순수 계산 / 런타임·상태 / 케이블 레이어 / 키프레임 패턴 | `SavedModelHook`·`carriable`(`types.ts`), `packages/domain/src/3d/lib/sanitize-model-hooks.ts`, `packages/features/src/3d/lib/scene-carry.ts`, `model/{scene-carry-runtime,scene-carry-state}.ts`, `ui/scene-carry-layer.tsx`, `packages/domain/src/virtual-tag/lib/tag-pattern.ts`(`evaluateKeyframes`) |
| 리깅 런타임(값 저장소·드라이버·readout) | `packages/features/src/3d/model/rig-value-store.ts`, `packages/features/src/3d/model/use-rig-driver.ts`, `packages/features/src/3d/model/rig-live-readouts.ts` |
| 관절 적용 / 스무딩 / rest 캐시 / 노드 경로 | `packages/features/src/3d/lib/apply-joint.ts`, `packages/features/src/3d/lib/smooth-damp.ts`, `packages/domain/src/3d/lib/rest-pose-cache.ts`, `packages/domain/src/3d/lib/mesh-path.ts` |
| 리깅 편집 UI(인스펙터 탭·계층 노드 트리) | `packages/widgets/src/3d/ui/rigging-section.tsx`, `packages/widgets/src/3d/lib/model-node-tree.ts` |

## 동작

### 태그 맵핑 `tagMappings[]`

모델 인스턴스 필드. "태그 값 하나 → 트랜스폼 채널 하나" 의 목록이다.

- 대상은 두 종류다. `{kind:'node', node, channel:position|rotation|scale, axis}` — `node: ''` 는 모델 루트. `{kind:'joint', jointId}` — 할당된 리그의 관절.
- 태그는 **코드 하나**(`code`)로 참조한다. 버스 키 `${craneId}.${code}` 는 저장하지 않고 `resolveMappingTagKey(model, mapping)` 이 모델의 `craneId` 로 조립한다(`buildCraneTagKey`). 크레인이 없는 모델의 맵핑은 키가 없어 어느 소스에서도 값을 받지 않는다 — 인스펙터·시나리오 패널이 amber 로 알린다. 코드는 `normalizeTagCode` 를 지난다(trim, 공백·점·콜론 금지, 비면 sanitize 가 맵핑을 버린다).
- 맵핑의 `craneId` 는 보존용 덮어쓰기다 — 레거시 키의 접두어가 모델 `craneId` 와 달랐을 때만 남고 편집 UI 가 없다. 배포 씬에는 없다.
- 적용 공식은 `offset + value × scale` 을 **rest 기준 Δ** 로 더하는 것. 루트의 rest 는 씬 배치 transform, 내부 노드는 GLTF rest 다.
- 같은 대상 중복은 sanitize 가 첫 항목만 남기고(first-wins), 리그 관절이 점유한 노드·축은 드라이버가 관절을 우선한다. 편집 UI 는 둘 다 amber 로 경고한다(`tag-mapping-editor.ts`). 맵핑 카드 머리줄의 순번(# 1, # 2 …)은 배열 순서라 이 first-wins 순서와 같다. 순번은 저장하지 않는다.
- 키의 구분자는 점(`C_171.tl_distance`) — ISL TagKey 표기와 같다. 레거시 키 필드 `realtimeTagKey`·`virtualTagKey`·`tagKey`(점·콜론 표기 모두)는 `parseTagKeyRef` 가 `{ craneKey, code }` 로 가르고(우선순위 `code` › `realtimeTagKey` › `virtualTagKey` › `tagKey`), `valueMapList`(루트 6칸 절대 대입)·`rigBindings`(관절 바인딩)도 같은 모양의 코드+접두어 맵핑으로 변환한다. 절대 좌표 → Δ 변환은 `offset' = offset − placement[axis]` 이며 테스트가 좌표 동일성을 고정한다. 레거시 필드는 전부 저장본에서 사라진다(`valueMapList`·`rigBindings` 는 타입에 `@deprecated` 입력 전용).
- 접두어는 모델 단위로 정리한다 — `finalizeModelTagKeys(modelCraneId, mappings, statusEntries)`: 모델에 `craneId` 가 없고 맵핑·상태 태그의 접두어가 하나뿐이면 그 접두어를 `craneId` 로 채우고, 접두어가 모델 `craneId` 와 같으면(`normalizeCraneKey` 비교, `GC-04` ≡ `GC_04`) 맵핑 `craneId` 를 떼고, 다르면 맵핑 `craneId` 로 남긴다. 상태 태그는 접두어가 다르면 버린다(console.warn). `sanitize-scene-info.ts` 의 모델 루프가 `craneId`·`tagMappings`·`statusTags` 를 리터럴 앞에서 함께 계산한다.

### 라벨의 태그 값 줄

맵핑 카드의 "라벨에 표시"(`TagMapping.showOnLabel`, true 만 저장)를 켜면 모델 라벨의 상자 위에 그 태그 값이 한 줄로 붙는다. 여러 개면 위쪽으로 쌓이고 첫 맵핑이 상자에 가장 가깝다. 상자는 값 줄 수와 무관하게 제자리에 있다. 짧은 이름(`caption`)을 넣으면 값 앞에 붙고, 표시를 꺼도 이름은 보존한다.

- 값은 scale·offset 을 거치지 않은 **태그 원시값**이다. 화면 구성(배치·맵핑 계수)이 틀려도 숫자는 PLC 와 같아야 한다.
- 라벨은 domain 이라 값 버스를 모른다. features·widgets 가 목록(`buildLabelReadings(model)` — 키는 모델 `craneId` 로 조립, 크레인이 없는 모델은 줄도 없다)과 읽기 함수(`readTagLiveValue`)를 `GltfModel` prop 으로 넘기고, 라벨은 `useFrame` 에서 표기가 바뀔 때만 DOM 에 쓴다.
- 목록은 모델마다 참조를 고정해 넘긴다 — 아니면 memo 된 `GltfModel` 이 렌더마다 다시 그려진다.
- 모양은 ACMS 매뉴얼의 GC 원점 거리 그대로 상자 없는 청록색 숫자다. 단위는 붙이지 않는다.
- 라벨을 숨긴 모델(`labelHidden`)·이름이 빈 모델은 값 줄도 없다.

### 상태 태그 `statusTags`

모델 인스턴스 필드. "상태 역할 하나 ← 태그 코드 하나" 의 객체(`ModelStatusTags = Partial<Record<StatusTagRole, string>>`)이고 역할은 `STATUS_TAG_ROLES` 다. 노드를 움직이지 않는다. 역할은 그리는 곳으로 두 묶음이다 — 라벨 묶음 `LABEL_STATUS_TAG_ROLES`(운전 전원·고장·Bypass·Free Swing)은 라벨의 색·아이콘을, 외곽선 묶음 `OUTLINE_STATUS_TAG_ROLES`(통신불량·Slowdown·Endstop)은 장비 외곽선을 정한다. Bypass·Free Swing·Slowdown·Endstop 은 화면 문구도 언어와 무관하게 영어다.

- 역할 값은 코드이고 키는 맵핑과 같은 규칙으로 모델 `craneId` 에서 조립한다 — 런타임은 `resolveStatusTagKeys(model)` 로 역할 → 키(`ResolvedStatusTagKeys`)를 풀어 판정한다. 값은 0/1 숫자이고 on 문턱·판정 우선순위는 `docs/agents/3d-play.md` 의 "장비 운전 상태 · 라벨 표시 상태 · 외곽선".
- 통신불량은 장비 PLC 와 연계 PLC 사이 통신이 끊겼다는 비트다. 서버는 값을 계속 주지만 그 값이 장비의 지금 상태가 아니다. 연결하지 않으면 회색 외곽선은 수신 끊김에서만 나온다.
- Slowdown·Endstop 은 역할마다 코드 하나를 따로 잇는다.
- 연결하지 않은 역할은 필드가 없고, 연결된 역할이 없으면 `statusTags` 가 빠진다. sanitize 는 모르는 역할·빈 코드를 버리고 역할 순서를 고정한다. 점·콜론이 든 문자열은 레거시 키로 읽어 접두어를 모델 단위로 검사한다(위 `finalizeModelTagKeys`).
- 편집은 인스펙터 "태그 매핑" 탭의 목록 아래 구역이다(`tag-mapping-section.tsx` 의 `StatusTagRows`). 묶음마다 작은 제목 아래에 역할 카드가 쌓이고, 움직임 카드는 라벨 묶음 끝에 있다. 역할마다 카드 하나 — 머리줄에 역할 이름과 미리보기 값, 아래에 태그 줄(`TagCodeField`, 맵핑 카드와 같다). 연결된 역할은 카드 테두리를 강조한다. 카드 위 한 줄에는 지금 라벨·외곽선이 그려지는 모양을 글자로 적은 줄(왼쪽, `describeLabelState`)과 미리보기 초기화 버튼(오른쪽, 항상 보인다)이 있다. 편집 채널은 `updateSelectedStatusTags` 로 `tagMappings` 와 같은 규칙(같은 참조 = no-op — `status-tag-editor.ts` 의 `setStatusTagCode`)이다.
- 탭의 두 구역은 화면에서 "트랜스폼"(맵핑 목록)·"상태"(상태 태그)라고 부른다. 각각 접고 펼 수 있고 접힌 채 연다(`inspector-fields.tsx` 의 `CollapsibleSection`, 열림 상태는 탭이 가진다). 제목 옆 개수가 접힌 구역의 내용 유무를 알리고, 내용은 열려 있을 때만 마운트한다.
- **미리보기**: 역할마다, 그리고 움직임에 값(없음·Off·On)을 고르면 에디터 캔버스의 그 모델 라벨과 외곽선이 고른 값으로 바로 그려진다. 에디터에는 값 생산자가 없어 연결만으로는 라벨이 늘 상태 미확인이고 외곽선이 없기 때문이다. 태그 연결 여부와 무관하고, 판정은 실제 값과 같은 우선순위를 탄다(`resolvePreviewLabelState`·`resolvePreviewOutlineState`). 값은 세션 스토어 `useLabelPreviewStore` 에 있고 대상은 한 번에 모델 하나다.
  - 미리보기 대상은 선택된 모델이라 외곽선이 선택 테두리와 같은 자리에 온다. 외곽선이 있는 동안은 모델 전체의 선택 테두리를 그리지 않고 상태 외곽선이 그 자리를 맡는다(`gltf-model.tsx`). 안쪽 노드 선택은 둘 다 그린다.
- 시뮬레이션에서 확인하려면 시나리오에 그 상태 코드를 넣는다 — 새 태그 기본값이 불리언(0/1, 수동이면 토글)이다. 실시간·리플레이는 서버 비트(`crane_control_on`·`crane_system_error`·`accs_bypass_on` 등)를 읽는다.

### 인스펙터의 크레인 칸 `CraneIdField`

"태그 매핑" 탭 맨 위다. 모델 `craneId` 가 맵핑·상태 태그 키의 접두어이자 서버·리플레이 데이터의 크레인이라 여기서 고른다.

- `@crane/ui/molecules/combobox`(검색 가능, 자유 입력 없음)로 **서버가 주는 크레인**에서만 고른다 — 원천은 크레인 스냅샷 스토어(`useCraneSnapshotStore` 의 `order`·`cranes`, 아래 "실시간 태그 피드")이고 탭이 열려 있는 동안 칸이 `useCraneSnapshotFeed(true)` 로 피드를 켠다(태그 연결 다이얼로그와 같은 클라이언트를 세어 쓴다, 브리지가 없어 버스로는 가지 않는다). 옵션은 `buildCraneIdOptions(order, cranes)` — value·label 은 서버 ID 그대로, description 은 구역(bay), 서버가 `online=false` 로 주는 크레인은 "오프라인" 배지를 달되 고를 수 있다. 정렬은 스토어 순서(ID 순). 콤보박스에 비우기가 없어 옆 × 가 `updateSelectedCraneId(undefined)` 로 비운다.
- 목록이 비면 `craneListEmptyReason(connection, loadError)` 로 이유를 가른다 — 연결 중 / 끊김·해제 / 초기 조회 실패 / 아직 받은 크레인 없음. 서버가 없는 환경에서는 고를 크레인이 없고 저장값은 그대로 보인다.
- 서버에 없는 값(philly 의 `GC_04`·`LLC_002` 등)은 `renderValue(null)` 로 raw 값을 amber "서버에 없음" 으로 보이고 `invalid` 다 — 동작은 그대로이고 사용자가 다시 고르기 전까지 지우지 않는다.
- 크레인이 없는데 맵핑·상태 태그가 있으면 칸 아래 amber 한 줄(키를 만들 수 없음).
- 편집 채널 `updateSelectedCraneId(craneId | undefined)` 는 다른 필드와 같은 규칙(같은 값 = no-op)이고 `scene-snapshot.ts` 가 `craneId` 를 비교한다.

### 태그 줄 `TagCodeField` · 태그 연결 다이얼로그 `tag-pick-dialog.tsx`

- **태그 줄**: 코드 칸(누르면 다이얼로그) + 안쪽 끝의 ×(코드 비움). 툴팁에 조립된 키, 크레인이 없으면 amber 아이콘. 칩(`describeCodeChip(code, craneId)`)은 좁은 인스펙터에서 코드가 가운데에서 줄어 끝 글자(`splitChipTail` — `_2` 같은 번호)가 남는다.
- **다이얼로그**: shadcn `Dialog`(`@crane/ui/molecules/dialog`, 포털 규약 `usePortalContainer`·`z-9999`). 머리줄은 "태그 연결 · 크레인 {craneId}" 와 닫기 — 크레인은 **모델의 `craneId` 로 고정**이고 탭이 없다. 본문은 열려 있을 때만 마운트해 열 때마다 초안이 `value` 로 돌아온다. 검색창은 팔레트·태그 페이지와 같은 `SearchField`.
- 본문: 검색 › 그 크레인의 서버 태그 목록(머리글 "이름 · 현재 값", 분류 묶음 `TAG_CATEGORIES`, 현재 값·단위, 불리언은 태그 페이지와 같은 글자 — `buildTagRows`·`filterPickTags`) › 미리보기(큰 현재 값, 최근 60초 스파크라인, 데이터 형식·분류·구역). 서버 항목은 `findSnapshotEntry(cranes, craneId)`(`normalizeCraneKey` 비교). 데이터는 다이얼로그 본문이 켠 `useCraneSnapshotFeed(true)`(REST 전체 + STOMP) — 에디터에는 다른 참조자가 없어 닫으면 소켓이 닫히고, 브리지가 없어 버스로는 가지 않는다(모델이 움직이지 않는다).
- 행을 누르면 코드가 초안이 되고 선택 강조·미리보기는 초안을 되읽는다. 하단에 초안과 조립될 키(`크레인키.코드`)를 보이고 "연결"(`onApply(code)`)은 초안이 `value` 와 다를 때만 산다. 초안이 서버 목록에 없으면(서버에 없는 코드를 연결해 둔 씬) 안내만 하고 그대로 둔다.
- 크레인이 없는 모델은 안내만 보이고 연결할 수 없다. 서버에 그 크레인이 없으면(philly 의 `GC_04` 등) 안내를 보이고 목록이 빈다.
- **최근 60초**(`model/use-tag-value-history.ts`): 고른 태그가 바뀌면 `getCraneHistory`(1초 간격, 60초)로 채우고 스냅샷 스토어 구독으로 뒤에 붙인다(`lib/tag-history.ts` `appendSample` 이 창 밖을 버린다). 조회가 실패하면 라이브 표본만 쌓인다. 그리기는 `tag-sparkline.tsx`.

### 값 흐름

생산자(시나리오 러너 / WebSocket 러너 / 리플레이) → `publishTagValue(key, v, { source, smoothTime })`(`tag-value-bus.ts`, 표시용 `tagLiveValues` 캐시) → **활성 소스 게이트** → `useTagBindingSource(sceneInfo, enabled)` 가 건 `createTagBindingSource(resolve)` — 인덱스(`buildTagMappingIndex(sceneInfo)`)는 모델마다 `resolveMappingTagKey` 로 만들고 크레인 없는 모델은 건너뛴다 → `rigValueStore`(smooth) → `useRigDriver`(Canvas 안 `RigDriver`) 가 매 프레임 노드별로 rest 로 되돌린 뒤 채널 Δ 를 누적한다(`apply-channel.ts`).

- **소스 게이트**: `TagSourceId = 'realtime' | 'replay' | 'simulation'`. 화면이 `useActiveTagSource(resolveActiveTagSource(mode, play3dSource))` 로 건다 — 실시간 → realtime, 3D 플레이 리플레이 소스 → replay, 시뮬레이션 소스 → simulation, 모드 없는 화면(에디터)은 `EDITOR_TAG_SOURCE`(realtime). 훅은 `setActiveTagSource(source)` 를 걸고 바뀔 때 `rigValueStore.reset()`, 언마운트에 `null`. 버스는 활성 소스가 있으면 `options.source` 가 다른(없는 것 포함) publish 를 캐시·ingest·관찰자 전부에서 버리고, 소스가 바뀌면 `tagLiveValues.clear()` 한다. 활성 `null` 이면 전부 통과한다. 자식 effect 가 먼저 돌아 `Play3dView`(부모)의 이탈 정리 `seekTo(0)`(replay 소스 publish)는 게이트가 버린다 — 테스트로 고정.
- 생산자의 소스: `use-realtime-runner.ts` 의 `REALTIME_SOURCE`, `use-replay-player-store.ts` 의 `REPLAY_SOURCE`·`PUBLISH_IMMEDIATE`, 시나리오 러너는 `publishSimulation` 래퍼(`setManualValue` 포함, `setPublish(null)` 도 래퍼로 복귀).
- 키를 쓰는 소비자: 바인딩 인덱스·`collectSceneTagKeys`(3D 플레이 통계·리포트의 "맵핑 없음"), 운전 상태·라벨·외곽선 판정 키(`collectModelTagKeys(model)`·`collectModelStatusKeys(model)` → `useModelStatusRecords(sceneInfo)`), 라벨 값 줄(`buildLabelReadings(model)`). 전부 모델 하나를 받고 소스를 모른다.
- 버스는 숫자 전용이다. WebSocket 브리지와 리플레이 스토어는 서버 값을 `toTagNumber` 로 바꿔 싣고 키는 `buildCraneTagKey` 로 만든다 — boolean 과 `'true'`/`'false'` 문자열은 1/0, 그 밖의 문자열·null 은 버린다.
- 바인딩은 모니터링 뷰·에디터 모두 화면이 떠 있는 동안 항상 켜 두고 언마운트 시 값 저장소를 비운다.
- 재생 토글(3D 플레이 트랜스포트 바)은 러너 틱만 켜고 끈다. 일시정지하면 노드가 마지막 값에 머물고, 초기값 복귀는 리셋 버튼이 한다.
- 기즈모 드래그 중엔 루트 맵핑을 건너뛴다. 드래그 종료 프레임의 루트 rest handoff 는 `docs/agents/3d-editor.md`.
- publish 옵션 `smoothTime`(`TagPublishOptions`): 생략은 기본 스무딩, 0 은 즉시 대입. 시나리오 러너의 정상 전진은 publish 벽시계 간격(`tickMs / speed`)을 넣어 스텝 계단을 숨기고(화면 지연은 씬 시간 한 스텝), 리플레이 `tick` 은 들어가는 프레임 길이 ÷ 배속을(`lib/replay-smoothing.ts`, `docs/agents/3d-play.md`), 실시간 러너는 키별 값 변화 간격을 넣고(아래 "실시간 태그 피드"), 러너 seek·리셋과 리플레이 seek 는 0 으로 내보낸다. 소비자 `createTagBindingSource` 가 `tagSetOptions` 로 값 저장소 set 옵션으로 바꾼다. 관찰자에게는 전달하지 않는다. 값 저장소 set 은 같은 target 이 와도 `smoothTime` 을 덮어쓴다 — 재발행하는 생산자는 같은 값을 넘길 것.
- 버스 관찰자 `subscribeTagValues` 는 소비자와 별개의 다중 구독이다(3D 플레이 통계 등이 쓴다 — `docs/agents/3d-play.md`). 게이트는 관찰자에도 적용된다.
- 값 저장소의 set/reset/restore 와 스무딩 잔여는 프레임 요청·그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

### 태그 페이지

실시간 태그(서버 스냅샷)만 있다 — 크레인 목록 › 크레인 상세. 상세는 URL 이 든다(`lib/tags-route.ts` — `tags` 목록, `tags/{craneId}` 상세, 그 밖의 깊이는 태그 페이지가 아니다; 경로 조립은 `realtimeTagsPath`). 마운트가 곧 STOMP 구독이다. 시뮬레이션(시나리오)은 여기 없고 3D 플레이의 시나리오 탭에 있다.

### 실시간 태그 피드(크레인 스냅샷 서버)

crane-integrated-server(Kafka → Redis → STOMP)가 내보내는 크레인별 현재 상태를 받아 태그 페이지가 보여 주고, 3D 모니터링 실시간 모드(`mode='realtime'`)의 값 생산자이기도 하다.

- 전송: `@crane/core/ws` 의 `StompClient`(`@stomp/stompjs` 래퍼). 엔드포인트는 `getStompWebSocketUrl()`(WebSocket 베이스 `/ws` 자체, SockJS 없음). `craneStompClient` 하나를 acquire/release 로 나눠 쓰고, 목적지 구독은 연결 전에 걸어도 CONNECTED 마다 다시 건다. 같은 핸들러 함수를 여러 화면이 넘겨도 등록 횟수로 세어 마지막 등록이 빠질 때만 브로커 구독을 끊는다 — 피드 훅은 모듈 전역 `applyBatch` 하나를 넘기므로, 태그 페이지와 3D 실시간 브리지가 겹쳐 있다가 한쪽이 먼저 빠져도 남은 쪽의 수신이 끊기지 않는다. 재연결은 stompjs 지수 백오프이고, 사용자가 끊은 것(`disconnect`)과 서버 쪽 끊김은 `isActive()` 로 가른다.
- 데이터: `CraneSnapshot`(`@crane/domain/monitoring`) — craneId · bay · online · `tags{code → {value, quality, timestamp}}`. `/topic/cranes` 봉투(`type: 'snapshot'`)에는 push 주기 동안 바뀐 크레인만 실리므로 피드를 켤 때 `GET /api/cranes`(`getCraneSnapshots`)로 전체를 받는다. stompjs 자동 재연결 뒤에는 다시 받지 않는다 — 살아 있는 크레인은 heartbeat 로 다음 묶음에 실려 오지만, 끊긴 동안 offline 으로 바뀐 크레인의 전이는 놓칠 수 있다. 모양이 깨진 태그 항목은 `sanitizeCraneSnapshot` 이 버린다.
- 스토어: `useCraneSnapshotStore` — craneId → `CraneSnapshotEntry`(스냅샷 + 수신 시각 + heartbeat 가 마지막으로 뒤집힌 시각 + 태그별 변경 시각·횟수·관측 범위). 묶음마다 바뀐 크레인 항목만 새 참조라 카드는 자기 크레인만 구독한다. 연결이 끊겨도 값은 마지막 상태로 남는다.
- 피드: `useCraneSnapshotFeed(enabled)` 가 구독·REST·참조를 맡고(마운트 = 구독), 연결 표시는 `useCraneFeedConnection()`(useSyncExternalStore). 태그 페이지의 연결 해제(툴바 톱니 → 연결 설정 팝업: 호스트 주소 `getCraneFeedUrl()` · 상태 · 연결 해제/연결 버튼)는 그 화면의 구독만 놓는다 — 같은 클라이언트를 다른 화면이 잡고 있으면 소켓은 열린 채다.
- 3D 실시간 모드: `useCraneSnapshotRealtimeBridge(enabled)`(`packages/features/src/3d/model/use-crane-snapshot-realtime-bridge.ts`, `OutdoorWorkModelSimulation` 이 `mode === 'realtime'` 로 켠다)가 피드를 켜고, 스토어에 새 스냅샷이 들어온 크레인의 태그 **전부**를 `${craneId}.${tagCode}` 키로 `useRealtimeStore` 버퍼에 쌓는다 — 바뀐 태그만 쌓지 않는다. 묶음에는 바뀐 크레인만 실리고 `heartbeat` 가 매초 뒤집히므로 살아 있는 크레인은 매초 재발행되어 `tagLiveValues.at` 가 갱신되고(정지 중 ↔ 두절 판정, `lib/model-runtime-status.ts`), 죽은 크레인은 묶음에서 빠져 at 이 멈춘다. 켤 때와 보류(held) 해제 때는 스토어의 스냅샷 전부를 한 번 쌓는다. 보류(`scene-collision-hold.ts`)는 그대로이고 관제 HUD 의 수신 줄(`lib/feed-freshness.ts`)은 `craneStompClient` 상태와 스토어의 마지막 묶음 수신 시각을 본다.
- 러너(`useRealtimeRunner`)의 publish 스무딩 시간은 **키별 값 변화 간격**이다(`lib/realtime-smoothing.ts` 의 `createRealtimeCadenceTracker`·`resolveRealtimeSmoothTime`, 하한 `REALTIME_SMOOTH_MIN_S`·상한 `REALTIME_SMOOTH_MAX_S`). 1초마다 바뀌는 값은 1초 동안 미끄러져 다음 값에 닿아 연속 운동으로 보인다 — 기본 0.35초로 내보내면 0.35초 돌고 나머지를 서 있는 "휙휙" 이 된다(시나리오 러너와 같은 규칙, 화면 지연은 한 수신 간격). 간격은 publish 가 아니라 값의 변화 사이로 잰다 — 브리지가 스냅샷의 태그 전부를 재발행하므로 publish 간격은 묶음 주기(heartbeat 1초, 실물은 250ms 까지)로 수렴해 그 태그의 변화 주기를 말해 주지 않는다. 바뀌지 않은 재발행은 마지막 스무딩 시간을 이어받고, 첫 값과 그 재발행은 기본, 오래 멈춘 뒤 첫 변화는 상한이다. 간격 표는 러너 전용이며(버스 캐시 `tagLiveValues.changedAt` 은 소스 전환 때 비워지는 표시 캐시라 쓰지 않는다) 시작·정지 때 비우고, 보류 중 버린 값은 재지 않는다.
- 상태 점: `resolveCraneLiveState` — 서버 `online=false` 나 연결 없음은 off(회색), `heartbeat` 가 `HEARTBEAT_STALE_MS` 안에 뒤집혔으면 live(초록 맥동), 값은 오는데 안 뒤집히면 stale(노랑). 첫 수신 직후엔 수신 시각을 기준으로 삼는다.
- 표시명·단위·묶음은 `getMonitoringTagMetadata`(영문) 그대로. 묶음 안 정렬은 코드의 숫자 인식 사전순이고 시각 태그만 큰 단위 → 작은 단위(`tag-rows.ts`).
- dev 는 `apps/shell/.env.local` 의 `VITE_DEV_PROXY_TARGET_HTTP/WS`(서버 `http://localhost:8080`)로 `/crane_rnd/{api,ws}` 를 프록시한다. 운영은 nginx 가 같은 경로를 `BACKEND_HOST:PORT` 로 보내고, 서버 쪽 `cis.web.allowed-origins` 에 셸 주소가 있어야 한다.

### 시뮬레이션 시나리오 `@crane/domain/virtual-tag`

서버 없이 태그 값을 만드는 정의다. 씬에 **이미 맵핑된 모델·태그** 중에서 고른 것에 값·동작(수동·파형·토글)을 붙인 묶음이 시나리오이고, 시나리오에 없는 태그는 값이 나가지 않는다(노드 rest). 슬라이스 이름은 `virtual-tag` 그대로다.

- 시나리오 `SimulationScenario{ id, name, sceneFile, tags[] }` — **씬 파일 단위**(`sceneFile`, region → 파일은 `getSceneFileNameByRegionId`)라 okpo.json 을 쓰는 region 들이 같은 시나리오를 본다. 태그 `ScenarioTag = VirtualTagDefinition + modelId` — `code` 는 그 모델의 맵핑·상태 태그 코드다. 키는 저장하지 않고 재생 때 그 씬의 모델 `craneId` 로 조립한다(`collectScenarioEntries(scenario, sceneInfo)` → `VirtualTagEntry{ key, tag, modelId, modelName, craneId }`, 코드가 모델 맵핑에 있으면 그 맵핑의 `craneId` 덮어쓰기를 존중) — 에디터에서 모델의 크레인을 바꾸면 시나리오가 따라온다. 건너뛴 태그는 `issues[]`(`model-missing` | `crane-missing` | `duplicate-key`)로 돌려줘 패널이 amber 로 보인다.
- 값 정의 `VirtualTagDefinition` = `code` · `name`(비워 둔다 — 표시는 맵핑 대상) · `dataType`(number|bool) · `unit` · 범위·`initial` · `pattern`(manual|sine|sawtooth|square, 주기 `periodSec` / keyframes, 점 `points` — 아래 블록 운반). 옛 `triangle` 은 사인파와 거의 같아 없앴고 sanitize 가 같은 주기의 sine 으로 읽는다. 불리언은 범위 0~1·초기값 0/1 로 강제하고 패턴은 manual·square·keyframes 만, 단위가 없다(sanitize). 버스는 숫자 전용이라 0/1 로 나가고 표시만 ON/OFF 배지다. 코드는 `normalizeVirtualTagCode`(공백·점·콜론 금지).
- 초 단위 값(`tickSec`·`periodSec`)은 sanitize 가 ms 해상도(`VIRTUAL_TAG_SECONDS_DECIMALS`)로 반올림한다 — 부동소수 잡음이 dirty 를 만들지 않게. 러너 시계는 ms 라 스토어 `runnerConfig` 가 `tickSec` 을 정수 ms 로 바꿔 넘기고, `tag-pattern.ts` 가 `periodSec` 을 ms 로 바꿔 계산한다.
- 세트 `ScenarioSet{ version: 1, tickSec, scenarios[] }`. 상한 `SCENARIOS_MAX`·`SCENARIO_NAME_MAX`·`SCENARIO_TAGS_MAX`. `sanitizeScenarioSet` — 시나리오 id 중복은 뒤를 버리고, 이름은 trim·길이 제한·비면 id, `sceneFile` 없으면 버리고, 태그는 `(modelId, code)` 중복(`scenarioTagKey`)을 뒤부터 버린다. 옛 포맷(`equipments`·평탄 키 목록)은 읽지 않는다 — tick 만 살린 빈 세트가 된다.
- 전역 스토어 `useScenarioStore`: `scenarios` · `activeScenarioId`(세션) · `sceneInfo`/`sceneFile`(`attachScene(sceneInfo, sceneFile)` — 3D 플레이 뷰가 넣고 언마운트에 null) · 파생 `entries`·`issues`(활성 시나리오 × 씬, `commit` 한 곳에서 다시 만들고 러너에 `syncDefinitions`) · `tickSec` · `speed` · `hasSession` · `isRunning`. 액션 — `setActiveScenario`(재생 중이면 pause + 시간 0), `addScenario({ name, sceneFile, tags })`·`renameScenario`·`removeScenario`(활성이면 같은 씬의 다음 것)·`duplicateScenario`, `addTags`(중복 `(modelId, code)` 건너뜀)·`editTags({ add, removeKeys })`(키로 지우고 넣기를 commit 한 번에 — 남는 태그 정의는 그대로, 바뀐 것이 없으면 참조 유지)·`updateTag`·`removeModelTags`, `start`(활성 시나리오가 없거나 엔트리가 비면 no-op)·`pause`·`stop`·`setSpeed`·`seek`. 편집은 메모리에만 쌓이고 `save()` 가 기록한다. 같은 내용 재설정은 같은 참조(no-op).
- 영속화는 씬과 같은 규칙(`scenario-storage.ts`). dev 는 `POST /__dev/scenarios` 로 배포 파일 `apps/shell/public/simulation/scenarios.json` 에 기록하며 이 파일이 클론·배포의 기준값이라 커밋한다. 운영은 localStorage `crane:scenarios` 에 배포 해시 도장(`baseVersion`)과 함께 봉투로 저장하고, 새 배포가 나오면 배포본이 이긴다. API 경로 문자열은 `vite.config.ts`(`DEV_SCENARIOS_API_PATH`·`SCENARIOS_PUBLIC_FILE`)와 `scenario-storage.ts` 두 곳에 있다 — `docs/agents/3d-editor.md`.
- 새 태그 기본값 `createScenarioTagDefaults(code)`(`lib/scenario-defaults.ts`): 상태 태그 역할 → `bool`·초기값 0·수동, 맵핑 코드 → `number`·단위는 `getMonitoringTagMetadata(code).unit`·범위 `SCENARIO_NUMBER_DEFAULT_RANGE`·초기값 0·수동. 사용자가 행에서 고친다.
- 러너 `virtualTagRuntime`(모듈 전역 `setInterval`, Canvas 불필요)은 상태를 **키** 기준으로 들고 틱마다 엔트리를 `source: 'simulation'` 으로 버스에 내보낸다. 정의의 범위·초기값·패턴·형식이 바뀌면 그 키의 상태를 initial 로 다시 잡고, 이름·단위만 바뀌면 유지한다.
- 재생을 켜는 곳: 3D 플레이(`mode='play3d'`, 소스 시뮬레이션)의 상단 트랜스포트 바 ▶ 다(자동 재생 없음). 실시간 페이지(`mode='realtime'`)에는 시뮬레이션 UI 가 없다. 시나리오 패널에는 재생 버튼이 없다 — 값 조작과 정의 편집만.
- 배포 시나리오: `scenarios.json` 의 "기본"(philly-2dock.json) — GC_04 3·LLC_002 4 태그가 그 씬의 모델에 `modelId + code` 로 붙어 있다.

### 3D 플레이 우측 "시나리오" 탭 `@crane/widgets/scenario`

- `Play3dSidePanel`: "리포트 | 시나리오" 탭(role=tablist 버튼, 소스 탭과 같은 모양). 시나리오 탭은 시뮬레이션 소스에서만 보이고 리플레이로 바꾸면 리포트로 돌아간다. 앱의 `replay-monitoring-view.tsx`(실외·실내) 가 `ResizablePanelGroup` 우측에 둔다(`docs/agents/3d-play.md`). 시나리오 편집본의 수명은 탭이 아니라 이 패널의 `useScenarioDraft`(`model/use-scenario-draft.ts`) 가 든다 — 로드, 저장(토스트·재시도), 미저장 이탈 가드·Ctrl+S(씬 편집 훅 `useSceneUnsavedChangesGuard`·`SceneUnsavedChangesDialog` 그대로), 언마운트 `discard()`. 그래서 리포트 탭·리플레이 소스로 갔다 와도 편집본이 남고, 3D 플레이 페이지를 떠날 때만 묻고 폐기한다. `ScenarioPanel` 은 `isDirty`·`isSaving`·`onSave` 를 prop 으로 받아 저장 버튼만 그린다.
- `ScenarioPanel`: 머리줄(새 시나리오(맨 왼쪽) · 현재 씬 파일의 시나리오 `<select>` · 이름 수정(연필 — 누르면 선택 상자 자리가 이름 입력이 된다: `useImeSafeBlur` 로 blur/Enter 확정, Escape 취소, 거부되면 amber + 포커스 유지) · 복제 · 삭제(확인창) · 저장(미저장이면 아이콘 우측 위 붉은 점·저장 중 스피너)), 설정 줄(갱신 주기(초) · 크레인 추가(+ 아이콘, 툴팁·다이얼로그 제목·빈 시나리오 버튼 모두 "크레인 추가" — 시나리오에 없는 맵핑 모델이 없으면 비활성)), 본문은 **모델별 묶음**(`groupScenarioRows` — 시나리오의 태그 순서, 모델은 처음 등장한 순서)이고 접고 펼친다 — 펼침 집합은 패널 상태라 처음·시나리오 전환·탭 재진입에는 전부 접힌 채고, 새로 들어온 모델도 접혀 나타난다. 묶음 머리줄에 chevron · `equipName` · `craneId` · 태그 수 · (묶음 자체가 amber 가 아닌데 issue 행이 있으면 경고 아이콘, `issueCount`) · "태그 수정"(`PencilLine` 아이콘만, 그 모델만 연 edit 다이얼로그) · 묶음 제거(씬에서 사라진 모델·맵핑에서 빠진 코드는 다이얼로그에 안 보여 이 ✕ 로만 뺀다), 아래에 태그 행. 씬에 없는 모델·크레인 없는 모델·키 중복 행은 amber 이고 값 조작이 없다. 바닥 줄은 태그·모델 수와 안내.
- 행 `ScenarioTagRow` 는 한 줄 — 동작 아이콘 · 코드 · 미니 막대 또는 ON/OFF · 값과 단위. 무엇을 둘지는 `resolveRowControl`(수동 숫자는 막대를 끌고 — 막대 위에 겹친 투명 range, 수동 불리언은 ON/OFF 를 누르고, 파형은 보기만, issue·키 없음은 "값 없음"). 맵핑 대상(`Trolley_01 · 위치 x` / `관절 luff` / 역할 이름 / `훅 Upper · 부착`)은 행의 title 이다. 값 자리는 `useRigLivePoll` 로 러너 값을 다시 읽는 하위 컴포넌트라 펼친 정의는 폴링에 다시 그려지지 않는다. 행을 누르면 그 아래 `ScenarioTagSettings` 가 펼쳐진다(패널이 시나리오별 펼친 태그 하나를 든다) — 동작(파형 버튼 `selectablePatternKinds`, 바꾸면 `nextPattern` 으로 파형끼리 주기 유지. 키프레임 버튼은 이미 키프레임인 태그에만 있고 다른 동작에서 키프레임으로는 바꿔 들어가지 않는다 — 점 편집 UI 가 없다)·주기(파형일 때, 옆에 `describePatternSentence` 문장) 또는 길이(키프레임 — `describeKeyframes` 의 점 수·총 길이·반복·가감속 요약)·범위·단위(숫자)·초기값(사인·톱니파만 — `showsInitialValue`, 수동은 막대가 값을 정하고 구형파·키프레임은 초기값을 읽지 않는다)·형식. 코드는 모델 맵핑에서 온 것이라 고치지 않고 행 삭제 버튼은 없다 — 빼는 것은 묶음의 "태그 수정". 값 조작은 `virtualTagRuntime.setManualValue`, 정의 편집은 `updateTag`.
- 선택 다이얼로그 `ScenarioPickDialog` 는 세 모드다. `create`(새 시나리오: 이름 + 맵핑 있는 모델 전부, 빈 선택, 만들기 → `addScenario`), `add`(모델 추가: 시나리오에 태그가 없는 모델만 `filterModelsNotInScenario`, 빈 선택, 추가 → `addTags`), `edit`(태그 수정: 모델 하나, 기존 태그가 체크된 채 펼쳐 열리고 적용 → `editTags`). 나열은 씬에서 맵핑·상태 태그가 있는 모델(`listPickableModels`), 모델 머리글 체크는 그 모델의 태그 전부(일부면 indeterminate), 펼치면 태그마다 코드·대상. 검색은 모델 이름·크레인에 맞으면 코드 전부, 아니면 코드만(`filterPickableModels`). edit 의 확정은 차집합 `diffPickSelection(selected, existing, scopedKeys)` — 범위(그 모델의 키) 안에서 새로 체크한 것은 add, 푼 것은 removeKeys, 범위 밖은 건드리지 않으며 바뀐 것이 없으면 적용 버튼이 비활성이고 바닥 요약에 추가·제거 수를 보인다. 새 태그는 `buildScenarioTags`(모델 순 › 코드 순, 기본값은 `createScenarioTagDefaults`). 체크 집합 규칙은 `pick-selection.ts`.
- 트랜스포트 바 버튼 줄의 시뮬레이션 슬롯에도 시나리오 `<select>`(`simulation-scenario-select.tsx`, 같은 후보)가 있고, 시나리오가 없으면 그 자리가 안내 문구(마우스를 올리면 만드는 법)다. 시뮬레이션 종료는 바의 ▶ 바로 오른쪽 종료 버튼(`transport.stop` → `stopSimulation`)이다. `scene-simulation-badge.tsx` 에는 시나리오 이름을 싣지 않는다(선택 상자에 있다).
- 순수 로직은 `lib/scenario-rows.ts`(묶음·`issueCount`·값 표기·슬라이더 스텝·불리언 판정·노드 잎 이름·행 조작 판정·동작 전환·초기값 줄 여부·주기 문장)·`lib/scenario-pick.ts`(나열·검색·차집합·태그 생성·요약)·`lib/pick-selection.ts` 에 두고 테스트한다. `ui/*.tsx` 에서 계산하지 않는다.

### 시뮬레이션 시계

- 러너(`virtual-tag-runner.ts`)는 벽시계 dt × `speed`(스토어 세션값, 선택지 `SIMULATION_SPEED_OPTIONS`)를 씬 시간으로 누적하고, 값은 `tickMs` 고정 스텝 경계에서만 계산한다(`advanceTo` — 값이 씬 시간의 순수 함수라 목표 시각 직전 경계로 바로 간다) — 같은 씬 시각의 값은 경로·틱 지터와 무관하게 같다. `seek(ms)` 는 0 초 상태에서 ms 직전 경계의 값을 계산해 내보낸다. 정지 중에도 동작하도록 `attachConfig` 로 getter 만 붙여 둔다. 타이머 간격은 `tickMs / speed`(하한 `TIMER_MIN_MS`)라 배속이 높아도 스텝마다 내보낸다.
- `start()` 는 현재 상태값만 내보내고 재계산하지 않는다. 0 초 상태는 전부 initial 이다. seek 는 manual 태그의 슬라이더 값을 유지하고, 리셋은 전부 initial 로 돌린다. 시뮬레이션은 끝이 없는 열린 구간이다 — 3D 플레이 트랜스포트의 `durationMs` 는 항상 null.
- **종료(관제 복귀)** 는 `stop-simulation.ts` 의 `stopSimulation()` 한 곳이다 — 패널 ■·화면 진입/이탈이 전부 이걸 부른다. 내용은 충돌 세션 기록·정지 상태 `clearHistory()` + 스토어 `stop()`(러너 정지·시간 0 — publish 없는 `resetValues(false)`·배속 1) + `rigValueStore.reset()`(rest 복귀) + `tagLiveValues.clear()`(운전 상태 unknown) + 실시간 `release()`. 일시정지(자세 유지)와 다른 경로다.
- 모니터링 `useSceneData` 와 에디터 페이지는 **진입·이탈 모두** `stopSimulation()` 을 불러 화면마다 깨끗한 시뮬레이션으로 시작한다.
- UI: 3D 플레이 트랜스포트 바가 전부다 — 재생·종료·배속·경과·스크럽은 바 공통(종료는 어댑터 `stop`, 시뮬레이션이면 `stopSimulation`), 시나리오 선택만 시뮬레이션 슬롯(`simulation-scenario-select.tsx`). 별도 초기화 버튼은 없다 — 처음으로는 ⏮(seek 0). 재생 위치 이동은 트랜스포트 바의 스크럽 하나다. 경과 시각 문구는 `sim-clock.ts`.
- **시뮬레이션 중 표시** `scene-simulation-badge.tsx` 는 스토어 `hasSession`(start 에 true, stop 에 false, 일시정지 중에도 true)을 본다 — 캔버스 가장자리 하늘색 inset 테두리(재생 진하게·정지 흐리게) + 좌측 상단 배지(맥동 점·배속이 1 이 아니면 배속 — 표시 전용, 조작 버튼 없음). `Monitoring3dView` 좌측 상단 열 첫 항목이고 3D 플레이 시뮬레이션 소스에서만 보인다.

### 블록 운반(크레인 훅 ↔ 운반 가능 모델)

골리앗 같은 크레인이 블록을 집어 옮기는 것을 씬 데이터 + 런타임으로 표현한다. 훅은 GLB 노드이고 블록은 씬의 다른 모델이라, 둘을 잇는 것은 부착 태그 하나다.

- 스키마(`types.ts`): 크레인 모델의 `hooks[]`(`SavedModelHook{ id, label?, nodes[], anchorOffsetY?, attachCode, pickRadius? }`)와 블록 모델의 `carriable: true`. 방어는 `sanitize-model-hooks.ts`(노드 1개 이상·코드 유효해야 항목이 남고, 오프셋 0·반경 무효는 생략), 동등 비교는 `scene-snapshot.ts` 의 `isHookListEqual`. 편집 UI 는 없다 — 씬 JSON 에 적는다(philly-2dock: GC_04 의 `hook-upper`(Trolley_01 로프 둘)·`hook-lower`, Block_001·Block_002 가 운반 가능).
- 훅 앵커는 노드 서브트리의 월드 AABB 바닥(+오프셋), XZ 는 노드들의 평균(`lib/scene-carry.ts`). 훅 블록 높이를 데이터에 적지 않아 새 GLB 버전에서 숫자가 틀어지지 않는다. 측정은 `updateWorldMatrix(true,true)` 뒤에 한다 — useFrame 에서 읽는 matrixWorld 는 한 프레임 전 자세라 배속·저 fps 에서 블록이 훅보다 뒤처져 내려놓을 때마다 높이가 쌓였다.
- 부착 태그 코드는 `collectModelTagCodes` 가 `source: 'hook'` 으로 펴서 시나리오 선택기·행에 "훅 Upper · 부착" 으로 보인다. 기본 정의는 불리언(`createScenarioTagDefaults`).
- 런타임 `model/scene-carry-runtime.ts`(`SceneCarryRuntime.step`): 부착 값 ≥ 0.5 가 되는 프레임에 앵커 `pickRadius`(기본 `DEFAULT_HOOK_PICK_RADIUS`) 안 XZ 최근접 운반 가능 모델(다른 크레인이 든 것·자기 자신 제외)을 붙인다. 블록은 **그 블록을 든 훅들의 앵커 평균** + 오프셋을 따라간다(부모 로컬로 변환) — 같은 크레인의 상부·하부 훅이 함께 들면 탠덤이고 가운데를 따라가며, 드는 훅 수가 바뀌는 프레임(첫 부착·합류·한쪽 분리)에 오프셋을 지금 자리 기준으로 다시 잡아 점프하지 않는다. 마지막 훅이 놓으면 그 자리에 남는다. 어느 훅에도 값이 없으면(소스 꺼짐·다른 시나리오·`stopSimulation` 의 live 캐시 비움) 옮긴 블록을 배치 위치로 되돌린다. 높이는 보지 않는다 — 훅이 블록 위에 내려와 있는지는 작업 순서가 보장한다.
- 상태 `model/scene-carry-state.ts`(`sceneCarryState`, 블록 → 크레인 모델 id + 든 훅들의 노드 경로. 탠덤 합류는 경로를 합친다). 충돌 런타임은 `setMeshPairExclusion(isCarriedMeshPair)` 로 **훅 노드 메쉬↔블록** 쌍만 건너뛴다(`use-scene-collision-detector` 가 꽂는다) — 크레인 다리·거더·트롤리 본체가 운반 중인 블록을 치면 보고된다. 영역 감지는 블록이 `zoneExempt` 라 무관하다.
- 레이어 `ui/scene-carry-layer.tsx`: `Monitoring3dView` Canvas 의 `RigDriver` 바로 다음(훅 노드가 움직인 뒤 블록이 따라간다). 훅 노드마다 트롤리(부모) 높이에서 노드 서브트리 꼭대기까지 케이블 실린더 하나를 그린다 — GLB 로프 노드는 권상으로 내려가면 트롤리와 사이가 빈다. 블록이 움직인 프레임은 `invalidateShadows()`. 에디터 캔버스에는 없다.
- 시나리오 키프레임 패턴 `{ kind: 'keyframes', points[{ atSec, value }], loop?, ease? }`(`tag-pattern.ts` 의 `evaluateKeyframes`): 숫자는 점 사이 보간(기본 선형, `ease: 'smooth'` 면 구간마다 smoothstep 가감속 — 점에서 속도 0), 불리언은 계단(점의 시각에 새 값), 첫 점 앞·마지막 점 뒤는 끝값, `loop` 면 마지막 시각을 주기로 되감는다. sanitize 는 점을 시각순 정렬·같은 시각 첫 점·ms 반올림·`VIRTUAL_TAG_KEYFRAMES_MAX` 상한, 점이 없으면 manual, ease 는 `smooth` 만. UI 는 펼친 정의의 길이 줄에 요약("N점 · N초 · 반복 · 가감속")만 보이고 점 편집은 `scenarios.json` 에서 한다. 배포 시나리오는 블록 크기별 셋(philly-2dock, 각 8~9분 루프)이고 **전부 상·하부 두 훅 탠덤**이다 — 소조 블록(Block_002 자산 0.6배)은 훅 간격 ±6, 중조(Block_002)·대조(Block_001)는 ±10. 소조·중조는 안벽에서 드라이도크(x −690~−644, 바닥 −8.89) 안으로 탑재하고 대조는 도크 안에서 옮긴다. 경로는 **장애물을 알고 고른다**: LLC 두 대의 부품 AABB·건물 150/151·운반 대상이 아닌 블록·골리앗 다리(x −704 / −583 안쪽 면)·지면을 상대로, 운반 높이의 블록·로프·트롤리 본체의 구간별 스윕 AABB 가 전부 2 unit 이상 떨어지는 순서(횡행→주행 / 주행→횡행 / 경유점 L 자)를 고르고, 생성 뒤 0.25초 샘플로 전 구간(블록·로프·다리 vs 장애물·지면·거더, 트롤리가 다리 안쪽, 부착 반경)을 다시 검사해 위반 0 일 때만 기록한다. 작업 순서는 z 0 에서 두 트롤리를 블록 폭으로 벌림 → 주행 → 두 훅 하강(깊은 쪽이 먼저 출발해 같이 닿음) → 3초 → 부착 → 3초 → 하부 훅이 rest 가 될 때까지 같은 양만큼 권상(블록 윗면 ≈ 31, 수평) → 계획된 경로 → 목적지 지면 높이까지 하강(도크면 안벽보다 12.5 더) → 분리 → 상승, 되가져온 뒤 z 0 으로 주행 → 트롤리 rest. 시간은 거리 ÷ 속도(주행 2.0 · 횡행 1.2 · 권상 1.2 unit/s, 최소 2초)이고 전 축이 가감속이다. 권상값은 실측 훅 바닥(상부 34.17 · 하부 31.49)과 블록 윗면에서 0.5 띄운 값이라 GLB·블록 배치가 바뀌면 다시 재서 생성한다(생성기는 저장소 밖 스크립트 — 규칙은 여기가 원본).
- 한계: 블록 위치는 씬 시간의 순수 함수가 아니라(부착 시점 상태) seek·되감기는 결정론이 아니다. 실시간 피드에는 부착 신호가 없다 — 서버 작업 이벤트(크레인·트롤리·블록·attach/detach)나 하중 태그 임계 추론이 붙으면 같은 부착 코드로 흘려보내면 된다.

### 리깅(관절 연동)

- 정의 `RigDefinition` = 관절 `hinge|slide` + 구속조건 `linear`("출력 관절 = 입력 관절 × factor + offset", 디자이너가 주는 공식 형태 그대로). 출력 관절은 driven 이 되어 슬라이더·태그를 받지 않고, 구속조건은 배열 순서대로 계산돼 체인이 된다.
- 정의는 자산 단위라 씬 상위 `rigs[]` 에 두고, 모델 인스턴스는 `rigId` 만 가진다. 관절 ← 태그는 `tagMappings` 의 joint 대상.
- 리그는 `assetId` 로 모델에 매인다 — 리깅 탭의 후보는 같은 자산(모델의 `asset.id`)의 리그이고, 붙어 있는 리그는 후보가 아니어도 보인다(`packages/widgets/src/3d/lib/rig-choices.ts`). 경로·버전으로 맞추지 않아 새 버전 갱신에도 후보가 유지되고, 새 GLB 에서 관절 노드가 안 풀리면 amber 표시가 알린다. 자산 참조 없는 모델에는 리그를 만들 수 없다. `modelPath` 만 있는 옛 리그는 로드 때 sanitize 가 그 리그를 쓰는 모델의 `asset.id` 로 채우고(쓰는 모델이 없으면 버린다), `scripts/migrate-scene-asset-refs.mjs` 가 파일에 적는다.
- 관절 값은 **항상 rest pose 기준 Δ** 다. `rest-pose-cache.ts` 가 clone 직후 잡은 GLTF 원본을 기준으로 매 프레임 `q = rest ∘ Δ` 를 다시 만든다. 노드 경로는 `mesh-path.ts` 의 `[index]name/...` 형식 그대로.
- 값 소스는 `JointValueSource` 하나로 통한다. 에디터 슬라이더는 `manualJointSource`(씬 데이터·히스토리에 남지 않음), 태그는 `createTagBindingSource`. 시뮬레이션 재생 중 태그가 꽂힌 관절의 슬라이더는 잠긴다.
- 리깅 가능한 자산은 돌아야 하는 부품마다 Empty 노드가 있어야 하고 메쉬는 그 Empty 의 자식이어야 한다. 메쉬를 든 잎 노드는 최적화(`optimize-glb.mjs` 의 meshopt 양자화)가 translation·scale 보정을 노드 자체에 실어 원점이 메쉬 바운즈 중심으로 옮겨진다 — 메쉬가 없는 Empty 는 건드리지 않는다. `LLC_002.glb` 는 참고 프로젝트의 리깅본(루트 scale 을 `scripts/unbake-root-transform.mjs --fold-scale` 로 자식에 접어 넣어 실제 미터, 배치 scale 1)이다. 옥포 OC(자산 `okpo-oc`)는 `okpo.json` 의 `rigs[]` 에 리그가 있다 — 입력 관절 `Link_Upper.001` 하나에 나머지 5개(`Link_Upper.002/003`·`Connector`·`Link_Lower.001`·`Link_End`)가 디자이너 비율의 선형 구속으로 매달리며, 모든 Empty 의 로컬 X 가 러핑 평면 법선이라 관절 축은 전부 `x` 다. 옥포 TC·TTC 는 `*_Top` Empty 를 hinge(축 `y`)로 돌리는 선회 리그다 — 디자이너 파일의 잎 메쉬를 Blender 에서 `*_Top(Empty) › *_Top_Mesh` 로 내린 버전이고, Empty 는 마스트 단면 중심에 둔다. 옥포 Goliath 는 `Trolly_*` 노드를 slide(position) 맵핑 대상으로 쓴다(부모 프레임 평행이동이라 자기 원점과 무관). 그 외 카탈로그 크레인은 단일 메쉬라 관절을 정의할 수 없다. 모델 최적화 파이프라인(`scripts/optimize-glb.mjs`)은 join/prune 을 쓰지 않아 Empty 계층·이름이 보존된다.
- 리깅 노드에 `meshOverrides` 가 함께 있으면 드라이버가 이긴다(rest = GLTF 원본).
- 관절·맵핑 정의 편집으로 드라이버 인스턴스가 해체·재생성되면 rest 점프가 생기므로 그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

## 불변식

- 관절·태그 값은 항상 rest 기준 Δ 로 적용한다. `rotation.x = θ` 같은 절대 대입은 Blender Empty 의 비항등 rest 를 파괴하므로 금지.
- 메쉬를 든 노드를 hinge 로 직접 돌리지 않는다. 돌릴 부품은 Empty 아래에 메쉬를 두고 Empty 를 돌린다 — 잎 메쉬 노드는 최적화가 원점을 바운즈 중심으로 옮긴다. slide 는 자기 원점과 무관하다.
- 태그 값 생산자를 새로 만들면 `publishTagValue` 로만 내보내고 `TagSourceId` 를 붙인다 — 버스가 단일 진입점이고, 표시 캐시·바인딩·운전 상태 판정·3D 플레이 통계가 전부 여기서 갈라진다. 소스 없는 publish 는 게이트가 걸린 화면에서 버려진다.
- 소스를 가르는 것은 버스의 활성 소스 게이트(`setActiveTagSource`, 화면은 `useActiveTagSource`) 하나다. 키 표기(콜론·접두어)나 소비자의 `mode`·`source` 분기로 소스를 나누지 않는다 — 소비자는 모델 하나를 받아 키를 풀 뿐이다.
- 태그 키는 조립값이다 — 맵핑·상태 태그·시나리오 어디에도 키 필드를 두지 않고 `resolveMappingTagKey`/`resolveStatusTagKeys` 로만 만든다. 크레인 없는 모델의 맵핑은 키가 없는 것이 맞다 — 기본 접두어로 채우지 않는다.
- 인스펙터의 크레인 ID 는 서버가 주는 크레인(스냅샷 스토어)에서만 고른다 — 자유 입력도 코드 목록도 두지 않는다. 서버에 없는 저장값은 표시·보존만 한다.
- 시뮬레이션을 끝내는 코드는 `stopSimulation()` 을 부른다. 스토어 `stop()` 만 부르면 값 저장소·충돌 기록·실시간 보류가 남는다.
- 같은 대상(노드·채널·축 / 관절)에 맵핑을 두 개 만들지 않는다 — sanitize 가 뒤 항목을 조용히 버린다.
- 버스에 숫자가 아닌 값을 싣지 않는다. 서버 값의 형식이 늘면 `toTagNumber` 한 곳에서 받는다.
- 상태 태그 코드를 사이트 규칙으로 유추하지 않는다 — 사이트마다 태그 코드가 다르다. 씬에 연결된 코드만 읽는다.
- 라벨 미리보기는 씬 데이터·히스토리·태그 값 버스에 쓰지 않는다. 상태 태그 구역을 접거나 탭·선택 모델이 바뀌면 `clear()` 한다 — 남으면 에디터 라벨이 저장된 상태처럼 보인다.
- 시나리오 배포 파일 `scenarios.json` 을 바꿨으면 커밋한다 — 운영 localStorage 는 `baseVersion` 이 다르면 배포본으로 덮인다.
- 시나리오 태그는 `modelId + code` 로만 가리킨다 — 키·크레인을 저장하면 에디터에서 크레인을 바꿨을 때 시나리오가 따라오지 않는다.
- `scenarios` 는 스토어 액션으로만 바꾼다 — `entries` 파생과 러너 `syncDefinitions` 가 `commit` 한 곳에 묶여 있다. 밖에서 `setState` 하면 러너가 옛 정의를 돈다(테스트는 `entries` 를 함께 세우거나 `isRunning` 만 세운다).
- 시뮬레이션 값은 씬 시간의 함수다 — 재생 tick 과 seek 가 같은 고정 스텝 함수(`advanceTo`)를 쓴다. 벽시계 dt 로 값을 계산하지 않는다. 3D 플레이 타임라인의 사건 시각으로 옮기면 재생 때 그 시각의 자세가 나와야 한다(`docs/agents/3d-play.md`).
- 위치 불연속(seek·리셋)의 publish 는 `smoothTime: 0` 이다 — 스무딩을 타면 자세가 미끄러져 감지기가 가짜 전이를 낸다.
- `TagMapping`·`ModelStatusTags` 에 필드를 추가하면 `sanitize-tag-mappings.ts`·`sanitize-status-tags.ts` 와 `scene-snapshot.ts` 의 `isTagMappingListEqual`·`isStatusTagsEqual`(코드·`craneId`·역할별 코드 비교)을 함께 고친다 — 빠지면 그 편집이 동등 단락에 먹혀 저장되지 않는다.
- 라벨의 태그 값 줄은 버스의 마지막 값(`readTagLiveValue`)만 읽는다. 맵핑의 적용값(`offset + value × scale`)이나 화면 위치에서 계산하지 않는다.

## 하지 않기로 한 것

- 맵핑에 실시간·시뮬레이션 두 슬롯을 두는 것 — 같은 태그를 두 번 등록해야 했고 둘 다 채운 배포 씬이 없었다. 코드 하나 + 버스의 소스 게이트로 가른다.
- 가상 태그 키를 콜론 표기로 두어 실시간 키와 키 공간을 나누는 것 — 소스 구분이 키 표기에 숨어 같은 태그가 두 이름을 가졌다. 소스는 게이트가 가른다.
- 전역 가상 장비 등록(태그 페이지의 가상 탭) — 크레인 ID 를 손으로 다시 치고 씬의 맵핑과 어긋났다. 시나리오는 씬에 맵핑된 모델·태그에서 고른다.
- 실시간 값을 스냅샷해 시나리오를 만드는 것(실시간 복제) — 피드가 있어야 하고 1회 복사라 바로 낡는다. 기본값에서 손으로 고친다.
- 인스펙터의 크레인 ID 자유 입력 — 오타가 키를 조용히 깨뜨린다. 서버 크레인 콤보박스만.
- 시나리오 동작의 삼각파 — 사인파와 3D 움직임이 거의 같아 고를 이유가 없었다. 왕복은 사인파 하나.
- 크레인 레지스트리 전체를 콤보박스 선택지로 — 서버가 주지 않는 크레인을 골라도 값이 오지 않고, 레지스트리 번호(`C-171`)와 서버 ID(`C_171`) 표기가 달라 헷갈렸다. 끊긴 상태의 레지스트리 fallback 도 두지 않는다.
- 서버 태그 전체(크레인 20대 × 태그 45개)를 콤보박스 하나에 — 고를 수 없고 서버에는 태그 정의 API 가 없다. 다이얼로그는 모델 크레인으로 고정하고 그 크레인의 태그만 보인다.
- 장비 안 그룹(사용자 정의 분류)·태그별 사용 스위치·속도/가속 한계·장비 이름 — 등록 화면이 복잡해지고 표가 가로로 넘쳐 뺐다. 한계는 3D 플레이 리포트의 포화 지표까지 함께 뺐다.
- 벽시계 dt 로 값을 계산하는 것 — 틱 지터로 같은 씬 시각의 값이 달라진다. 씬 시간 `tickMs` 고정 스텝 경계에서만 계산한다.
- 에디터에 시뮬레이션·시나리오 UI 를 두지 않는다 — 진입·이탈의 `stopSimulation()` 은 3D 플레이에서 켜진 러너가 넘어오지 않게 하는 방어다. 재생·저작 UI 는 3D 플레이 트랜스포트 바와 우측 시나리오 탭에만 있다.
- 시뮬레이션 알림 toast — 배너·HUD·헤더 배지와 겹쳐 보여 소리·브라우저 알림만 쓴다(`docs/agents/monitoring-ui.md`).
- 레거시 `valueMapList`·`rigBindings`·`tagKey`·`realtimeTagKey`·`virtualTagKey` 를 저장본에 다시 쓰는 것 — 입력 전용, 로드 시 변환 후 소멸.
- 리그 관절의 회전 중심(pivot) 오프셋 필드 — 최적화가 옮긴 원점을 리그에서 되감는 우회였다. 값을 GLB 를 열어 손으로 재야 하고 재최적화·새 버전에서 틀어지며 회전 중심의 원천이 자산과 리그 둘이 된다. 모델에 Empty 를 둔다.

## 미룬 것

- 시나리오 키프레임 점의 편집 UI — 지금은 행에 요약만 보이고 점은 `scenarios.json` 에서 적는다.
- 블록 운반의 편집 UI(인스펙터의 훅·운반 가능 스위치)와 실시간 부착 신호(서버 작업 이벤트 또는 하중 태그 임계 추론).
- 시나리오 태그의 초기값·범위를 실시간 값에서 가져오기(피드가 필요하다). 지금은 기본값에서 손으로.
- 맵핑 `craneId` 덮어쓰기의 편집 UI, 크레인 콤보박스의 구역(bay) 필터, 태그 페이지에서 시나리오 조회.
- 라벨 값 줄의 단위 표시·표시용 환산. 서버 태그의 원시 단위가 m 가 아니면(dock-in `tl_distance` 는 맵핑 scale 이 0.1 이다) 숫자가 m 로 읽히지 않는다.
- 맵핑되지 않은 태그(Load 등)를 라벨에 보이는 것.
- 다이얼로그의 "같은 태그를 전체 크레인에 적용" — 크레인마다 GLB 노드 경로가 달라(`3_Bay_C_800_Head_01` vs `3_Bay_C_172_Head`) 루트 대상에만 맞는다. 여러 크레인의 맵핑은 한 대를 에디터에서 맞춘 뒤 스크립트로 씬 JSON 에 일괄 생성하는 쪽이 맞다.
- 감지·3D 플레이 리포트가 의미 있는 씬은 `tagMappings` 가 있는 philly-2dock(크레인 `GC_04`·`LLC_002`, 시뮬레이션은 시나리오 "기본" — 서버 리플레이에는 그 크레인이 없어 "맵핑 없음" 과 같다)·dock-in(주행 `legacy-pz`, 횡행·권상 `map-ts{n}`·`map-mh{n}`·`map-ah{n}`)뿐이다. 옥포 실외·골리앗 씬은 맵핑이 없어 아무것도 움직이지 않는다.
- dock-in 횡행(`ts{n}_distance` → `…_Head_0n` position z)·권상(`mh{n}_height`/`ah{n}_height` → `…_Hook_0m` position y)의 scale·offset 은 가정값이다 — 횡행 scale 0.001, 횡행 값 0 = 트롤리가 거더 끝(트롤리가 하나면 모델 −z 끝, 둘이면 각자 가까운 끝), 권상 scale 0.01·offset = −(배치 y + 훅 바닥 y), 번호는 같은 트롤리 안 큰 훅이 주권. 서버 값의 단위·기준점·방향·트롤리/훅 번호 대응표가 PLC 쪽에서 오면 바꾼다.
- 상태 태그를 연결한 배포 씬은 dock-in 하나다(운전 전원 `crane_control_on`, 고장 `crane_system_error`, Bypass `accs_bypass_on`). 서버의 상태 값 형식이 정해지면 맞춘다 — 비트 묶음 워드(역할별 비트 번호), 반전 비트, 모션 run 비트(지금 가동은 축 값 변화로 추정한다), 모션별 Slowdown·Endstop 비트(지금은 역할마다 태그 하나라 모션별로 오면 역할 값을 태그 목록으로 넓혀야 한다).
