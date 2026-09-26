# 3D 렌더링·성능 — demand 프레임루프, 그림자, 바다 미러 반사·스텐실, 낮/밤 조명, 워밍업 큐

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
| 천문 계산 / 시간대 변환 / 현장 위경도 | `packages/domain/src/3d/lib/solar-position.ts`, `packages/core/src/lib/time-zone.ts`, `packages/domain/src/3d/model/scene-site-geo.ts` |
| 씬 시계·태양 UI 상태 | `packages/features/src/3d/model/use-scene-clock-store.ts`, `model/use-scene-sun-state.ts`, `model/scene-time-source.ts` |
| 씬 시계 UI | `packages/features/src/3d/ui/scene-clock-panel.tsx`, `ui/scene-clock-menu.tsx`(모니터링 독), `packages/widgets/src/3d/ui/palette-environment-section.tsx`(에디터 배경 탭) |
| shadow map 온디맨드 무효화 | `packages/domain/src/3d/lib/shadow-invalidation.ts`(`invalidateShadows`) |
| 바다(미러 반사)·배경 환경 | 포크 `packages/features/src/3d/lib/ocean-water.ts`(`OceanWater` — three r183 `examples/jsm/objects/Water.js` 포크, MIT 헤더), 컴포넌트 `ui/scene-water.tsx`(`SceneWater`), 배경 `ui/scene-environment.tsx`(`SceneEnvironment`), 태양 유니폼 `lib/water-sun-uniforms.ts`(`resolveWaterSunUniforms`), 반사 제외 `lib/water-reflection.ts`·`model/scene-reflection-exclusions.ts`(`excludeFromReflection`), 표시 판정 `packages/domain/src/3d/lib/scene-sea.ts`(`resolveSeaVisible`). 노멀맵 `apps/shell/public/textures/waternormals.jpg` 는 three.js r183 examples 의 파일이다(MIT) |
| 불투명 씬 스텐실 표식 | `packages/domain/src/3d/lib/scene-stencil.ts`(`markSceneOpaqueStencil`), 켜는 곳 `packages/domain/src/3d/ui/model-mesh.tsx`(`useClonedModel`) |
| 컨텍스트 지형 Lambert 변환 | `packages/domain/src/3d/lib/lambert-material.ts`, `GltfModel shading='lambert'` |
| 지형·모델 LOD 런타임 전환 | `packages/features/src/3d/ui/scene-terrain-lod.tsx`(`SceneTerrainLod`), 수식 `lib/terrain-lod.ts`(`TERRAIN_LOD_THRESHOLD_PX`) |
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
- 컨텍스트 지형(kind `'context'`)은 `GltfModel shading='lambert'` 로 PBR 대신 Lambert 다(`lambert-material.ts`, 원본 머티리얼당 변환본 캐시). 조명·낮/밤엔 똑같이 반응하고 스펙큘러·radiance 샘플링만 없다. 모니터링·에디터 같은 규칙.
- 타일 LOD 임계는 `TERRAIN_LOD_THRESHOLD_PX`(device px). 컨텍스트 지형과 LOD 체인이 붙은 모델에만 LOD 가 있다(생성 절차는 `docs/agents/assets-glb.md`).
- 바다 미러 패스는 컨텍스트 지형 루트·밤하늘 틴트 돔·태양/달 스프라이트를 빼고 그린다(`OceanWater` 의 `excludedObjects` — `resolveReflectionExcludedMapIds` + `excludeFromReflection`). 지형 루트 하나를 숨기면 three 가 서브트리를 통째로 건너뛰어 LOD 타일 전부가 빠진다. 반사 RT 크기는 `scene-water.tsx` 의 `WATER_REFLECTION_SIZE`, 비친 하늘의 밝기는 `WATER_REFLECTION_INTENSITY`(포크 유니폼 `reflectionIntensity`, 예제엔 없다 — 예제는 렌더러 노출 0.1 로 HDR 하늘을 숨기지만 이 씬은 조명 전체가 노출 1 기준이라 물에서만 누그러뜨린다), 태양 확산 회색항의 배율은 `WATER_SUN_DIFFUSE_INTENSITY`(포크 유니폼 `sunDiffuseIntensity`, 예제 원값이면 낮에 산란색을 덮어 물이 회색이 된다) 하나씩.

### 바다는 미러 반사 + 불투명 패스 뒤 스텐실

바다는 `ui/scene-water.tsx` 의 `SceneWater` 가 만드는 `OceanWater`(`lib/ocean-water.ts`, three r183 `Water.js` 포크) 원판 하나다. 켜짐 여부는 `resolveSeaVisible(regionId, sceneInfo)`(`scene-sea.ts`) 한 곳이 정하고, 세 캔버스가 그 값을 `SceneEnvironment`·`SceneFrameGovernor`·`SceneSurfaceCamera`·모델 `seaSubmersion` 에 넘긴다. `SceneEnvironment` 는 EXR 배경(`EnvironmentBackground`)과 `SceneWater` 를 한 `Suspense` 경계 안에 두어 둘이 같이 나타나고 배경 교체에 물이 리마운트되지 않는다. 씬별 켜고 끄기는 `docs/agents/3d-editor.md`.

- **미러 패스** — `OceanWater.onBeforeRender` 가 메인 카메라를 수면에 반사한 미러 카메라로 씬을 스텐실 딸린 8bit RT 에 한 번 더 그린다(중첩 render — HalfFloat 이 아닌 이유: EXR 하늘의 수평선 띠는 백색의 몇 배라 그대로 비추면 얕은 각도의 바다가 흰색이 된다. 8bit 가 1.0 에서 잘라 EXR 이 달라도 반사 상한이 같다). 그동안 물 자신과 제외 객체(`excludedObjects` 게터 — `excludeFromReflection` 으로 등록된 틴트 돔·태양/달 스프라이트, `resolveReflectionExcludedMapIds` 가 고른 컨텍스트 지형 id 를 `modelObjectRegistry` 에서 매 패스 조회)는 `visible=false` 로 빠지고, shadow map 은 다시 그리지 않는다(`shadowMap.autoUpdate` 저장/복원). 직교 카메라면 미러 패스만 건너뛰고 `eye` 를 시선 반대쪽 먼 점(`ORTHO_EYE_DISTANCE`)으로 둔다 — 미니맵 캡처는 물을 `reflectionIntensity` 0 으로 보이는 채 그린다(`docs/agents/monitoring-ui.md`). 숨김·플래그·렌더 타깃 복원은 try/finally. RT 에도 스텐실이 있어 실루엣 마스크·헐이 반사에서 뭉개지지 않는다. 미러 패스는 `renderer.info` 를 리셋하지 않아(`info.autoReset` 을 패스 동안 끔) HUD 값은 메인 + 미러 합이다.
- **메인 패스** — 물은 `SEA_RENDER_ORDER` 로 불투명 패스 뒤에 그려진다. 모든 GLTF 인스턴스 메시 머티리얼이 `markSceneOpaqueStencil`(`useClonedModel` 이 원본에 켬, clone 이 물려받음)로 "불투명 씬이 그려졌다" 비트를 ZPass 에 찍고, 물 머티리얼은 depthTest/depthWrite 없이 그 비트(`SCENE_OPAQUE_STENCIL_BIT`)가 없는 픽셀에서만 그려진다(Equal 스텐실, writeMask 0). 지도·드라이독·잠긴 선체가 깊이 순서와 무관하게 바다 위에 남으면서, 가려진 픽셀은 early stencil 로 셰이더 앞에서 탈락한다. 실루엣 마스크·헐은 자기 비트만 writeMask/funcMask 로 본다(비트 값은 `scene-stencil.ts`).
- **태양 유니폼** — `SceneWater` 의 useFrame 이 `sceneLightingInfo.sunDirection/sunColor/sunIntensity` 의 튜플 참조가 바뀐 프레임에만 `resolveWaterSunUniforms`(방향 정규화, `SCENE_LIGHTING_BASE.sunIntensity` 기준 배율 상한 1, 수평선 페이드 `WATER_SUN_HORIZON_FADE_Y`, 비유한 값은 낮 폴백)를 거쳐 `sunDirection`·`sunColor` 유니폼에 쓴다. 키 라이트(밤엔 작업등 혼합)가 아니라 실제 태양이라 밤 바다는 어두운 하늘 반사 + `waterColor` 산란으로 어둡다.
- 포크가 원본과 다른 점: logdepthbuf 청크 없음·depthTest/depthWrite 없음·스텐실 Equal, RT 에 stencil, RT 8bit + `reflectionIntensity` 유니폼, `excludedObjects`, 직교 스킵, `dispose()`(RT·머티리얼), `info.autoReset` 보존, try/finally, `lights`·shadowmap 청크·`getShadowMask()` 제거(receiveShadow false 라 결과가 같다). 파도 시간은 useFrame 의 delta 에 `WATER_TIME_SCALE`(`scene-water.tsx`) 을 곱해 누적하고(물결 흐름 속도는 이 상수 하나로 조절), 노멀맵은 `ensureRepeatWrapping`(`lib/water-normals.ts`) 으로 useLoader 캐시 텍스처를 멱등 설정. `raycast` 는 no-op 이라 에디터 marquee·드롭에 잡히지 않는다. 폐기는 `SceneWater` cleanup 이 geometry·물을 dispose 하고 `invalidate` 한다(R3F 가 removeChild 에서 invalidate 하지 않는다).

`useClonedModel` 을 거치지 않는 GLTF 로드 경로(collision-guard 감지 객체 등)는 transparent 머티리얼이라 바다 뒤에 블렌딩돼 무관하다.

### shadow map 은 온디맨드로만

`SceneLighting` 이 `gl.shadowMap.autoUpdate=false` 로 끄고, 캐스터를 움직이는 코드가 `invalidateShadows()` 를 불러야 그 프레임의 shadow pass 가 돈다. 배선된 경로: `rigValueStore`(set/reset/step 누적 드리프트 판정 — 임계 `SHADOW_STEP_EPS` 를 넘긴 프레임마다), `useActiveTransformStore`(기즈모), `ModelMesh`(배치 props·meshOverrides·마운트), 리그 드라이버 인스턴스 해체/재생성(관절·맵핑 정의 편집 시 rest 점프), `SceneLighting` 자신(frustum·태양각) + 4초 주기 안전망. shadow pass 상한은 거버너 fps 가 정한다. 컨텍스트 지형은 cast/receiveShadow 모두 꺼져 있다(모니터링·에디터 동일).

### 낮/밤·태양 위치(solar 모드)

씬 설정 `lighting.sunMode: 'solar'`(`SceneSunMode`, 기본 `manual` = 수동 방위·고도 패드, 필드 생략). `'solar'` 만 저장하고 수동 각도는 보존돼 되돌리면 복원된다 — sanitize·에디터 dirty·`setLighting` 모두 같은 규칙.

- 현장 위치·시간대는 `scene-site-geo.ts`(region → 위경도·IANA tz). 씬 파일이 등록된 region 은 전부 있어야 한다 — 테스트가 강제. 미등록 region 은 solar 설정이어도 런타임이 manual 로 폴백하고 에디터 토글이 비활성.
- 천문은 `solar-position.ts`(태양·달 방위/고도·달 위상·일출/일몰, Meeus 축약식, 의존성 0). 시간대 변환은 `time-zone.ts`(Intl 기반, 라이브러리 없음 — 폐쇄망).
- 조명 곡선은 `sky-lighting.ts`: 고도 → 방향광 세기·색, 환경광, 하늘 배율. 낮 기준값 `SCENE_LIGHTING_BASE` 가 `SCENE_LIGHTING` 의 단일 소스, 환경맵 세기는 `SCENE_ENVIRONMENT_INTENSITY` 하나.
- **밤은 야간 작업등이 밝힌다.** 해가 지면(`YARD_LIGHT_FADE`) 따뜻한 백색 투광등이 고정 마스트 방향(`YARD_LIGHT_AZIMUTH`/`YARD_LIGHT_ELEVATION`)에서 `YARD_LIGHT_INTENSITY_RATIO` 세기로 켜지고 환경광도 난색으로 오른다(`NIGHT_AMBIENT_INTENSITY_LIT`). 반대편(`FILL_LIGHT_*`)에 그림자 없는 보조 투광등과 위 남색·아래 난색의 반구광(`NIGHT_HEMISPHERE_INTENSITY_LIT`)이 더해져 그림자 면이 새까맣지 않다. 하늘(EXR)은 `NIGHT_SKY_INTENSITY` 로 어두워지고 그 위에 남색 틴트 돔(`NIGHT_SKY_TINT_*`, 카메라 추종 BackSide 구, EXR 있을 때만)이 덮인다. 밤 전용 요소는 낮에 전부 0 이라 한낮 화면은 수동 모드와 같다.
- 방향광은 하나뿐이라 박명엔 태양·작업등 세기의 합을 세기로, 비율(`keyYardBlend`)로 방향·색을 섞어 그림자가 마스트 방향으로 돈다.
- 작업등은 `useSceneClockStore.yardLights`(세션, 기본 ON, 팝업 스위치)로 끌 수 있고 끄면 달·별빛 수준의 푸른 바닥값 `NIGHT_*_DARK`. 달은 표식·위상 표시용.
- 합성은 `solar-lighting.ts`: 시각+위치(+옵션) → 스냅샷. 방향광 고도 하한 `KEY_LIGHT_ELEVATION_MIN`, 방향은 `CELESTIAL_ANGLE_STEP` 격자로 양자화 — 정지 화면에서 shadow map 이 매 프레임 다시 그려지지 않는 근거.
- 적용은 `scene-render-preset.tsx` 의 `SceneLighting`(`regionId`·`timeSource` prop — 세 캔버스가 넘긴다). useFrame 에서 초 단위로 재계산해 방향광·환경광·`scene.backgroundIntensity`·`environmentIntensity` 를 직접 쓴다. 바다는 미러 패스가 `backgroundIntensity` 가 적용된 EXR 을 그대로 반사해 배경과 같은 배율로 어두워지고, 태양 하이라이트는 `sceneLightingInfo.sunDirection/sunColor/sunIntensity` 를 따른다 — `SceneLighting` 이 manual·solar 두 모드 모두 `publishSunLight` 로 쓴다(solar 는 고도 클램프 없는 진짜 태양 방향·`sky.sunColor`·`sky.sunIntensity`, manual 은 수동 태양·백색·기준 세기). 하늘의 태양 글로우·달 표식은 카메라 추종 스프라이트로 EXR 배경이 있을 때만이며, 틴트 돔과 함께 `excludeFromReflection` 으로 바다 반사에서 뺀다. 모드를 떠나면 `resetToManualLook`. 태양 방향·색·세기(두 모드)는 `model/scene-lighting-info.ts` 의 mutable `sceneLightingInfo` 로 내보낸다(바다가 읽는다). 미니맵 캡처는 조명 상태를 읽지 않고 캡처 순간만 수동 모드 기준 조명(`applyCanonicalCaptureLighting`, 키 라이트는 `SCENE_KEY_LIGHT_NAME` 으로 찾는다)으로 바꾼다(`docs/agents/monitoring-ui.md`).
- 시각 출처: 씬 시계 `use-scene-clock-store.ts`(세션 전역 live/manual — 에디터·모니터링 공유, 저장 안 됨) 또는 리플레이 프레임 타임스탬프(`scene-time-source.ts` + `@crane/domain/monitoring` 의 `parseReplayTimestamp` — `Z` 없는 값은 현장 벽시계로 해석).
- UI 는 `scene-clock-panel.tsx`(위상·현장 시각·태양/달 위치·일출/일몰, 실시간/시각 지정 토글, 날짜·시각 슬라이더·프리셋) 하나를 모니터링 독 팝업 `scene-clock-menu.tsx`(아이콘이 위상을 따라 해·일출·일몰·달, 시각 고정 중엔 하늘색)와 에디터 배경 탭(`palette-environment-section.tsx`, 방식 토글 수동/현장 시각 연동)이 공유한다. UI 상태는 `use-scene-sun-state.ts`(live 는 주기 갱신 — 렌더 중 `Date.now()` 금지라 스토어 `liveNowMs` 캐시).
- 배포 씬은 실외 4개(dock-1·dock-2·goliath·philly-dock-2)가 `sunMode: 'solar'` + `shadows: true`, 실내 dock-in 은 수동.

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
- **조명·하늘 밝기를 다른 곳에서 세팅하지 않는다.** `SceneLighting` 이 solar 모드에서 방향광 세기·색, 환경광, `scene.backgroundIntensity`·`environmentIntensity` 를 매 프레임 덮어쓰므로 프레임마다 서로 되돌린다. 기준값은 `sky-lighting.ts` 상수를 고치고, 환경맵 세기는 `SCENE_ENVIRONMENT_INTENSITY` 하나를 쓴다.
- **새 불투명 GLTF 로드 경로(`useClonedModel` 을 거치지 않는 것)는 `markSceneOpaqueStencil` 을 켠다.** 아니면 물 위에서 바다에 덮여 사라진다.
- **바다 위에 보여야 하는 불투명 오버레이(선택 박스·텍스트 테두리·격자·가드 링)는 `renderOrder ≥ 0.5`.** 0 이면 물 위에서 바다에 덮인다.
- `ocean-water.ts` 에 `gl_FragDepth`(logdepthbuf 청크)를 다시 넣거나 depthTest 를 켜지 않는다 — early stencil test 가 꺼져 절감이 사라진다.
- **바다 반사에서 빼야 하는 객체(대형 객체, 메인 패스에서 이미 물 픽셀을 덮는 것)는 `OceanWater` 의 `excludedObjects`/`excludeFromReflection` 으로 뺀다.** 미러 카메라 `layers` 는 쓰지 않는다.
- **직교 카메라로 씬 전체를 RT 에 그리는 새 경로는 반사 제외 객체를 숨기고, `OceanWater` 는 `applyCanonicalWaterUniforms` 로 반사 0 을 준 채 보이게 두며, 시각과 무관해야 하면 `applyCanonicalCaptureLighting` 으로 조명을 수동 모드 기준값으로 바꾼다(renderer `shadowMap` 플래그도 함께 끈다).** 직교 투영에선 미러 패스가 돌지 않아 반사 RT 에 낡은 원근 프레임이 남고, equirect 배경도 보이지 않으며(바다 영역은 물 원판이 덮는다), 틴트 돔은 카메라를 감싸 전체를 틴트한다. RT 는 Float 로 두고 readback 에 three 와 동일한 ACES(`acesFilmicToneMap`)를 건다(미니맵 캡처가 선례 — `docs/agents/monitoring-ui.md`).
- **`sceneLightingInfo.sun*` 은 `SceneLighting` 만 쓴다(`publishSunLight`).** 다른 곳에서 쓰면 프레임마다 서로 되돌린다.
- **바다 유무는 `resolveSeaVisible(regionId, sceneInfo)` 하나로 판정한다.** `environmentId`·EXR URL 로 바다를 유추하는 코드를 만들지 않는다.
- three 를 올리면 `ocean-water.ts` 를 새 버전의 `examples/jsm/objects/Water.js` 와 대조한다 — 포크라 자동으로 따라가지 않는다.
- `SceneFrameGovernor` 주기 틱 중에는 useFrame 안에서 `requestSceneFrame()`/`invalidate()` 를 부르지 않는다(`isSceneFrameTickerActive()` 가드) — 30fps 상한이 무력화된다.
- `SCENE_DEFAULT_DPR` 와 `three-scene-viewer.tsx` 의 DPR 기본값은 함께 바꾼다.
- `bvh-build-queue` 의 `cancel` 은 `enqueue` 와 같은 옵션(`outline`)으로 부른다.
- 새 캔버스를 만들면 `SceneLighting`(regionId)·`SceneFrameGovernor`·`SceneTerrainLod`·`SilhouetteOutlineWarmup` 을 기존 세 캔버스와 같이 마운트한다.

## 하지 않기로 한 것

- **reverse-Z 깊이** — three r183 의 `reverseDepthBuffer` 는 WebGPURenderer 전용이고, 기본 프레임버퍼(24bit unorm)에선 부호 반전만으로 정밀도가 늘지 않아(float 깊이 RT 여야 이득) 로그 깊이의 z-fighting 해결을 대체할 수 없다.
- **DPR 상한 1.25** — 내렸다 되돌렸다. 1.5 를 유지한다(`SCENE_DEFAULT_DPR` 와 뷰어 기본값 함께).
- **shadow 무효화 벽시계 스로틀(20Hz 상한)** — 렌더가 주사율로 도는 동안 대부분 프레임이 이전 자세의 depth map 이라 배속 ≥2 에서 자기 그림자 오차가 명멸했다. 임계 `SHADOW_STEP_EPS` 를 넘긴 프레임마다 무효화한다.
- **`compileAsync` 프리워밍** — 폴링 중 캔버스 언마운트·머티리얼 dispose 에 three 내부가 던진다. 동기 `compile` 을 쓴다.
- **PCFSoftShadowMap(Canvas `shadows` true·`'soft'`)** — r183 은 첫 shadow pass 에서 PCF 로 바꾸고 R3F 는 Canvas 재렌더마다 되돌린다. 그 사이 컴파일된 셰이더는 BASIC 변형(`sampler2D`)이 되어 그림자 받는 메시의 드로우를 WebGL 이 버린다(shadow pass 를 막고 찍는 미니맵 캡처에서 조선소 지도가 빠졌다). `sceneCanvasShadows` 의 `'percentage'` 만 쓴다.
- **달빛만 두는 밤** — 관제용으로 너무 어두웠다. 야간 작업등이 기본.
- **바다를 맨 먼저 그리기** — 화면 전체가 매 프레임 파도 계산이었다. 불투명 뒤 스텐실로 바꿨다.
- **인스턴스별 유휴 콜백 체인(requestIdleCallback) 워밍업** — 로딩 직후엔 콜백이 타임아웃으로만 돌아 지오메트리 수십 개 씬이 수십 초 걸렸다. 고정 예산 큐로 통합.
- **shadow 캐스터에 컨텍스트 지형 포함** — 약 180만 삼각형이 매 shadow pass 에 들어갔다.
- **EXR 을 시선 방향으로 샘플링하는 자체 바다 셰이더** — 하늘 사진 톤은 유지되지만 크레인·야드가 물에 비치지 않는다. 미러 반사 포크로 바꿨다.
- **GroundedSkybox(EXR 하반구를 바닥 평면에 투영)** — EXR 의 바다는 시점 의존 프레넬 그라데이션이라 월드 한 점에 고정하면 어두운 점이 박히고 밝은 수평선이 방사형으로 늘어지며, 돔 밖으로 나가면 구멍이 난다.
- **수면 아래를 프레임버퍼 복사로 블러하는 오버레이** — alpha:false 프레임버퍼·텍스처 포맷 호환에 취약해 선체가 검게 덮였다. 모델 셰이더 패치(`sea-submersion.ts`)로 대신한다.

## 미룬 것

- 타워크레인 데시메이션/LOD 확대, 지도 KTX2 전환(`docs/agents/assets-glb.md`), 바다만 애니메이션인 유휴(sea-only)를 `ANIMATING_FPS` 아래로 낮추는 거버너 단계.
- 바다 미러 패스의 격프레임 갱신·`WATER_REFLECTION_SIZE` 축소 — 미러 패스는 머티리얼마다 RT/화면 프로그램 전환과 `updateMatrixWorld` 한 번이 더 도는 상시 비용이라 실측 뒤 부족하면 적용한다.
- 실루엣 헐·마스크의 미러 RT 변형 프리컴파일 — `SilhouetteOutlineWarmup` 은 화면 변형만 컴파일해, 반사에 첫 선택·충돌 테두리가 나타나는 프레임에 일회성 동기 컴파일이 있다.
- 바다 `time` 유니폼의 정밀도 — 예제와 같이 delta 를 무한 누적해 며칠 연속 가동하면 float32 정밀도로 파도가 거칠어진다(이전 셰이더도 같았다). 단순 wrap 은 노이즈 레이어 주기가 서로 소수라 어딘가에서 튄다 — 레이어별 uv 오프셋을 JS 에서 mod 로 계산해 넘기는 방식이 후보.
