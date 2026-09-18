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
| 실행 통계 집계(순수) | `packages/features/src/3d/lib/play3d-stats.ts` (`computePlay3dStats`, `assignZoneBandsToRows`), 표시 보조·라벨 해석 `lib/play3d-format.ts` (`tagRowLabel`) |
| 통계 스토어 / 기록기 | `packages/features/src/3d/model/use-play3d-stats-store.ts`, `model/use-play3d-stats-recorder.ts` |
| 리포트 패널 | `packages/features/src/3d/ui/play3d-report-panel.tsx` (+ `play3d-report-kpi.tsx`, `play3d-report-timeline.tsx`, `play3d-report-tables.tsx`) |
| 장비 운전 상태 | 타입 `packages/core/src/types/status.ts` (`EquipmentRuntimeStatus`), 판정 `packages/features/src/3d/lib/model-runtime-status.ts`, 훅 `model/use-model-runtime-statuses.ts` |
| 리플레이 프레임 시각 | `packages/features/src/3d/model/scene-time-source.ts`, `@crane/domain/monitoring` 의 `parseReplayTimestamp` |
| 앱 배치 | `apps/{hanwha-ocean,goliath-crane}/src/pages/*/ui/replay-monitoring-view.tsx` (`ResizablePanelGroup` 우측에 리포트) |

i18n 은 `monitoring:play3d.*`.

## 동작

### 레이아웃

- `Play3dView` 는 `Monitoring3dView mode='play3d' toolbarLayout='dock'` 위에 소스 탭(리플레이 | 시뮬레이션)과 트랜스포트 바를 **캔버스 위 별도 행**으로 둔다. 오버레이가 아니라 좌상단 열과 겹치지 않는다.
- 소스 탭은 role=tablist 버튼이다(공용 Tabs 컴포넌트 없음).
- 트랜스포트 바 구성: 소스 슬롯(리플레이 = 구간 검색 팝오버 `ReplaySearchForm`, 시뮬레이션 = `SceneSimulationPanel` 팝오버) · 이동/▶ · 사건 마커 띠가 얹힌 스크럽 · 배속(소스별 선택지) · 위치.
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

- 사건 = 충돌 기록, 영역 diff, 정지(충돌 pinned ∪ 영역 held) 전이, 두절 전이. 사건 시각은 스토어의 벽시계 `at` 이 아니라 **구독 콜백 안에서 읽은 트랜스포트 위치**(같은 틱, 동기)다. 충돌 사건은 양쪽 `modelIds`, 영역 사건은 소유 모델 `ownerId` 를 싣는다.
- 짧은 주기 폴링으로 재생 중 지나간 구간을 `scanned`(합집합)·장비 상태 ms 에 더한다. 한 폴링에 배속 기준 기대치를 크게 넘게 뛰면 seek 로 보고 제외한다.
- 충돌 감지 off 는 `detectionOffSeen` 으로 남긴다.
- 태그는 버스 관찰자 `subscribeTagValues`(`tag-value-bus.ts`, 소비자 슬롯과 별개·다중 가능)로 publish 마다 집계한다 — 맵핑된 키만.
- 운전 상태는 `useModelRuntimeStatuses(scene, { paused, timeScale })` 로 받는다(아래). 밴드의 출처는 기록기가 남기는 `statusTransitions`(모든 전이, reset 직후 현재 상태를 unknown→x 로 심는다).

### 리포트 패널

`play3d-report-panel.tsx` 가 조립한다. 개요 → 상세 순이고, 같은 사실은 한 자리에서만 보인다.

1. 헤더 — 소스·구간, 창·검사된 구간(창 대비 비율)·회차, 정지가 있었을 때만 정지 횟수·벽시계. 감지가 꺼져 있던 구간 안내와, 씬에 `tagMappings` 가 없을 때의 안내(`collectSceneTagKeys`).
2. KPI 카드 4장 `play3d-report-kpi.tsx` — 충돌(첫 충돌·최다 쌍) · 영역 침범(정지 등급 수·체류 합) · 가동률(장비 수·대기율) · 소스별 4번째: 리플레이는 통신 두절(횟수·합계), 시뮬레이션은 속도 한계 도달(최대 축). 색은 문제일 때만(충돌·정지 등급 침범은 빨강, 경고 침범·두절·포화는 호박). 스파크라인 없음. 패널 루트가 컨테이너 쿼리 기준이라 넓으면 한 줄 4장, 좁으면 2×2.
3. 스윔레인 타임라인 `play3d-report-timeline.tsx`
   - 첫 행은 사건 — 충돌과 영역 진입이 **같은 모양의 각진 세로 선**이고, 영역 선은 그 체류 띠와 같은 등급 색이다(같은 시각이면 충돌 선이 위). 그 아래 장비마다 한 행: 상태 밴드(`statusBands`, 색 `PLAY3D_STATUS_FILL`) 아래쪽에 그 장비에 배정된 영역 체류 띠(`zoneBands` → `assignZoneBandsToRows`, stop 은 red·미이탈은 점선 끝). 검사 안 된 구간은 빗금, 현재 위치 세로선, 축 클릭 = `msAtFraction` 으로 seek. 영역별 행·정지 밴드는 없다. HTML 절대 배치 % 라 SVG 늘림이 없다.
   - 범례는 가동·대기·(리플레이) 두절·영역 체류·충돌. 영역 진입은 체류에 흡수했고 빗금은 범례에 올리지 않는다. 범례 색은 `PLAY3D_STATUS_FILL` 을 그대로 읽는다.
   - 축은 `reportAxisMs` — 길이에 더해 위치·마지막 사건이 길이를 넘으면 그만큼 자란다. 반복 시나리오는 경과가 되감기지 않아, 길이에 고정하면 첫 회차 뒤의 커서·표식이 전부 축 끝에 쌓인다.
   - 축이 `TIMELINE_FIT_MS` 를 넘으면 트랙이 `timelineTrackScale` 배로 넓어지고(`timelineContentWidth`) 한 스크롤 컨테이너가 세로·가로를 함께 맡는다 — 장비 이름 열은 sticky-left, 눈금 행은 sticky-bottom. 확대된 뒤에는 px/ms 가 일정해 축이 자라도 표식은 제자리다. 눈금은 `timelineTickTimes` — 한 화면 이하는 4등분, 넘으면 `TIMELINE_TICK_STEP_MS` 배수에 고정.
   - 재생 위치 따라가기는 `timelineFollowScroll` 이 판단한다. 재생 중에는 보이던 커서가 벗어날 때만 넘기고(오른쪽 이탈은 한 페이지, 뒤로 점프는 가운데) 사용자가 직접 스크롤해 둔 위치는 되돌리지 않는다(`onScroll` 이 `timelineCursorInView` 로 갱신, ▶ 전이가 다시 무장). 일시정지 중에는 화면 밖 커서를 가운데로 보인다. 자라는 축은 오른쪽 끝에 붙어 따라간다.
4. 접이식 상세 — 네이티브 `details` 네 개(사건만 기본 펼침), 제목 옆에 요약 한 줄. 사건 목록(종류 필터 칩 `PLAY3D_EVENT_FILTERS`, 클릭 = seek — 리플레이는 한 프레임·시뮬레이션은 조금 앞, `markerSeekLeadMs`) · 장비 표(적층 비율 막대·가동%·두절·영역 체류·충돌 관여) · 영역 표(체류 막대·진입·주 침범자, 영역 사건이 없으면 섹션 생략) · 축 표(`tagRowLabel` 로 이름·단위, range bar `tagRangeBar` — 시뮬레이션은 가상 태그 정의 min~max 기준·리플레이는 관측 범위, 이동량, 포화는 시뮬레이션만). 표마다 헤더 행이 있다.

표·목록 컴포넌트는 `play3d-report-tables.tsx`(컴포넌트만). 행 변환·비율/위치 환산·라벨 해석은 `lib/play3d-format.ts` 에 둔다(react-refresh 규칙, ui 수치 계산 금지). 차트는 전부 인라인 SVG/DIV 다.

### 장비 운전 상태

- `EquipmentRuntimeStatus` = running · idle · offline · unknown (`@crane/core/types/status`).
- PLC 상태 태그가 아니라 **태그 값 버스 활동**에서 파생한다. `tag-value-bus.ts` 의 `TagLiveValue.changedAt`(값이 달라진 마지막 시각)과 `at` 을 모델 `tagMappings` 의 tagKey 들로 모아 판정한다(`model-runtime-status.ts`, 창 `RUNNING_WINDOW_MS` · `OFFLINE_WINDOW_MS`, 테스트 대상). craneId 없는 필리 모델도 맵핑만 있으면 상태가 나온다.
- 훅 `use-model-runtime-statuses.ts` 는 1Hz 폴링, 같으면 참조를 유지한다. `Monitoring3dView` 가 한 번 부르고 라벨·미니맵 마커·관제 HUD 가 공유한다.
  - 라벨: `@crane/domain/3d` `ModelLabel` 의 `runtimeStatus` prop. 알람이 없으면 배경을 상태색으로 물들이고 이름 앞에 점, offline 은 라벨 흐림. 알람이 있으면 배경은 알람색·점만 남는다.
  - 미니맵 마커 색 우선순위: 알람 > 상태 > 기본 (`docs/agents/monitoring-ui.md`).
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
- 새 사건 종류를 추가하면 `PLAY3D_EVENT_FILTERS`·`PLAY3D_EVENT_COLORS`·타임라인 행·`computePlay3dStats` 창 필터를 함께 고친다.
- 장비 표의 영역 체류값과 타임라인 띠는 `assignZoneBandsToRows` 한 규칙을 쓴다.
- 접이식 상세의 `details` 는 `open` 에 리터럴 초기값만 넘긴다. 데이터에서 파생하면 통계 리렌더가 사용자의 접기·펼치기를 되돌린다.
- 리포트 타임라인은 정지를 그리지 않지만 트랜스포트 바 마커(`PLAY3D_MARKER_KINDS`)는 그린다.
- `timelineAxisMs` 는 트랜스포트 바 스크럽의 기준이다. 리포트 축을 늘릴 일은 `reportAxisMs` 에서 한다.
- 타임라인 스크롤러와 sticky 요소(이름 열·눈금 행) 사이에 `overflow` 를 가진 요소를 두지 않는다 — sticky 의 기준이 바뀐다. 트랙의 `overflow-hidden` 은 지우지 않는다 — 축 끝의 표식이 스크롤 폭을 넓혀 확대가 없을 때도 가로 스크롤바가 생긴다.
- 확대 배율·눈금·따라가기 판단은 `lib/play3d-format.ts` 에 두고 ui 는 DOM 치수만 읽어 넘긴다. 따라가기 판정의 허용오차를 없애지 않는다 — 스크롤 치수가 정수로 반올림돼 프로그램 스크롤 직후 따라가기가 꺼진다. 스크롤러에 smooth scroll 을 걸지 않는다(중간 scroll 이벤트가 같은 문제를 만든다).

## 하지 않기로 한 것

- PASS/FAIL 판정 — 판단은 사용자가 한다.
- `features` 에 recharts 등 차트 라이브러리 — 차트는 인라인 SVG/DIV.
- 3D 플레이에 관제 HUD·미니맵 마운트 — 실시간 화면 전용.
- 리포트의 CSV 내려받기.
- KPI 카드 스파크라인 — 바로 아래 타임라인과 같은 정보.
- 정지(hold) KPI 카드·타임라인 밴드 — 도구 동작(정지 옵션 기본 OFF)이라 현장 지표가 아니다. 헤더 한 줄과 사건 목록만.
- 원인 상위 랭킹 섹션 — 최다 쌍은 KPI 보조 줄, 주 침범자는 영역 표 컬럼으로 흡수.
- 영역별 타임라인 행 — 장비 행의 체류 띠로 대체.
- 상세를 탭으로 — 여러 표를 함께 봐야 해서 접이식.
- 타임라인 사건 표식을 종류별 도형(마름모·삼각형)으로 — 같은 모양의 세로 선으로 통일하고 색으로만 가른다.
- 재생 중 사용자가 스크롤해 둔 타임라인 위치를 커서로 되돌리기 — 지난 구간을 살펴보는 중에 화면이 튄다.
- 소스 전환 시 뷰 리마운트(위 불변식).
- 정지 중·저배속에서 운전 상태를 실시간과 같은 창으로 판정하는 것 — `paused`·`timeScale` 옵션이 그 대안.

## 미룬 것

두 실행 비교, 리플레이 구간 서버 알람, 서버 timeline 가동 구간, 태그 시계열 차트, 검사 구간의 기준선·감지 off 정밀 차감, 프레임 전체 헤드리스 스캔, PDF·대시보드 위젯, 패널 리사이즈 시 타임라인이 보던 시각 유지.
