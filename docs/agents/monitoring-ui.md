# 모니터링 화면 UI — 전체화면·카메라 이동 범위 제한·관제 HUD·경보 알림·미니맵·방위 표시·씬 독·워밍업 표시·씬 뷰·분할 화면

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

조립은 `packages/features/src/3d/ui/monitoring-3d-view.tsx`(`Monitoring3dView`)다. `toolbarLayout='dock'` 이 실시간 관제 화면 배치이고, HUD·미니맵은 그 배치에서 `mode !== 'play3d'` 일 때만, 방위 표시는 독 배치 전부(3D 플레이 포함)와 에디터에 마운트된다. 좌측 상단 열은 첫 줄에 방위 표시와 그 오른쪽 워밍업 표시, 그 아래 시뮬레이션 배지(`ui/scene-simulation-badge.tsx`) → 포커스 복귀 버튼 순의 세로 스택이다(방위 표시가 없는 독 아닌 배치는 워밍업 표시가 열 맨 아래).

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
| 방위 표시 | 기하 `packages/features/src/3d/lib/compass.ts`(테스트 대상), 표시·드라이버 `ui/scene-compass.tsx`, 씬 진북 `packages/domain/src/3d/lib/true-north.ts`(`resolveTrueNorth`) |
| 씬 독 | 껍데기 `packages/ui/src/organisms/scene-dock.tsx` (`SceneDockRail`, `SceneDockRailSeparator`), 상태 `packages/features/src/3d/model/use-scene-dock.ts`, 리듀서·영속화 `lib/dock-hover-state.ts`, `lib/dock-storage.ts` |
| 워밍업 표시 | 단계 선택 `packages/features/src/3d/lib/scene-warmup-step.ts`, 훅 `model/use-scene-warmup-step.ts`, 표시 `ui/scene-warmup-indicator.tsx` |
| 씬 뷰(우상단 고정 줄) | `packages/features/src/3d/ui/scene-view-bar.tsx`. 데이터·저작은 `docs/agents/3d-editor.md` |
| 분할 화면 | 상태 `packages/features/src/3d/model/use-scene-split-store.ts`, 타일 DOM `ui/scene-split-overlay.tsx`, 렌더러 `ui/scene-split-renderer.tsx` + `lib/split-render.ts`, 타일 사각형 `lib/split-rects.ts`(테스트 대상), 배치 `packages/domain/src/3d/lib/view-split-layout.ts`. 렌더 쪽 규칙은 `docs/agents/rendering-perf.md` |

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
- 알람 장비 수 — 페이지가 넘긴 `alarmsByCraneId`, 최고 severity 색. 페이지가 넘기지 않으면 칸을 숨긴다.
- 영역 침범 수 — 씬에 영역이 있을 때만, 정지 중엔 "n · 정지"(`docs/agents/3d-zone.md`).
- 충돌 상태 — 활성일 때만(`docs/agents/3d-collision.md`).
- 연결 — `use-realtime-connection-state.ts`. 시뮬레이션은 재생/정지(라벨에 `×배속 mm:ss`, `lib/sim-clock.ts`), 실시간은 cranes-lite WebSocket `subscribeState` 상태에 화면 반영 보류를 덧입힘, 3D 플레이는 `play3dPlaying` / `play3dPaused`.

### 장면 안 알람 표시

`Monitoring3dView` 의 `alarmsByCraneId` 를 넘긴 화면만 라벨 배경·미니맵 마커·HUD 알람 칸에 알람을 그린다. 실외 실시간 화면(`apps/hanwha-ocean` outdoor-work)은 넘기지 않는다 — 라벨 색을 운전 상태에만 쓰고(`docs/agents/3d-play.md`), 알람은 독의 알람 목록·상단 배너·헤더 벨로 본다. 실내·골리앗·대시보드 미리보기는 넘긴다.

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

### 방위 표시 (좌상단)

- 모양은 ACMS 매뉴얼의 방위 표시(가는 흰 원 + N·E·S·W)에 바늘(북 적색·남 흰색)을 더한 것이다. 지면에 놓인 원을 카메라가 보는 모습이라 원과 바늘은 카메라 기울기만큼 눕고(세로 비율 = 내려다본 각의 사인, 탑뷰 1), 글자는 타원 위 자리에서 바깥으로 `COMPASS_LABEL_OFFSET_PX` 띄워 서 있다. 글자는 기호라 번역하지 않는다.
- 북쪽은 씬 진북(`SavedSceneInfo.trueNorth`, 에디터 맵 탭 — `docs/agents/3d-editor.md`)이다. solar 모드의 태양·달과 같은 값을 본다(`docs/agents/rendering-perf.md`).
- 화면 위쪽이 가리키는 지면 방향은 카메라 전방·위 벡터 XZ 성분의 합이다(`resolveCompassView`) — roll 이 없어 둘이 같은 쪽을 향하고, 정수직 탑뷰에서도 위 벡터로 방향이 남는다.
- 갱신: Canvas 안 `SceneCompassDriver` 가 useFrame 에서 자세가 바뀐 프레임에만 `SceneCompass` 핸들의 `update` 로 SVG 속성을 직접 쓴다. setState 없음, frameloop demand 라 카메라가 멈추면 비용 0. 카메라가 확정된 뒤 읽도록 `SceneTerrainLod` 다음에 마운트한다. 첫 `update` 전에는 숨긴다.
- 배치: 모니터링·3D 플레이는 overlay 슬롯 좌측 상단 열의 첫 줄, 에디터는 캔버스 컨테이너 좌측 상단이다. 두 화면 모두 워밍업 표시가 바로 오른쪽에 붙는다(에디터는 `scene-objects-edit-page.tsx` 가 DOM 을 두고 `SceneObjectsEditCanvas` 의 `compassRef` 로 드라이버를 붙인다). 에디터는 편집 중인 씬의 진북을 읽어 맵 탭 입력을 바꾸면 바로 돈다.
- 조작은 없다(pointer-events-none).

### 씬 독 (우측 레일, hover 펼침·고정)

- 껍데기 `scene-dock.tsx` 는 완전 제어형이다. 도킹 프레임은 `three-scene-viewer.tsx` 의 `toolbarPlacement="dock"`.
- 레일 순서(위에서부터): 카메라 묶음(메인 뷰·탑뷰·확대·축소·전체화면) → 화면 표시 묶음(페이지가 준 `toolbarExtras` — 알람 토글·골리앗 가드·미니맵·현장 시각 `ui/scene-clock-menu.tsx`). 독 배치는 `toolbarTrailing` 을 비운다 — 뷰·분할은 우상단 고정 줄이 전부다.
- `toolbarTrailing` 은 독이 아닌 가로 툴바에서만 쓰고(고정한 뷰 칩) 카메라 버튼 앞에 붙는다.
- "메인 뷰" 버튼(구 원래 위치)과 초기 시점은 홈 카메라(`resolveSceneHomeCamera` — 에디터에서 지정한 메인 뷰, 없으면 저장 시점 카메라)다. `ThreeSceneViewer` 의 `cameraPreset.defaultPosition/defaultTarget` 이 그 값이라 둘이 같다(`docs/agents/3d-editor.md`).
- 분할 화면 중에는 전체화면·알람 표시·현장 시각만 동작하고 나머지(메인 뷰·탑뷰·확대·축소·미니맵·페이지 버튼)는 비활성이다 — `ThreeSceneViewer` 의 `cameraControlsDisabledLabel`, `SceneMinimapToggle` 의 `disabledLabel`, 페이지 버튼은 `useSceneSplitStore` 를 읽어 스스로. 비활성은 `disabled` 속성이 아니라 `aria-disabled` + `SCENE_TOOLBAR_DISABLED_CLASS` 다(툴팁으로 사유를 보여야 해서).
- 상태·영속화는 `use-scene-dock.ts` + `dock-hover-state.ts`(순수 리듀서)·`dock-storage.ts`(pin 영속화), 테스트 대상.

### 씬 뷰와 우상단 고정 줄

뷰는 에디터가 저작해 씬 파일에 저장한 이름 붙은 카메라 구도(`SavedSceneInfo.views`, `docs/agents/3d-editor.md`)다. 브라우저별 북마크는 없다 — 모든 관제 PC 가 같은 뷰를 본다.

- 모니터링이 보이는 뷰는 **에디터에서 고정한 뷰(`pinned`)뿐**이다 — 캔버스 우상단 고정 줄(`scene-view-bar.tsx`)에 목록 순서대로 상시 버튼으로 온다. 고정하지 않은 뷰는 모니터링 어디에도 없다(뷰 목록 팝오버 없음). 고정한 분할도 같은 줄의 버튼이다. 독 배치는 `fullscreenTopRightOverlay` 슬롯에 고정 줄 → 알람 패널 순으로 세로로 쌓고, 독이 아닌 툴바 배치는 `toolbarTrailing` 자리에 고정한 뷰 칩만 둔다. 에디터도 같은 컴포넌트를 캔버스 우상단에 쓴다.
- 뷰 버튼은 누르면 그 구도로 옮길 뿐 선택 상태를 두지 않는다. 분할 중이면 분할에서 나간 뒤 옮긴다.

### 분할 화면

씬의 분할 지정(`SavedSceneInfo.viewSplit`, 뷰를 2×2 칸에 배정)이 2칸 이상이고 **에디터에서 분할을 고정했을 때** 실시간 독 배치(`mode='realtime'`·`toolbarLayout='dock'`)에서 분할을 켤 수 있다. 고정하지 않은 분할은 모니터링에 나타나지 않는다. 3D 플레이·대시보드 미리보기는 뷰 버튼만 있고 분할이 없다. 켜짐 여부는 세션 스토어(`use-scene-split-store.ts`, 키 = regionId)이고 저장하지 않는다 — 접속하면 기본 카메라 단일 화면으로 시작한다.

- 진입: 우상단 고정 줄의 분할 버튼 하나다(독 레일에는 없다). 들어갈 때 모델 포커스를 푼다.
- 배치: 빈 행·열을 접는다(`resolveSplitLayout`) — 좌상·우상만 채우면 좌우 2분할, 좌상·좌하만 채우면 상하 2분할, 그 밖은 2×2 이고 빈 칸은 캔버스 clear 색이다. 타일 사각형은 오버레이가 잰 캔버스 크기로 `computeSplitRects` 가 정하고 렌더러의 viewport·scissor 도 같은 값을 쓴다.
- 타일(`scene-split-overlay.tsx`): 전체가 클릭 영역이라 캔버스는 포인터를 받지 않는다(회전·줌·크레인 클릭·hover 없음). 단일 클릭이면 그 뷰의 단일 화면으로 나간다. 타일마다 상단 중앙에 뷰 이름(상자 없는 흰 글자 + 진한 글자 그림자 `SPLIT_TITLE_TEXT_SHADOW`), 좌상단에 카메라가 고정이라 한 번만 쓰는 방위 표시(`resolveCompassViewForPose`), 안쪽 `overflow-hidden` 컨테이너에 그 타일의 라벨·표지 DOM 이 붙는다.
- 분할 중 숨김: 관제 HUD, 미니맵, 전역 방위 표시(타일마다 있으므로). 경보 비네트·알람 패널·배너·우상단 고정 줄은 그대로다.
- 나가는 경로: 타일 클릭, 고정 줄의 뷰 버튼, 분할 버튼(들어오기 전 구도로 복귀 — 기본 카메라는 분할 중 움직이지 않는다), 알람 목록의 "영역 보기"(분할에서 나가 그 영역으로 이동).
- 그리는 방식(타일마다 카메라·LOD·라벨 포털·그림자 초점)은 `docs/agents/rendering-perf.md` 의 "분할 화면 렌더".

### 워밍업 표시

초기 로딩 오버레이(`ui/scene-loading-overlay.tsx`)가 걷힌 뒤 이어지는 비차단 표시다(스피너 + 문구 한 줄, `common:viewer3d.warmup.*`).

- 단계 선택 `selectSceneWarmupStep`(`scene-warmup-step.ts`): bvh 잔여 → outline 잔여 → 충돌 런타임 baseline(스토어 `baselinePending`) → drei `useProgress` 활성. 타이머 추측은 없다. 큐 자체·셰이더 프리워밍은 `docs/agents/rendering-perf.md`, baseline 은 `docs/agents/3d-collision.md`.
- 배치: 방위 표시 바로 오른쪽이다 — 모니터링·리플레이는 overlay 슬롯 좌측 상단 열의 첫 줄, 편집은 캔버스 컨테이너 좌측 상단. 방위 표시가 없는 독 아닌 배치는 좌측 상단 열 맨 아래.

## 불변식

- `SceneCameraLimits` 는 `SceneSurfaceCamera` **바로 다음 형제**로 마운트한다.
- 카메라 제한 뒤 `controls.update()` 금지 — damping 이 이중 적용된다. `change` 이벤트만 발행한다.
- 카메라 범위·탑뷰·미니맵 캡처의 기준 지도는 `resolveCameraBoundsMaps` 하나다. 바닥 raycast 기준(`resolveGroundMaps`)과 섞지 않는다.
- 카메라 최대 거리를 읽는 곳(휠 dolly·표면 피벗 cap·탑뷰 상한)은 `SceneCameraLimits` 가 정한 `controls.maxDistance` 를 읽는다. 따로 계산하지 않는다.
- 미니맵 캡처 렌더 타깃은 `FloatType`(EXT_color_buffer_float·EXT_float_blend 가 없으면 `UnsignedByteType` 폴백) + `stencilBuffer: true`(실루엣 마스크·헐). 캡처는 `applyCanonicalCaptureLighting` 으로 조명을 수동 모드 기준값으로 바꾸고(renderer `shadowMap.autoUpdate`/`needsUpdate` 도 캡처 동안 끔) `OceanWater` 는 `applyCanonicalWaterUniforms` 로 반사 0·기준 태양으로 둔 채 보이게, 반사 제외 객체만 숨긴 채 찍는다. clear color 는 바꾸지 않는다. 캡처에서 조명·그림자·노출을 씬의 시각 상태에 의존시키지 않고, 톤매핑은 three 의 ACESFilmic 과 같은 식(`acesFilmicToneMap`)만 쓴다.
- 미니맵 표시는 setState 없이 2D 캔버스에 직접 그린다. 팬은 컨트롤러 `moveTo` 로 보내 카메라 제한을 통과시킨다.
- 전체화면 주인이 언마운트되면 전체화면을 끝낸다. 한 시점에 주인은 하나다.
- `notifyAlert` 호출자가 제목·본문을 번역한다. 채널에 i18n 을 넣지 않는다.
- HUD·미니맵은 독 배치의 실시간 화면(`toolbarLayout='dock'` 이고 `mode !== 'play3d'`)에만 마운트한다. 방위 표시는 독 배치 전부(실시간·3D 플레이)와 에디터다.
- 방위 표시의 자세는 React 상태로 두지 않는다. 드라이버가 SVG 에 직접 쓰고, `SceneCompass` 의 JSX 에는 자세와 무관한 속성만 둔다 — 리렌더가 직접 쓴 값을 덮지 않게.
- HUD 알람 칸을 0 으로 그리지 않는다. 알람을 받지 않는 화면은 칸을 숨긴다 — 0 은 "알람 없음"으로 읽힌다.
- 독 레일 순서는 카메라 묶음 → 화면 표시 묶음. 감지 스위치·시뮬레이션 ▶ 는 독에 두지 않는다(감지 설정 페이지·3D 플레이 트랜스포트 바가 담당).
- 뷰는 씬 파일에서만 온다. 모니터링 화면에 뷰를 만들거나 지우는 UI·브라우저 저장을 두지 않는다.
- 분할 중 카메라를 옮기는 명령(뷰 선택·영역 보기)은 먼저 `useSceneSplitStore.exit()` 를 부른다. 분할 중 독 레일에서 동작하는 것은 전체화면·알람 표시·현장 시각뿐이고 나머지는 비활성 + 툴팁이다.
- 모니터링의 뷰·분할 UI 는 우상단 고정 줄 하나다. 독 레일에 뷰 목록·분할 버튼을 두지 않는다 — 에디터가 고정한 것만 보인다.
- 분할 타일은 단일 클릭이다. 더블클릭·hover 조작을 두지 않는다.

## 하지 않기로 한 것

- 요소 단위 전체화면 — top layer 밖 DOM 이 생겨 `PortalContainerProvider` 와 두 번째 Toaster 가 필요해진다.
- 브라우저별 뷰 북마크(localStorage) — 관제 PC 마다 뷰가 달라진다. 에디터가 저작해 씬 파일에 넣은 뷰로 대체했다.
- 분할 중 카메라 버튼을 "분할에서 나간 뒤 수행" — 눌렀을 때 화면이 통째로 바뀌어 당황스럽다. 비활성 + 사유 툴팁으로 둔다.
- 분할로 시작하기(ACMS 안벽 방식) — 접속하면 항상 기본 카메라 단일 화면이다.
- 탑뷰·카메라 범위에 여유·여백 비율 — 지도가 작업 구역보다 훨씬 넓은 조선소에선 바깥 여유가 무의미하고 안쪽 여백은 가장자리 모델을 잘라낸다.
- 타깃 기준 카메라 범위 제한 — 표면 피벗이 타깃을 지도 밖에 놓아 드래그마다 튄다.
- 경계 위반 시 되밀기 — 프레임 평행이동 취소 + 투영이 대안.
- 씬 감지 사건(충돌·침범)의 toast — 비네트·HUD·헤더 배지와 겹친다.
- 3D 플레이에 HUD·미니맵.
- 독의 하단 패널(크레인 실시간 상태 테이블)·감지 묶음.
- 미니맵 마커·카메라 그리기를 React state 로 — 매 틱 리렌더.
- 미니맵 시야 부채꼴을 카메라 fov·타깃 거리에 맞추기 — 탑뷰 근처에선 사라지고 멀리서 낮게 보면 지도를 덮어 방향을 읽기 어렵다. 리사이즈로 종횡비가 바뀔 때마다 각도 흔들린다.
