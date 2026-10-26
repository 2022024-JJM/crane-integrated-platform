# 태그 맵핑 · 상태 태그 · 가상 태그 시뮬레이션 · 리깅

서버(PLC) 태그 값이 3D 모델의 트랜스폼·관절을 움직이고 라벨을 칠하고 장비에 외곽선을 두르는 경로 전체 — 맵핑 스키마, 상태 태그, 값 버스, 가상 태그(장비 › 그룹 › 태그)·러너, 리그 정의·드라이버.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 태그 맵핑 스키마(두 슬롯) / 방어 / 레거시 변환 | `packages/domain/src/3d/model/tag-mapping-types.ts`(`TagSlot`·`TagKeySlots`·`getSlotTagKey`·`setSlotTagKey`·`isTagKeySlotsEqual`), `packages/domain/src/3d/lib/sanitize-tag-mappings.ts`(`sanitizeTagKeySlots`) |
| 활성 슬롯 해석(모드·3D 플레이 소스 → 실시간|가상) | `packages/features/src/3d/lib/tag-slot.ts`(`resolveActiveTagSlot`·`tagSlotOfPlay3dSource`·`EDITOR_TAG_SLOT`, 테스트 대상) |
| 크레인 태그 키 조립·파싱(`${craneId}.${tagCode}`) | `packages/domain/src/monitoring/lib/crane-tag-key.ts`(`buildCraneTagKey`·`parseCraneTagKey`·`normalizeCraneKey`) |
| 라벨의 태그 값 줄(목록 구성·표기 / 값 읽기 / 표시) | `packages/domain/src/3d/lib/label-reading.ts`(테스트 대상), `packages/features/src/3d/model/tag-value-bus.ts`(`readTagLiveValue`), `packages/domain/src/3d/ui/model-label.tsx` |
| 상태 태그 스키마 / 방어 / 편집 로직 / 미리보기 | `packages/domain/src/3d/model/status-tag-types.ts`, `packages/domain/src/3d/lib/sanitize-status-tags.ts`, `packages/widgets/src/3d/lib/status-tag-editor.ts`, `packages/features/src/3d/model/use-label-preview-store.ts` |
| 서버 값 → 버스 숫자 | `packages/domain/src/monitoring/lib/tag-number.ts` (`toTagNumber`) |
| 태그 값 버스 / 맵핑 인덱스 / 바인딩 소스 | `packages/features/src/3d/model/tag-value-bus.ts`, `packages/features/src/3d/lib/tag-mapping-index.ts`, `packages/features/src/3d/model/use-tag-binding-source.ts` |
| 채널 Δ 적용 / 루트 Δ 벗기기 / 배치 프레임 | `packages/features/src/3d/lib/apply-channel.ts`, `packages/features/src/3d/lib/strip-channel-delta.ts`, `packages/features/src/3d/model/root-placement.ts` |
| 태그 맵핑 편집 UI(인스펙터 탭) / 태그 줄(슬롯 전환) / 태그 연결 다이얼로그 | `packages/widgets/src/3d/ui/tag-mapping-section.tsx`, `packages/widgets/src/3d/ui/tag-slot-field.tsx`, `packages/widgets/src/3d/ui/tag-pick-dialog.tsx`(+ `tag-pick-realtime-tab.tsx`·`tag-pick-virtual-tab.tsx`·`tag-sparkline.tsx`), `packages/widgets/src/3d/lib/tag-mapping-editor.ts`(충돌 판정·기본값·대상 설명, 테스트 대상), `packages/widgets/src/3d/lib/tag-pick.ts`(필터·선택·칩, 테스트 대상), `packages/widgets/src/3d/lib/tag-history.ts` + `model/use-tag-value-history.ts`(미리보기 최근 60초, 테스트 대상) |
| 가상 태그 정의(장비 › 그룹 › 태그)·키 조립·파형·방어(버전 1 변환)·기본 그룹·평탄화·한계 | `packages/domain/src/virtual-tag/model/types.ts`, `packages/domain/src/virtual-tag/lib/{virtual-tag-key,tag-pattern,sanitize-virtual-tags,default-groups,virtual-tag-entries,rate-limit}.ts` |
| 가상 태그 영속화 어댑터 / 배포 파일 | `packages/domain/src/virtual-tag/lib/virtual-tag-storage.ts`, `apps/shell/public/simulation/virtual-tags.json` |
| 가상 태그 스토어 · 러너 · 카탈로그 · 실시간 복제 · 종료 | `packages/features/src/3d/model/use-virtual-tag-store.ts`, `packages/features/src/3d/model/virtual-tag-runner.ts`, `packages/features/src/3d/model/use-tag-catalog.ts`, `packages/features/src/3d/lib/virtual-tag-clone.ts`, `packages/features/src/3d/model/stop-simulation.ts` |
| 시뮬레이션 UI | 공용 패널 `packages/features/src/3d/ui/scene-simulation-panel.tsx`, 배지 `packages/features/src/3d/ui/scene-simulation-badge.tsx`, 시계 문구 `packages/features/src/3d/lib/sim-clock.ts` |
| 태그 페이지(실시간 태그 | 가상 태그 탭) / 가상 장비 목록·상세·등록 다이얼로그·복제 선택기 / 순수 로직 | `packages/widgets/src/tags/ui/tags-page.tsx`, `packages/widgets/src/tags/ui/virtual-tags-view.tsx`(+ `virtual-simulation-bar.tsx`·`virtual-equipment-{list,card,detail,dialog}.tsx`·`virtual-tag-row.tsx`·`virtual-clone-picker.tsx`), `packages/widgets/src/tags/lib/{tags-route,virtual-tag-rows,virtual-tag-validation,clone-selection}.ts`(테스트 대상) |
| 실시간 태그 피드 — STOMP 래퍼 / 스냅샷 방어·REST / 스토어·피드 훅·관측치 / 실시간 탭 UI | `packages/core/src/ws/stomp-client.ts`(`craneStompClient`), `packages/domain/src/monitoring/lib/crane-snapshot.ts`, `packages/domain/src/monitoring/api/get-crane-snapshots.ts`, `packages/features/src/3d/model/use-crane-snapshot-store.ts`, `packages/features/src/3d/model/use-crane-snapshot-feed.ts`, `packages/features/src/3d/lib/crane-snapshot-stats.ts`, `packages/widgets/src/tags/ui/realtime-tags-view.tsx` |
| 실시간 태그 표 헬퍼(행 구성·분류·불리언 표기 / 구역 칩·크레인 필터 / 시계·숫자 표기 / 상태 점·구역 칩 UI) — 태그 페이지와 태그 연결 다이얼로그가 같이 쓴다 | `packages/features/src/3d/lib/tag-rows.ts`, `packages/features/src/3d/lib/crane-filter.ts`, `packages/features/src/3d/lib/format-clock.ts`(셋 다 테스트 대상), `packages/features/src/3d/ui/{crane-live-dot,bay-chip}.tsx`, 벽시계 틱 `packages/core/src/lib/use-now.ts` |
| 리깅 스키마(관절·구속조건) / 방어 | `packages/domain/src/3d/model/rig-types.ts`, `packages/domain/src/3d/lib/sanitize-rig.ts` |
| 리깅 런타임(값 저장소·드라이버·readout) | `packages/features/src/3d/model/rig-value-store.ts`, `packages/features/src/3d/model/use-rig-driver.ts`, `packages/features/src/3d/model/rig-live-readouts.ts` |
| 관절 적용 / 스무딩 / rest 캐시 / 노드 경로 | `packages/features/src/3d/lib/apply-joint.ts`, `packages/features/src/3d/lib/smooth-damp.ts`, `packages/domain/src/3d/lib/rest-pose-cache.ts`, `packages/domain/src/3d/lib/mesh-path.ts` |
| 리깅 편집 UI(인스펙터 탭·계층 노드 트리) | `packages/widgets/src/3d/ui/rigging-section.tsx`, `packages/widgets/src/3d/lib/model-node-tree.ts` |

## 동작

### 태그 맵핑 `tagMappings[]`

모델 인스턴스 필드. "태그 값 하나 → 트랜스폼 채널 하나" 의 목록이다.

- 대상은 두 종류다. `{kind:'node', node, channel:position|rotation|scale, axis}` — `node: ''` 는 모델 루트. `{kind:'joint', jointId}` — 할당된 리그의 관절.
- 태그는 **슬롯 둘**(`TagKeySlots`)로 참조한다 — `realtimeTagKey`(서버 키 `${craneId}.${tagCode}`, 모니터링 실시간·3D 플레이 리플레이가 읽는다)와 `virtualTagKey`(가상 태그 키, 시뮬레이션이 읽는다). 둘 다 선택이고 둘 다 비면 sanitize 가 맵핑을 버린다. 어느 슬롯을 읽을지는 `lib/tag-slot.ts` 의 `resolveActiveTagSlot(mode, play3dSource)` 한 곳 — 실시간·리플레이 → realtime, 시뮬레이션(대시보드 미리보기·3D 플레이 시뮬레이션 소스) → virtual, 모드 없는 화면(에디터·대시보드)은 realtime. 소비자는 전부 슬롯을 인자로 받고 memo 의존성에 둔다(3D 플레이 소스 전환은 리마운트가 아니다).
- 적용 공식은 `offset + value × scale` 을 **rest 기준 Δ** 로 더하는 것. 루트의 rest 는 씬 배치 transform, 내부 노드는 GLTF rest 다.
- 같은 대상 중복은 sanitize 가 첫 항목만 남기고(first-wins), 리그 관절이 점유한 노드·축은 드라이버가 관절을 우선한다. 편집 UI 는 둘 다 amber 로 경고한다(`tag-mapping-editor.ts`). 맵핑 카드 머리줄의 순번(# 1, # 2 …)은 배열 순서라 이 first-wins 순서와 같다. 순번은 저장하지 않는다.
- 실시간 키의 구분자는 점(`C_171.tl_distance`, `buildCraneTagKey`) — ISL TagKey 표기와 같다. 단일 키 시절의 콜론 표기(`C_171:tl_distance`)는 레거시 변환 때 점으로 옮긴다(`sanitize-tag-mappings.ts` 의 `toDottedLegacyKey` = monitoring 의 `normalizeLegacyCraneTagKey`, 같은 레이어라 import 대신 같은 규칙을 둘이 든다). 가상 태그 키는 `장비키:코드`(`buildVirtualTagKey`, 콜론)로 조립한다 — 장비키는 장비 ID 의 하이픈을 밑줄로 바꾼 것이라 `GC-04` 장비의 `gantry_position` 은 `GC_04:gantry_position` 이다. 저장본에 키는 없다.
- 레거시는 셋이다 — 단일 키 `tagKey` 는 `sanitizeTagKeySlots` 가 **실시간 슬롯**으로 옮긴다(그 시절 배포 씬 dock-in 의 키가 서버 키였고, 가상 키였던 philly-2dock 은 데이터를 `virtualTagKey` 로 옮겼다). `valueMapList`(루트 6칸 절대 대입)·`rigBindings`(관절 바인딩)는 로드 시 `sanitize-tag-mappings.ts` 가 실시간 슬롯 맵핑으로 변환한다. 셋 다 저장본에서 사라진다. 절대 좌표 → Δ 변환은 `offset' = offset − placement[axis]` 이며 테스트가 좌표 동일성을 고정한다. `valueMapList`·`rigBindings` 는 타입에 `@deprecated` 입력 전용으로만 남아 있고 `tagKey` 는 타입에 없다.
- 표시용 대표 키는 `getPrimaryTagKey`(실시간 우선) — 관절 배지·대시보드 장비 목록처럼 소스와 무관한 곳만 쓴다.

### 라벨의 태그 값 줄

맵핑 카드의 "라벨에 표시"(`TagMapping.showOnLabel`, true 만 저장)를 켜면 모델 라벨의 상자 위에 그 태그 값이 한 줄로 붙는다. 여러 개면 위쪽으로 쌓이고 첫 맵핑이 상자에 가장 가깝다. 상자는 값 줄 수와 무관하게 제자리에 있다. 짧은 이름(`caption`)을 넣으면 값 앞에 붙고, 표시를 꺼도 이름은 보존한다.

- 값은 scale·offset 을 거치지 않은 **태그 원시값**이다. 화면 구성(배치·맵핑 계수)이 틀려도 숫자는 PLC 와 같아야 한다.
- 라벨은 domain 이라 값 버스를 모른다. features·widgets 가 목록(`buildLabelReadings(mappings, slot)` — 활성 슬롯의 키, 그 슬롯에 키가 없는 맵핑은 줄도 없다)과 읽기 함수(`readTagLiveValue`)를 `GltfModel` prop 으로 넘기고, 라벨은 `useFrame` 에서 표기가 바뀔 때만 DOM 에 쓴다.
- 목록은 모델마다 참조를 고정해 넘긴다 — 아니면 memo 된 `GltfModel` 이 렌더마다 다시 그려진다.
- 모양은 ACMS 매뉴얼의 GC 원점 거리 그대로 상자 없는 청록색 숫자다. 단위는 붙이지 않는다.
- 라벨을 숨긴 모델(`labelHidden`)·이름이 빈 모델은 값 줄도 없다.

### 상태 태그 `statusTags`

모델 인스턴스 필드. "상태 역할 하나 ← 연결 하나(두 슬롯)" 의 객체이고 역할은 `STATUS_TAG_ROLES` 다. 노드를 움직이지 않는다. 역할은 그리는 곳으로 두 묶음이다 — 라벨 묶음 `LABEL_STATUS_TAG_ROLES`(운전 전원·고장·Bypass·Free Swing)은 라벨의 색·아이콘을, 외곽선 묶음 `OUTLINE_STATUS_TAG_ROLES`(통신불량·Slowdown·Endstop)은 장비 외곽선을 정한다. Bypass·Free Swing·Slowdown·Endstop 은 화면 문구도 언어와 무관하게 영어다.

- 역할 값은 맵핑과 같은 `TagKeySlots`(`StatusTagBinding` — `realtimeTagKey`·`virtualTagKey`)다. 런타임은 `resolveStatusTagKeys(statusTags, slot)` 으로 활성 슬롯의 역할 → 키(`ResolvedStatusTagKeys`)를 풀어 판정한다. 값은 0/1 숫자이고 on 문턱·판정 우선순위는 `docs/agents/3d-play.md` 의 "장비 운전 상태 · 라벨 표시 상태 · 외곽선".
- 통신불량은 장비 PLC 와 연계 PLC 사이 통신이 끊겼다는 비트다. 서버는 값을 계속 주지만 그 값이 장비의 지금 상태가 아니다. 연결하지 않으면 회색 외곽선은 수신 끊김에서만 나온다.
- Slowdown·Endstop 은 역할마다 연결 하나를 따로 잇는다.
- 연결하지 않은 역할은 키가 없고, 연결된 역할이 없으면 필드가 빠진다. sanitize 는 모르는 역할·두 슬롯 다 빈 값을 버리고(단일 키 시절의 문자열은 실시간 슬롯으로 받는다) 역할 순서를 고정한다.
- 편집은 인스펙터 "태그 매핑" 탭의 목록 아래 구역이다(`tag-mapping-section.tsx` 의 `StatusTagRows`). 묶음마다 작은 제목 아래에 역할 카드가 쌓이고, 움직임 카드는 라벨 묶음 끝에 있다. 역할마다 카드 하나 — 머리줄에 역할 이름과 미리보기 값, 아래에 태그 줄(`TagSlotField`, 맵핑 카드와 같다). 연결된 역할은 카드 테두리를 강조한다. 카드 위 한 줄에는 지금 라벨·외곽선이 그려지는 모양을 글자로 적은 줄(왼쪽, `describeLabelState`)과 미리보기 초기화 버튼(오른쪽, 항상 보인다)이 있다. 편집 채널은 `updateSelectedStatusTags` 로 `tagMappings` 와 같은 규칙(같은 참조 = no-op — `status-tag-editor.ts` 의 `setStatusTagBinding`)이다.
- 탭의 두 구역은 화면에서 "트랜스폼"(맵핑 목록)·"상태"(상태 태그)라고 부른다. 각각 접고 펼 수 있고 접힌 채 연다(`inspector-fields.tsx` 의 `CollapsibleSection`, 열림 상태는 탭이 가진다). 제목 옆 개수가 접힌 구역의 내용 유무를 알리고, 내용은 열려 있을 때만 마운트한다.
- **미리보기**: 역할마다, 그리고 움직임에 값(없음·Off·On)을 고르면 에디터 캔버스의 그 모델 라벨과 외곽선이 고른 값으로 바로 그려진다. 에디터에는 값 생산자가 없어 연결만으로는 라벨이 늘 상태 미확인이고 외곽선이 없기 때문이다. 태그 연결 여부와 무관하고, 판정은 실제 값과 같은 우선순위를 탄다(`resolvePreviewLabelState`·`resolvePreviewOutlineState`). 값은 세션 스토어 `useLabelPreviewStore` 에 있고 대상은 한 번에 모델 하나다.
  - 미리보기 대상은 선택된 모델이라 외곽선이 선택 테두리와 같은 자리에 온다. 외곽선이 있는 동안은 모델 전체의 선택 테두리를 그리지 않고 상태 외곽선이 그 자리를 맡는다(`gltf-model.tsx`). 안쪽 노드 선택은 둘 다 그린다.
- 시뮬레이션에서 확인하려면 가상 슬롯에 불리언 형식의 가상 태그를 연결한다(값 0/1, 수동이면 토글). 실시간·리플레이는 실시간 슬롯의 서버 비트(`crane_control_on`·`crane_system_error`·`accs_bypass_on` 등)를 읽는다.

### 태그 연결 다이얼로그 `tag-pick-dialog.tsx`

맵핑 카드·상태 태그 카드의 태그 줄(`TagSlotField`)에서 키 칸을 누르면 열리는 shadcn `Dialog`(`@crane/ui/molecules/dialog`, 포털 규약 `usePortalContainer`·`z-9999`). 머리줄은 제목과 닫기 버튼 한 줄뿐이다. **탭이 곧 슬롯**이다(`@crane/ui/molecules/tabs` — 에디터 팔레트 탭과 같은 모양, 탭 이름은 `monitoring:tags.tabs.*`) — 두 탭의 선택을 초안으로 들고 "연결" 한 번에 바뀐 슬롯만 적용하고(`isTagKeySlotsEqual` 로 dirty 판정), 본문은 열려 있을 때만 마운트해 열 때마다 `value`·누른 슬롯으로 돌아온다. 검색창은 팔레트·태그 페이지와 같은 `SearchField`.

- **태그 줄** `TagSlotField`: 슬롯 전환 버튼(실시간 · 시뮬레이션) + 고른 슬롯의 키 칸(안쪽 끝의 × 는 그 슬롯만 비운다). 좁은 인스펙터에서 키는 장비 쪽 앞부분부터 줄고(`describeSlotChip` 의 `lead`·`tail`), 그다음 코드가 가운데에서 줄어 끝 글자(`splitChipTail` — `_2` 같은 번호)가 남는다. 전체 키는 툴팁. 키 칸을 누르면 다이얼로그가 고른 슬롯의 탭으로 열린다. 전환 버튼의 아이콘 색이 슬롯별 연결 여부(주황, 못 찾는 키는 amber)이고 툴팁에 그 슬롯의 키를 적는다(`실시간 : 키`). 처음 보일 슬롯은 키가 있는 첫 슬롯(`pickInitialSlot`, 실시간 우선)이고, "연결" 하면 그때 보던 탭으로 옮긴다. 고른 슬롯은 화면 상태라 저장하지 않는다.
- **실시간 탭**: 검색창과 그 아래 구역 칩(`BayChip`, 태그 페이지와 같다) › 크레인 목록(상태 점 `CraneLiveDot`) › 그 크레인의 태그 목록(머리글 "이름 · 현재 값", 분류 묶음 `TAG_CATEGORIES`, 현재 값·단위, 불리언은 태그 페이지와 같은 글자) › 미리보기(큰 현재 값, 최근 60초 스파크라인, 데이터 형식·분류·구역). 데이터는 다이얼로그 본문이 켠 `useCraneSnapshotFeed(true)`(REST 전체 + STOMP) — 에디터에는 다른 참조자가 없어 닫으면 소켓이 닫히고, 브리지가 없어 버스로는 가지 않는다(모델이 움직이지 않는다). 검색창 하나가 두 목록을 겨눈다 — 크레인(ID·구역)에 맞으면 크레인을 거르고, 아니면 태그(코드·표시명)를 거른다(`lib/tag-pick.ts` `filterPickCranes`·`filterPickTags`). 처음 고르는 크레인은 연결된 키의 크레인 › 모델 `craneId` › 첫 크레인(`pickInitialCrane`). 행을 누르면 `buildCraneTagKey(craneId, code)` 가 초안이 되고 선택 강조·미리보기는 초안을 되읽는다.
- **최근 60초**(`model/use-tag-value-history.ts`): 고른 태그가 바뀌면 `getCraneHistory`(1초 간격, 60초)로 채우고 스냅샷 스토어 구독으로 뒤에 붙인다(`lib/tag-history.ts` `appendSample` 이 창 밖을 버린다). 조회가 실패하면 라이브 표본만 쌓인다. 그리기는 `tag-sparkline.tsx`.
- **가상 탭**: `useTagCatalogEquipments` 로 실시간 탭과 같은 세 단 — 장비 목록(ID·이름·구역, 꺼진 장비 흐리게) › 그 장비의 그룹별 태그(`groupPickEntries`, 그룹 순 › 미분류) › 미리보기(현재값은 러너 상태 › 버스 캐시, 형식·그룹·단위·범위). 검색창 하나가 두 목록을 겨눈다(`filterPickEquipments`·`filterPickVirtualTags`, 실시간 탭과 같은 규칙). 처음 고르는 장비는 연결된 키의 장비 › 모델 `craneId` 와 같은 장비 › 첫 장비(`pickInitialEquipment`). 연결된 키가 카탈로그에 없으면 amber 항목으로 보존한다 — 사용자가 다시 고르기 전까지 지우지 않는다.
- 카드 칩(`describeSlotChip`): 실시간 키는 `크레인 · 코드`(툴팁에 카탈로그 표시명·단위), 가상 키는 카탈로그에 있으면 `장비 · 코드`(툴팁에 이름·단위·그룹), 없으면 키 그대로 amber.

### 값 흐름

생산자(가상 태그 러너 / WebSocket 러너 / 리플레이) → `publishTagValue(key, v)`(`tag-value-bus.ts`, 표시용 `tagLiveValues` 캐시) → `useTagBindingSource(sceneInfo, enabled, slot)` 가 건 `createTagBindingSource(resolve)` — 인덱스(`buildTagMappingIndex(sceneInfo, slot)`)는 활성 슬롯의 키로만 만든다 → `rigValueStore`(smooth) → `useRigDriver`(Canvas 안 `RigDriver`) 가 매 프레임 노드별로 rest 로 되돌린 뒤 채널 Δ 를 누적한다(`apply-channel.ts`).

- 슬롯을 받는 소비자: 바인딩 인덱스·`collectSceneTagKeys`(3D 플레이 통계·리포트의 "맵핑 없음"), 운전 상태·라벨·외곽선 판정 키(`collectModelTagKeys`·`collectModelStatusKeys` → `useModelStatusRecords(sceneInfo, slot)`), 라벨 값 줄(`buildLabelReadings`). 모니터링 뷰는 `resolveActiveTagSlot(mode, play3dSource)`, 3D 플레이 통계·리포트는 `tagSlotOfPlay3dSource(source)`, 에디터는 `EDITOR_TAG_SLOT`.
- 버스는 숫자 전용이다. WebSocket 브리지와 리플레이 스토어는 서버 값을 `toTagNumber` 로 바꿔 싣고 키는 `buildCraneTagKey` 로 만든다 — boolean 과 `'true'`/`'false'` 문자열은 1/0, 그 밖의 문자열·null 은 버린다.
- 바인딩은 모니터링 뷰·에디터 모두 화면이 떠 있는 동안 항상 켜 두고 언마운트 시 값 저장소를 비운다.
- 재생 토글(가상 태그 탭·3D 플레이 트랜스포트 바)은 러너 틱만 켜고 끈다. 일시정지하면 노드가 마지막 값에 머물고, 초기값 복귀는 리셋 버튼이 한다.
- 기즈모 드래그 중엔 루트 맵핑을 건너뛴다. 드래그 종료 프레임의 루트 rest handoff 는 `docs/agents/3d-editor.md`.
- publish 옵션 `smoothTime`(`TagPublishOptions`): 생략은 기본 스무딩, 0 은 즉시 대입. 가상 태그 러너의 정상 전진은 publish 벽시계 간격(`tickMs / speed`)을 넣어 스텝 계단을 숨기고(화면 지연은 씬 시간 한 스텝), 리플레이 `tick` 은 들어가는 프레임 길이 ÷ 배속을(`lib/replay-smoothing.ts`, `docs/agents/3d-play.md`), 실시간 러너는 키별 값 변화 간격을 넣고(아래 "실시간 태그 피드"), 러너 seek·리셋과 리플레이 seek 는 0 으로 내보낸다. 소비자 `createTagBindingSource` 가 `tagSetOptions` 로 값 저장소 set 옵션으로 바꾼다. 관찰자에게는 전달하지 않는다. 값 저장소 set 은 같은 target 이 와도 `smoothTime` 을 덮어쓴다 — 재발행하는 생산자는 같은 값을 넘길 것.
- 버스 관찰자 `subscribeTagValues` 는 소비자 슬롯과 별개의 다중 구독이다(3D 플레이 통계 등이 쓴다 — `docs/agents/3d-play.md`).
- 값 저장소의 set/reset/restore 와 스무딩 잔여는 프레임 요청·그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

### 태그 페이지 — 가상 태그 탭

실시간 탭과 같은 구성으로 장비 목록 › 장비 상세다. 탭·상세는 URL 이 든다(`lib/tags-route.ts` — `tags` 실시간 목록, `tags/{craneId}` 실시간 상세, `tags/virtual` 가상 목록, `tags/virtual/{equipmentId}` 가상 상세; 경로 조립은 `realtimeTagsPath`·`virtualTagsPath`). 가상 탭은 항상 마운트해 두고 숨긴다 — 편집본이 전역 스토어에 있어 탭 전환으로 사라지면 안 된다. 페이지 이탈(언마운트)에서 `discard()`.

- 공통 바(`virtual-simulation-bar.tsx`): 갱신 주기·저장(미저장 점·스피너)·전체 재생/일시정지·값 초기화. 목록·상세 어디서든 같은 자리이고 재생은 전역(모든 장비)이다.
- 목록(`virtual-equipment-list.tsx`): 검색(장비 ID·이름·구역)·구역 칩(`collectVirtualBays`)·장비 수·장비 등록. 카드(`virtual-equipment-card.tsx`)는 ID·이름·구역·태그 수와 사용 스위치 — 스위치가 들어 바깥은 버튼이 아니고 본문만 버튼이다.
- 상세(`virtual-equipment-detail.tsx`): 머리글에 목록 버튼·장비 ID(비제어, blur/Enter 커밋, 거부 시 툴팁 + 포커스 유지, Escape 복귀 — `getEquipmentIdError`)·이름·구역·사용 스위치·장비 복제·장비 삭제(확인창). 그 아래 검색·그룹 필터(전체 › 그룹별 개수 › 미분류)·태그 수·그룹 추가·JSON 복사. 표(`virtual-tag-row.tsx`, 고정 폭 열 + 가로 스크롤)는 그룹 묶음(`groupVirtualTags` — 그룹 순 › 미분류 끝, 검색 중엔 맞는 묶음만, 아니면 빈 그룹도 머리글은 남는다)마다 머리글 행(이름 입력·개수·위/아래·삭제·태그 추가)과 인라인 편집 행. 코드 입력은 장비 ID 와 같은 비제어 규칙(`getTagCodeError`). 불리언은 범위·단위·한계 칸이 대시, 초기값·현재값은 토글, 값은 ON/OFF 배지.
- 등록 다이얼로그(`virtual-equipment-dialog.tsx`): 기본 정보 탭(ID·이름·구역, 등록 시 기본 그룹 시드)과 실시간 복제 탭(`virtual-clone-picker.tsx` — 크레인 목록 › 실시간 묶음별 체크 목록, 기본 전부 선택, 크레인을 바꾸면 다시 전부 선택 — `lib/clone-selection.ts`). 복제 소스를 고르면 ID 가 비어 있거나 자동으로 채워진 상태일 때 ID 를 크레인 ID 로, 구역이 비어 있으면 스냅샷 구역으로 채운다. 본문은 열려 있을 때만 마운트하고 크레인 스냅샷 피드도 본문 수명이다. 실시간 상세의 "가상 장비로 복제" 는 이 다이얼로그를 그 크레인으로 미리 채워 열고, 만들어지면 가상 상세로 옮긴다.
- 순수 로직은 `lib/virtual-tag-rows.ts`(구역·필터·묶음·개수·값 표기·새 코드)·`lib/virtual-tag-validation.ts`·`lib/clone-selection.ts` 에 두고 테스트한다. `ui/*.tsx` 에서 계산하지 않는다.

### 실시간 태그 피드(크레인 스냅샷 서버)

crane-integrated-server(Kafka → Redis → STOMP)가 내보내는 크레인별 현재 상태를 받아 태그 페이지의 실시간 탭이 보여 주고, 3D 모니터링 실시간 모드(`mode='realtime'`)의 값 생산자이기도 하다.

- 전송: `@crane/core/ws` 의 `StompClient`(`@stomp/stompjs` 래퍼). 엔드포인트는 `getStompWebSocketUrl()`(WebSocket 베이스 `/ws` 자체, SockJS 없음). `craneStompClient` 하나를 acquire/release 로 나눠 쓰고, 목적지 구독은 연결 전에 걸어도 CONNECTED 마다 다시 건다. 재연결은 stompjs 지수 백오프이고, 사용자가 끊은 것(`disconnect`)과 서버 쪽 끊김은 `isActive()` 로 가른다.
- 데이터: `CraneSnapshot`(`@crane/domain/monitoring`) — craneId · bay · online · `tags{code → {value, quality, timestamp}}`. `/topic/cranes` 봉투(`type: 'snapshot'`)에는 push 주기 동안 바뀐 크레인만 실리므로 피드를 켤 때 `GET /api/cranes`(`getCraneSnapshots`)로 전체를 받는다. stompjs 자동 재연결 뒤에는 다시 받지 않는다 — 살아 있는 크레인은 heartbeat 로 다음 묶음에 실려 오지만, 끊긴 동안 offline 으로 바뀐 크레인의 전이는 놓칠 수 있다. 모양이 깨진 태그 항목은 `sanitizeCraneSnapshot` 이 버린다.
- 스토어: `useCraneSnapshotStore` — craneId → `CraneSnapshotEntry`(스냅샷 + 수신 시각 + heartbeat 가 마지막으로 뒤집힌 시각 + 태그별 변경 시각·횟수·관측 범위). 묶음마다 바뀐 크레인 항목만 새 참조라 카드는 자기 크레인만 구독한다. 연결이 끊겨도 값은 마지막 상태로 남는다.
- 피드: `useCraneSnapshotFeed(enabled)` 가 구독·REST·참조를 맡고(마운트 = 구독), 연결 표시는 `useCraneFeedConnection()`(useSyncExternalStore). 실시간 탭의 연결 해제(툴바 톱니 → 연결 설정 팝업: 호스트 주소 `getCraneFeedUrl()` · 상태 · 연결 해제/연결 버튼)는 그 화면의 구독만 놓는다 — 같은 클라이언트를 다른 화면이 잡고 있으면 소켓은 열린 채다.
- 3D 실시간 모드: `useCraneSnapshotRealtimeBridge(enabled)`(`packages/features/src/3d/model/use-crane-snapshot-realtime-bridge.ts`, `OutdoorWorkModelSimulation` 이 `mode === 'realtime'` 로 켠다)가 피드를 켜고, 스토어에 새 스냅샷이 들어온 크레인의 태그 **전부**를 `${craneId}.${tagCode}` 키로 `useRealtimeStore` 버퍼에 쌓는다 — 바뀐 태그만 쌓지 않는다. 묶음에는 바뀐 크레인만 실리고 `heartbeat` 가 매초 뒤집히므로 살아 있는 크레인은 매초 재발행되어 `tagLiveValues.at` 가 갱신되고(정지 중 ↔ 두절 판정, `lib/model-runtime-status.ts`), 죽은 크레인은 묶음에서 빠져 at 이 멈춘다. 켤 때와 보류(held) 해제 때는 스토어의 스냅샷 전부를 한 번 쌓는다. 보류(`scene-collision-hold.ts`)는 그대로이고 관제 HUD 의 수신 줄(`lib/feed-freshness.ts`)은 `craneStompClient` 상태와 스토어의 마지막 묶음 수신 시각을 본다.
- 러너(`useRealtimeRunner`)의 publish 스무딩 시간은 **키별 값 변화 간격**이다(`lib/realtime-smoothing.ts` 의 `createRealtimeCadenceTracker`·`resolveRealtimeSmoothTime`, 하한 `REALTIME_SMOOTH_MIN_S`·상한 `REALTIME_SMOOTH_MAX_S`). 1초마다 바뀌는 값은 1초 동안 미끄러져 다음 값에 닿아 연속 운동으로 보인다 — 기본 0.35초로 내보내면 0.35초 돌고 나머지를 서 있는 "휙휙" 이 된다(가상 태그 러너와 같은 규칙, 화면 지연은 한 수신 간격). 간격은 publish 가 아니라 값의 변화 사이로 잰다 — 브리지가 스냅샷의 태그 전부를 재발행하므로 publish 간격은 묶음 주기(heartbeat 1초, 실물은 250ms 까지)로 수렴해 그 태그의 변화 주기를 말해 주지 않는다. 바뀌지 않은 재발행은 마지막 스무딩 시간을 이어받고, 첫 값과 그 재발행은 기본, 오래 멈춘 뒤 첫 변화는 상한이다. 간격 표는 러너 전용이며(`tagLiveValues.changedAt` 은 리플레이·시뮬레이션과 키 공간을 나눠 써서 쓰지 않는다) 시작·정지 때 비우고, 보류 중 버린 값은 재지 않는다.
- 상태 점: `resolveCraneLiveState` — 서버 `online=false` 나 연결 없음은 off(회색), `heartbeat` 가 `HEARTBEAT_STALE_MS` 안에 뒤집혔으면 live(초록 맥동), 값은 오는데 안 뒤집히면 stale(노랑). 첫 수신 직후엔 수신 시각을 기준으로 삼는다.
- 표시명·단위·묶음은 `getMonitoringTagMetadata`(영문) 그대로. 묶음 안 정렬은 코드의 숫자 인식 사전순이고 시각 태그만 큰 단위 → 작은 단위(`tag-rows.ts`).
- dev 는 `apps/shell/.env.local` 의 `VITE_DEV_PROXY_TARGET_HTTP/WS`(서버 `http://localhost:8080`)로 `/crane_rnd/{api,ws}` 를 프록시한다. 운영은 nginx 가 같은 경로를 `BACKEND_HOST:PORT` 로 보내고, 서버 쪽 `cis.web.allowed-origins` 에 셸 주소가 있어야 한다.

### 가상 태그 `@crane/domain/virtual-tag`

서버 없이 태그 값을 만드는 정의다. 실시간 태그와 같은 모양의 **장비 › 그룹 › 태그** 계층이고 저장 포맷은 버전 2(`VirtualTagSet{ tickMs, equipments[] }`)다.

- 장비 `VirtualEquipment` = 장비 ID(`craneId`, 표시용 그대로) · 이름 · 구역 · `enabled` · `groups[]` · `tags[]`. 장비 ID 유일성은 정규화 키(하이픈→밑줄, `normalizeVirtualEquipmentKey`) 기준이라 `GC-04` 와 `GC_04` 는 같은 장비다. 꺼진 장비의 태그는 태그가 켜져 있어도 내보내지 않는다.
- 그룹 `VirtualTagGroup` 은 장비별 사용자 정의 분류(id·이름·`preset?`)이고 배열 순서가 표시 순서다. 등록 때 `createDefaultGroups` 로 기본 그룹 셋(시각·계측값·상태·알람, 표식 `datetime|measurement|status`)을 시드하고 이름은 호출자가 번역해 넘긴다. 표식은 실시간 복제가 카탈로그 묶음을 넣을 그룹을 찾는 데만 쓰고 이름을 바꿔도 남는다. 그룹을 지우면 그 태그는 미분류(`groupId` 없음)가 된다.
- 태그 `VirtualTagDefinition` = `code`(장비 안 유일, 공백·콜론 없음) · 이름 · `groupId?` · `dataType`(number|bool) · 범위·`initial` · `pattern`(manual|triangle|sine|sawtooth|square) · `enabled` · `limits?`. 불리언은 범위 0~1·초기값 0/1 로 강제하고 패턴은 manual·square 만, 단위·한계가 없다(sanitize). 버스는 숫자 전용이라 0/1 로 나가고 표시만 ON/OFF 배지다.
- **키는 저장하지 않는다.** `buildVirtualTagKey(craneId, code)` = `장비키:코드`(콜론)로 조립하고, `collectVirtualTagEntries` 가 계층을 평탄화한 `VirtualTagEntry{key, equipment, tag}` 를 러너·카탈로그가 본다. 콜론 구분자가 실시간 키(점)와 키 공간을 가른다. 코드나 장비 ID 를 바꾸면 키가 바뀌어 씬이 연결한 가상 슬롯은 미등록이 된다.
- 버전 1(평탄 키 목록)은 로드 때 `migrateVirtualTagSetV1` 이 첫 콜론에서 나눠 장비로 묶는다(장비 id `legacy-<장비키>`, 콜론 없는 키는 `UNASSIGNED` 장비, 변환된 태그는 숫자·미분류). 조립한 키가 원래 문자열과 같아 philly-2dock 씬의 참조가 그대로 풀린다. 버전 1 의 시나리오는 버린다.
- 전역 스토어 `useVirtualTagStore` 가 `equipments` 와 파생 `entries` 를 들고 있다. 편집은 전부 스토어 액션(장비·그룹·태그 CRUD, `importTags`)을 지나며 `commit` 한 곳에서 `entries` 를 다시 만들고 러너에 `syncDefinitions` 한다. 편집은 메모리에만 쌓이고 저장 버튼(`save()`)이 기록한다. dirty·미저장 이탈 경고는 씬 편집과 같은 훅을 재사용한다.
- 영속화는 씬과 같은 규칙(`virtual-tag-storage.ts`). dev 는 `POST /__dev/virtual-tags` 로 배포 파일 `apps/shell/public/simulation/virtual-tags.json` 에 기록하며 이 파일이 클론·배포의 기준값이라 커밋한다. 운영은 localStorage `crane:virtual-tags` 에 배포 해시 도장(`baseVersion`)과 함께 봉투로 저장하고, 새 배포가 나오면 배포본이 이긴다. API 경로 문자열은 `vite.config.ts` 와 `virtual-tag-storage.ts` 두 곳에 있다 — `docs/agents/3d-editor.md`.
- 러너 `virtualTagRuntime`(모듈 전역 `setInterval`, Canvas 불필요)은 상태를 **키** 기준으로 들고 틱마다 켜진 항목(장비·태그 둘 다)만 버스로 내보낸다. 정의의 범위·초기값·패턴·형식·한계가 바뀌면 그 키의 상태를 initial 로 다시 잡고, 이름·그룹만 바뀌면 유지한다.
- 재생을 켜는 곳: 모니터링 `mode='simulation'` 은 `useSceneData` 의 `autoStartSimulation`(기본 true — 대시보드 3D 미리보기 모달은 ▶ 토글이 없는 뷰라 false 로 정지 상태로 연다). 3D 플레이(`mode='play3d'`, 소스 시뮬레이션)은 상단 트랜스포트 바 ▶ 가 켠다(자동 재생 없음). 실시간 페이지(`mode='realtime'`)에는 시뮬레이션 UI 가 없다. 태그 페이지 가상 탭의 공통 바(재생·값 초기화·갱신 주기)는 전역이다.
- **실시간 복제**(`lib/virtual-tag-clone.ts` `cloneTagsFromSnapshot`, 순수)는 크레인 스냅샷 한 대분을 태그 정의로 바꾼다 — 코드·표시명·단위는 카탈로그 메타(`buildTagRows`), 불리언 값은 bool 형식, 초깃값은 현재값, 범위는 접속 후 관측 범위(한 점이면 `fallbackRange` 기본 폭), 패턴은 수동, 그룹은 카탈로그 묶음의 표식 그룹(없으면 새로 만들어 함께 돌려준다). 1회 스냅샷이고 이후 실시간과 무관하다. 진입점은 장비 등록 다이얼로그의 복제 탭과 실시간 상세의 "가상 장비로 복제" 버튼이며 둘 다 `importTags` 로 넣는다(코드 중복·상한은 건너뛴다).
- 카탈로그 `useTagCatalog`(평탄, 꺼진 항목 포함)·`useTagCatalogEquipments`(장비 › 그룹 › 태그)는 태그 연결 다이얼로그의 가상 탭과 카드 칩이 본다. 서버 태그는 여기 합치지 않는다 — 다이얼로그의 실시간 탭이 스냅샷 스토어에서 크레인별로 직접 고른다.

### 시뮬레이션 시계

- 러너(`virtual-tag-runner.ts`)는 벽시계 dt × `speed`(스토어 세션값, 선택지 `SIMULATION_SPEED_OPTIONS`)를 씬 시간으로 누적하고, 값은 `tickMs` 고정 스텝으로만 적분한다(`advanceTo`) — 같은 씬 시각의 값은 경로·틱 지터와 무관하게 같다. `seek(ms)` 는 0 초 상태에서 ms 까지 다시 적분해 내보낸다(재시뮬레이션, 비용은 스텝 수에 선형). 정지 중에도 동작하도록 `attachConfig` 로 getter 만 붙여 둔다. 타이머 간격은 `tickMs / speed`(하한 `TIMER_MIN_MS`)라 배속이 높아도 스텝마다 내보낸다.
- `start()` 는 현재 상태값만 내보내고 재시뮬레이션하지 않는다. 0 초 상태는 전부 initial 이다. seek 는 manual 태그의 슬라이더 값을 유지하고, 리셋은 전부 initial 로 돌린다. 시뮬레이션은 끝이 없는 열린 구간이다 — 3D 플레이 트랜스포트의 `durationMs` 는 항상 null.
- **종료(관제 복귀)** 는 `stop-simulation.ts` 의 `stopSimulation()` 한 곳이다 — 패널 ■·화면 진입/이탈이 전부 이걸 부른다. 내용은 충돌 세션 기록·정지 상태 `clearHistory()` + 스토어 `stop()`(러너 정지·시간 0 — publish 없는 `resetValues(false)`·배속 1) + `rigValueStore.reset()`(rest 복귀) + `tagLiveValues.clear()`(운전 상태 unknown) + 실시간 `release()`. 일시정지(자세 유지)와 다른 경로다.
- 모니터링 `useSceneData` 와 에디터 페이지는 **진입·이탈 모두** `stopSimulation()` 을 불러 화면마다 깨끗한 시뮬레이션으로 시작한다.
- UI: 공용 패널 `scene-simulation-panel.tsx`(재생·리셋·종료·배속·경과 시각)를 3D 플레이 트랜스포트 바 팝오버가 쓴다. 재생 위치 이동은 트랜스포트 바의 스크럽 하나다. 경과 시각 문구는 `sim-clock.ts`.
- **시뮬레이션 중 표시** `scene-simulation-badge.tsx` 는 스토어 `hasSession`(start 에 true, stop 에 false, 일시정지 중에도 true)을 본다 — 캔버스 가장자리 하늘색 inset 테두리(재생 진하게·정지 흐리게) + 좌측 상단 배지(맥동 점·배속이 1 이 아니면 배속 — 표시 전용, 조작 버튼 없음). `Monitoring3dView` 좌측 상단 열 첫 항목이고 `toolbarLayout='none'` 은 제외.

### 속도·가속 한계

- `VirtualTagDefinition.limits?: {maxSpeed?, maxAccel?}` — 태그 단위/초·초², 양수만. 상세 표의 두 열(숫자 형식만).
- 러너가 파형 **목표값**을 향해 `rateLimitStep`(`rate-limit.ts` — 속도 상한, 가속 상한 + 이산 스텝 기준 정지 거리 상한(연속식은 한 스텝 늦어 목표를 지나친다), 오버슈트 클램프, 상태에 `velocity`)을 씬 시간 `tickMs` 고정 스텝마다 한 번 적용해 램프한다.
- 스텝이 씬 시간이라 한계는 배속과 무관하게 시뮬레이션 초 기준이고, 가속 프로파일도 배속·틱 지터와 무관하다.
- manual 슬라이더·리셋은 즉시(텔레포트). seek 는 재시뮬레이션이라 한계를 지킨 값이 나온다.
- 배포 필리 태그에 한계가 들어 있어 sine 파형은 한계에 잘려 평평해진다(의도 — 순간이동 방지).

### 리깅(관절 연동)

- 정의 `RigDefinition` = 관절 `hinge|slide` + 구속조건 `linear`("출력 관절 = 입력 관절 × factor + offset", 디자이너가 주는 공식 형태 그대로). 출력 관절은 driven 이 되어 슬라이더·태그를 받지 않고, 구속조건은 배열 순서대로 계산돼 체인이 된다.
- 정의는 자산 단위라 씬 상위 `rigs[]` 에 두고, 모델 인스턴스는 `rigId` 만 가진다. 관절 ← 태그는 `tagMappings` 의 joint 대상.
- 관절 값은 **항상 rest pose 기준 Δ** 다. `rest-pose-cache.ts` 가 clone 직후 잡은 GLTF 원본을 기준으로 매 프레임 `q = rest ∘ Δ` 를 다시 만든다. 노드 경로는 `mesh-path.ts` 의 `[index]name/...` 형식 그대로.
- 값 소스는 `JointValueSource` 하나로 통한다. 에디터 슬라이더는 `manualJointSource`(씬 데이터·히스토리에 남지 않음), 태그는 `createTagBindingSource`. 시뮬레이션 재생 중 태그가 꽂힌 관절의 슬라이더는 잠긴다.
- 리깅 가능한 자산은 돌아야 하는 부품마다 Empty 노드가 있어야 하고 메쉬는 그 Empty 의 자식이어야 한다. 메쉬를 든 잎 노드는 최적화(`optimize-glb.mjs` 의 meshopt 양자화)가 translation·scale 보정을 노드 자체에 실어 원점이 메쉬 바운즈 중심으로 옮겨진다 — 메쉬가 없는 Empty 는 건드리지 않는다. `LLC_002.glb` 는 참고 프로젝트의 리깅본(루트 scale 을 `scripts/unbake-root-transform.mjs --fold-scale` 로 자식에 접어 넣어 실제 미터, 배치 scale 1)이다. 옥포 OC(`okpo_oc.glb`)는 `okpo.json` 의 `rigs[]` 에 리그가 있다 — 입력 관절 `Link_Upper.001` 하나에 나머지 5개(`Link_Upper.002/003`·`Connector`·`Link_Lower.001`·`Link_End`)가 디자이너 비율의 선형 구속으로 매달리며, 모든 Empty 의 로컬 X 가 러핑 평면 법선이라 관절 축은 전부 `x` 다. 옥포 TC·TTC 는 `*_Top` Empty 를 hinge(축 `y`)로 돌리는 선회 리그다 — 디자이너 파일의 잎 메쉬를 Blender 에서 `*_Top(Empty) › *_Top_Mesh` 로 내린 버전이고, Empty 는 마스트 단면 중심에 둔다. 옥포 Goliath 는 `Trolly_*` 노드를 slide(position) 맵핑 대상으로 쓴다(부모 프레임 평행이동이라 자기 원점과 무관). 그 외 카탈로그 크레인은 단일 메쉬라 관절을 정의할 수 없다. 모델 최적화 파이프라인(`scripts/optimize-glb.mjs`)은 join/prune 을 쓰지 않아 Empty 계층·이름이 보존된다.
- 리깅 노드에 `meshOverrides` 가 함께 있으면 드라이버가 이긴다(rest = GLTF 원본).
- 관절·맵핑 정의 편집으로 드라이버 인스턴스가 해체·재생성되면 rest 점프가 생기므로 그림자 무효화가 배선돼 있다 — `docs/agents/rendering-perf.md`.

## 불변식

- 관절·태그 값은 항상 rest 기준 Δ 로 적용한다. `rotation.x = θ` 같은 절대 대입은 Blender Empty 의 비항등 rest 를 파괴하므로 금지.
- 메쉬를 든 노드를 hinge 로 직접 돌리지 않는다. 돌릴 부품은 Empty 아래에 메쉬를 두고 Empty 를 돌린다 — 잎 메쉬 노드는 최적화가 원점을 바운즈 중심으로 옮긴다. slide 는 자기 원점과 무관하다.
- 태그 값 생산자를 새로 만들면 `publishTagValue` 로만 내보낸다 — 버스가 단일 진입점이고, 표시 캐시·바인딩·운전 상태 판정·3D 플레이 통계가 전부 여기서 갈라진다.
- 시뮬레이션을 끝내는 코드는 `stopSimulation()` 을 부른다. 스토어 `stop()` 만 부르면 값 저장소·충돌 기록·실시간 보류가 남는다.
- 같은 대상(노드·채널·축 / 관절)에 맵핑을 두 개 만들지 않는다 — sanitize 가 뒤 항목을 조용히 버린다.
- 버스에 숫자가 아닌 값을 싣지 않는다. 서버 값의 형식이 늘면 `toTagNumber` 한 곳에서 받는다.
- 상태 태그를 craneId 규칙으로 유추하지 않는다 — craneId 없는 모델이 있고 사이트마다 태그 코드가 다르다. 씬에 연결된 키만 읽는다.
- 라벨 미리보기는 씬 데이터·히스토리·태그 값 버스에 쓰지 않는다. 상태 태그 구역을 접거나 탭·선택 모델이 바뀌면 `clear()` 한다 — 남으면 에디터 라벨이 저장된 상태처럼 보인다.
- 가상 태그 배포 파일 `virtual-tags.json` 을 바꿨으면 커밋한다 — 운영 localStorage 는 `baseVersion` 이 다르면 배포본으로 덮인다.
- 가상 태그 키는 조립값이다 — 저장본·스토어에 키 필드를 두지 않고 `buildVirtualTagKey` 로만 만든다. 콜론 구분자를 점으로 바꾸지 않는다 — 실시간 키와 같은 문자열이 되면 한 버스에서 소스가 섞인다.
- 장비 ID 의 유일성은 정규화 키(`normalizeVirtualEquipmentKey`) 기준이다 — 표기만 다른 장비를 둘 두면 키가 겹친다. sanitize·스토어·UI 검증이 같은 규칙을 쓴다.
- `equipments` 는 스토어 액션으로만 바꾼다 — `entries` 파생과 러너 `syncDefinitions` 가 `commit` 한 곳에 묶여 있다. 밖에서 `setState` 하면 러너가 옛 정의를 돈다(테스트는 `entries` 를 함께 세운다).
- 실시간 복제는 `cloneTagsFromSnapshot` → `importTags` 경로만 쓴다 — 변환 규칙(형식·범위·그룹 표식)이 한 곳에 있고 import 가 중복·상한을 건너뛴다.
- 러너가 한계를 적용하는 대상은 목표값이다. 한계를 우회해 값을 즉시 넣어야 하면 manual·리셋 경로(텔레포트)를 쓴다. seek 는 우회하지 않는다.
- 시뮬레이션 값은 씬 시간의 함수다 — 재생 tick 과 seek 가 같은 고정 스텝 적분기(`advanceTo`)를 쓴다. seek 에서 목표값을 직접 대입하거나 벽시계 dt 로 적분하지 않는다. 3D 플레이 타임라인의 사건 시각으로 옮기면 재생 때 그 시각의 자세가 나와야 한다(`docs/agents/3d-play.md`).
- 위치 불연속(seek·리셋)의 publish 는 `smoothTime: 0` 이다 — 스무딩을 타면 자세가 미끄러져 감지기가 가짜 전이를 낸다.
- `TagMapping`·`StatusTagBinding` 에 필드를 추가하면 `sanitize-tag-mappings.ts`(`sanitizeTagKeySlots`)와 `scene-snapshot.ts` 의 `isTagMappingListEqual`·`isStatusTagsEqual`(둘 다 `isTagKeySlotsEqual` 로 두 슬롯 비교)을 함께 고친다 — 한쪽 슬롯만 바꾼 편집이 동등 단락에 먹혀 저장되지 않는다.
- 어느 슬롯을 읽을지는 `resolveActiveTagSlot` 한 곳이 정한다. 소비자에 `mode`·`source` 분기를 따로 두지 않고 슬롯을 인자로 받아 memo 의존성에 넣는다 — 3D 플레이의 소스 전환은 리마운트가 아니다.
- 두 슬롯을 한 인덱스에 함께 넣지 않는다 — 가상 태그가 서버 키와 같은 표기를 쓰면 마지막 publish 가 이겨 소스가 섞인다.
- 라벨의 태그 값 줄은 버스의 마지막 값(`readTagLiveValue`)만 읽는다. 맵핑의 적용값(`offset + value × scale`)이나 화면 위치에서 계산하지 않는다.

## 하지 않기로 한 것

- 러너 `start()` 에서 재시뮬레이션 — 한계로 뒤처진 값이 재개 순간 목표로 점프해 미끄러진다. 현재 상태값만 내보낸다.
- seek 에서 그 시각의 목표값을 바로 대입 — 한계로 뒤처진 재생 자세와 어긋나, 3D 플레이 타임라인 사건 시각으로 옮기면 크레인이 최대 수 초 앞선 자세로 보였다. 0 초부터 다시 적분한다.
- 가상 태그를 평탄한 키 목록으로 두는 것 — 장비 없이 키 문자열만 있으면 실시간 태그와 모양이 달라 복제도, 장비별로 모아 보는 것도 안 됐다. 장비 › 그룹 › 태그 계층으로 바꿨고 키는 조립한다.
- 고정 카테고리(시각·계측값·상태)로 묶는 것 — 사용자 정의 그룹(장비별)으로 바꿨다. 실시간 묶음과는 기본 그룹의 표식(`preset`)으로만 이어진다.
- 시나리오(태그 키별 키프레임 트랙) — 평탄 키 기준이라 장비 구조와 어긋나 통째로 뺐다. 다시 만들 때는 장비·코드 기준 트랙으로 새로 설계한다.
- 복제한 가상 태그가 실시간 값을 계속 따라가는 것 — 1회 스냅샷만 둔다. 라이브 연동은 러너가 스냅샷 스토어를 읽어야 해 값 생산자가 둘이 된다.
- 벽시계 dt 를 그대로 적분하는 rate limit — 큰 dt 는 가속 프로파일이 1~2틱으로 붕괴해 stop‑go 히치가 나고, 틱 지터로 같은 씬 시각의 값이 달라진다. 씬 시간 `tickMs` 고정 스텝으로 적분한다.
- 에디터에 시뮬레이션·시나리오 UI 를 두지 않는다 — 진입·이탈의 `stopSimulation()` 은 관리 페이지에서 켜진 러너가 넘어오지 않게 하는 방어다. 재생 UI 는 관리 페이지와 3D 플레이 트랜스포트 바에만 있다.
- 시뮬레이션 알림 toast — 배너·HUD·헤더 배지와 겹쳐 보여 소리·브라우저 알림만 쓴다(`docs/agents/monitoring-ui.md`).
- 레거시 `valueMapList`·`rigBindings`·단일 `tagKey` 를 저장본에 다시 쓰는 것 — 입력 전용, 로드 시 변환 후 소멸.
- 서버 태그를 `useTagCatalog` 에 합쳐 콤보박스 하나로 고르는 것 — 크레인 20대 × 태그 45개가 한 목록에 섞여 고를 수 없고, 서버에는 태그 정의 API 가 없다. 크레인 › 태그 두 단계의 다이얼로그로 고른다.
- 리그 관절의 회전 중심(pivot) 오프셋 필드 — 최적화가 옮긴 원점을 리그에서 되감는 우회였다. 값을 GLB 를 열어 손으로 재야 하고 재최적화·새 버전에서 틀어지며 회전 중심의 원천이 자산과 리그 둘이 된다. 모델에 Empty 를 둔다.

## 미룬 것

- 라벨 값 줄의 단위 표시·표시용 환산. 서버 태그의 원시 단위가 m 가 아니면(dock-in `tl_distance` 는 맵핑 scale 이 0.1 이다) 숫자가 m 로 읽히지 않는다.
- 맵핑되지 않은 태그(Load 등)를 라벨에 보이는 것.
- 다이얼로그의 "같은 태그를 전체 크레인에 적용" — 크레인마다 GLB 노드 경로가 달라(`3_Bay_C_800_Head_01` vs `3_Bay_C_172_Head`) 루트 대상에만 맞는다. 여러 크레인의 맵핑은 한 대를 에디터에서 맞춘 뒤 스크립트로 씬 JSON 에 일괄 생성하는 쪽이 맞다.
- 감지·3D 플레이 리포트가 의미 있는 씬은 `tagMappings` 가 있는 philly-2dock(가상 슬롯만 — 리플레이 소스에서는 "맵핑 없음")·dock-in(실시간 슬롯 — 주행 `legacy-pz`, 횡행·권상 `map-ts{n}`·`map-mh{n}`·`map-ah{n}`)뿐이다. 옥포 실외·골리앗 씬은 맵핑이 없어 아무것도 움직이지 않는다.
- dock-in 횡행(`ts{n}_distance` → `…_Head_0n` position z)·권상(`mh{n}_height`/`ah{n}_height` → `…_Hook_0m` position y)의 scale·offset 은 가정값이다 — 횡행 scale 0.001, 횡행 값 0 = 트롤리가 거더 끝(트롤리가 하나면 모델 −z 끝, 둘이면 각자 가까운 끝), 권상 scale 0.01·offset = −(배치 y + 훅 바닥 y), 번호는 같은 트롤리 안 큰 훅이 주권. 서버 값의 단위·기준점·방향·트롤리/훅 번호 대응표가 PLC 쪽에서 오면 바꾼다.
- 상태 태그를 연결한 배포 씬은 dock-in 하나다(운전 전원 `crane_control_on`, 고장 `crane_system_error`, Bypass `accs_bypass_on`). 서버의 상태 값 형식이 정해지면 맞춘다 — 비트 묶음 워드(역할별 비트 번호), 반전 비트, 모션 run 비트(지금 가동은 축 값 변화로 추정한다), 모션별 Slowdown·Endstop 비트(지금은 역할마다 태그 하나라 모션별로 오면 역할 값을 태그 목록으로 넓혀야 한다).
