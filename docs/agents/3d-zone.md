# 모델 영역(zone) 침범 감지 · 알람 브릿지 · 저널 · 씬 unit 스케일

모델마다 붙는 수직 원기둥 영역에 다른 모델(메쉬 또는 영역)이 들어오는지를 **상태 기반**으로 감지하고, 링·배지·비네트·HUD·알람 목록·저널로 알리는 계통. 충돌 감지(`docs/agents/3d-collision.md`)와 별도 스토어이며 기준선·억제·자세 복원이 없다.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 스키마(`SavedModelInfo.zones`·`zoneExempt`, `SavedModelZone`·`level`) | `packages/domain/src/3d/model/types.ts` |
| 방어(sanitize) | `packages/domain/src/3d/lib/sanitize-model-zones.ts` (`sanitize-scene-info.ts` 가 모델마다 호출) |
| 기하(XZ 원 ↔ 삼각형, 영역 중심) | `packages/domain/src/3d/lib/zone-volumes.ts` (`meshIntersectsVerticalCylinder`, `zoneCenterWorld`) |
| 런타임(React 밖 싱글턴 `sceneZoneRuntime`) | `packages/features/src/3d/model/scene-zone-runtime.ts` |
| 상수·키·히스테리시스(`zoneKey`, `zoneExitMargin`) | `packages/features/src/3d/lib/scene-zones.ts` |
| 스토어 | `packages/features/src/3d/model/use-scene-zone-store.ts` |
| 검출기 훅 / Canvas 컴포넌트 | `packages/features/src/3d/model/use-scene-zone-detector.ts`, `ui/scene-zone-detector.tsx` |
| 링·이름 배지 | `packages/features/src/3d/ui/scene-zone-rings.tsx` |
| 화면 경보(비네트) | `packages/features/src/3d/ui/scene-zone-alert-overlay.tsx` |
| 미니맵 영역 원 | `packages/features/src/3d/ui/scene-minimap.tsx` (`drawZones`) |
| 인스펙터 "영역" 탭 / 순수 로직 | `packages/widgets/src/3d/ui/zone-section.tsx`, `packages/widgets/src/3d/lib/zone-editor.ts` |
| 편집 채널·dirty 판정 | `updateSelectedZones` (`packages/features/src/3d/model/use-selected-scene-object-editor.ts`), `isZoneListEqual` (`packages/widgets/src/scene-editor/model/scene-snapshot.ts`) |
| 로컬 알람 / 알람 메타 | `packages/domain/src/alarm/lib/local-alarm.ts`, `lib/zone-alarm-meta.ts` |
| 침범 → 알람 브릿지(앱 셸) | `apps/shell/src/runtime/zone-alarm-bridge.tsx` |
| 저널 타입·키 | `packages/domain/src/journal/model/types.ts` |
| 저널 diff·동기화 | `packages/features/src/3d/lib/zone-journal-map.ts`, `lib/status-journal-map.ts`, `ui/zone-journal-sync.tsx`, `model/use-status-journal-sync.ts` |
| 저널 스토어 | `packages/features/src/3d/model/use-zone-journal-store.ts`, `model/use-status-journal-store.ts` |
| 씬 unit 스케일 | `packages/domain/src/3d/model/scene-unit-scale.ts` (`getSceneMetersPerUnit`) |

## 동작

### 스키마·방어

- `SavedModelInfo.zones?: SavedModelZone[]` — 항목은 `id`·`name`·`color`(`#rrggbb`)·`radius`·`offset?: [dx, dz]`·`level?: 'warn' | 'stop'`. `radius` 와 `offset` 은 **씬 unit** 이며 position 과 같은 단위다(옥포는 unit 이 m 가 아니다 — 아래 "씬 unit 스케일"). `offset` 은 월드 축 기준이고 `[0,0]` 이면 생략, `level` 은 `'stop'` 만 저장, 배열이 비면 필드 생략.
- `SavedModelInfo.zoneExempt?: boolean` — true 만 저장. 그 모델은 감지에서 통째로 빠진다: 침범자도 되지 않고 **자기 `zones` 도 감지하지 않으며** 링도 그리지 않는다(`buildEntry` 가 ZoneEntry 를 만들지 않고, `SceneZoneRings` 가 같은 플래그를 보고 선택 중이어도 건너뛴다). 정의는 남아 제외를 풀면 되살아난다. 침범 중 제외로 바뀌면 양쪽 다 합성 exit(`liveZoneKeys`·`liveIntruderIds` 가 같은 기준).
- `sanitize-model-zones.ts`: 반경 ≤0·NaN 항목 버림, 중복 id first-wins, 색은 `#rrggbb` 만 소문자 정규화하고 그 외는 `DEFAULT_ZONE_COLOR` 폴백.

### 기하·판정

- 판정은 **Y 를 무시하는 무한 수직 원기둥**이다. `meshIntersectsVerticalCylinder` 는 원기둥을 메쉬 로컬로 보내지 않고, BVH 노드 박스·삼각형을 `matrixWorld` 의 X·Z 행으로 월드 XZ 에 투영해 2D 원↔삼각형으로 판정한다 — 기울어진 메쉬·비균일 스케일도 정확하다.
- BVH 가 없으면 `null` 을 돌려주고 AABB/OBB 로 대신 답하지 않는다. 회전한 긴 붐의 박스는 오탐이고, 그 진입 기록은 영구 행으로 남기 때문이다.
- 영역 중심은 소유 루트 `matrixWorld` 의 평행이동 + 오프셋(`zoneCenterWorld`, yaw 는 반영하지 않는다).

### 런타임(scene-zone-runtime)

- 충돌 런타임과 같은 골격: 모델 레지스트리 루트가 항목, 메쉬 `matrixWorld` 서명으로 dirty 판정, job 사이 시간 예산(`ZONE_SCAN_BUDGET_MS`). 메쉬 수집도 같은 `collectCollidableMeshes`(LOD 는 항상 LOD0, `docs/agents/3d-collision.md`).
- **상태 기반**이다. 기준선·억제 없이 "안에 있으면 침범 중" 이고, 돌려주는 것은 전이(enter/exit)뿐이다.
- 영역 중심은 소유 루트의 `rootLast` 서명으로 따로 추적한다 — 트롤리만 움직이면 그 모델은 침범자로만 재검사한다.
- 영역 × 다른 모델 메쉬는 AABB XZ → 삼각형, 영역 × 다른 모델 영역은 중심 거리 ≤ r1+r2 인라인. 같은 모델의 영역끼리·소유 모델 자신은 제외하고, 영역↔영역 전이는 a 쪽에서 한 번만 낸다.
- 히스테리시스: 진입 r, 이탈 r + `zoneExitMargin(r)`(반경 비례 — 떨림 원인이 PLC 주행값 노이즈라서).
- inside 집합은 `zoneKey`(`modelId#zoneId`)로 런타임이 들고 있어 항목 재생성(반경·이름 편집·리마운트)에도 유지된다. 합성 exit 의 기준은 job 존재가 아니라 **씬 모델 목록**이다(sync 직후 재해석 전 쌍을 사라진 것으로 보면 이름만 바꿔도 exit+enter 가 난다).
- 씬에 영역이 없으면 변화 감지도 건너뛰어 비용 0.

### 스토어(use-scene-zone-store)

- `enabled`·`labelsVisible`·`stopOnIntrusion` 은 감지 설정 봉투에서 읽고 쓴다(기본값·키·병합 규칙은 `docs/agents/3d-collision.md` "감지 설정").
- `intrusions` — 침범자가 1개 이상인 영역만. 영역↔영역은 양쪽 항목에 거울상으로 들어간다.
- **기록(history)은 없다** — 상태만.
- `applyTransitions(transitions, allowHold)` 가 전이를 반영한다. `'stop'` 영역 진입은 `stopOnIntrusion` ON 이고 `allowHold` 일 때 충돌과 같은 `holdRunners`(시뮬레이션 pause·실시간 화면 반영 보류)로 멈추고 `held` 에 그 쌍 하나를 둔다.
- `resume` 은 `releaseRunners` + 그 쌍을 `acknowledged` 에 넣어 **이탈 전까지** 다시 멈추지 않는다(아니면 재생 즉시 같은 침범으로 또 멈춘다). 이탈·감지 off·clear·`stopOnIntrusion` off 는 정지·승인을 푼다.
- 프레임 거버너의 활성 소스에 `intrusions.length > 0` 이 들어간다(`docs/agents/rendering-perf.md`).

### 검출기(use-scene-zone-detector)

- Canvas 안 `RigDriver` 뒤, `SceneCollisionHighlight` 다음에 마운트하고 `ZONE_SCAN_INTERVAL_MS` 로 스로틀한다.
- **스캔은 러너 여부와 무관**하게 돈다(에디터 드래그 피드백). `runner` prop(기본 `'simulation'`)은 ▶ 재개 전이(`subscribeRunnerResume`)를 보기 위한 것이고 스캔 게이트가 아니다.
- 실시간 모니터링은 `applyTransitions(transitions, allowHold=false)` 로 넘겨 **멈추지 않는다**(충돌과 같은 원칙).
- `moved`·전이 프레임에 `invalidate()` 를 불러 demand 캔버스에서 마지막 자세가 미검사로 남거나 링이 낡는 것을 막는다.
- 재개 UI 는 러너 ▶ 하나다(시뮬레이션·3D 플레이 트랜스포트).

### 링·배지(scene-zone-rings)

- 검출기 **바로 다음**에 마운트. 모델 루트에 portal 하지 않고 씬 수준 형제로 useFrame 마다 레지스트리 루트 월드 위치를 따라간다(스케일·yaw 상속으로 반경 단위가 깨지는 것을 막기 위해). 단위 지오메트리 + 그룹 scale = r, `meshBasicMaterial toneMapped=false`(solar 밤에도 색 식별), renderOrder 는 바다(0.25) 위. key 는 `zoneKey`(중심값 key 는 매 틱 리마운트).
- 침범 중이면 자기 색의 채움이 진해지고 `ZONE_PULSE_HZ` 로 펄스한다. **색은 식별자일 뿐 상태를 실어 나르지 않는다**(빨강 덮어쓰기 없음).
- 이름 배지는 drei `Html`. 침범 중엔 배지 우상단에 빨간 점 + 그 영역의 침범자 수 — 모델 라벨이 아니라 **영역 배지**에 붙는다. `labelsVisible` 이 꺼지면 배지만 통째로 언마운트되고 감지·링은 그대로다.
- 에디터는 `selectedModelId` 를 넘겨 **감지 토글이 off 여도 선택 모델의 영역은 그린다**(반경 편집 피드백, 판정은 멈춤).

### 화면 경보·알람 목록·HUD·미니맵

- `scene-zone-alert-overlay.tsx` 는 가장자리 비네트만(amber/red). 충돌 경보가 떠 있으면 아무것도 그리지 않는다.
- [영역 보기]는 우상단 알람 목록의 `zone_intrusion` 행 버튼이다. `features/alarm` 의 `AlarmFullscreenOverlay onViewZone` 을 페이지가 `Monitoring3dView actionsRef.viewZone` 에 잇는다 — 두 슬라이스는 같은 레이어라 서로 import 하지 않는다. 카메라 포즈는 충돌의 `computeCollisionViewPose` 재사용. 행의 색 점은 알람 `eventData.color`, 파싱은 `@crane/domain/alarm` `getZoneAlarmMeta`. 이 목록의 배지는 위험 수준 라벨(`getAlarmRiskLevelLabel`)이고 설명 줄 대신 발생 시각을 보인다. 골리앗 실시간 화면은 알람 오버레이 자체가 없어 [영역 보기]도 없다.
- HUD 에 침범 칸이 있다(씬에 영역이 있을 때만, 정지 중엔 "n · 정지"). 가동 칸은 값 생산이 멈춘 동안 "정지 중". HUD 자체는 `docs/agents/monitoring-ui.md`.
- 미니맵 `drawZones`: 마커 아래에 같은 중심·색으로 원을 그리고 침범 시 채움이 진해진다. 2px 미만은 생략. 영역 원 hover 는 소유·이름·침범자 목록 라벨. 미니맵 자체는 `docs/agents/monitoring-ui.md`.
- 마운트 범위: 모니터링은 전 모드(실시간·3D 플레이·미리보기), 에디터는 `scene-objects-edit-canvas.tsx`.

### 인스펙터 "영역" 탭(zone-section)

- 카드마다 이름·색(`<input type="color">`)·반경·오프셋 X/Z, 경고/정지 토글. 상단에 "영역 감지에서 제외" 체크박스(`zoneExempt`) — 켜면 아래 목록이 비활성·흐림 처리되고 값은 보존된다.
- 순수 로직은 `zone-editor.ts`: 새 영역 반경은 `measureModelFootprintRadius`(루트 원점에서 보이는 메쉬 월드 AABB 합집합의 가장 먼 XZ 모서리까지 = 모델을 딱 감싸는 원, 미로드면 `DEFAULT_ZONE_RADIUS`), 추가 시 이름은 "영역 n" 을 실제 값으로 저장(배지에 id 노출 방지), 색은 `ZONE_COLOR_PRESETS` 순환.
- 편집 채널은 `updateSelectedZones`(세션·페이지에 배선). **dirty·히스토리는 `scene-snapshot.ts` 의 `isZoneListEqual` 이 잡는다** — 비교에서 빠진 필드는 편집이 동등 단락에 먹혀 저장되지 않는다.
- 반경·오프셋 수치 입력은 `unitsToDisplayMeters`/`displayMetersToUnits` 로 m 환산해 보인다(저장은 unit).

### 침범 → 알람 계통

- 로컬 알람은 `@crane/domain/alarm` 의 `createLocalAlarm`/`localAlarmActiveKey`(id `local:<type>:<subject>:<at>`(+`:clear`), `eventType 'zone_intrusion'`), 스토어 `useRealtimeAlarmStore.upsertLocalAlarm(alarm, key)`.
- 브릿지는 **앱 셸** `apps/shell/src/runtime/zone-alarm-bridge.tsx` 다. 침범 쌍 생성 = 발생(`stop` → high, `warn` → medium), 소멸 = 해제. `eventData` 는 `zoneKey`·`intruder`·`color`.
- 실시간 화면의 침범만 알람이 된다(`filterAcceptedZoneTransitions`, 아래 저널과 같은 규칙).
- craneId 는 소유 모델의 craneId, 없으면 모델 id 다. 그래서 지역 필터는 `isAlarmInRegion`(레지스트리 craneId **또는** `alarm.regionId === regionId`)으로 통과시키며, 알람 슬라이스의 모든 필터 지점이 이 헬퍼를 쓴다.
- 영역 침범 로컬 알람은 critical 배너 대상에서 제외한다(`eventType 'zone_intrusion'`) — 3D 화면 경보와 겹침 방지. 경보 소리·브라우저 알림은 `docs/agents/monitoring-ui.md`.

### 영역·운전 상태 저널

- `@crane/domain/journal` 의 `ZoneJournalEntry`(진입·이탈 각 항목, 이탈에 `durationMs`)·`StatusJournalEntry`(**통신두절 진입·복귀만** — 가동↔대기는 제외, 첫 unknown→x 도 제외). 키는 `ZONE_JOURNAL_STORAGE_KEY`·`STATUS_JOURNAL_STORAGE_KEY`.
- 순수 diff `diffZoneIntrusions`(두 스냅샷의 쌍 차이로 사건 복원 — 경보 알림·알람 브릿지도 같은 함수)·`diffOfflineTransitions`(`status-journal-map.ts`). 동기화는 `zone-journal-sync.tsx`(앱 셸 runtime effects)와 `use-status-journal-sync.ts`(`Monitoring3dView`, `enabled` = 실시간만).
- **실시간 화면의 사건만 남긴다.** `useSceneInfoStore.activeMode`(`useSceneData` 가 진입 set·이탈 null)와 `isRealtimeSceneActive()` 로 충돌 기록·영역 진입·두절 진입을 받고, 영역 이탈은 `filterAcceptedZoneTransitions` 로 **진입을 승인했던 쌍만** 받는다 — 언마운트 cleanup 은 부모(`useSceneData`)가 자식(검출기 clear)보다 먼저라 `activeMode` 만 보면 실시간을 떠날 때의 이탈이 버려진다.
- 3D 플레이·에디터·미리보기의 사건은 저널·로컬 알람·경보 소리 어디에도 가지 않는다(3D 플레이는 실행 리포트가 대신, `docs/agents/3d-play.md`).
- 대시보드 소비는 아직 없다.

### 씬 unit 스케일

- `getSceneMetersPerUnit(regionId)` — 옥포 3개 region 은 unit 당 수 m, 필리 2개는 1 m(미등록도 1).
- 지금 m 로 환산해 보이는 곳은 인스펙터 영역 탭의 반경·오프셋만이다. 트랜스폼 위치 필드는 아직 unit 을 " m" 로 표기한다.
- 골리앗 LiDAR 의 `METERS_PER_UNIT` 은 센서 보정값이라 별개다.

## 불변식

- `SavedModelZone` 에 필드를 추가하면 `sanitize-model-zones.ts` 와 `scene-snapshot.ts` 의 `isZoneListEqual` 을 함께 고친다 — 비교에서 빠지면 편집이 동등 단락에 먹혀 저장되지 않는다.
- 저널·로컬 알람·경보 소리는 **실시간 화면의 사건만** 받는다: 진입은 `isRealtimeSceneActive()`, 이탈은 `filterAcceptedZoneTransitions`. 3D 플레이·에디터·미리보기 사건을 이 경로에 넣지 않는다.
- `features/3d` 와 `features/alarm` 은 같은 레이어라 서로 import 하지 않는다. 둘을 잇는 코드는 앱 셸 runtime(`zone-alarm-bridge.tsx`) 또는 페이지의 콜백 배선(`onViewZone` ↔ `actionsRef.viewZone`)에 둔다.
- Canvas 마운트 순서: `RigDriver` → 충돌 검출기 → `SceneCollisionHighlight` → `SceneZoneDetector` → `SceneZoneRings`(검출기 바로 다음).
- 실시간 모니터링은 `applyTransitions(…, allowHold=false)` — 어떤 영역 등급에서도 멈추지 않는다.
- 정지·재개는 충돌과 같은 `holdRunners`/`releaseRunners`/`subscribeRunnerResume` 만 쓴다.
- 판정은 BVH 삼각형만. BVH 가 없으면 `null` 이고 AABB/OBB 로 대신 답하지 않는다.
- 링의 색은 식별자다 — 상태를 색으로 덮어쓰지 않는다(침범은 채움·펄스로).
- 영역 반경·오프셋은 씬 unit 으로 저장하고 표시할 때만 `getSceneMetersPerUnit` 으로 환산한다.
- 알람 슬라이스에서 region 으로 거를 때는 `isAlarmInRegion` 을 쓴다(craneId 없는 로컬 알람이 걸러지지 않게).

## 하지 않기로 한 것

- 영역 침범 기록(history)은 두지 않는다 — 상태(`intrusions`)만. 이력은 저널(실시간)과 실행 리포트(3D 플레이)가 맡는다.
- 침범 목록 패널·독 팝업·에디터 팔레트 "영역" 탭·패널 안 재개 버튼은 두지 않는다 — 현재 침범은 알람 목록·HUD 칸·링·비네트가 보이고 설정은 감지 설정 페이지, 재개는 러너 ▶ 다.
- 상단 배너는 두지 않는다 — 비네트만.
- 침범 시 링을 빨강으로 바꾸지 않는다 — 색은 어느 영역인지 식별하는 값이다.
- 새 영역 반경을 모델 가로 폭 전체로 잡지 않는다 — 링 지름이 모델의 두 배가 된다. `measureModelFootprintRadius` 를 쓴다.
- 링을 모델 루트 아래에 portal 하지 않는다 — 스케일·yaw 상속으로 반경 단위가 깨진다.
- BVH 없는 메쉬를 AABB/OBB 로 판정하지 않는다 — 회전한 긴 붐이 오탐을 내고 진입 기록이 영구 행으로 남는다.
- 히스테리시스 마진을 고정값으로 두지 않는다 — 떨림 원인이 PLC 주행값 노이즈라 반경 비례여야 한다.
- 합성 exit 의 기준을 job 존재로 하지 않는다 — 이름만 바꿔도 exit+enter 가 난다.
- 영역 이름을 비워 두고 id 를 표시하지 않는다 — 추가 시 "영역 n" 을 실제 값으로 저장한다.

## 미룬 것

- 높이 제한, 무시 목록, 저널 영속화 정책, 링·배지의 m 단위 표시, yaw 기준 오프셋(`zoneCenterWorld` 한 곳만 고치면 된다).
- 골리앗 실시간 화면의 알람 오버레이·[영역 보기].
- 트랜스폼 위치 필드의 m 환산.
- 저널의 대시보드 소비.
