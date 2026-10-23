# 모니터링 화면 UI — 전체화면·카메라 이동 범위 제한·관제 HUD·경보 알림·미니맵·씬 독·워밍업 표시

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

조립은 `packages/features/src/3d/ui/monitoring-3d-view.tsx`(`Monitoring3dView`)다. `toolbarLayout='dock'` 이 실시간 관제 화면 배치이고, HUD·미니맵은 그 배치에서 `mode !== 'play3d'` 일 때만 마운트된다. 좌측 상단 열은 시뮬레이션 배지(`ui/scene-simulation-badge.tsx`) → 워밍업 표시 순의 세로 스택이다. 모니터링·3D 플레이·대시보드 미리보기는 모델·라벨 클릭을 받지 않는다 — `OutdoorWorkModelSimulation` 이 `onSelect` 를 넘기지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 전체화면 | `packages/core/src/lib/use-fullscreen.ts` (`useIsFullscreenActive`), 소비 `packages/widgets/src/layout/ui/app-layout.tsx`, `packages/ui/src/organisms/three-scene-viewer.tsx` |
| 카메라 이동 범위 제한 | 적용 `packages/features/src/3d/ui/scene-camera-limits.tsx` (`SceneCameraLimits`), 수식 `lib/camera-limits.ts`, 기준 지도 `packages/domain/src/3d/lib/camera-bounds-maps.ts` |
| 지도 표면 raycast | `packages/domain/src/3d/lib/map-surface-raycast.ts` (`raycastMapSurfaceY`) |
| 캔버스 위 오버레이(라벨·눈금)의 휠·드래그 넘김 | 수식 `packages/domain/src/3d/lib/overlay-pointer-forwarding.ts`, 훅 `packages/domain/src/3d/model/use-overlay-pointer-forwarding.ts`, 적용 `packages/domain/src/3d/ui/{model-label,scene-ruler}.tsx` |
| 관제 요약 HUD | `packages/features/src/3d/ui/scene-status-hud.tsx`, 알람 목록 `ui/scene-status-hud-alarm-list.tsx`, 위험 비네트 `ui/scene-danger-vignette.tsx`, 이상 조건 `lib/hud-conditions.ts`·`model/use-hud-conditions.ts`, 전이 시각 `lib/status-since.ts`, 수신 `lib/feed-freshness.ts`, 날씨 `model/use-scene-weather.ts`, 권고·게이지 `lib/wind-advisory.ts` |
| 경보 알림 채널 | `packages/core/src/lib/alert-notifications.ts` (`notifyAlert`, `useAlertNotificationSettings`) |
| 알림 발신자 | `packages/features/src/3d/ui/scene-alert-notifier.tsx`, `packages/features/src/alarm/model/use-critical-alarm-notifier.ts` |
| 미니맵 | 계산 `packages/features/src/3d/lib/minimap.ts`, 픽셀 후처리 `lib/minimap-image.ts`, 스토어 `model/use-scene-minimap-store.ts` |
| 미니맵 UI | `packages/features/src/3d/ui/scene-minimap-capture.tsx`, `ui/scene-minimap.tsx`, `ui/scene-minimap-toggle.tsx` |
| 충돌 감지 표시(LiDAR 근접 존) | 씬 레이어 `packages/features/src/3d/ui/collision-guard-scene-layer.tsx`(`CollisionGuard` + 에고 카메라 리그), 토글 `ui/collision-guard-toggle.tsx`, HUD `ui/collision-guard-hud.tsx`, 도움말 `ui/collision-guard-help.tsx`, 존 빌더 `lib/goliath-collision-zone.ts`, 존 파생 `model/use-goliath-collision-zones.ts`, 스토어 `model/use-collision-guard-store.ts`, 감지 객체 시뮬레이션 `model/use-collision-guard-simulation.ts` |
| 씬 독 | 껍데기 `packages/ui/src/organisms/scene-dock.tsx` (`SceneDockRail`, `SceneDockRailSeparator`), 상태 `packages/features/src/3d/model/use-scene-dock.ts`, 리듀서·영속화 `lib/dock-hover-state.ts`, `lib/dock-storage.ts` |
| 워밍업 표시 | 단계 선택 `packages/features/src/3d/lib/scene-warmup-step.ts`, 훅 `model/use-scene-warmup-step.ts`, 표시 `ui/scene-warmup-indicator.tsx` |

## 동작

### 전체화면

- 훅 `use-fullscreen.ts` 는 3D 뷰어·편집 페이지 공용이며 zustand 전역 상태다.
- 요소 하나가 아니라 **문서 전체**를 `requestFullscreen` 하고, `AppLayout` 이 `useIsFullscreenActive()` 로 헤더·사이드바를 숨긴다. top layer 밖에 남는 DOM 이 없어 body 포털·전역 Toaster 를 따로 챙길 필요가 없다.
- 페이지 일부인 뷰어(`ThreeSceneViewer`)는 `isFullscreen` 일 때 자기 루트를 `fixed inset-0 z-50` 으로 띄운다.
- 주인(toggle 을 부른 인스턴스)만 `isFullscreen` 이 true 다. 주인이 언마운트되면 전체화면을 끝낸다.

### 카메라 이동 범위 제한 (모니터링·리플레이·에디터 공용)

`SceneCameraLimits` 는 `SceneSurfaceCamera` **바로 다음 형제**에 마운트한다. 같은 priority 의 useFrame 은 마운트 순으로 돈다.

**기준 지도** — 이 절이 기준 지도 규칙의 단일 소스다. 미니맵 캡처·탑뷰도 같은 함수를 본다.

- 지도 인스펙터 카메라 탭의 "카메라 영역 제한" 체크가 `SavedMapInfo.cameraBounds` 다(옵트인, true 만 저장).
- `resolveCameraBoundsMaps` 는 체크된 지도들을 돌려주고, 하나도 없으면 씬의 모든 지도. 그 월드 AABB 합집합은 `unionObjectBounds` / `collectCameraBoundsBox`.
- 팔레트로 ground 지도를 추가하면 `addSceneMap` 이 체크된 채 넣는다. `resolveGroundMaps` 는 드롭 raycast 바닥면에만 쓴다 — 카메라 기준과 다른 축이다.
- 여유·여백 비율은 두지 않는다. 탑뷰는 이 합집합을 fit 하지 않는다 — 지금 보는 화면 위로 올라가는 직교 토글이고(`docs/agents/3d-editor.md` "카메라 up 과 탑뷰"), 합집합은 최대 궤도 반경(= 탑뷰 줌 상한)에만 쓰인다.

**바닥** — 카메라 아래 지도 표면(씬의 모든 지도에 `raycastMapSurfaceY`, 카메라 XZ 가 일정 거리 움직였을 때만 재측정, 히트 없으면 `SEA_LEVEL_Y`) + `CAMERA_GROUND_CLEARANCE`. EXR 유무와 무관하다. 여유는 지면에 선 사람을 확대 하한까지 다가가 볼 수 있게 사람 키보다 낮고, 낮은 시점은 극각 상한과 맞물려 피벗이 가까울 때만 나온다. 회전은 `maxPolarAngle` 을 매 프레임 갱신해 막는다 — 바닥 기준 동적 상한과 `CAMERA_MAX_POLAR_ANGLE` 중 작은 쪽. `minPolarAngle` 은 0(정수직 탑뷰 허용).

**이동** — 타깃이 아니라 **카메라 XZ** 를 합집합 안으로 제한한다. 표면 피벗이 타깃을 지도 밖 지형·바다에 놓으므로 타깃 기준이면 드래그마다 튄다.

**위반 처리** — 되밀기가 아니라 **그 프레임의 평행이동 취소**다. 카메라·타깃 델타가 같으면 팬·dolly 로 보고 update 직전 자세로 복원해 경계에서 그냥 멈춘다. 그래도 밖이면(회전·프레임 밖 명령·로드 직후) 경계로 투영한다.

**최대 거리** — `controls.maxDistance` = 합집합의 탑뷰 fit 거리 × `CAMERA_MAX_DISTANCE_RATIO`, 상한 `CAMERA_MAX_DISTANCE`(지도 없으면 상한값). 휠 dolly 상한, 표면 피벗 거리 cap(`scene-surface-camera.tsx` 의 `placePivot`), 직교 탑뷰의 줌 상한(`orthoZoomAdvance`)이 전부 이 값을 읽는다. 직교 카메라의 fov·aspect 는 `resolveCameraFov`/`resolveCameraAspect` 로 읽어 원근과 같은 값이 나온다.

**최소 거리** — 휠 줌은 커서 아래 표면(모델 자체 포함), 독 확대 버튼은 화면 중앙 표면(타깃)에서 `CAMERA_MIN_SURFACE_DISTANCE`(`lib/camera-limits.ts`)까지만 다가간다. 휠 한 이벤트의 이동량은 `surfaceDollyAdvance` 가 정한다(미적용 pending 반영, 하한·`controls.maxDistance` 로 clamp). 에디터 F 포커스·탑뷰의 최소 거리가 같은 상수를 읽고, 뷰어 확대 버튼의 `MIN_CAMERA_DISTANCE`(`three-scene-viewer.tsx`)는 ui 가 features 를 import 하지 못해 같은 값의 리터럴이다. OrbitControls `minDistance` 는 회전·팬 반경 clamp 일 뿐이라 이보다 작게(표면 레이캐스트 near 와 같게) 둔다. 바닥·극각 제한은 그대로 걸리므로 지면 위 객체에는 비스듬히 볼수록 멀리서 멈춘다.

**라벨 위 조작** — 모델 라벨·눈금 점/숫자는 포인터를 받는 DOM 오버레이(drei `Html` — 에디터의 클릭 선택, 라벨의 상태 툴팁)라 그 위의 휠·드래그는 카메라 조작에 닿지 않는다(휠 줌은 캔버스 요소의 리스너, OrbitControls·R3F 이벤트는 R3F 가 연결한 Canvas 래퍼 div 의 리스너). 그래서 `useOverlayPointerForwarding` 이 휠과 pointerdown 을 같은 좌표·버튼으로 캔버스에서 난 것처럼 다시 발행(bubbles)하고 원본의 전파는 끊는다 — 라벨 위에서도 휠 줌·회전이 되고 어느 리스너도 두 번 받지 않는다. OrbitControls 는 pointermove·pointerup 을 document 에서 받으므로 pointerdown 만 넘기면 드래그가 이어진다. 눌린 자리에서 `OVERLAY_CLICK_SLOP_PX` 넘게 움직인 뒤의 click 은 선택으로 치지 않는다. 클릭을 받지 않는 라벨(`onSelect` 없음)은 커서가 기본이다.

제한 뒤에는 `controls.update()` 를 부르지 않고 `change` 이벤트만 발행해 에디터 카메라 상태가 따라오게 한다.

### 관제 요약 HUD (상단 중앙)

`scene-status-hud.tsx`, 독 배치의 실시간 화면에서만 마운트한다. 한 줄 막대 + 그 아래 펼침 목록(`scene-status-hud-alarm-list.tsx`). 막대는 pointer-events-none 이고 알람 요약 버튼·풍속 툴팁 트리거·펼침 목록만 포인터를 받는다 — 목록은 스크롤이라 휠을 캔버스로 넘기지 않는다(고정 뷰 줄과 같은 취급).

칸(왼쪽부터):

- 알람 요약 — 이상 조건(아래)이 없으면 "이상 없음", 있으면 "경고 n · 주의 m" 버튼. 경고는 붉은 원판 느낌표, 주의는 호박색 삼각형 느낌표(`scene-status-hud-glyphs.tsx`, 목록 행도 같은 글리프). 누르면 아래로 크레인별 알람 목록이 펼쳐진다. 저절로 펼치지 않고(사용자가 열기 전까지) 조건이 전부 사라지면 접는다. 펼침 상태는 영속하지 않는다.
- 크레인 N대 — 운전 상태(`docs/agents/3d-play.md`)의 적층 막대 + 가동·대기·전원 Off·고장·통신두절 수치. N 은 상태를 아는 장비 수이고 미확인은 title 에만. 색은 `RUNTIME_STATUS_COLORS`(라벨과 같은 색), 통신두절만 빗금이고 조각 사이에 여백이 없다. "대기" 는 standby(운전 전원 On, 멈춤)의 HUD 짧은 라벨이고 풀네임은 title 이다. 고장·통신두절 수치는 0 이면 흐리고 1 이상이면 강조.
- 풍속 — `use-scene-weather.ts` 가 `scene-site-geo` 좌표로 open-meteo 를 주기 조회한다(기상 예보 값이지 현장 풍속계가 아니다 — title 에 적는다). 헤더의 `useHeaderWeather` 는 라우트·옥포 독 좌표 전용이라 따로 둔다. 값·16방위 아래 게이지(`windGaugeFraction`, 상한 `WIND_GAUGE_MAX_MS`)에 주의·중지 눈금(`windGaugeMarks`)이 있고 권고 단계(`wind-advisory.ts`, `WIND_CAUTION_MS`·`WIND_STOP_MS`)가 색·칩을 정한다. 아이콘과 두 눈금은 툴팁(`@crane/ui/molecules/tooltip`)으로 출처·기준을 보인다.
- 현장 시각 · 수신 — 현장 시각은 `useSceneSunState`(`docs/agents/rendering-perf.md`). 수신 줄은 `lib/feed-freshness.ts` 가 크레인 스냅샷 피드의 소켓 상태(`useCraneFeedConnection`)·화면 반영 보류(`useRealtimeStore.held`)·마지막 묶음 수신 시각(`useCraneSnapshotStore.lastReceivedAt`)을 한 상태로 합친 것이다. 보류가 소켓보다 앞서고, 연결됐는데 묶음이 `FEED_STALE_MS` 넘게 없으면 stale. 연결돼 있으면 마지막 묶음의 수신 시각을 현장 시간대로 보이고(`formatFeedClock`) 아니면 상태 문구다. 두 줄은 오른쪽 정렬. 1초 틱은 이 줄만 다시 그린다.

**이상 조건** — `lib/hud-conditions.ts`(`buildHudConditions`), 훅 `model/use-hud-conditions.ts` 를 `Monitoring3dView` 가 한 번 부르고 HUD 와 위험 비네트가 같은 결과를 읽는다.

- 입력: 페이지가 넘긴 region 활성 알람(`alarms` prop — features/alarm `useRegionActiveAlarms`, 같은 레이어라 뷰가 직접 읽지 않는다), 운전 상태·라벨의 Bypass·전이 시각(`useModelStatusRecords` 의 `since`, `lib/status-since.ts`), 영역 침범·정지(`useSceneZoneStore`), 활성 충돌 기록(`useSceneCollisionStore`).
- 등급은 둘이다. 경고(danger) = 충돌·stop 영역 침범·고장·critical/high 알람. 주의(caution) = warn 영역 침범·통신두절·medium 알람·Bypass. info 알람은 넣지 않는다.
- 행은 크레인마다 하나다. 가장 심각한 조건이 제목, 나머지가 상세 줄. 경고 → 주의, 같은 등급은 제목 조건이 최근인 행이 먼저. 요약 수는 조건이 아니라 행 수다. 씬에 없는 크레인의 알람은 `crane:<craneId>` 키로 따로 선다.
- 영역 침범은 알람 스토어의 `zone_intrusion` 로컬 알람이 아니라 영역 스토어에서 직접 읽고(정지 여부·침입자가 알람에 없다) 들어간 쪽 크레인에 붙는다. 알람 쪽 `zone_intrusion` 은 거른다.
- [보기] — 영역 행은 영역 중심(`handleViewZone`), 그 외는 모델 바운즈 중심(`computeObjectViewPose`)으로 카메라를 보내고 목록을 닫는다. 씬에 없는 크레인의 행은 버튼이 없다. 분할 중이면 나가서 보여 준다.

**위험 비네트** — `ui/scene-danger-vignette.tsx`. 경고 행이 하나라도 있으면 옅은 붉은 비네트(정적). 펼침 목록 헤더의 경광등 토글로 끈다(`model/use-danger-vignette-store.ts`, localStorage `DANGER_VIGNETTE_STORAGE_KEY`, 기본 켜짐). 충돌·영역 침범 비네트가 떠 있으면 그리지 않는다.

### 충돌 감지 표시 (LiDAR 근접 존, 필리 실외 화면만)

골리앗 크레인 양쪽 다리의 LiDAR 감지 원과 감지 객체(사람·작업자·차량·지게차)를 그리는 표시 모드. 씬 객체 충돌 감지(`docs/agents/3d-collision.md`)와 별개다.

- 켜는 곳은 `outdoor-work` 실시간 뷰가 `Monitoring3dView` 세 슬롯(`sceneExtras`·`toolbarExtras`·`overlayExtras`)에 넣는 `CollisionGuardSceneLayer`·`CollisionGuardToggle`·`CollisionGuardHud`/`CollisionGuardHelp` 다. region 의 `siteType === 'philly-shipyard'` 일 때만 넣는다 — 옥포 씬에도 같은 자산의 골리앗이 있어 씬 내용으로는 가르지 못한다.
- 존은 그 region 씬에서 자산 `CODE_ASSETS.goliathCrane.id` 인 첫 모델의 배치(position·rotation Y)에서 `useGoliathCollisionZones` 가 파생한다. 크레인이 없으면 null 이고 토글·HUD·도움말·씬 레이어 모두 그리지 않는다. 존 높이는 `groundMaps`(바닥 지도) raycast 가 정하고 크레인 y 는 폴백이다.
- 토글 ON 은 `CollisionGuardCameraRig` 가 에고 포즈(크레인 중심 부감)로 날아가고 OFF 에 진입 직전 시점으로 돌아온다. 분할 화면 중엔 토글이 비활성이다(가드 카메라가 기본 카메라를 움직이는데 분할에선 그 카메라가 보이지 않는다).
- 감지 객체는 아직 시뮬레이션(`use-collision-guard-simulation.ts`)이 만든다. 훅 언마운트가 스토어 트랙과 `enabled` 를 함께 내린다 — 켠 채로 화면을 떠나면 다음 진입이 복귀 지점 없이 ON 으로 시작하기 때문이다.
- 번역 키는 `monitoring:collisionGuard.*`.

### 경보 알림 채널

`notifyAlert({ id, severity, title, description, toast? })` 가 설정에 따라 세 채널로 내보낸다.

- toast — sonner, 앱 전역 Toaster.
- 소리 — WebAudio 비프(에셋 없음). 사용자 입력 전엔 무음.
- 브라우저 알림 — 탭이 숨겨진 때만, 권한 granted 일 때만.

설정은 `useAlertNotificationSettings`, localStorage `crane:alert-notify`, 기본 소리 ON·브라우저 OFF. UI 는 페이지 설정 팝업의 "경보 알림" 절(`packages/features/src/page-settings/`). 채널은 i18n 을 모르므로 제목·본문은 호출자가 번역해 넘긴다.

발신자는 둘이다.

- `scene-alert-notifier.tsx` — 앱 셸 runtime effects 에 마운트. 충돌 새 기록·영역 새 침범 쌍. **toast 없음**, 소리·브라우저 알림만 — 비네트·HUD·헤더 배지와 겹친다.
- `use-critical-alarm-notifier.ts` — critical·high 새 알람(실시간 페이지가 부른다). 화면 표시는 관제 HUD 가 맡아 toast·배너 없이 소리·브라우저만. 영역 침범 로컬 알람(`eventType 'zone_intrusion'`)은 제외한다 — 3D 화면 경보와 겹침 방지.

실시간 화면의 사건만 알림으로 나간다(`docs/agents/3d-zone.md` 의 저널 규칙과 같은 게이트).

### 미니맵 (기본 좌하단)

- 순수 계산 `minimap.ts`(bounds→프레임, 픽셀↔월드, 팬 포즈 `panPoseToPoint`, 카메라 발자국·픽토그램 `cameraGlyphPolygon`(실루엣 `CAMERA_GLYPH_SHAPE`), 패널 위치 `clampPanelPosition`·비율 변환 `panelPositionToRatio`/`panelRatioToPosition` — 테스트 대상).
- 픽셀 후처리 `minimap-image.ts` — Float 렌더 타깃 readback(선형·비톤매핑, Float 확장이 없으면 8bit 폴백을 `toLinearFloatPixels` 가 0~1 로 편다)에 three 의 `ACESFilmicToneMapping` 을 그대로 옮긴 `acesFilmicToneMap`(행렬이 채널을 섞어 채널별 LUT 불가) + sRGB 를 픽셀마다 적용한다. 노출은 렌더러와 같은 1, 노출 보정은 없다(캡처 조명이 고정이라 입력 밝기가 일정). 캡처용 기준 조명은 `minimap-capture-lighting.ts`(`applyCanonicalCaptureLighting`, `applyCanonicalWaterUniforms`, `CANONICAL_KEY_LIGHT_DISTANCE`) — 둘 다 테스트 대상.
- 스토어 `use-scene-minimap-store.ts` — 스냅샷, 표시 여부(영속 `crane:scene-minimap:visible`), 패널 위치(영속 `crane:scene-minimap:position`, 컨테이너 여유 공간 대비 **비율** `PanelRatio`, null = 기본 좌하단. px 로 저장하던 예전 모양은 null 로 읽는다).
- 캡처 `scene-minimap-capture.tsx`(Canvas 안) — 씬 준비 + 로더 idle 뒤 useFrame 에서 기준 지도 합집합(`resolveCameraBoundsMaps`, 위 카메라 제한과 같은 기준) 위를 직교 카메라(up=(0,0,-1) → 이미지 위 = −Z)로 렌더 타깃에 한 번 그려 readback 한다. **렌더 타깃에 stencilBuffer 가 필수**다 — 실루엣 마스크·헐이 자기 스텐실 비트로 그려진다(충돌 하이라이트 중 캡처, `docs/agents/3d-collision.md`). 렌더 타깃은 **Float**(`FloatType`, WebGL2 `EXT_color_buffer_float` 필요 — 없으면 readback 이 검정으로 남거나 던져 try/catch 가 경고 뒤 null, 어느 쪽이든 미니맵 배경만 잃는다) — 8bit 선형 RT 는 어두운 값이 양자화돼 띠·색 편향이 생긴다. **조명은 캡처 순간만 SceneLighting 의 수동 모드 값(기준 조명)으로 바꾼다**(`applyCanonicalCaptureLighting` — `SCENE_KEY_LIGHT_NAME` 으로 찾은 키 방향광을 씬의 수동 태양 방향(`sunDirectionFromAngles(lighting.sunAzimuth/sunElevation)`, 없으면 기본값)·백색·`SCENE_LIGHTING_BASE.sunIntensity` 로 두고 target 월드 위치 기준으로 옮김, 환경광 백색·`SCENE_LIGHTING_BASE.ambientIntensity`, 나머지 조명 세기 0, 그림자 `shadow.intensity` 0, `scene.environmentIntensity` 는 환경맵이 있으면 `SCENE_ENVIRONMENT_INTENSITY` 아니면 0, renderer 의 `shadowMap.autoUpdate`·`needsUpdate` 를 캡처 동안 끔 — 같은 프레임의 보류된 `invalidateShadows()` 를 옮긴 조명으로 소비하지 않게, 렌더 뒤 전부 원복). 미니맵이 3D 화면의 기본 룩과 같은 색이고 solar 모드의 시각·날씨·그림자와 무관하다. 전부 유니폼 변경이라 재컴파일이 없다 — visible·castShadow·`shadowMap.enabled` 는 건드리지 않는다. `OceanWater` 는 **보이는 채로** 그린다(바다 색이 물 셰이더에서 나온다) — 직교 카메라엔 미러 패스가 없어 캡처 동안만 `applyCanonicalWaterUniforms` 로 `reflectionIntensity` 0(낡은 반사 RT 배제)·`sunDirection`/`sunColor` 를 기준 태양·백색으로 둔다. 바다 반사 제외 등록부의 객체(밤하늘 틴트 돔·태양/달 스프라이트 — 돔은 직교 카메라도 감싸 전체를 틴트)만 숨긴다. clear color 는 손대지 않는다 — 바다 영역은 물 원판이 덮고, 바다 없는 씬은 검정 배경이다(`docs/agents/rendering-perf.md`). 재캡처는 기준 지도 목록 또는 씬의 수동 태양 각도(`lighting.sunAzimuth`/`sunElevation`)가 바뀔 때뿐이고 수동 새로 고침은 없다.
- 표시 `scene-minimap.tsx` — DOM 2D 캔버스에 짧은 인터벌로 직접 그린다, setState 없음. 그리는 순서는 스냅샷 → 고정 뷰 핀 → 장비 마커 → 카메라(부채꼴·픽토그램) → 호버 라벨이다 — 알람 색 마커가 핀에, 카메라가 마커에 가려지지 않고, 부채꼴은 반투명이라 안의 마커가 비친다. 레지스트리 월드 위치 마커(색은 알람 severity, 없으면 노랑 `MARKER_COLOR` — 운전 상태 색은 미니맵에 쓰지 않는다, 루트→AABB 중심 오프셋은 첫 관측 때 캐시), 카메라(시선 방향으로 돌린 카메라 픽토그램 `cameraGlyphPolygon` + 같은 색 `CAMERA_COLOR` 흰색의 시야 부채꼴 — 픽토그램은 검은 외곽선 — 카메라에서 멀어질수록 투명해지는 그라데이션 채움, 테두리는 호 없이 양쪽 모서리 직선만. 부채꼴은 방향 표시일 뿐이라 각·길이가 `FOOTPRINT_ANGLE_DEG`·`FOOTPRINT_LENGTH_PX` 고정이고 카메라 fov·타깃 거리를 따라가지 않는다. 카메라→타깃 XZ 거리가 `HEADING_MIN_DISTANCE_PX` 미만이면 정수직 탑뷰로 보고 점만 찍는다). 영역 원·타깃 십자는 그리지 않는다.
- 고정 뷰 핀 — 고정 줄(`SceneViewBar`)과 같은 목록(`pinnedViews`, 씬 순서)을 받아 고정 줄 순서의 번호를 머리에 쓴다. 핀 끝이 뷰 타깃(보는 곳)이고, 머리가 이미지 위로 잘리면 아래로 뒤집는다(`viewPinHead`). 호버하면 그 뷰의 카메라 위치·시야 부채꼴·타깃까지 점선과 이름을 보인다. 지금 카메라의 위치·시선 방향이 그 뷰와 같으면(`isSameViewPose`) 흰색으로 채운다 — 타깃 거리는 보지 않는다. 이동 뒤 표면 피벗이 타깃을 시선 위에서 다시 잡아 같은 화면이어도 타깃이 달라진다. 타깃이 지도 밖인 뷰는 장비 마커처럼 그리지 않는다. 고정하지 않은 뷰는 그리지 않는다.
- 조작 — 누르기·끌기는 `panPoseToPoint` 로 타깃만 옮기는 팬을 컨트롤러 `panTo` 로 보내 `SceneCameraLimits` 가 그대로 걸린다. 장비 마커 위를 눌러도 같은 팬이다 — 마커는 호버 때 장비 이름만 보인다. 핀 머리는 눌렀다 놓으면 `onSelectView`(고정 줄 버튼과 같은 핸들러, `moveTo`)로 그 뷰에 가고, 누른 채 `isOverlayDrag` 범위를 넘게 끌면 팬으로 바뀐다. 핀과 장비 마커가 겹치면 핀이 누르기·호버 라벨을 가진다. 패널은 상단 그립 바를 끌어 캔버스 영역 안 어디든 놓을 수 있다. 끄는 동안은 px(`clampPanelPosition`)로 움직이고 놓을 때 컨테이너 크기로 비율을 만들어 저장하며, 마운트·컨테이너 리사이즈(전체화면 포함) 때는 레이아웃 effect 가 `panelRatioToPosition` 으로 px 를 다시 놓는다 — 우하단에 둔 패널이 전체화면에서도 우하단에 머문다.
- 독 토글 `scene-minimap-toggle.tsx`.

### 씬 독 (우측 레일, hover 펼침·고정)

- 껍데기 `scene-dock.tsx` 는 완전 제어형이다. 도킹 프레임은 `three-scene-viewer.tsx` 의 `toolbarPlacement="dock"`.
- 레일 순서(위에서부터): 카메라 묶음(원래위치·탑뷰·저장한 뷰 `toolbarTrailing`·확대·축소·전체화면) → 화면 표시 묶음(페이지가 준 `toolbarExtras` — 충돌 감지 표시 토글·미니맵·현장 시각 `ui/scene-clock-menu.tsx`).
- 레일 토글의 켜짐은 배경 채움이고, 탑뷰만 에디터 도구 모음처럼 아이콘 아래 점이다(`SceneToolbarButton` 의 `pressedDot`, 점 클래스 `TOOLBAR_PRESSED_DOT_CLASS` 를 에디터와 공유). 2D/3D 는 레일이 아니라 우상단 토글이다(`docs/agents/rendering-perf.md` "평면도 룩").
- 우상단 슬롯(`fullscreenTopRightOverlay`)은 위에서부터 고정 뷰 줄(`SceneViewBar`) → 방위 표시(`SceneCompass`) → 탑뷰 중 2D/3D 전환(`ScenePlanLookToggle`)이다. 고정 뷰 줄이 비면 `null` 이라 간격 없이 방위 표시가 맨 위다. 토글이 방위 표시 아래라 탑뷰를 켜고 꺼도 방위 표시 자리는 그대로다. 슬롯 래퍼는 포인터를 받지 않고 누를 것만 `pointer-events-auto` 다 — 폭이 다른 줄 사이 빈 곳이 캔버스 조작을 먹지 않게. 탑뷰 상태는 뷰어의 `onTopViewActiveChange` 로 받는다.
- `toolbarTrailing` 을 카메라 묶음 안에 끼우는 것은 dock 배치뿐이다. 가로 툴바는 앞에 붙는다.
- 상태·영속화는 `use-scene-dock.ts` + `dock-hover-state.ts`(순수 리듀서)·`dock-storage.ts`(pin 영속화), 테스트 대상.

### 방위 표시·축척·북쪽 위로 (독 배치)

- **방위 표시** `ui/scene-compass.tsx` — 우상단 슬롯의 고정 뷰 줄 아래(에디터도 같은 열). 지면에 놓인 원(N·E·S·W + 북 적색 바늘)을 카메라가 보는 모습이라 탑뷰에선 원, 비스듬하면 납작한 타원이다. 기하는 `lib/compass.ts`(`resolveCompassView`, 진북 = `resolveTrueNorth`). 자세는 React 상태가 아니라 Canvas 안 `SceneCompassDriver` 가 `useFrame` 에서 바뀐 프레임에만 DOM 에 쓴다. 모니터링·에디터에서는 누르면 북쪽 위로(`onNorthUp`).
- **분할 타일의 방위 표시** — 타일마다 우상단, 고정 구도라 한 번만 쓰고(`resolveCompassViewForPose`) 조작이 없다(타일 클릭이 그 뷰를 연다). 오른쪽 열 타일(`isSplitTileAtRightEdge`)은 `--dock-right-inset` 만큼 안쪽으로 비킨다. 캔버스 우상단 모서리 타일(`findSplitCornerTile`)의 것만 타일 오버레이가 아니라 우상단 슬롯의 고정 뷰 줄 아래(분할 밖 방위 표시 자리)에 그린다 — 그 타일 위에 고정 뷰 줄이 떠 있다.
- **축척 바** `ui/scene-plan-scale-bar.tsx` — 캔버스 우하단(독 레일 안쪽). 직교 탑뷰에서만 보이고 원근에서는 숨는다(원근은 화면 위치마다 축척이 달라 바 하나가 거짓). 길이는 `lib/plan-scale-bar.ts` 의 `resolvePlanScaleBar`(상한 `PLAN_SCALE_BAR_MAX_PX` 안에서 가장 긴 1·2·5×10ⁿ m, 씬 단위는 `getSceneMetersPerUnit`). 갱신은 `ScenePlanScaleBarDriver` 가 방위 표시와 같은 규칙으로 쓴다.
- **북쪽 위로** — 방위 표시를 누른다(독 레일 버튼은 없다). 타깃을 축으로 카메라를 돌려 화면 위가 진북이 되게 한다(`lib/north-up.ts` → core `rotatePoseToHeading`·`headingForAzimuth`). 모드를 유지하는 경로(모니터링 `panTo`, 에디터 `SceneEditorCameraActions.northUp`)로 적용하므로 탑뷰면 평면도가 north-up, 원근이면 시선이 북을 향한다. 탑뷰 진입 기본은 여전히 "보던 방향이 화면 위" 다 — 북쪽 고정을 기본으로 바꾸지 않는다(보던 곳을 잃는다).

### 평면도 겹침 (탑뷰, 독 배치)

위에서 겹쳐 보이는 장비 쌍에서 가려지는 쪽을 읽게 하는 표시. 실제 충돌(`docs/agents/3d-collision.md`)과 별개의 표시용 계산이고 경고색을 쓰지 않는다 — "겹쳐 보이는데 빨갛지 않다" 가 안전이어야 한다.

- 판정 `lib/plan-overlap.ts`(domain, `resolvePlanOverlaps`): 모델별 메쉬 월드 AABB 의 평면 겹침 → 위/아래(수직 여유가 가장 작은 메쉬 쌍 기준, 여유 값은 화면에 쓰지 않는다). 스캔은 `lib/plan-overlap-scan.ts` 의 `PlanOverlapScanner` 가 `modelObjectRegistry` 루트에서 `collectCollidableMeshes` 로 모아 `PLAN_OVERLAP_SCAN_INTERVAL_MS` 마다 돌고(`ScenePlanOverlapDetector`, Canvas 안·RigDriver 뒤·평면도 룩일 때만), 숨은선 대상(쌍·위아래)이 바뀐 결과만 `use-plan-overlap-store.ts` 에 쓴다(`hasPlanOverlapChanged`) — 장비가 겹친 채 움직여도 스토어를 다시 쓰지 않는다. 원근으로 돌아오면 비운다.
- **숨은선**: 가려지는 쪽 모델에 옅은 회청 채움과 가는 윤곽(`docs/agents/rendering-perf.md` "평면도 룩" 의 숨은선). 픽셀 단위 깊이라 AABB 가 겹침을 과하게 잡아도 정확하다.

### 워밍업 표시

초기 로딩 오버레이(`ui/scene-loading-overlay.tsx`)가 걷힌 뒤 이어지는 비차단 표시다(스피너 + 문구 한 줄, `common:viewer3d.warmup.*`).

- 단계 선택 `selectSceneWarmupStep`(`scene-warmup-step.ts`): bvh 잔여 → outline 잔여 → 충돌 런타임 baseline(스토어 `baselinePending`) → drei `useProgress` 활성. 타이머 추측은 없다. 큐 자체·셰이더 프리워밍은 `docs/agents/rendering-perf.md`, baseline 은 `docs/agents/3d-collision.md`.
- 배치: 모니터링·리플레이는 overlay 슬롯의 좌측 상단 열(시뮬레이션 배지와 세로 스택), 편집은 캔버스 컨테이너 좌측 상단.

## 불변식

- `SceneCameraLimits` 는 `SceneSurfaceCamera` **바로 다음 형제**로 마운트한다.
- 카메라 제한 뒤 `controls.update()` 금지 — damping 이 이중 적용된다. `change` 이벤트만 발행한다.
- 카메라 범위·미니맵 캡처의 기준 지도는 `resolveCameraBoundsMaps` 하나다. 바닥 raycast 기준(`resolveGroundMaps`)과 섞지 않는다.
- 카메라 최대 거리를 읽는 곳(휠 dolly·표면 피벗 cap·직교 탑뷰 줌 상한)은 `SceneCameraLimits` 가 정한 `controls.maxDistance` 를 읽는다. 따로 계산하지 않는다.
- 카메라를 옮기는 명령은 뷰어 컨트롤러의 `moveTo`(탑뷰면 원근 복귀)·`panTo`(모드 유지, 미니맵) 둘 중 하나다. 분할 진입·충돌 감지 표시 ON 은 `exitTopView` 를 먼저 부른다.
- 확대 하한은 `CAMERA_MIN_SURFACE_DISTANCE` 하나다. 뷰어 확대 버튼의 리터럴은 같은 값으로 맞추고, OrbitControls `minDistance` 는 그보다 작게 둔다.
- 캔버스 위에서 pointer-events 를 받는 DOM 오버레이는 `useOverlayPointerForwarding` 으로 휠·pointerdown 을 캔버스에 넘긴다. 오버레이를 카메라 조작의 사각지대로 두지 않는다.
- 미니맵 캡처 렌더 타깃은 `FloatType`(EXT_color_buffer_float·EXT_float_blend 가 없으면 `UnsignedByteType` 폴백) + `stencilBuffer: true`(실루엣 마스크·헐). 캡처는 `applyCanonicalCaptureLighting` 으로 조명을 수동 모드 기준값으로 바꾸고(renderer `shadowMap.autoUpdate`/`needsUpdate` 도 캡처 동안 끔) `OceanWater` 는 `applyCanonicalWaterUniforms` 로 반사 0·기준 태양으로 둔 채 보이게, 반사 제외 객체만 숨긴 채 찍는다. clear color 는 바꾸지 않는다. 캡처에서 조명·그림자·노출을 씬의 시각 상태에 의존시키지 않고, 톤매핑은 three 의 ACESFilmic 과 같은 식(`acesFilmicToneMap`)만 쓴다.
- 미니맵 표시는 setState 없이 2D 캔버스에 직접 그린다. 팬은 컨트롤러 `panTo`, 핀은 고정 줄과 같은 `moveTo` 핸들러로 보내 카메라 제한을 통과시킨다.
- 미니맵 핀과 고정 줄은 같은 `pinnedViews` 를 받는다. 따로 거르거나 정렬하면 핀 번호가 고정 줄 순서와 어긋난다.
- 전체화면 주인이 언마운트되면 전체화면을 끝낸다. 한 시점에 주인은 하나다.
- `notifyAlert` 호출자가 제목·본문을 번역한다. 채널에 i18n 을 넣지 않는다.
- HUD·미니맵은 독 배치의 실시간 화면(`toolbarLayout='dock'` 이고 `mode !== 'play3d'`)에만 마운트한다.
- 실시간 화면의 알람 목록은 관제 HUD 의 펼침 목록 하나다. 알람·고장·통신두절·Bypass·영역 침범·충돌은 `useHudConditions` 한 결과를 읽고 위험 비네트도 같은 결과를 본다 — 같은 사건을 다른 곳에서 따로 세지 않는다.
- 비네트는 한 번에 하나다. 위험 비네트는 충돌·영역 침범 비네트가 떠 있으면 그리지 않는다.
- 독 레일 순서는 카메라 묶음 → 화면 표시 묶음. 감지 스위치·시뮬레이션 ▶ 는 독에 두지 않는다(감지 설정 페이지·3D 플레이 트랜스포트 바가 담당).

## 하지 않기로 한 것

- 요소 단위 전체화면 — top layer 밖 DOM 이 생겨 `PortalContainerProvider` 와 두 번째 Toaster 가 필요해진다.
- 탑뷰·카메라 범위에 여유·여백 비율 — 지도가 작업 구역보다 훨씬 넓은 조선소에선 바깥 여유가 무의미하고 안쪽 여백은 가장자리 모델을 잘라낸다.
- 타깃 기준 카메라 범위 제한 — 표면 피벗이 타깃을 지도 밖에 놓아 드래그마다 튄다.
- 경계 위반 시 되밀기 — 프레임 평행이동 취소 + 투영이 대안.
- 씬 감지 사건(충돌·침범)의 toast — 비네트·HUD·헤더 배지와 겹친다.
- 3D 플레이에 HUD·미니맵.
- 우상단 알람 목록·독 레일의 알람 토글·상단 중앙 critical 배너 — HUD 요약·펼침 목록·비네트와 같은 사건이 세 군데에 떠 겹쳤다. 소리·브라우저 알림만 `use-critical-alarm-notifier.ts` 에 남겼다.
- HUD 펼침 목록의 휠·pointerdown 캔버스 전달 — 스크롤 목록이라 휠을 넘기면 목록이 안 넘어간다.
- HUD 에 info 알람 — 요약 수만 부풀리고 관제가 할 행동이 없다.
- 경고가 생길 때 알람 목록 자동 펼침 — 관제 중 화면 한가운데를 가린다. 사용자가 연다.
- 독의 하단 패널(크레인 실시간 상태 테이블)·감지 묶음.
- 미니맵 마커·카메라 그리기를 React state 로 — 매 틱 리렌더.
- 미니맵 시야 부채꼴을 카메라 fov·타깃 거리에 맞추기 — 탑뷰 근처에선 사라지고 멀리서 낮게 보면 지도를 덮어 방향을 읽기 어렵다. 리사이즈로 종횡비가 바뀔 때마다 각도 흔들린다.
- 평면도 겹침 쌍의 수직 여유(Δh) 칩 — 겹침 중심에 띄운 숫자가 화면을 어지럽히고, AABB 여유는 골리앗처럼 박스가 바닥까지 닿는 장비에서 뜻이 없다. 가려짐은 숨은선 하나로 보인다.
