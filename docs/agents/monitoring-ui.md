# 모니터링 화면 UI — 전체화면·카메라 이동 범위 제한·관제 HUD·경보 알림·미니맵·씬 독·워밍업 표시

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

조립은 `packages/features/src/3d/ui/monitoring-3d-view.tsx`(`Monitoring3dView`)다. `toolbarLayout='dock'` 이 실시간 관제 화면 배치이고, HUD·미니맵은 그 배치에서 `mode !== 'play3d'` 일 때만 마운트된다. 좌측 상단 열은 시뮬레이션 배지(`ui/scene-simulation-badge.tsx`) → 워밍업 표시 → 포커스 복귀 버튼 순의 세로 스택이다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 전체화면 | `packages/core/src/lib/use-fullscreen.ts` (`useIsFullscreenActive`), 소비 `packages/widgets/src/layout/ui/app-layout.tsx`, `packages/ui/src/organisms/three-scene-viewer.tsx` |
| 카메라 이동 범위 제한 | 적용 `packages/features/src/3d/ui/scene-camera-limits.tsx` (`SceneCameraLimits`), 수식 `lib/camera-limits.ts`, 기준 지도 `packages/domain/src/3d/lib/camera-bounds-maps.ts` |
| 지도 표면 raycast | `packages/domain/src/3d/lib/map-surface-raycast.ts` (`raycastMapSurfaceY`) |
| 관제 요약 HUD | `packages/features/src/3d/ui/scene-status-hud.tsx`, 날씨 `model/use-scene-weather.ts`, 권고 `lib/wind-advisory.ts`, 연결 `model/use-realtime-connection-state.ts` |
| 경보 알림 채널 | `packages/core/src/lib/alert-notifications.ts` (`notifyAlert`, `useAlertNotificationSettings`) |
| 알림 발신자 | `packages/features/src/3d/ui/scene-alert-notifier.tsx`, `packages/features/src/alarm/model/use-critical-alarm-banner.ts` |
| 미니맵 | 계산 `packages/features/src/3d/lib/minimap.ts`, 픽셀 후처리 `lib/minimap-image.ts`, 스토어 `model/use-scene-minimap-store.ts` |
| 미니맵 UI | `packages/features/src/3d/ui/scene-minimap-capture.tsx`, `ui/scene-minimap.tsx`, `ui/scene-minimap-toggle.tsx` |
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
- 뷰어·리플레이의 `getTopViewBounds` 와 에디터 `topView` 도 같은 합집합을 본다. 여유·여백 비율은 두지 않는다.

**바닥** — 카메라 아래 지도 표면(씬의 모든 지도에 `raycastMapSurfaceY`, 카메라 XZ 가 일정 거리 움직였을 때만 재측정, 히트 없으면 `SEA_LEVEL_Y`) + `CAMERA_GROUND_CLEARANCE`. EXR 유무와 무관하다. 회전은 `maxPolarAngle` 을 매 프레임 갱신해 막는다 — 바닥 기준 동적 상한과 `CAMERA_MAX_POLAR_ANGLE` 중 작은 쪽. `minPolarAngle` 은 0(정수직 탑뷰 허용).

**이동** — 타깃이 아니라 **카메라 XZ** 를 합집합 안으로 제한한다. 표면 피벗이 타깃을 지도 밖 지형·바다에 놓으므로 타깃 기준이면 드래그마다 튄다.

**위반 처리** — 되밀기가 아니라 **그 프레임의 평행이동 취소**다. 카메라·타깃 델타가 같으면 팬·dolly 로 보고 update 직전 자세로 복원해 경계에서 그냥 멈춘다. 그래도 밖이면(회전·프레임 밖 명령·로드 직후) 경계로 투영한다.

**최대 거리** — `controls.maxDistance` = 합집합의 탑뷰 fit 거리 × `CAMERA_MAX_DISTANCE_RATIO`, 상한 `CAMERA_MAX_DISTANCE`(지도 없으면 상한값). 휠 dolly 상한, 표면 피벗 거리 cap(`scene-surface-camera.tsx` 의 `placePivot`), 뷰어·에디터 탑뷰 상한(반높이 차감)이 전부 이 값을 읽는다.

제한 뒤에는 `controls.update()` 를 부르지 않고 `change` 이벤트만 발행해 에디터 카메라 상태가 따라오게 한다.

### 관제 요약 HUD (상단 중앙)

`scene-status-hud.tsx`, pointer-events-none. 독 배치의 실시간 화면에서만 마운트한다. `mode`·`sceneInfo` prop 을 받는다.

칸:

- 현장 시각 — `useSceneSunState`(`docs/agents/rendering-perf.md`).
- 풍속/풍향 — `use-scene-weather.ts` 가 `scene-site-geo` 좌표로 open-meteo 를 주기 조회한다. 헤더의 `useHeaderWeather` 는 라우트·옥포 독 좌표 전용이라 따로 둔다. `@crane/domain/weather` 의 `WeatherSnapshot.windSpeed`(m/s)·`windDirection` 은 응답에 없으면 null. 권고 단계는 `wind-advisory.ts`(`WIND_CAUTION_MS`·`WIND_STOP_MS`, 현장 규정에 맞춰 상수만 조정).
- 가동 n / 상태 확인 N — 장비 운전 상태(`docs/agents/3d-play.md`). 값 생산이 멈춘 동안(충돌 pinned·영역 hold·실시간 보류·시뮬 정지)은 "정지 중".
- 두절 — 0 이면 숨김.
- 알람 장비 수 — 페이지가 넘긴 `alarmsByCraneId`, 최고 severity 색.
- 영역 침범 수 — 씬에 영역이 있을 때만, 정지 중엔 "n · 정지"(`docs/agents/3d-zone.md`).
- 충돌 상태 — 활성일 때만(`docs/agents/3d-collision.md`).
- 연결 — `use-realtime-connection-state.ts`. 시뮬레이션은 재생/정지(라벨에 `×배속 mm:ss`, `lib/sim-clock.ts`), 실시간은 cranes-lite WebSocket `subscribeState` 상태에 화면 반영 보류를 덧입힘, 3D 플레이는 `play3dPlaying` / `play3dPaused`.

### 경보 알림 채널

`notifyAlert({ id, severity, title, description, toast? })` 가 설정에 따라 세 채널로 내보낸다.

- toast — sonner, 앱 전역 Toaster.
- 소리 — WebAudio 비프(에셋 없음). 사용자 입력 전엔 무음.
- 브라우저 알림 — 탭이 숨겨진 때만, 권한 granted 일 때만.

설정은 `useAlertNotificationSettings`, localStorage `crane:alert-notify`, 기본 소리 ON·브라우저 OFF. UI 는 페이지 설정 팝업의 "경보 알림" 절(`packages/features/src/page-settings/`). 채널은 i18n 을 모르므로 제목·본문은 호출자가 번역해 넘긴다.

발신자는 둘이다.

- `scene-alert-notifier.tsx` — 앱 셸 runtime effects 에 마운트. 충돌 새 기록·영역 새 침범 쌍. **toast 없음**, 소리·브라우저 알림만 — 비네트·HUD·헤더 배지와 겹친다.
- `use-critical-alarm-banner.ts` — critical·high 새 알람. 배너가 있으니 toast 없이 소리·브라우저만. 영역 침범 로컬 알람(`eventType 'zone_intrusion'`)은 배너 대상에서 제외한다 — 3D 화면 경보와 겹침 방지.

실시간 화면의 사건만 알림으로 나간다(`docs/agents/3d-zone.md` 의 저널 규칙과 같은 게이트).

### 미니맵 (기본 좌하단)

- 순수 계산 `minimap.ts`(bounds→프레임, 픽셀↔월드, 팬 포즈 `panPoseToPoint`, 카메라 발자국·픽토그램 `cameraGlyphPolygon`(실루엣 `CAMERA_GLYPH_SHAPE`), 패널 위치 `clampPanelPosition` — 테스트 대상).
- 픽셀 후처리 `minimap-image.ts` — Float 렌더 타깃 readback(선형·비톤매핑, Float 확장이 없으면 8bit 폴백을 `toLinearFloatPixels` 가 0~1 로 편다)에 three 의 `ACESFilmicToneMapping` 을 그대로 옮긴 `acesFilmicToneMap`(행렬이 채널을 섞어 채널별 LUT 불가) + sRGB 를 픽셀마다 적용한다. 노출은 렌더러와 같은 1, 노출 보정은 없다(캡처 조명이 고정이라 입력 밝기가 일정). 캡처용 기준 조명은 `minimap-capture-lighting.ts`(`applyCanonicalCaptureLighting`, `applyCanonicalWaterUniforms`, `CANONICAL_KEY_LIGHT_DISTANCE`) — 둘 다 테스트 대상.
- 스토어 `use-scene-minimap-store.ts` — 스냅샷, 표시 여부(영속 `crane:scene-minimap:visible`), 패널 위치(영속 `crane:scene-minimap:position`, null = 기본 좌하단).
- 캡처 `scene-minimap-capture.tsx`(Canvas 안) — 씬 준비 + 로더 idle 뒤 useFrame 에서 기준 지도 합집합(`resolveCameraBoundsMaps`, 위 카메라 제한과 같은 기준) 위를 직교 카메라(up=(0,0,-1) → 이미지 위 = −Z)로 렌더 타깃에 한 번 그려 readback 한다. **렌더 타깃에 stencilBuffer 가 필수**다 — 실루엣 마스크·헐이 자기 스텐실 비트로 그려진다(충돌 하이라이트 중 캡처, `docs/agents/3d-collision.md`). 렌더 타깃은 **Float**(`FloatType`, WebGL2 `EXT_color_buffer_float` 필요 — 없으면 readback 이 검정으로 남거나 던져 try/catch 가 경고 뒤 null, 어느 쪽이든 미니맵 배경만 잃는다) — 8bit 선형 RT 는 어두운 값이 양자화돼 띠·색 편향이 생긴다. **조명은 캡처 순간만 SceneLighting 의 수동 모드 값(기준 조명)으로 바꾼다**(`applyCanonicalCaptureLighting` — `SCENE_KEY_LIGHT_NAME` 으로 찾은 키 방향광을 씬의 수동 태양 방향(`sunDirectionFromAngles(lighting.sunAzimuth/sunElevation)`, 없으면 기본값)·백색·`SCENE_LIGHTING_BASE.sunIntensity` 로 두고 target 월드 위치 기준으로 옮김, 환경광 백색·`SCENE_LIGHTING_BASE.ambientIntensity`, 나머지 조명 세기 0, 그림자 `shadow.intensity` 0, `scene.environmentIntensity` 는 환경맵이 있으면 `SCENE_ENVIRONMENT_INTENSITY` 아니면 0, renderer 의 `shadowMap.autoUpdate`·`needsUpdate` 를 캡처 동안 끔 — 같은 프레임의 보류된 `invalidateShadows()` 를 옮긴 조명으로 소비하지 않게, 렌더 뒤 전부 원복). 미니맵이 3D 화면의 기본 룩과 같은 색이고 solar 모드의 시각·날씨·그림자와 무관하다. 전부 유니폼 변경이라 재컴파일이 없다 — visible·castShadow·`shadowMap.enabled` 는 건드리지 않는다. `OceanWater` 는 **보이는 채로** 그린다(바다 색이 물 셰이더에서 나온다) — 직교 카메라엔 미러 패스가 없어 캡처 동안만 `applyCanonicalWaterUniforms` 로 `reflectionIntensity` 0(낡은 반사 RT 배제)·`sunDirection`/`sunColor` 를 기준 태양·백색으로 둔다. 바다 반사 제외 등록부의 객체(밤하늘 틴트 돔·태양/달 스프라이트 — 돔은 직교 카메라도 감싸 전체를 틴트)만 숨긴다. clear color 는 손대지 않는다 — 바다 영역은 물 원판이 덮고, 바다 없는 씬은 검정 배경이다(`docs/agents/rendering-perf.md`). 재캡처는 기준 지도 목록 또는 씬의 수동 태양 각도(`lighting.sunAzimuth`/`sunElevation`)가 바뀔 때뿐이고 수동 새로 고침은 없다.
- 표시 `scene-minimap.tsx` — DOM 2D 캔버스에 짧은 인터벌로 직접 그린다, setState 없음. 그리는 순서는 스냅샷 → 카메라 → 장비 마커라 마커가 부채꼴 위에 온다. 레지스트리 월드 위치 마커(색은 알람 severity, 없으면 노랑 `MARKER_COLOR` — 운전 상태 색은 미니맵에 쓰지 않는다, 포커스 테두리, 루트→AABB 중심 오프셋은 첫 관측 때 캐시), 카메라(시선 방향으로 돌린 카메라 픽토그램 `cameraGlyphPolygon` + 같은 색 `CAMERA_COLOR` 청록의 시야 부채꼴 — 카메라에서 멀어질수록 투명해지는 그라데이션 채움, 테두리는 호 없이 양쪽 모서리 직선만. 부채꼴은 방향 표시일 뿐이라 각·길이가 `FOOTPRINT_ANGLE_DEG`·`FOOTPRINT_LENGTH_PX` 고정이고 카메라 fov·타깃 거리를 따라가지 않는다. 카메라→타깃 XZ 거리가 `HEADING_MIN_DISTANCE_PX` 미만이면 정수직 탑뷰로 보고 점만 찍는다). 영역 원·타깃 십자는 그리지 않는다.
- 조작 — 누르기·끌기는 `panPoseToPoint` 로 타깃만 옮기는 팬을 컨트롤러 `moveTo` 로 보내 `SceneCameraLimits` 가 그대로 걸린다. 마커 클릭 = 그 모델 포커스(포커스 중 재클릭 = 돌아가기, 드래그 시작 안 함, 커서 pointer). 패널은 상단 그립 바를 끌어 캔버스 영역 안 어디든 놓을 수 있고 복원 시 `clampPanelPosition` 으로 창 안에 넣는다.
- 독 토글 `scene-minimap-toggle.tsx`.

### 씬 독 (우측 레일, hover 펼침·고정)

- 껍데기 `scene-dock.tsx` 는 완전 제어형이다. 도킹 프레임은 `three-scene-viewer.tsx` 의 `toolbarPlacement="dock"`.
- 레일 순서(위에서부터): 카메라 묶음(원래위치·탑뷰·저장한 뷰 `toolbarTrailing`·확대·축소·전체화면) → 화면 표시 묶음(페이지가 준 `toolbarExtras` — 알람 토글·골리앗 가드·미니맵·현장 시각 `ui/scene-clock-menu.tsx`).
- `toolbarTrailing` 을 카메라 묶음 안에 끼우는 것은 dock 배치뿐이다. 가로 툴바는 앞에 붙는다.
- 상태·영속화는 `use-scene-dock.ts` + `dock-hover-state.ts`(순수 리듀서)·`dock-storage.ts`(pin 영속화), 테스트 대상.

### 워밍업 표시

초기 로딩 오버레이(`ui/scene-loading-overlay.tsx`)가 걷힌 뒤 이어지는 비차단 표시다(스피너 + 문구 한 줄, `common:viewer3d.warmup.*`).

- 단계 선택 `selectSceneWarmupStep`(`scene-warmup-step.ts`): bvh 잔여 → outline 잔여 → 충돌 런타임 baseline(스토어 `baselinePending`) → drei `useProgress` 활성. 타이머 추측은 없다. 큐 자체·셰이더 프리워밍은 `docs/agents/rendering-perf.md`, baseline 은 `docs/agents/3d-collision.md`.
- 배치: 모니터링·리플레이는 overlay 슬롯의 좌측 상단 열(포커스 복귀 버튼과 세로 스택), 편집은 캔버스 컨테이너 좌측 상단.

## 불변식

- `SceneCameraLimits` 는 `SceneSurfaceCamera` **바로 다음 형제**로 마운트한다.
- 카메라 제한 뒤 `controls.update()` 금지 — damping 이 이중 적용된다. `change` 이벤트만 발행한다.
- 카메라 범위·탑뷰·미니맵 캡처의 기준 지도는 `resolveCameraBoundsMaps` 하나다. 바닥 raycast 기준(`resolveGroundMaps`)과 섞지 않는다.
- 카메라 최대 거리를 읽는 곳(휠 dolly·표면 피벗 cap·탑뷰 상한)은 `SceneCameraLimits` 가 정한 `controls.maxDistance` 를 읽는다. 따로 계산하지 않는다.
- 미니맵 캡처 렌더 타깃은 `FloatType`(EXT_color_buffer_float·EXT_float_blend 가 없으면 `UnsignedByteType` 폴백) + `stencilBuffer: true`(실루엣 마스크·헐). 캡처는 `applyCanonicalCaptureLighting` 으로 조명을 수동 모드 기준값으로 바꾸고(renderer `shadowMap.autoUpdate`/`needsUpdate` 도 캡처 동안 끔) `OceanWater` 는 `applyCanonicalWaterUniforms` 로 반사 0·기준 태양으로 둔 채 보이게, 반사 제외 객체만 숨긴 채 찍는다. clear color 는 바꾸지 않는다. 캡처에서 조명·그림자·노출을 씬의 시각 상태에 의존시키지 않고, 톤매핑은 three 의 ACESFilmic 과 같은 식(`acesFilmicToneMap`)만 쓴다.
- 미니맵 표시는 setState 없이 2D 캔버스에 직접 그린다. 팬은 컨트롤러 `moveTo` 로 보내 카메라 제한을 통과시킨다.
- 전체화면 주인이 언마운트되면 전체화면을 끝낸다. 한 시점에 주인은 하나다.
- `notifyAlert` 호출자가 제목·본문을 번역한다. 채널에 i18n 을 넣지 않는다.
- HUD·미니맵은 독 배치의 실시간 화면(`toolbarLayout='dock'` 이고 `mode !== 'play3d'`)에만 마운트한다.
- 독 레일 순서는 카메라 묶음 → 화면 표시 묶음. 감지 스위치·시뮬레이션 ▶ 는 독에 두지 않는다(감지 설정 페이지·3D 플레이 트랜스포트 바가 담당).

## 하지 않기로 한 것

- 요소 단위 전체화면 — top layer 밖 DOM 이 생겨 `PortalContainerProvider` 와 두 번째 Toaster 가 필요해진다.
- 탑뷰·카메라 범위에 여유·여백 비율 — 지도가 작업 구역보다 훨씬 넓은 조선소에선 바깥 여유가 무의미하고 안쪽 여백은 가장자리 모델을 잘라낸다.
- 타깃 기준 카메라 범위 제한 — 표면 피벗이 타깃을 지도 밖에 놓아 드래그마다 튄다.
- 경계 위반 시 되밀기 — 프레임 평행이동 취소 + 투영이 대안.
- 씬 감지 사건(충돌·침범)의 toast — 비네트·HUD·헤더 배지와 겹친다.
- 3D 플레이에 HUD·미니맵.
- 독의 하단 패널(크레인 실시간 상태 테이블)·감지 묶음.
- 미니맵 마커·카메라 그리기를 React state 로 — 매 틱 리렌더.
- 미니맵 시야 부채꼴을 카메라 fov·타깃 거리에 맞추기 — 탑뷰 근처에선 사라지고 멀리서 낮게 보면 지도를 덮어 방향을 읽기 어렵다. 리사이즈로 종횡비가 바뀔 때마다 각도 흔들린다.
