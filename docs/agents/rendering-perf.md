# 3D 렌더링·성능 — demand 프레임루프, 그림자, 바다 미러 반사·스텐실, 낮/밤 조명, 워밍업 큐, 분할 화면 렌더

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

세 캔버스(모니터링·3D 플레이·에디터)가 공유하는 프레임 생산·조명·후처리 규칙이다. 이 문서의 대상은 "화면을 언제, 얼마나 밝게, 무엇을 먼저 그리는가" 이고, 씬 객체의 움직임(태그·리그)은 `docs/agents/tag-mapping-rig.md`, 자산 자체의 최적화(LOD 생성·압축)는 `docs/agents/assets-glb.md` 에 있다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 프레임 거버너(demand 루프의 틱 생산) | `packages/features/src/3d/ui/scene-frame-governor.tsx`(`SceneFrameGovernor`), 판정 `packages/features/src/3d/lib/frame-governor.ts`(테스트 대상) |
| React 밖 프레임 요청 깔때기 | `packages/features/src/3d/model/scene-frame-request.ts`(`requestSceneFrame`, `isSceneFrameTickerActive`) |
| 렌더 프리셋·GL 옵션·DPR·조명 적용 | `packages/features/src/3d/ui/scene-render-preset.tsx`(`SCENE_GL_OPTIONS`, `SCENE_DEFAULT_DPR`, `SceneLighting`) |
| 낮 기준 조명값·밤 작업등·하늘 곡선 | `packages/features/src/3d/lib/sky-lighting.ts`(`SCENE_LIGHTING_BASE`, `SCENE_ENVIRONMENT_INTENSITY`, `YARD_LIGHT_*`, `FILL_LIGHT_*`, `NIGHT_*`) |
| 시각+위치 → 조명 스냅샷 합성 | `packages/features/src/3d/lib/solar-lighting.ts`(`KEY_LIGHT_ELEVATION_MIN`, `CELESTIAL_ANGLE_STEP`) |
| 천문 계산 / 시간대 변환 / 씬 지역 → 현장 위경도·시간대 | `packages/domain/src/3d/lib/solar-position.ts`, `packages/core/src/lib/time-zone.ts`, `packages/domain/src/3d/model/scene-site-geo.ts`(`resolveSceneSiteGeo`) |
| 씬 시계·태양 UI 상태 | `packages/features/src/3d/model/use-scene-clock-store.ts`, `model/use-scene-sun-state.ts`, `model/scene-time-source.ts` |
| 씬 시계 UI | `packages/features/src/3d/ui/scene-clock-panel.tsx`, `lib/scene-clock-presets.ts`, `ui/scene-clock-menu.tsx`(모니터링 독), `packages/widgets/src/3d/ui/palette-environment-section.tsx`(에디터 배경 탭) |
| shadow map 온디맨드 무효화 | `packages/domain/src/3d/lib/shadow-invalidation.ts`(`invalidateShadows`) |
| 바다(미러 반사)·배경 환경 | 포크 `packages/features/src/3d/lib/ocean-water.ts`(`OceanWater` — three r183 `examples/jsm/objects/Water.js` 포크, MIT 헤더), 컴포넌트 `ui/scene-water.tsx`(`SceneWater`), 배경 `ui/scene-environment.tsx`(`SceneEnvironment`), 태양 유니폼 `lib/water-sun-uniforms.ts`(`resolveWaterSunUniforms`), 반사 제외 `lib/water-reflection.ts`·`model/scene-reflection-exclusions.ts`(`excludeFromReflection`), 표시 판정 `packages/domain/src/3d/lib/scene-sea.ts`(`resolveSeaVisible`). 노멀맵 `apps/shell/public/textures/waternormals.jpg` 는 three.js r183 examples 의 파일이다(MIT) |
| 불투명 씬 스텐실 표식 | `packages/domain/src/3d/lib/scene-stencil.ts`(`markSceneOpaqueStencil`), 켜는 곳 `packages/domain/src/3d/ui/model-mesh.tsx`(`useClonedModel`) |
| 수면 아래 잠김(깊이 안개) | 셰이더 패치 `packages/domain/src/3d/lib/sea-submersion.ts`, 머티리얼 전이·공유 `lib/mesh-material-binding.ts`·`lib/sea-material-cache.ts`, 켜는 곳 `GltfModel` 의 `seaSubmersion` |
| 바다 도달 마스크(안개가 끼는 위치) | 격자·물 퍼뜨리기 `packages/domain/src/3d/lib/sea-reach-grid.ts`, 지도 메시 → 마스크 `lib/sea-reach-mask.ts`(`buildSeaReachMask`), 전역 유니폼 `lib/sea-reach-uniforms.ts`, 수명 `packages/features/src/3d/model/sea-reach-controller.ts`, 나눠 돌리기 `lib/sliced-task.ts`, 캔버스 `ui/scene-sea-reach.tsx`(`SceneSeaReach`) — 전부 테스트 대상 |
| 컨텍스트 지형 Lambert 변환 | `packages/domain/src/3d/lib/lambert-material.ts`, `GltfModel shading='lambert'` |
| 지형·모델 LOD 런타임 전환 | 배선 `packages/features/src/3d/ui/scene-terrain-lod.tsx`(`SceneTerrainLod`), 상태·카메라별 적용 `model/terrain-lod-controller.ts`(`TerrainLodController`, 테스트 대상), 수식 `lib/terrain-lod.ts`(`TERRAIN_LOD_THRESHOLD_PX`) |
| 분할 화면 렌더(타일마다 카메라) | `packages/features/src/3d/ui/scene-split-renderer.tsx`, 프레임 `lib/split-render.ts`, 뷰포트별 DOM 포털 `packages/domain/src/3d/ui/scene-viewports.tsx`(`PerViewport`, `ViewportAnchor`) + `model/scene-viewports-context.ts`, 그림자 초점 합집합 `lib/scene-shadow.ts`(`unionShadowFocus`) — 화면 쪽은 `docs/agents/monitoring-ui.md` |
| 워밍업 큐(BVH·아웃라인 사본) | `packages/domain/src/3d/lib/bvh-build-queue.ts`(테스트 대상) |
| 실루엣 셰이더 프리워밍 | `packages/domain/src/3d/ui/silhouette-outline-warmup.tsx` |
| 워밍업 단계 선택·표시 | `packages/features/src/3d/lib/scene-warmup-step.ts`, 표시 UI 는 `docs/agents/monitoring-ui.md` |
| 성능 HUD(dev) | `packages/features/src/3d/ui/scene-perf-hud.tsx`, 키 `PERF_HUD_STORAGE_KEY`(`crane:perf-hud`) |

## 동작

### demand 프레임루프와 거버너

세 캔버스 모두 `frameloop='demand'` 다. 프레임은 `SceneFrameGovernor` 가 만든다.

- 애니메이션 소스가 하나라도 있으면 `ANIMATING_FPS` 로 틱을 돌린다. 소스: 가상 태그 재생, 실시간(최근 메시지 수신이 있는 경우만 — `useRealtimeStore.activity.lastMessageAt`), 리플레이 재생, 기즈모 드래그, 바다가 켜진 씬(`resolveSeaVisible`), 영역 침범 활성.
- 소스가 멈춘 뒤 `ANIMATION_GRACE_MS` 동안은 계속 틱을 돌려 스무딩이 정착하게 한다.
- solar 태양만 있으면 `SLOW_FPS` 로 드물게 그린다. 정지 씬은 틱이 없다.
- 조작(OrbitControls·표면 카메라)은 스스로 `invalidate` 해 주사율로 그려진다. drei `OrbitControls`·`TransformControls`·`Text` 와 R3F 리컨실러(prop 변경·마운트)도 스스로 invalidate 한다.

React 밖에서 씬을 바꾸는 코드는 Canvas 를 모르므로 `requestSceneFrame()` 을 부른다. 거버너가 자기 `invalidate` 를 여기에 등록한다. 이미 배선된 곳: `rigValueStore` 의 set/reset/restore, `SceneLighting` 의 조명 설정·씬 시계 구독, `SceneEnvironment` 의 배경 교체. 스무딩 잔여는 `useRigDriver` 가 `hasPendingSmoothing()` 으로 프레임마다 다음 프레임을 스스로 요청해 러너 없이 들어온 값도 끝까지 수렴한다 — 단 거버너가 주기 틱을 돌리는 동안(`isSceneFrameTickerActive()`)은 부르지 않는다. useFrame 안에서 부른 invalidate 는 R3F 가 `frames=2` 로 두어 rAF 루프가 주사율로 자체 지속되므로, 이 가드가 없으면 재생 중 fps 상한이 무력화된다.

성능 확인은 `localStorage crane:perf-hud='1'` 로 켜는 HUD(드로우콜·삼각형·프레임 ms·fps — demand 루프라 fps 는 실제로 그린 빈도). 드로우콜·삼각형은 shadow pass 뒤 메인 패스 + 바다 미러 패스의 합이다(shadow pass 는 three 가 그 뒤 `info.reset()` 을 불러 빠진다). 에디터 perf HUD 의 드로우콜·삼각형은 GizmoHelper 의 Hud 가 마지막으로 그린 기즈모 씬 값이라 참고하지 않고 fps·ms 만 본다.

### 절감은 핵심이 아니라 주변에서

야드 지도(kind `'ground'`)와 크레인은 그대로 두고 주변에서 줄인다.

- DPR 상한은 `SCENE_DEFAULT_DPR` 와 `three-scene-viewer.tsx` 기본값 두 곳이 같은 값(1.5)이어야 한다 — 함께 바꾼다.
- 컨텍스트 지형(씬 지도의 `role: 'context'` — `isContextMap`)은 `GltfModel shading='lambert'` 로 PBR 대신 Lambert 다(`lambert-material.ts`, 원본 머티리얼당 변환본 캐시). 조명·낮/밤엔 똑같이 반응하고 스펙큘러·radiance 샘플링만 없다. 모니터링·에디터 같은 규칙.
- 타일 LOD 임계는 `TERRAIN_LOD_THRESHOLD_PX`(device px). 컨텍스트 지형과 LOD 체인이 붙은 모델에만 LOD 가 있다(생성 절차는 `docs/agents/assets-glb.md`).
- 바다 미러 패스는 컨텍스트 지형 루트·밤하늘 틴트 돔·태양/달 스프라이트를 빼고 그린다(`OceanWater` 의 `excludedObjects` — `resolveReflectionExcludedMapIds` + `excludeFromReflection`). 지형 루트 하나를 숨기면 three 가 서브트리를 통째로 건너뛰어 LOD 타일 전부가 빠진다. 반사 RT 크기는 `scene-water.tsx` 의 `WATER_REFLECTION_SIZE`, 비친 하늘의 밝기는 `WATER_REFLECTION_INTENSITY`(포크 유니폼 `reflectionIntensity`, 예제엔 없다 — 예제는 렌더러 노출 0.1 로 HDR 하늘을 숨기지만 이 씬은 조명 전체가 노출 1 기준이라 물에서만 누그러뜨린다), 태양 확산 회색항의 배율은 `WATER_SUN_DIFFUSE_INTENSITY`(포크 유니폼 `sunDiffuseIntensity`, 예제 원값이면 낮에 산란색을 덮어 물이 회색이 된다) 하나씩.

### 바다는 미러 반사 + 불투명 패스 뒤 스텐실

바다는 `ui/scene-water.tsx` 의 `SceneWater` 가 만드는 `OceanWater`(`lib/ocean-water.ts`, three r183 `Water.js` 포크) 원판 하나다. 켜짐 여부는 `resolveSeaVisible(sceneInfo)`(`scene-sea.ts`) 한 곳이 정하고, 세 캔버스가 그 값을 `SceneEnvironment`·`SceneFrameGovernor`·`SceneSurfaceCamera`·모델과 지도의 `seaSubmersion` 에 넘긴다. `SceneEnvironment` 는 EXR 배경(`EnvironmentBackground`)과 `SceneWater` 를 한 `Suspense` 경계 안에 두어 둘이 같이 나타나고 배경 교체에 물이 리마운트되지 않는다. 씬별 켜고 끄기는 `docs/agents/3d-editor.md`.

- **미러 패스** — `OceanWater.onBeforeRender` 가 메인 카메라를 수면에 반사한 미러 카메라로 씬을 스텐실 딸린 8bit RT 에 한 번 더 그린다(중첩 render — HalfFloat 이 아닌 이유: EXR 하늘의 수평선 띠는 백색의 몇 배라 그대로 비추면 얕은 각도의 바다가 흰색이 된다. 8bit 가 1.0 에서 잘라 EXR 이 달라도 반사 상한이 같다). 그동안 물 자신과 제외 객체(`excludedObjects` 게터 — `excludeFromReflection` 으로 등록된 틴트 돔·태양/달 스프라이트, `resolveReflectionExcludedMapIds` 가 고른 컨텍스트 지형 id 를 `modelObjectRegistry` 에서 매 패스 조회)는 `visible=false` 로 빠지고, shadow map 은 다시 그리지 않는다(`shadowMap.autoUpdate` 저장/복원). 직교 카메라면 미러 패스만 건너뛰고 `eye` 를 시선 반대쪽 먼 점(`ORTHO_EYE_DISTANCE`)으로 둔다 — 미니맵 캡처는 물을 `reflectionIntensity` 0 으로 보이는 채 그린다(`docs/agents/monitoring-ui.md`). 숨김·플래그·렌더 타깃 복원은 try/finally. RT 에도 스텐실이 있어 실루엣 마스크·헐이 반사에서 뭉개지지 않는다. 미러 패스는 `renderer.info` 를 리셋하지 않아(`info.autoReset` 을 패스 동안 끔) HUD 값은 메인 + 미러 합이다.
- **메인 패스** — 물은 `SEA_RENDER_ORDER` 로 불투명 패스 뒤에 그려진다. 모든 GLTF 인스턴스 메시 머티리얼이 `markSceneOpaqueStencil`(`useClonedModel` 이 원본에 켬, clone 이 물려받음)로 "불투명 씬이 그려졌다" 비트를 ZPass 에 찍고, 물 머티리얼은 depthTest/depthWrite 없이 그 비트(`SCENE_OPAQUE_STENCIL_BIT`)가 없는 픽셀에서만 그려진다(Equal 스텐실, writeMask 0). 지도·드라이독·잠긴 선체가 깊이 순서와 무관하게 바다 위에 남으면서, 가려진 픽셀은 early stencil 로 셰이더 앞에서 탈락한다. 실루엣 마스크·헐은 자기 비트만 writeMask/funcMask 로 본다(비트 값은 `scene-stencil.ts`).
- **수면 아래 잠김** — 물은 불투명 메시가 그려진 픽셀을 덮지 않으므로, 수면 아래에 있다는 표현은 메시 자신의 셰이더가 낸다. `seaSubmersion` 이 켜진 모델·지도(ground·context 모두)의 머티리얼에 깊이 안개(`sea-submersion.ts`)가 주입된다. 안개가 끼는 조건은 둘이다: 수면보다 낮고, 그 위치에 바다가 닿는다(아래 마스크). 모델과 지도가 같은 조건을 쓴다. 잠김만 필요한 인스턴스는 원본당 하나의 패치 클론을 공유한다(`sea-material-cache.ts`).
- **바다 도달 마스크** — 수면보다 낮아도 벽과 땅에 막혀 물이 닿지 않는 곳(드라이독·육지 안 저지대)을 가린다. `SceneSeaReach`(`SceneEnvironment` 가 바다가 켜진 씬에서 마운트)가 씬의 지도 메시에서 만든다.
  - 지도의 삼각형을 위에서 본 덮개 격자(칸 `SEA_REACH_CELL_SIZE`, 월드 축 정렬)에 찍는다. 위에서 보이는 면은 면적을, 벽은 가장자리를 찍고, 위에서 컬링되는 아래 향한 단면은 건너뛴다. 칸은 지면 없음·수면 아래·수면 이상(막음) 셋 중 하나다.
  - 지면 없는 칸 전부와 격자 테두리의 수면 아래 칸에서 물을 4방향으로 퍼뜨린다. 닿지 않은 수면 아래 칸이 마른 분지다. 막는 칸은 이웃으로 정한다 — 마른 분지에 붙었으면 마른 곳, 물에만 붙었으면 잠긴 곳, 육지 안쪽은 마른 곳.
  - 격자 범위는 바닥 지도(`resolveGroundMaps`)의 정점 범위에 `SEA_REACH_MARGIN` 을 더한 것이고, 격자 밖은 바다로 본다. 주변 지형은 격자에 걸친 부분만 찍힌다.
  - 결과는 1채널 텍스처로 전역 유니폼(`sea-reach-uniforms.ts`)에 올라가고, 패치된 머티리얼 전부가 같은 유니폼 객체를 참조한다. 준비 전에는 안개가 전혀 끼지 않는다.
  - 다시 만드는 때는 씬 데이터의 지도 구성(경로·배치)이 바뀔 때다. 선언된 지도가 전부 로드된 뒤에 시작하고, 계산은 프레임 사이 슬라이스로 돈다. 같은 구성의 씬에 다시 들어오면 올라가 있는 마스크를 그대로 쓴다.
- **태양 유니폼** — `SceneWater` 의 useFrame 이 `sceneLightingInfo.sunDirection/sunColor/sunIntensity` 의 튜플 참조가 바뀐 프레임에만 `resolveWaterSunUniforms`(방향 정규화, `SCENE_LIGHTING_BASE.sunIntensity` 기준 배율 상한 1, 수평선 페이드 `WATER_SUN_HORIZON_FADE_Y`, 비유한 값은 낮 폴백)를 거쳐 `sunDirection`·`sunColor` 유니폼에 쓴다. 키 라이트(밤엔 작업등 혼합)가 아니라 실제 태양이라 밤 바다는 어두운 하늘 반사 + `waterColor` 산란으로 어둡다.
- 포크가 원본과 다른 점: logdepthbuf 청크 없음·depthTest/depthWrite 없음·스텐실 Equal, RT 에 stencil, RT 8bit + `reflectionIntensity` 유니폼, `excludedObjects`, 직교 스킵, `dispose()`(RT·머티리얼), `info.autoReset` 보존, try/finally, `lights`·shadowmap 청크·`getShadowMask()` 제거(receiveShadow false 라 결과가 같다). 파도 시간은 useFrame 의 delta 에 `WATER_TIME_SCALE`(`scene-water.tsx`) 을 곱해 누적하고(물결 흐름 속도는 이 상수 하나로 조절), 노멀맵은 `ensureRepeatWrapping`(`lib/water-normals.ts`) 으로 useLoader 캐시 텍스처를 멱등 설정. `raycast` 는 no-op 이라 에디터 marquee·드롭에 잡히지 않는다. 폐기는 `SceneWater` cleanup 이 geometry·물을 dispose 하고 `invalidate` 한다(R3F 가 removeChild 에서 invalidate 하지 않는다).

`useClonedModel` 을 거치지 않는 GLTF 로드 경로(collision-guard 감지 객체 등)는 transparent 머티리얼이라 바다 뒤에 블렌딩돼 무관하다.

### shadow map 은 온디맨드로만

`SceneLighting` 이 `gl.shadowMap.autoUpdate=false` 로 끄고, 캐스터를 움직이는 코드가 `invalidateShadows()` 를 불러야 그 프레임의 shadow pass 가 돈다. 배선된 경로: `rigValueStore`(set/reset/step 누적 드리프트 판정 — 임계 `SHADOW_STEP_EPS` 를 넘긴 프레임마다), `useActiveTransformStore`(기즈모), `ModelMesh`(배치 props·meshOverrides·마운트), 리그 드라이버 인스턴스 해체/재생성(관절·맵핑 정의 편집 시 rest 점프), `SceneLighting` 자신(frustum·태양각) + 4초 주기 안전망. shadow pass 상한은 거버너 fps 가 정한다. 컨텍스트 지형은 cast/receiveShadow 모두 꺼져 있다(모니터링·에디터 동일).

### 낮/밤·태양 위치(solar 모드)

씬 설정 `lighting.sunMode: 'solar'`(`SceneSunMode`, 기본 `manual` = 수동 방위·고도 패드, 필드 생략). `'solar'` 만 저장하고 수동 각도는 보존돼 되돌리면 복원된다 — sanitize·에디터 dirty·`setLighting` 모두 같은 규칙.

- 현장 위치·시간대는 씬 지역(`SavedSceneInfo.siteLocation` — 에디터 배경 탭 시각 패널의 드롭다운, 미지정이면 region 기본 지역)으로 `scene-site-geo.ts` 의 `resolveSceneSiteGeo` 하나가 정한다. 지역 하나가 IANA 시간대와 그 시간대에 있는 조선소의 대표 좌표를 함께 갖는다(시간대만 바꾸면 벽시계와 하늘이 어긋난다). 표시 이름은 언어와 무관하게 시간대 이름이다(`formatSceneSiteLocation`). 씬 파일이 등록된 region 은 전부 기본 지역이 있어야 한다 — 테스트가 강제. 지역이 정해지지 않은 씬은 solar 설정이어도 manual 로 폴백하고 에디터 토글이 비활성. HUD 현장 시각·풍속도 같은 지역을 따른다.
- 천문은 `solar-position.ts`(태양·달 방위/고도·달 위상·일출/일몰, Meeus 축약식, 의존성 0). 시간대 변환은 `time-zone.ts`(Intl 기반, 라이브러리 없음 — 폐쇄망).
- 조명 곡선은 `sky-lighting.ts`: 고도 → 방향광 세기·색, 환경광, 하늘 배율. 낮 기준값 `SCENE_LIGHTING_BASE` 가 `SCENE_LIGHTING` 의 단일 소스, 환경맵 세기는 `SCENE_ENVIRONMENT_INTENSITY` 하나.
- **밤은 야간 작업등이 밝힌다.** 해가 지면(`YARD_LIGHT_FADE`) 따뜻한 백색 투광등이 고정 마스트 방향(`YARD_LIGHT_AZIMUTH`/`YARD_LIGHT_ELEVATION`)에서 `YARD_LIGHT_INTENSITY_RATIO` 세기로 켜지고 환경광도 난색으로 오른다(`NIGHT_AMBIENT_INTENSITY_LIT`). 반대편(`FILL_LIGHT_*`)에 그림자 없는 보조 투광등과 위 남색·아래 난색의 반구광(`NIGHT_HEMISPHERE_INTENSITY_LIT`)이 더해져 그림자 면이 새까맣지 않다. 하늘(EXR)은 `NIGHT_SKY_INTENSITY` 로 어두워지고 그 위에 남색 틴트 돔(`NIGHT_SKY_TINT_*`, 카메라 추종 BackSide 구, EXR 있을 때만)이 덮인다. 밤 전용 요소는 낮에 전부 0 이라 한낮 화면은 수동 모드와 같다.
- 방향광은 하나뿐이라 박명엔 태양·작업등 세기의 합을 세기로, 비율(`keyYardBlend`)로 방향·색을 섞어 그림자가 마스트 방향으로 돈다.
- 작업등은 항상 켜진다(끄는 옵션이 없다). `NIGHT_*_DARK` 는 점등 전 박명의 바닥값이다. 달은 하늘 표식·위상 아이콘용이고 시계 패널에는 나오지 않는다.
- **천체 방위는 지리 방위다.** 월드 방향으로 바꿀 때 씬 진북(`SavedSceneInfo.trueNorth`, `resolveTrueNorth`)만큼 돌린다 — `bearingToWorldAzimuth`(`packages/domain/src/3d/lib/true-north.ts`). 방향광의 태양 성분(`resolveSolarLighting` 의 `trueNorth` 옵션)과 하늘의 태양·달 표식·바다 태양, 수동 태양(`lighting.sunAzimuth` 도 지리 방위 — 패드의 북 = 진북, `SceneLighting`·미니맵 캡처가 돌린다)이 돌고, 작업등·보조 투광등 방향은 월드 기준 연출값이라 돌리지 않는다. 스냅샷의 `sun`·`moon` 방위는 지리 방위 그대로(시계 패널 표시), `keyAzimuth` 는 월드 방위다. 나침반(`docs/agents/monitoring-ui.md`)과 같은 북쪽이다.
- 합성은 `solar-lighting.ts`: 시각+위치(+옵션) → 스냅샷. 방향광 고도 하한 `KEY_LIGHT_ELEVATION_MIN`, 방향은 `CELESTIAL_ANGLE_STEP` 격자로 양자화 — 정지 화면에서 shadow map 이 매 프레임 다시 그려지지 않는 근거.
- 적용은 `scene-render-preset.tsx` 의 `SceneLighting`(`regionId`·`timeSource` prop — 세 캔버스가 넘긴다). useFrame 에서 초 단위로 재계산해 방향광·환경광·`scene.backgroundIntensity`·`environmentIntensity` 를 직접 쓴다. 바다는 미러 패스가 `backgroundIntensity` 가 적용된 EXR 을 그대로 반사해 배경과 같은 배율로 어두워지고, 태양 하이라이트는 `sceneLightingInfo.sunDirection/sunColor/sunIntensity` 를 따른다 — `SceneLighting` 이 manual·solar 두 모드 모두 `publishSunLight` 로 쓴다(solar 는 고도 클램프 없는 진짜 태양 방향·`sky.sunColor`·`sky.sunIntensity`, manual 은 수동 태양·백색·기준 세기). 하늘의 태양 글로우·달 표식은 카메라 추종 스프라이트로 EXR 배경이 있을 때만이며, 틴트 돔과 함께 `excludeFromReflection` 으로 바다 반사에서 뺀다. 모드를 떠나면 `resetToManualLook`. 태양 방향·색·세기(두 모드)는 `model/scene-lighting-info.ts` 의 mutable `sceneLightingInfo` 로 내보낸다(바다가 읽는다). 미니맵 캡처는 조명 상태를 읽지 않고 캡처 순간만 수동 모드 기준 조명(`applyCanonicalCaptureLighting`, 키 라이트는 `SCENE_KEY_LIGHT_NAME` 으로 찾는다)으로 바꾼다(`docs/agents/monitoring-ui.md`).
- 시각 출처: 씬 시계 `use-scene-clock-store.ts`(세션 전역 live/manual — 에디터·모니터링 공유, 저장 안 됨) 또는 리플레이 프레임 타임스탬프(`scene-time-source.ts` + `@crane/domain/monitoring` 의 `parseReplayTimestamp` — `Z` 없는 값은 현장 벽시계로 해석).
- UI 는 `scene-clock-panel.tsx`(위상·현장 시각·날짜·지역 이름, 시각 출처 점 — 현재 시각 초록·지정 시각 주황 + 지정 중 "현재 시각으로" 버튼, 태양 방위·고도, 날짜·00~24시 눈금 시각 슬라이더·일출/정오/일몰/자정 아이콘 토글 — 시각은 툴팁, 선택 판정은 같은 분 기준 `lib/scene-clock-presets.ts`) 하나를 모니터링 독 팝업 `scene-clock-menu.tsx`(아이콘이 위상을 따라 해·일출·일몰·달, 시각 고정 중엔 하늘색)와 에디터 배경 탭(`palette-environment-section.tsx`, 태양 위치 토글 수동/현장 시각 연동)이 공유한다. 실시간/지정 전환 토글은 없다 — 날짜·슬라이더·프리셋을 건드리는 순간 지정 시각이 된다. 지역 드롭다운은 에디터가 `onSiteLocationChange` 를 넘길 때만 날짜 위에 보이고(지역·날짜·프리셋 토글은 `CONTROL_WIDTH_CLASS` 한 폭), 모니터링 패널은 날짜 옆 이름만 보인다. UI 상태는 `use-scene-sun-state.ts`(live 는 주기 갱신 — 렌더 중 `Date.now()` 금지라 스토어 `liveNowMs` 캐시).
- 배포 씬은 실외 4개(dock-1·dock-2·goliath·philly-dock-2)가 `sunMode: 'solar'` + `shadows: true`, 실내 dock-in 은 수동.

### 분할 화면 렌더 (한 캔버스, 타일마다 카메라)

분할 화면(`docs/agents/monitoring-ui.md`)은 캔버스를 늘리지 않고 한 씬을 타일마다 다른 카메라로 여러 번 그린다. `SceneSplitRenderer` 가 `useFrame(…, 1)` 로 R3F 자동 렌더를 넘겨받고, 프레임의 일은 `lib/split-render.ts` 다: 캔버스를 한 번 지우고 → 타일마다 카메라 종횡비·fov(기본 카메라와 같게) → LOD 를 그 카메라 기준으로 다시 쓰기 → viewport·scissor 를 타일 사각형으로 → `gl.render` → 끝나면 캔버스 전체로 복원. 언마운트하면 자동 렌더가 돌아온다.

타일 viewport·scissor 는 `setViewport`·`setScissor` 뒤 `setRenderTarget(null)` 로 한 번 더 적용한다. three 는 앞의 둘을 device px 로 반올림하고, 중첩 패스(shadow pass·바다 미러 패스) 뒤의 복원은 내림한다 — 맞추지 않으면 shadow pass 를 소비하는 첫 타일만 그 프레임에 1px 어긋나 들썩인다(DPR 1.5, 테스트 `lib/__tests__/split-render.test.ts`).

빈 칸·타일 사이 간격의 색은 캔버스 요소의 `--canvas-background`(컨테이너와 같은 토큰, `readCanvasBackgroundColor`)를 clear 색으로 명시해 지운다 — GL 의 clear 색 상태는 마지막 패스가 남긴 값이라(shadow pass 는 흰색) 그대로 `clear()` 하면 빈 칸이 희다. 텍스처 배경은 three 가 clear 색을 되돌리지 않는다. 렌더러의 clear 색은 프레임 뒤 원복하고, 테마 전환(`<html>` class)은 MutationObserver 로 다시 읽는다.

기본 카메라 하나를 전제한 곳은 이렇게 맞춘다. **기본 카메라·캔버스 크기를 읽는 새 코드는 이 목록에 자기 처리를 더한다.**

| 기본 카메라에 기대는 것 | 분할에서 |
|---|---|
| 지형·모델 LOD(`node.visible` 은 씬에 하나) | `TerrainLodController` 가 카메라 키마다 이동 게이트·현재 레벨을 따로 두고, 게이트에 걸려도 가시성은 매번 다시 쓴다. 렌더러가 타일 렌더 직전에 타일 높이(device px)로 적용 |
| shadow frustum(시선 초점 추종) | `SceneLighting` 의 `shadowFocus` prop — 타일 구도들의 초점(`resolveShadowFocusForPose`) 합집합(`unionShadowFocus`)으로 고정. shadow pass 는 첫 타일 렌더가 `needsUpdate` 를 소비해 프레임당 1회 |
| drei `Html` 표시(모델 라벨·눈금 숫자·영역 배지·충돌 표지) | `PerViewport`/`ViewportAnchor` 가 타일마다 R3F portal(state 의 camera·size 를 타일 것으로)로 복제하고 DOM 은 타일 컨테이너(`portal`)에 붙인다. 포털 key 에 타일 크기·컨테이너 uuid 가 들어가 리사이즈에 재마운트된다. 타일 라벨은 클릭·hover 를 받지 않는다 |
| 실루엣 테두리 두께(캔버스 세로 px 기준) | `useSceneViewportHeight` — 분할이면 타일 높이(타일은 전부 같은 높이) |
| 바다 미러 패스 | 수정 없음 — `OceanWater.onBeforeRender` 가 그리는 카메라 기준이라 타일마다 맞게 돌고 비용만 타일 수만큼 |
| 태양·달 스프라이트·밤하늘 틴트 돔(기본 카메라 추종) | 그대로 둔다 — 각각 `CELESTIAL_DISTANCE`·`SKY_TINT_RADIUS` 거리라 타일 카메라가 몇 km 어긋나도 눈에 띄지 않는다 |
| 방위 표시·미니맵·HUD·표면 카메라·카메라 범위 제한 | 화면 쪽에서 숨기거나 입력을 막는다(`monitoring-ui.md`). 표면 카메라·범위 제한은 마운트된 채 기본 카메라만 다룬다 |
| `gl.info`(perf HUD) | 렌더러가 마운트 동안 `autoReset` 을 끄고 프레임 시작에 리셋해 타일 합(shadow pass 포함)을 보인다 |

비용은 픽셀이 아니라 정점·드로우콜이 타일 수만큼 는다(지도 GLB 는 노드 하나라 절두체 컬링이 안 먹는다). 부족하면 분할 중 미러 패스 끄기 → 거버너 fps 낮추기 → 그림자 끄기 순으로 본다 — 실측 전이라 아직 아무것도 넣지 않았다.

### 씬 로딩 뒤 워밍업 큐

`bvh-build-queue.ts` 의 전역 큐에 `ModelMesh` 가 넣고, 프레임급 간격의 고정 시간 예산 슬라이스로 처리한다.

- 작업 종류 순서: `bvh`(클릭 raycast BVH) → `outline`(실루엣 테두리용 스무딩 노멀 사본). 각 종류 안에서 삼각형 수 오름차순이라 큰 지형이 마지막.
- `outline` 은 `enqueue` 옵션 `outline: true` 인 메시만 — `GltfModel`/`ModelMesh` 의 `prepareOutline`. 에디터·모니터링의 **모델**만 켜고 지도는 제외. 첫 선택·첫 충돌에서 사본을 만들면 프레임이 서기 때문에 미리 만든다.
- `(지오메트리, 종류)` 참조 카운트라 `cancel` 은 `enqueue` 와 같은 옵션으로 불러야 한다.
- 셰이더 프리워밍 `silhouette-outline-warmup.tsx`(Canvas 안): 헐·마스크 프로그램을 동기 `gl.compile` 로 미리 컴파일하고, 헐 머티리얼을 캔버스 수명 동안 들고 있는다 — three 는 같은 셰이더의 마지막 머티리얼이 dispose 되면 프로그램을 지워, 이게 없으면 재선택마다 재컴파일된다. `SceneCollisionHighlight` 옆에 마운트.
- 단계 선택(`scene-warmup-step.ts`): bvh 잔여 → outline 잔여 → 충돌 런타임 `baseline`(`docs/agents/3d-collision.md`) → drei `useProgress` 활성 순, 타이머 추측 없음. 표시 UI 는 `docs/agents/monitoring-ui.md`.

## 불변식

- **모델·노드를 새 경로로 움직이는 코드는 `invalidateShadows()` 를 함께 부른다.** 빼먹으면 그림자가 최대 4초(안전망 상한) 동결된다.
- **씬을 매 프레임 바꾸는 새 경로는 `SceneFrameGovernor` 의 소스 목록에 넣거나 스스로 `invalidate()`/`requestSceneFrame()` 한다.** 안 하면 화면이 다음 조작까지 낡은 프레임에 머문다(model-mesh 의 머티리얼 effect 가 선례).
- **`SceneLighting` 은 `regionId` 필수.** 빼면 solar 씬이 수동 태양으로 조용히 떨어진다.
- **지리 방위(천체·나침반)를 월드 방향으로 바꾸는 곳은 `bearingToWorldAzimuth`(씬 진북) 하나다.** 월드 −Z 를 북으로 가정하지 않는다 — 씬이 지도를 돌려 놓아 진북이 씬마다 다르다.
- **조명·하늘 밝기를 다른 곳에서 세팅하지 않는다.** `SceneLighting` 이 solar 모드에서 방향광 세기·색, 환경광, `scene.backgroundIntensity`·`environmentIntensity` 를 매 프레임 덮어쓰므로 프레임마다 서로 되돌린다. 기준값은 `sky-lighting.ts` 상수를 고치고, 환경맵 세기는 `SCENE_ENVIRONMENT_INTENSITY` 하나를 쓴다.
- **새 불투명 GLTF 로드 경로(`useClonedModel` 을 거치지 않는 것)는 `markSceneOpaqueStencil` 을 켠다.** 아니면 물 위에서 바다에 덮여 사라진다.
- **바다 위에 보여야 하는 불투명 오버레이(선택 박스·텍스트 테두리·격자·가드 링)는 `renderOrder ≥ 0.5`.** 0 이면 물 위에서 바다에 덮인다.
- `ocean-water.ts` 에 `gl_FragDepth`(logdepthbuf 청크)를 다시 넣거나 depthTest 를 켜지 않는다 — early stencil test 가 꺼져 절감이 사라진다.
- **바다 반사에서 빼야 하는 객체(대형 객체, 메인 패스에서 이미 물 픽셀을 덮는 것)는 `OceanWater` 의 `excludedObjects`/`excludeFromReflection` 으로 뺀다.** 미러 카메라 `layers` 는 쓰지 않는다.
- **직교 카메라로 씬 전체를 RT 에 그리는 새 경로는 반사 제외 객체를 숨기고, `OceanWater` 는 `applyCanonicalWaterUniforms` 로 반사 0 을 준 채 보이게 두며, 시각과 무관해야 하면 `applyCanonicalCaptureLighting` 으로 조명을 수동 모드 기준값으로 바꾼다(renderer `shadowMap` 플래그도 함께 끈다).** 직교 투영에선 미러 패스가 돌지 않아 반사 RT 에 낡은 원근 프레임이 남고, equirect 배경도 보이지 않으며(바다 영역은 물 원판이 덮는다), 틴트 돔은 카메라를 감싸 전체를 틴트한다. RT 는 Float 로 두고 readback 에 three 와 동일한 ACES(`acesFilmicToneMap`)를 건다(미니맵 캡처가 선례 — `docs/agents/monitoring-ui.md`).
- **`sceneLightingInfo.sun*` 은 `SceneLighting` 만 쓴다(`publishSunLight`).** 다른 곳에서 쓰면 프레임마다 서로 되돌린다.
- **바다 유무는 `resolveSeaVisible(sceneInfo)` 하나로 판정한다.** 씬의 배경(`environment`)·EXR URL 로 바다를 유추하는 코드를 만들지 않는다.
- **지도가 주변 지형인지는 씬 지도의 `role` 로 본다(`isContextMap`).** 그림자 제외·Lambert·바다 반사 제외가 전부 이 판정 하나를 쓴다. 파일 이름이나 자산 라이브러리로 묻지 않는다 — 런타임은 라이브러리를 읽지 않는다.
- **바다가 켜진 캔버스에서 지도·모델을 그리는 경로는 `seaSubmersion` 을 켜고, 그 캔버스는 `SceneEnvironment`(→ `SceneSeaReach`)를 마운트한다.** 마스크가 없으면 안개가 전혀 끼지 않는다.
- **안개를 뺄 곳을 머티리얼 이름·객체 종류로 가리지 않는다.** 기준은 위치(바다 도달 마스크) 하나다. 잠김 안개의 물 색·밀도도 `sea-submersion.ts` 상수 하나라, 모델과 지도 중 한쪽만 다르게 보이게 하는 분기를 넣지 않는다.
- **바다 도달 마스크의 유니폼은 객체를 바꾸지 않고 값만 바꾼다(`publishSeaReachMask`·`resetSeaReachMask`).** 머티리얼이 유니폼 객체를 참조로 들고 있어 객체를 갈면 이미 컴파일된 머티리얼이 옛 값을 본다.
- **마스크는 삼각형을 직접 찍어 만든다.** GPU 탑뷰 렌더로 바꾸지 않는다 — 두께 없는 도크 게이트는 위에서 본 면적이 없어 렌더에 남지 않고, 도크가 통째로 바다로 샌다.
- three 를 올리면 `ocean-water.ts` 를 새 버전의 `examples/jsm/objects/Water.js` 와 대조한다 — 포크라 자동으로 따라가지 않는다.
- `SceneFrameGovernor` 주기 틱 중에는 useFrame 안에서 `requestSceneFrame()`/`invalidate()` 를 부르지 않는다(`isSceneFrameTickerActive()` 가드) — 30fps 상한이 무력화된다.
- `SCENE_DEFAULT_DPR` 와 `three-scene-viewer.tsx` 의 DPR 기본값은 함께 바꾼다.
- `bvh-build-queue` 의 `cancel` 은 `enqueue` 와 같은 옵션(`outline`)으로 부른다.
- 새 캔버스를 만들면 `SceneLighting`(regionId)·`SceneFrameGovernor`·`SceneTerrainLod`·`SilhouetteOutlineWarmup` 을 기존 세 캔버스와 같이 마운트한다.
- **기본 카메라(`useThree().camera`, useFrame 의 `camera`)나 캔버스 크기(`size`)로 화면 배치를 계산하는 새 코드는 분할 화면을 고려한다** — DOM 표시는 `PerViewport`/`ViewportAnchor`, 세로 px 는 `useSceneViewportHeight`, 씬 전역 가시성을 카메라로 정하는 것은 렌더 직전 타일 카메라로 다시 쓴다. 위 "분할 화면 렌더" 표에 더한다.
- `useFrame` 에 양수 priority 를 쓰는 것은 분할 렌더러(와 drei GizmoHelper 의 Hud)뿐이다. 하나 더 두면 서로 렌더를 뺏는다.

## 하지 않기로 한 것

- **reverse-Z 깊이** — three r183 의 `reverseDepthBuffer` 는 WebGPURenderer 전용이고, 기본 프레임버퍼(24bit unorm)에선 부호 반전만으로 정밀도가 늘지 않아(float 깊이 RT 여야 이득) 로그 깊이의 z-fighting 해결을 대체할 수 없다.
- **DPR 상한 1.25** — 내렸다 되돌렸다. 1.5 를 유지한다(`SCENE_DEFAULT_DPR` 와 뷰어 기본값 함께).
- **shadow 무효화 벽시계 스로틀(20Hz 상한)** — 렌더가 주사율로 도는 동안 대부분 프레임이 이전 자세의 depth map 이라 배속 ≥2 에서 자기 그림자 오차가 명멸했다. 임계 `SHADOW_STEP_EPS` 를 넘긴 프레임마다 무효화한다.
- **`compileAsync` 프리워밍** — 폴링 중 캔버스 언마운트·머티리얼 dispose 에 three 내부가 던진다. 동기 `compile` 을 쓴다.
- **PCFSoftShadowMap(Canvas `shadows` true·`'soft'`)** — r183 은 첫 shadow pass 에서 PCF 로 바꾸고 R3F 는 Canvas 재렌더마다 되돌린다. 그 사이 컴파일된 셰이더는 BASIC 변형(`sampler2D`)이 되어 그림자 받는 메시의 드로우를 WebGL 이 버린다(shadow pass 를 막고 찍는 미니맵 캡처에서 조선소 지도가 빠졌다). `sceneCanvasShadows` 의 `'percentage'` 만 쓴다.
- **달빛만 두는 밤·작업등 끄기 스위치** — 관제용으로 너무 어두웠다. 야간 작업등은 항상 켠다.
- **바다를 맨 먼저 그리기** — 화면 전체가 매 프레임 파도 계산이었다. 불투명 뒤 스텐실로 바꿨다.
- **인스턴스별 유휴 콜백 체인(requestIdleCallback) 워밍업** — 로딩 직후엔 콜백이 타임아웃으로만 돌아 지오메트리 수십 개 씬이 수십 초 걸렸다. 고정 예산 큐로 통합.
- **shadow 캐스터에 컨텍스트 지형 포함** — 약 180만 삼각형이 매 shadow pass 에 들어갔다.
- **EXR 을 시선 방향으로 샘플링하는 자체 바다 셰이더** — 하늘 사진 톤은 유지되지만 크레인·야드가 물에 비치지 않는다. 미러 반사 포크로 바꿨다.
- **GroundedSkybox(EXR 하반구를 바닥 평면에 투영)** — EXR 의 바다는 시점 의존 프레넬 그라데이션이라 월드 한 점에 고정하면 어두운 점이 박히고 밝은 수평선이 방사형으로 늘어지며, 돔 밖으로 나가면 구멍이 난다.
- **수면 아래를 프레임버퍼 복사로 블러하는 오버레이** — alpha:false 프레임버퍼·텍스처 포맷 호환에 취약해 선체가 검게 덮였다. 모델·지도 셰이더 패치(`sea-submersion.ts`)로 대신한다.

## 미룬 것

- 바다 도달 마스크의 한계: 바다와 마른 분지 사이의 한 칸짜리 벽(도크 게이트)은 바다 쪽 면에도 안개가 끼지 않는다. 선체 내부처럼 모델이 스스로 물을 막는 공간은 지도 기반이라 가리지 못한다. 격자 밖 주변 지형의 육지 안 저지대는 바다로 본다. 바다가 켜진 캔버스 둘이 서로 다른 씬을 동시에 그리면 나중에 올린 마스크가 이긴다.

- 타워크레인 데시메이션/LOD 확대, 지도 KTX2 전환(`docs/agents/assets-glb.md`), 바다만 애니메이션인 유휴(sea-only)를 `ANIMATING_FPS` 아래로 낮추는 거버너 단계.
- 바다 미러 패스의 격프레임 갱신·`WATER_REFLECTION_SIZE` 축소 — 미러 패스는 머티리얼마다 RT/화면 프로그램 전환과 `updateMatrixWorld` 한 번이 더 도는 상시 비용이라 실측 뒤 부족하면 적용한다.
- 실루엣 헐·마스크의 미러 RT 변형 프리컴파일 — `SilhouetteOutlineWarmup` 은 화면 변형만 컴파일해, 반사에 첫 선택·충돌 테두리가 나타나는 프레임에 일회성 동기 컴파일이 있다.
- 바다 `time` 유니폼의 정밀도 — 예제와 같이 delta 를 무한 누적해 며칠 연속 가동하면 float32 정밀도로 파도가 거칠어진다(이전 셰이더도 같았다). 단순 wrap 은 노이즈 레이어 주기가 서로 소수라 어딘가에서 튄다 — 레이어별 uv 오프셋을 JS 에서 mod 로 계산해 넘기는 방식이 후보.
