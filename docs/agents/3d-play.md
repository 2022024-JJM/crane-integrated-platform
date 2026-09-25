# 3D 플레이 페이지 — 리플레이·시뮬레이션 재생과 실행 리포트, 장비 운전 상태 판정

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

라우트 구분: `3d-monitoring` 은 **실시간(WebSocket 만)**, `3d-replay` 는 **3D 플레이(분석)** 페이지다. 3D 플레이는 리플레이 | 시뮬레이션 소스를 한 3D 뷰에서 재생하고 우측에 실행 리포트를 둔다. 메뉴 라벨은 "3D 플레이"(`MonitorPlay` 아이콘).

## 진입점

| 관심사 | 위치 |
|---|---|
| 페이지 뷰 조립 | `packages/features/src/3d/ui/play3d-view.tsx` (`Play3dView`) |
| 소스 탭 / 트랜스포트 바 | `packages/features/src/3d/ui/play3d-source-tabs.tsx`, `ui/play3d-transport-bar.tsx` |
| 활성 소스 스토어 | `packages/features/src/3d/model/use-play3d-store.ts` (`usePlay3dStore.source`) |
| 트랜스포트 어댑터 | `packages/features/src/3d/model/play3d-transport.ts` (`Play3dTransport`), 리플레이 위치 변환 `lib/replay-position.ts` |
| 실행 통계 집계(순수) | `packages/features/src/3d/lib/play3d-stats.ts` (`computePlay3dStats`, `assignZoneBandsToRows`, `assignCollisionsToRows`), 시간 축·눈금·표식 조립·표시 보조 `lib/play3d-format.ts` (`timelineAxisMs`, `timelineRows`, `transportMarks`, `tagRowLabel`), 집계 범위 `lib/play3d-scope.ts` |
| 통계 스토어 / 기록기 | `packages/features/src/3d/model/use-play3d-stats-store.ts`, `model/use-play3d-stats-recorder.ts` |
| 리포트 패널 | `packages/features/src/3d/ui/play3d-report-panel.tsx` (+ `play3d-report-kpi.tsx`, `play3d-report-timeline.tsx`, `play3d-report-tables.tsx`) |
| 타임라인·재생바 공용 | 눈금 행 `ui/play3d-tick-row.tsx`, hover 요약 `ui/play3d-hover-summary.tsx`, 분리 트리거 핸들 `@crane/ui/molecules/tooltip-handle` |
| 장비 운전 상태 | 타입 `packages/core/src/types/status.ts` (`EquipmentRuntimeStatus`), 판정 `packages/features/src/3d/lib/model-runtime-status.ts`, 훅 `model/use-model-runtime-statuses.ts` |
| 리플레이 프레임 시각 | `packages/features/src/3d/model/scene-time-source.ts`, `@crane/domain/monitoring` 의 `parseReplayTimestamp` |
| 앱 배치 | `apps/{hanwha-ocean,goliath-crane}/src/pages/*/ui/replay-monitoring-view.tsx` (`ResizablePanelGroup` 우측에 리포트) |

i18n 은 `monitoring:play3d.*`.

## 동작

### 레이아웃

- `Play3dView` 는 `Monitoring3dView mode='play3d' toolbarLayout='dock'` 위에 소스 탭(리플레이 | 시뮬레이션)과 트랜스포트 바를 **캔버스 위 별도 행**으로 둔다. 오버레이가 아니라 좌상단 열과 겹치지 않는다.
- 소스 탭은 role=tablist 버튼이다(공용 Tabs 컴포넌트 없음).
- 트랜스포트 바 구성: 시간 눈금 → 사건 표식 띠 → 스크럽(아래 "시간 축과 표식") · 소스 슬롯(리플레이 = 구간 검색 팝오버 `ReplaySearchForm`, 시뮬레이션 = `SceneSimulationPanel` 팝오버) · 이동/▶ · 배속(소스별 선택지) · 위치.
- 스크럽은 재생할 내용이 있으면(`hasContent`) 열린 구간(시나리오 없음)에서도 활성이고 범위는 축 전체다. 열린 구간은 재생 중 손잡이가 오른쪽 끝(닿은 지점)에 붙고, 왼쪽으로 끌면 그 시점부터 이어서 재생된다. 열린 구간에는 ⏭(끝으로)이 없다.
- 세 앱의 `replay-monitoring-view.tsx` 가 `ResizablePanelGroup` 우측에 리포트 패널을 둔다.

### 소스 전환

- `usePlay3dStore.source` 는 `'replay' | 'simulation'`, 세션 전용.
- 전환은 **리마운트가 아니라 상태 전환**이다. 씬·GLB·카메라·검색 상태·프레임이 유지되고, `Play3dView` 의 effect 가 떠나는 소스만 정리한다 — 시뮬레이션을 떠나면 `stopSimulation`, 리플레이를 떠나면 pause + seekTo(0).
- `useSceneData(mode='play3d')` 는 진입에 resetReplay + 가상 태그 로드만 한다. 자동 재생은 없다 — 시뮬레이션 소스도 트랜스포트 바 ▶ 가 켠다.
- 리플레이 소스는 `timeSource='replay'` 로 현장 시각·조명이 프레임 시각을 따르고(`docs/agents/rendering-perf.md`), `SceneClockMenu` 는 숨긴다.

### 트랜스포트 어댑터

- `Play3dTransport` 는 isPlaying · durationMs(null = 열린 구간) · speed · play / pause / seek(ms) / stepFrames 를 갖는다. `readPlay3dTransport()` 가 스냅샷, `usePlay3dTransport()` 가 훅이다.
- **위치는 트랜스포트에 포함하지 않는다** — `readPlay3dPositionMs()` 를 폴링한다.
- 리플레이는 프레임 누적 ms ↔ index 를 `lib/replay-position.ts` 로 변환한다. seek 는 충돌 스토어 `clearActive` 를 불러 옛 자세를 가리키는 pinned 박스가 남지 않게 한다.
- 시간 축은 **씬 시간**(리플레이 = 프레임 누적 ms, 시뮬레이션 = 러너 경과 ms)이다.
- 트랜스포트 바·마커 seek·통계·`scene-collision-hold` 가 전부 이 어댑터 하나만 본다. 충돌·영역 정지 시 어느 러너를 멈추는지(`'play3d'` 러너 = 활성 소스에 따라 리플레이 러너 또는 가상 태그 러너)는 `docs/agents/3d-collision.md`.

### 실행 통계

`computePlay3dStats`(`lib/play3d-stats.ts`, 테스트 대상):

- 사건은 `atMs ≤ windowEndMs`(현재 위치)로 창에 걸러진다. 뒤로 seek 하면 감춰질 뿐 지워지지 않는다.
- 장비 상태·태그 누적은 단조 누적. 정지(hold) 시간만 벽시계다 — 씬 시간은 정지 중 흐르지 않는다.
- 영역 체류는 진입~이탈, 미이탈은 창 끝까지, 진입 없는 이탈은 무시. 영역별 `byIntruder` 는 횟수 내림차순이라 첫 항목이 주 침범자다. 영역↔영역 침범은 양쪽 소유자에 거울상으로 기록되어 체류 합에 두 번 들어간다(현재 동작).
- 장비 행은 상태 누적이 있는 모델 ∪ 상태 전이가 있는 모델. 행마다 두절 횟수 외에 **노출**을 가진다 — 충돌 관여 횟수(사건의 `modelIds`)와 영역 체류(`assignZoneBandsToRows`: 침범자가 행이면 침범자 행, 아니면 소유 모델 행, 둘 다 없으면 버림). 타임라인의 체류 띠가 같은 배정을 쓴다.
- `summary` 는 KPI 카드용 전체 값 — 가동·대기 비율(분모는 unknown 을 뺀 시간), 두절 횟수·시간 합, 속도 한계 도달 비율이 가장 큰 태그.
- 회차 = floor(경과 / 시나리오 길이).
- 태그 `saturatedMs` = 연속 publish 속도가 `limits.maxSpeed` 근처(계수는 파일 상수) 이상인 씬 시간. 시뮬레이션만 — 러너가 한계로 자르므로 "최고 속도" 는 정보가 없다.

스토어 `use-play3d-stats-store.ts`(세션 전용, 영속화 없음):

- `data` 는 기록기가 **제자리 갱신**하고 `version` 을 낮은 빈도로 bump 한다. publish 마다 setState 하지 않는다.
- `reset(meta)` 가 실행의 시작점이다 — 마운트, 소스 전환, 새 구간 조회(프레임 참조 교체), 시나리오 변경, 시뮬레이션 종료(hasSession true→false). resetValues·seek(0) 은 뒤로 seek 일 뿐 reset 이 아니다.

기록기 `use-play3d-stats-recorder.ts` (`Play3dView` 가 Canvas 밖에서 한 번 마운트):

- 사건 = 충돌 기록, 영역 diff, 정지(충돌 pinned ∪ 영역 held) 전이, 두절 전이. 사건 시각은 스토어의 벽시계 `at` 이 아니라 **구독 콜백 안에서 읽은 트랜스포트 위치**(같은 틱, 동기)다. 충돌 사건은 양쪽 `modelIds`·`modelNames`(같은 순서), 영역 사건은 소유 모델 `ownerId` 를 싣는다.
- 짧은 주기 폴링으로 재생 중 지나간 구간을 `scanned`(합집합)·장비 상태 ms 에 더한다. 한 폴링에 배속 기준 기대치를 크게 넘게 뛰면 seek 로 보고 제외한다. `reachedMs`(위치가 닿은 가장 먼 지점)는 재생 여부·seek 와 무관하게 폴링마다 최댓값으로 갱신한다 — 시간 축의 앵커.
- **seek 는 로그를 바꾸지 않는다.** seek 신호(`model/scene-seek-signal.ts` — 발신처는 리플레이 스토어 `seekTo` 와 가상 태그 러너 `seek`/`resetValues` 뿐, 러너의 정상 전진은 알리지 않는다)와 reset 뒤 `SEEK_SETTLE_MS`(벽시계) 동안 영역·충돌 전이를 사건으로 남기지 않는다 — 자세가 리깅 스무딩으로 미끄러지는 동안의 전이는 seek 목표 시각의 사건이 아니다. 정착하면 런타임(영역 스토어 `intrusions`)과 로그를 화해한다: 런타임이 안인데 로그가 밖이면 진입, 로그가 안인데 런타임이 밖이면 이탈을 **잠정**(`provisional`)으로 넣는다. 정착 뒤의 전이와 화해는 모두 로그 기준 결정 `decideZoneEvent`(`lib/play3d-stats.ts`)를 거친다 — 로그에 이미 있는 시각의 재통과 전이는 넣지 않고(`REPASS_JITTER_MS` 안의 이른 관측은 그 사건을 앞당김), 잠정 사건은 실제 전이가 교체한다(제자리 수정이라 id·타임라인 key 유지). 충돌은 같은 쌍 ±`REPASS_JITTER_MS` 안의 중복을 넣지 않는다(`hasEventNear`). 정지·두절·상태 전이는 정착과 무관.
  - 정착 창 안(`SEEK_SETTLE_MS` × 배속, 시뮬레이션 재생 중 seek 에서만 — 리플레이 seek 는 항상 정지)의 실제 전이는 남지 않는다(짧은 체류·짧은 이탈). 정착 중 미끄러짐이 충돌 검출기(재기준선 없음)에서 hit 를 내면 스토어 기록·정지는 그대로 일어나고 리포트에는 `holdStart` 만 남는다. 폴링의 seek 휴리스틱(`maxStep`)은 1·2배속 리플레이의 긴 프레임 전진을 seek 로 오판해 `scanned` 가 비는 기존 문제가 있다 — seek 신호로 대체하는 것이 후속.
- 충돌 감지 off 는 `detectionOffSeen` 으로 남긴다.
- 태그는 버스 관찰자 `subscribeTagValues`(`tag-value-bus.ts`, 소비자 슬롯과 별개·다중 가능)로 publish 마다 집계한다 — 맵핑된 키만.
- 운전 상태는 `useModelRuntimeStatuses(scene, { paused, timeScale })` 로 받는다(아래). 밴드의 출처는 기록기가 남기는 `statusTransitions`(모든 전이, reset 직후 현재 상태를 unknown→x 로 심는다).
- **집계 범위**(`lib/play3d-scope.ts`): "영역 감지에서 제외"(`zoneExempt`)로 표시한 모델은 리포트에서 뺀다. 훅 결과를 `omitRuntimeStatuses` 로 한 번 걸러 누적·전이·시딩이 모두 따라오고(장비 표·타임라인 행·장비 수에서 빠진다), 그 모델이 끼인 충돌은 사건으로 남기지 않는다(`isCollisionExcluded`). 영역 사건은 런타임이 제외 모델을 애초에 감지하지 않는다. 맵핑이 없어도 제외 표시가 없는 모델은 '상태 미확인' 행으로 남는다.

### 리포트 패널

`play3d-report-panel.tsx` 가 조립한다. 개요 → 상세 순이고, 같은 사실은 한 자리에서만 보인다.

1. 헤더 — 소스·구간, 창·검사된 구간(창 대비 비율)·회차, 정지가 있었을 때만 정지 횟수·벽시계. 감지가 꺼져 있던 구간 안내와, 씬에 `tagMappings` 가 없을 때의 안내(`collectSceneTagKeys`).
2. KPI 카드 4장 `play3d-report-kpi.tsx` — 충돌(첫 충돌·최다 쌍) · 영역 침범(정지 등급 수·체류 합) · 가동률(장비 수·대기율) · 소스별 4번째: 리플레이는 통신 두절(횟수·합계), 시뮬레이션은 속도 한계 도달(최대 축). 색은 문제일 때만(충돌·정지 등급 침범은 빨강, 경고 침범·두절·포화는 호박). 스파크라인 없음. 패널 루트가 컨테이너 쿼리 기준이라 넓으면 한 줄 4장, 좁으면 2×2.
3. 스윔레인 타임라인 `play3d-report-timeline.tsx` — 장비마다 한 행이고 **사건은 그 행에 겹쳐 그린다**(별도 사건 행 없음). 행 조립은 `timelineRows`.
   - 아래부터 상태 막대(`statusBands`, 색 `PLAY3D_STATUS_FILL`, 창 끝까지) → 영역 체류 = **상태 막대와 같은 높이·위치의 노란 박스**(`zoneBands` → `assignZoneBandsToRows`, 등급 무관, 체류 중엔 상태 색을 덮는다, 미이탈은 오른쪽 어두운 점선 가장자리) → 충돌 = 빨간 각진 세로 선(`assignCollisionsToRows`, 부딪힌 두 장비 행 모두) → 현재 위치 세로선. 이 DOM 순서가 hover 우선순위(충돌 > 체류 > 상태)다. 사건(체류·충돌)은 실행 전체(`allEvents`)를 그리고 현재 위치 뒤에서 시작한 것은 흐리게(고스트) — 재생바와 같다. 열린 띠는 `runEndMs`(창 끝·마지막 사건·닿은 지점의 최대)까지. 검사 안 된 구간은 트랙 바탕색 그대로, 검사된 구간만 밝게 덮는다. 축 클릭 = `msAtFraction` 으로 seek. HTML 절대 배치 % 라 SVG 늘림이 없다.
   - 장비 이름 열은 고정이고 오른쪽 트랙 영역만 가로 스크롤러다(스크롤바가 이름 열 아래로 뻗지 않는다). 시간 눈금 행은 트랙 위. 안쪽 세로 스크롤은 없고 패널이 세로로 스크롤한다. 장비가 없으면 "데이터 없음".
   - 축이 `TIMELINE_FIT_MS` 를 넘으면 트랙이 `timelineTrackScale` 배로 넓어진다(`timelineContentWidth`). 확대된 뒤에는 px/ms 가 일정해 축이 자라도 표식은 제자리다.
   - 재생 위치 따라가기는 `timelineFollowScroll` 이 판단한다. 재생 중에는 보이던 커서가 벗어날 때만 넘기고(오른쪽 이탈은 한 페이지, 뒤로 점프는 가운데) 사용자가 직접 스크롤해 둔 위치는 되돌리지 않는다(`onScroll` 이 `timelineCursorInView` 로 갱신, ▶ 전이가 다시 무장). 일시정지 중에는 화면 밖 커서를 가운데로 보인다. 자라는 축은 오른쪽 끝에 붙어 따라간다.
   - 범례는 가동·대기·(리플레이) 두절·영역 체류(노란 박스 견본)·충돌. 상태 색은 `PLAY3D_STATUS_FILL` 을, 박스는 `PLAY3D_DWELL_BOX_CLASS` 를 그대로 읽는다.
4. 접이식 상세 — 네이티브 `details` 네 개(사건만 기본 펼침), 제목 옆에 요약 한 줄. 사건 목록(종류 필터 칩 `PLAY3D_EVENT_FILTERS`, 클릭 = seek — 리플레이는 한 프레임·시뮬레이션은 조금 앞, `markerSeekLeadMs`) · 장비 표(적층 비율 막대·가동%·두절·영역 체류·충돌 관여) · 영역 표(체류 막대·진입·주 침범자, 영역 사건이 없으면 섹션 생략) · 축 표(`tagRowLabel` 로 이름·단위, range bar `tagRangeBar` — 시뮬레이션은 가상 태그 정의 min~max 기준·리플레이는 관측 범위, 이동량, 포화는 시뮬레이션만). 표마다 헤더 행이 있다.

표·목록 컴포넌트는 `play3d-report-tables.tsx`(컴포넌트만). 행 변환·비율/위치 환산·라벨 해석은 `lib/play3d-format.ts` 에 둔다(react-refresh 규칙, ui 수치 계산 금지). 차트는 전부 인라인 SVG/DIV 다.

### 시간 축과 표식 (리포트 타임라인 · 재생바 공용)

- **축은 하나**: `timelineAxisMs(길이, 위치, 마지막 사건, 위치가 닿은 가장 먼 지점)` 의 최대(길이가 없으면 바닥값). 반복 시나리오는 경과가 되감기지 않아(회차 = 경과 ÷ 길이) 길이에 고정하면 첫 회차 뒤의 커서·표식이 전부 축 끝에 쌓인다. 닿은 지점(`reachedMs`, seek·정지 중 포함)을 넣어 **실행 중 축이 줄지 않는다** — 위치만 따라가면 재생바 손잡이를 뒤로 끌 때 축이 같이 줄어 값이 무너진다. 검사 구간(`scanned`) 끝이 아닌 이유는 정지 중 ⏩ 로 뛴 곳은 검사되지 않아 열린 구간에서 같은 붕괴가 나기 때문이다. 재생바는 원시 사건(기록 순, 뒤로 seek 하면 시각순이 아니다)을 읽으므로 마지막 사건은 `lastEventAtMs`(최댓값)다.
- **눈금은 둥근 간격**: `niceTickStepMs` 가 후보 목록에서 칸 수 상한에 맞는 가장 작은 간격을 고르고 `tickTimes` 가 그 배수를 낸다(끝 반 칸 안은 빼고 축 끝과 같은 배수는 넣음). 간격이 고정이라 축이 자라도 앞 눈금이 움직이지 않는다. 타임라인은 한 화면 구간 기준(`timelineViewTicks`), 재생바는 축 전체 기준(`transportTicks`). 그리기는 `Play3dTickRow`.
- **재생바 표식 띠**(`transportMarks`): 영역은 체류 구간 전체를 타임라인과 같은 노란 박스(선보다 낮게)로, 충돌·정지·두절(`PLAY3D_MARKER_KINDS`)은 각진 세로 선으로. 실행 전체를 그리고 현재 위치 뒤의 표식은 흐리게. 열린 띠는 `runEndMs` 까지(`reachedMs` 를 넘겨 뒤로 seek 해도 꼬리로 무너지지 않는다). 클릭 = 그 시각으로 이동(`markerSeekTargetMs`, 누르는 순간의 `readPlay3dTransport` 스냅샷). 바는 위치 폴링으로 계속 리렌더되므로 띠는 memo 자식이다.
- **노란 박스 = 영역 체류**: 채움·링과 미이탈 가장자리는 `PLAY3D_DWELL_BOX_CLASS`·`PLAY3D_DWELL_OPEN_CLASS`, hover 요약의 영역 프레임 점선은 `PLAY3D_DWELL_FRAME_CLASS` 한 곳이고 타임라인·재생바·범례·툴팁이 함께 읽는다. 등급은 hover 요약·KPI·영역 표에서 본다. 빨강은 충돌 선에만.
- **hover 요약은 즉시**: 화면마다 툴팁 하나에 트리거 여럿(base-ui 분리 트리거 — `createTooltipHandle`, 트리거가 `payload` 로 `Play3dHoverPayload` 를 넘긴다, 지연 0, 팝업 애니메이션 없음). 내용은 `Play3dHoverSummary` — 충돌(시각·[장비] ↔ [장비] 배지 쌍 `CollisionPair`·같은 쌍의 순번 `collisionSummaries`), 영역 체류(등급·영역 이름을 단 점선 상자 안에 [침범자] 배지 `ZoneFrame`·구간 `formatBandSpan`), 상태 막대(장비 · 상태·구간), 재생바의 정지·두절(시각·대상). 영역은 포함 관계라 화살표를 쓰지 않고, 프레임 점선은 `PLAY3D_DWELL_FRAME_CLASS`. 영역 이름 라벨은 툴팁 글자 그대로이며 흐름 안에서 음수 위 여백으로 테두리에 걸친다(절대 배치면 프레임 폭이 배지 폭으로 정해져 긴 이름이 잘린다). 이름 배지는 프레임과 같은 작은 모서리의 테두리 없는 칩이고, 툴팁 판이 `bg-foreground` 라 판 색을 뒤집은 채움이다. 사건 시각은 `eventTimeLabel` — 리플레이는 그 프레임의 실제 시각. 팝업은 body 로 포털돼 트랙의 `overflow-hidden` 에 잘리지 않는다.

### 장비 운전 상태

- `EquipmentRuntimeStatus` = running · idle · offline · unknown (`@crane/core/types/status`).
- PLC 상태 태그가 아니라 **태그 값 버스 활동**에서 파생한다. `tag-value-bus.ts` 의 `TagLiveValue.changedAt`(값이 달라진 마지막 시각)과 `at` 을 모델 `tagMappings` 의 tagKey 들로 모아 판정한다(`model-runtime-status.ts`, 창 `RUNNING_WINDOW_MS` · `OFFLINE_WINDOW_MS`, 테스트 대상). craneId 없는 필리 모델도 맵핑만 있으면 상태가 나온다.
- 훅 `use-model-runtime-statuses.ts` 는 1Hz 폴링, 같으면 참조를 유지한다. 맵핑이 없는 모델도 unknown 으로 기록에 들어간다(전 모델). `Monitoring3dView` 가 한 번 부르고 라벨·관제 HUD 가 공유한다.
  - 라벨: `@crane/domain/3d` `ModelLabel` 의 `runtimeStatus` prop. 알람이 없으면 배경을 상태색으로 물들이고 이름 앞에 점, offline 은 라벨 흐림. 알람이 있으면 배경은 알람색·점만 남는다.
- 옵션 `{ paused, timeScale }`: 정지 중 재판정을 건너뛰고 창을 1/배속(`scaleStatusWindows`)으로 조정한다 — 일시정지 뒤 전 장비 두절, 저배속 idle 깜빡임 방지. 기록기와 `Monitoring3dView` 3D 플레이 모드가 같은 옵션을 넘긴다.

### HUD 연결 칸

연결 상태 칸은 `use-realtime-connection-state.ts` 가 `play3dPlaying` / `play3dPaused` 를 낸다. HUD 자체는 실시간 화면에만 마운트된다(`docs/agents/monitoring-ui.md`).

### 전제

감지·리포트는 씬에 `tagMappings` 가 있어야 의미가 있다. 맵핑이 있는 씬은 philly-2dock(가상 태그만)·dock-in(서버 리플레이만)이고, 옥포 실외·골리앗 씬은 맵핑이 없어 재생해도 아무것도 움직이지 않는다.

## 불변식

- `RUNTIME_STATUS_COLORS`(hex, `model-runtime-status.ts`)와 `ModelLabel` 의 Tailwind 상태색 클래스는 **두 곳을 함께 바꾼다**. `PLAY3D_STATUS_FILL` 은 리포트 전용 팔레트다 — 가동만 전역 색을 공유하고 대기·두절은 트랙 위에서 면으로 읽히는 회색 계열이며, 타임라인 밴드·장비 표 적층 막대·범례가 이 상수 하나를 읽는다.
- 통계 스토어 `data` 는 제자리 갱신 + `version` bump 만. publish 마다 setState 금지.
- 사건 시각은 트랜스포트 위치를 구독 콜백 안에서 동기로 읽는다. 스토어의 벽시계 `at` 을 쓰지 않는다.
- 시간을 바꾸는 코드(바·마커·리포트 seek·정지 재개)는 `Play3dTransport` 하나만 통한다. 리플레이 러너·가상 태그 러너를 직접 부르지 않는다.
- 소스 전환은 상태 전환으로 유지한다. `key={source}` 리마운트는 `useSceneData` 진입의 resetReplay 로 프레임을 잃고 loadFrames effect 가 다시 돌지 않는다.
- `RUNNING_WINDOW_MS` 는 리플레이 프레임 간격보다 넓어야 한다. 좁으면 프레임 사이마다 idle 로 떨어진다.
- 새 실행의 시작은 `reset(meta)` 한 곳. 뒤로 seek·resetValues 에서 reset 하지 않는다.
- 리포트 행 변환·상수는 `lib/play3d-format.ts` 에, `ui/*.tsx` 에는 컴포넌트만.
- 새 사건 종류를 추가하면 `PLAY3D_EVENT_FILTERS`·`PLAY3D_EVENT_COLORS`·`Play3dHoverPayload`·`computePlay3dStats` 창 필터를 함께 고치고, 재생바에 선으로 그릴 것이면 `PLAY3D_MARKER_KINDS` 에 넣는다.
- 장비 표의 영역 체류값과 타임라인 체류 박스는 `assignZoneBandsToRows`, 장비 표의 충돌 값과 타임라인 충돌 선은 `assignCollisionsToRows` — 표와 그림이 한 규칙을 쓴다.
- 접이식 상세의 `details` 는 `open` 에 리터럴 초기값만 넘긴다. 데이터에서 파생하면 통계 리렌더가 사용자의 접기·펼치기를 되돌린다.
- 리포트 타임라인은 정지·두절 사건을 그리지 않지만 재생바 표식(`PLAY3D_MARKER_KINDS`)은 그린다.
- 시간 축은 `timelineAxisMs` 하나를 타임라인과 재생바가 함께 쓰고, 실행 중 줄지 않는다(가장 먼 지점 입력을 빼지 않는다). 회차로 접지(`% 길이`) 않는다 — 체류 구간이 회차 경계에서 끊기고 통계 창이 줄어든다.
- 사건 기록은 seek 정착 뒤·로그 상태 기준이다 — seek 는 로그를 바꾸지 않는다. 화해 사건은 잠정이고 실제 전이가 교체한다(`decideZoneEvent`). seek 로 로그를 자르지 않는다 — 현재 위치 뒤 사건은 고스트로 남긴다.
- seek 신호 발신처는 리플레이 스토어 `seekTo` 와 가상 태그 러너 `seek`·`resetValues` 뿐이다. 러너의 정상 전진(리플레이 `tick`·가상 태그 틱)에서 알리지 않는다 — 알리면 정착 창이 끊이지 않아 아무 사건도 남지 않는다.
- 타임라인 눈금 행과 이름 열 스페이서는 같은 높이 상수를 쓴다 — 다르면 이름과 트랙이 어긋난다. 트랙·눈금 행의 `overflow-hidden` 은 지우지 않는다 — 축 끝의 표식·라벨이 스크롤 폭을 넓혀 확대가 없을 때도 가로 스크롤바가 생긴다.
- 확대 배율·눈금·따라가기 판단·행과 표식 조립은 `lib/play3d-format.ts` 에 두고 ui 는 DOM 치수만 읽어 넘긴다. 따라가기 판정의 허용오차를 없애지 않는다 — 스크롤 치수가 정수로 반올림돼 프로그램 스크롤 직후 따라가기가 꺼진다. 스크롤러에 smooth scroll 을 걸지 않는다(중간 scroll 이벤트가 같은 문제를 만든다).
- 분리 트리거 툴팁은 Root 를 트리거보다 먼저 렌더하고, 핸들은 컴포넌트 인스턴스당 하나(`useState` 초기화)로 만든다. `@crane/features` 는 `@base-ui/react` 를 직접 import 하지 않는다 — `@crane/ui` 의 래퍼와 `tooltip-handle` 을 쓴다.
- 리포트의 집계 범위는 기록기에서만 거른다. 공용 훅 `useModelRuntimeStatuses` 는 라벨·HUD 가 전 모델을 전제로 쓰므로 걸러서 돌려주지 않는다.

## 하지 않기로 한 것

- PASS/FAIL 판정 — 판단은 사용자가 한다.
- `features` 에 recharts 등 차트 라이브러리 — 차트는 인라인 SVG/DIV.
- 3D 플레이에 관제 HUD·미니맵 마운트 — 실시간 화면 전용.
- 리포트의 CSV 내려받기.
- KPI 카드 스파크라인 — 바로 아래 타임라인과 같은 정보.
- 정지(hold) KPI 카드·타임라인 밴드 — 도구 동작(정지 옵션 기본 OFF)이라 현장 지표가 아니다. 헤더 한 줄과 사건 목록만.
- 원인 상위 랭킹 섹션 — 최다 쌍은 KPI 보조 줄, 주 침범자는 영역 표 컬럼으로 흡수.
- 영역별 타임라인 행·별도 사건 행 — 영역 체류와 충돌은 장비 행에 겹쳐 그린다.
- 상세를 탭으로 — 여러 표를 함께 봐야 해서 접이식.
- 타임라인 사건 표식을 종류별 도형(마름모·삼각형)으로 — 순간 사건은 각진 세로 선, 구간(영역 체류)은 채운 박스.
- 영역 체류를 대각선 빗금·등급별 색으로 — 사용자 요청으로 등급 무관 노란 채운 박스. 빨강은 충돌 선에만.
- `scanned` 를 재통과 중복 판정 기준으로 — 리플레이는 프레임 간격이 폴링의 seek 임계보다 크면 검사 구간이 비어 있다.
- 화해 사건을 잠정 없이 boolean 판정으로만 넣기 — 앞으로 점프 뒤 되돌아가 재통과하면 띠가 다시 쪼개진다.
- `hasPendingSmoothing` 으로 seek 정착 판정 — 값 도달이 수 초까지 늦다.
- 타임라인 안쪽 세로 스크롤·sticky 이름 열 — 가로 스크롤바가 이름 열 아래까지 뻗는다. 이름 열을 스크롤러 밖에 둔다.
- 재생바 축을 길이에 고정하기 — 반복 시나리오에서 표식이 끝에 쌓인다.
- 시간 축 앵커를 검사 구간(`scanned`) 끝으로 — 정지 중 seek 로 뛴 곳이 빠져 뒤로 끌 때 축이 손잡이 밑에서 무너진다.
- 열린 구간(시나리오 없음)에서 스크럽 비활성 — 길이 대신 닿은 지점이 축이라 범위가 정해지고, ⏪·표식 클릭과 어긋난다.
- 클릭 가능한 표식의 툴팁에 `closeOnClick=false` — 클릭 seek 로 표식이 사라지면 팝업이 떠돈다.
- 표식 요약을 브라우저 기본 `title` 로 — 지연이 있어 사건을 훑어볼 수 없다.
- 재생 중 사용자가 스크롤해 둔 타임라인 위치를 커서로 되돌리기 — 지난 구간을 살펴보는 중에 화면이 튄다.
- 소스 전환 시 뷰 리마운트(위 불변식).
- 정지 중·저배속에서 운전 상태를 실시간과 같은 창으로 판정하는 것 — `paused`·`timeScale` 옵션이 그 대안.

## 미룬 것

두 실행 비교, 리플레이 구간 서버 알람, 서버 timeline 가동 구간, 태그 시계열 차트, 검사 구간의 기준선·감지 off 정밀 차감, 프레임 전체 헤드리스 스캔, PDF·대시보드 위젯, 패널 리사이즈 시 타임라인이 보던 시각 유지.
