# 3D 씬 에디터

씬 편집 페이지(`3d-viewer-edit`)의 저장 경로, 씬 설정(배경·조명·바다·진북), 씬 뷰·분할 지정, 카메라·탑뷰 규약, 기즈모 스냅·다중 선택 피벗·루트 rest handoff, 노드 선택 표시, 거리 눈금, region → 씬 파일 매핑.

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

## 진입점

| 관심사 | 위치 |
|---|---|
| 에디터 세션 / 히스토리 / 영속화 / 미저장 가드 | `packages/widgets/src/scene-editor/model/use-scene-editor-session.ts`, `use-scene-history.ts`, `use-scene-persistence.ts`, `use-scene-unsaved-changes-guard.ts` |
| dirty·히스토리 동등 비교 | `packages/widgets/src/scene-editor/model/scene-snapshot.ts` |
| 에디터 캔버스 / 드롭 / 기즈모 | `packages/widgets/src/3d/ui/scene-objects-edit-canvas.tsx`, `packages/widgets/src/3d/ui/use-scene-drop.ts`, `packages/widgets/src/3d/ui/use-scene-transform.ts` |
| 인스펙터 / 선택 객체 편집 채널 | `packages/widgets/src/3d/ui/scene-object-inspector.tsx`, `packages/features/src/3d/model/use-selected-scene-object-editor.ts` |
| 씬 JSON 스키마 / 방어 | `packages/domain/src/3d/model/types.ts`, `packages/domain/src/3d/lib/sanitize-scene-info.ts` |
| region → 씬 파일 매핑 | `packages/domain/src/3d/model/scene-file-map.ts`, `packages/domain/src/3d/model/scene-file-registry.ts` |
| 씬 설정 팔레트(배경·조명·바다·진북) | `packages/widgets/src/3d/ui/palette-environment-section.tsx`(배경 탭), `packages/widgets/src/3d/ui/palette-map-section.tsx`(맵 탭 — 지도 타일 + 바다 스위치 + 진북 입력), 바다 판정 `packages/domain/src/3d/lib/scene-sea.ts`(`resolveSeaVisible`), 진북 `packages/domain/src/3d/lib/true-north.ts`(`resolveTrueNorth`) |
| 씬 뷰·분할·메인 뷰 지정(뷰 탭) | 스키마 `packages/domain/src/3d/model/view-types.ts`, 방어 `packages/domain/src/3d/lib/sanitize-views.ts`, 배치 `lib/view-split-layout.ts`, 홈 카메라 `lib/scene-home-camera.ts`(`resolveSceneHomeCamera`), 편집 `packages/widgets/src/3d/lib/view-editor.ts`(전부 테스트 대상), 팔레트 `packages/widgets/src/3d/ui/palette-view-section.tsx`, 우상단 고정 줄 `packages/features/src/3d/ui/scene-view-bar.tsx` |
| dev 저장 미들웨어 / public 자산 리로드 | `apps/shell/vite.config.ts`, `apps/shell/vite-plugin-asset-hash.ts`, `packages/domain/src/3d/lib/scene-dev-storage.ts` |
| 탑뷰 포즈(정수직 회피 tilt, 뷰어·에디터 공용) | `packages/core/src/lib/top-view-pose.ts`(`computeTopViewPose`, `ensureTopViewTilt`, 테스트 대상) |
| 기즈모 스냅 / 다중 선택 피벗 | `packages/features/src/3d/lib/snap-transform.ts`, `packages/widgets/src/3d/lib/pivot-transform.ts`, `packages/features/src/3d/ui/scene-transform-pivot-menu.tsx`, `packages/features/src/3d/model/use-scene-editor-view-store.ts` |
| 루트 Δ 벗기기 / 배치 프레임 | `packages/features/src/3d/lib/strip-channel-delta.ts`, `packages/features/src/3d/model/root-placement.ts`, `packages/features/src/3d/model/use-rig-driver.ts` |
| 선택 표시(박스·실루엣) | `packages/domain/src/3d/lib/selection-bounding-box.ts`, `packages/domain/src/3d/lib/silhouette-outline.ts`, `packages/domain/src/3d/ui/gltf-model.tsx`, `packages/domain/src/3d/ui/model-mesh.tsx` |
| 거리 눈금 스키마 / 방어 / 기하 / 렌더 | `packages/domain/src/3d/model/ruler-types.ts`, `packages/domain/src/3d/lib/sanitize-rulers.ts`, `packages/domain/src/3d/lib/ruler.ts`(테스트 대상), `packages/domain/src/3d/ui/scene-ruler.tsx` |
| 화면을 향한 표시(모델 라벨·눈금)의 거리 축소·숨김 | `packages/domain/src/3d/lib/label-scale.ts`(테스트 대상) |
| 거리 눈금 그리기 / 인스펙터 탭 / 편집 로직 | `packages/widgets/src/3d/ui/use-ruler-draw.ts`, `packages/widgets/src/3d/ui/ruler-section.tsx`, `packages/widgets/src/3d/lib/ruler-editor.ts`(테스트 대상) |
| 검색 가능 콤보박스 | `packages/ui/src/molecules/combobox.tsx`(base-ui `Combobox` 래핑, `usePortalContainer` + `z-9999` 규약) |
| 수치 입력 스테퍼 | `packages/ui/src/atoms/input-number.tsx`(`stepValue` 주입) |

## 동작

### 저장 경로 (dev 미들웨어)

- 씬 편집 결과는 dev 서버 경유로 `apps/shell/public/scenes/*.json` 에 저장된다. 미들웨어는 `apps/shell/vite.config.ts` 의 `POST /__dev/scene`. 관련 수정 시 scene registry 와 public asset 경로를 함께 확인한다.
- 가상 태그도 같은 방식이다 — `POST /__dev/virtual-tags` → `apps/shell/public/simulation/virtual-tags.json`. 경로 문자열이 `vite.config.ts` 와 `packages/domain/src/virtual-tag/lib/virtual-tag-storage.ts` 두 곳에 있으니 함께 바꾼다(가상 태그 자체는 `docs/agents/tag-mapping-rig.md`).
- 저장 미들웨어의 region → 파일 결정은 브라우저와 **같은 표**(`scene-file-map.ts`)를 읽는다. 아래 "region → 씬 파일 매핑".
- `scene-dev-storage.ts` 는 fetch 성공 뒤에만 로컬 사본을 지운다(실패 경로 테스트의 선례).

### public 자산 변경과 전체 리로드

- dev 미들웨어가 `public/` 에 쓰는 디렉토리(`scenes`, `simulation`, `previews`)는 `apps/shell/vite-plugin-asset-hash.ts` 의 `DEV_WRITTEN_DIRS` 에 등록돼 있어야 저장 시 전체 리로드가 나지 않는다. 이 플러그인이 public 자산 변경마다 `full-reload` 를 보내는 주체다 — Vite 코어는 보내지 않는다.
- `server.watch.ignored` 로 막지 않는다. Vite 는 워처가 유지하는 `publicFiles` 집합에 있는 파일만 서빙해서, 무시된 디렉토리에 기동 후 생긴 파일은 재시작 전까지 404 가 된다.

### region → 씬 파일 매핑

- 단일 소스는 `packages/domain/src/3d/model/scene-file-map.ts`. 브라우저 런타임(`scene-file-registry.ts`)과 Node 컨텍스트인 `apps/shell/vite.config.ts` 의 저장 미들웨어가 같은 표를 읽는다.
- 미등록 region 은 양쪽 모두 `null` 을 반환한다. 표를 복제하거나 기본 파일로 fallback 시키지 않는다 — 파일 자체 주석에 경위가 있다.
- 여러 region 이 한 파일을 **공유**할 수 있다(옥포 `dock-1`·`dock-2` → `okpo.json`, `isSceneFileShared`). 지도·모델·배경·조명은 하나이고 region 별로 다른 것은 카메라뿐이다 — 씬 JSON 의 `cameraByRegion[regionId]` 슬롯에 두고 `camera` 는 폴백. 로드 경계 `loadSceneInfoByRegionId` 가 `resolveSceneCameraForRegion` 으로 자기 슬롯을 `camera` 에 해석해 넣으므로 소비자는 `camera` 만 본다. 에디터 저장은 `withRegionCamera` 로 자기 슬롯만 기록한다(`lib/scene-region-camera.ts`). 두 region 의 에디터가 동시에 저장하면 마지막 저장이 이긴다.
- 운영 localStorage 저장 키는 region 이 아니라 **씬 파일**(`crane:scene:<파일명>`) 기준이라 공유 region 이 같은 로컬 저장본을 본다. GLB 캐시 해제(`gltf-cache-release.ts`)도 씬 파일 단위라 공유 region 사이 이동은 캐시를 유지한다.

### 씬 설정(배경·조명·바다·진북)

- 배경(EXR `environmentId`)·조명은 Project 팔레트 **배경 탭**(`palette-environment-section.tsx`), 바다·진북은 **맵 탭**(`palette-map-section.tsx`)의 지도 타일 아래다. 전부 씬 JSON(`SavedSceneInfo`)에 저장되고 모니터링·3D 플레이·에디터 세 캔버스가 같은 값을 읽는다.
- 바다 필드 `sea` 는 3-상태다 — `undefined` 는 레거시 규칙(EXR 이 resolve 되면 바다), `true`/`false` 는 명시. 유효값은 `resolveSeaVisible(regionId, sceneInfo)` 하나가 정하고 스위치는 그 유효값을 보여 준다. 미지정 씬은 절 제목과 스위치 사이에 안내 문구가 붙는다.
- 스위치를 누르면 `setSeaVisible` 이 유효값의 반대를 **명시 boolean** 으로 쓴다(미지정 씬도 첫 토글부터 명시 상태가 되어 dirty·히스토리에 잡힌다. 유효값을 그대로 명시로 굳히는 조작은 없다). 같은 명시값 재설정은 참조를 유지한다.
- 저장 단위는 **씬 파일**이다 — `okpo.json` 을 공유하는 `dock-1`·`dock-2` 는 한쪽에서 끄면 둘 다 꺼진다(`environmentId`·`lighting` 과 같은 규칙). 저장 경로는 위 dev 미들웨어 그대로.
- 진북 `trueNorth` 는 월드 −Z 에서 시계 방향(+X 쪽)으로 잰 진북 각도다. 기본값 0(−Z 가 북)이면 필드를 생략하고, sanitize·세터(`setTrueNorth`)가 [0,360) 로 랩한다(같은 값 재설정은 참조 유지). 지도 GLB 는 북쪽이 로컬 −Z 인 채로 들어오므로 지도를 Y축으로 ψ° 돌려 놓은 씬은 (360 − ψ)° 다 — 지도 회전을 바꾸면 진북도 같이 고친다. 나침반과 solar 모드 태양·달 방향이 읽는다(`docs/agents/monitoring-ui.md`, `docs/agents/rendering-perf.md`). 에디터 캔버스 좌상단에도 나침반이 있어 입력하면 바로 돈다. 수동 태양 패드의 방위는 월드 기준이라 진북과 무관하다.

### 씬 뷰와 분할 지정 (뷰 탭)

뷰는 이름 붙은 카메라 구도(`SavedSceneInfo.views`)이고, 분할은 뷰를 2×2 칸에 배정한 것(`SavedSceneInfo.viewSplit`)이다. 둘 다 씬 파일 단위 저장이라 파일을 공유하는 region 은 같은 뷰·분할을 본다. 모니터링·3D 플레이가 어떻게 쓰는지는 `docs/agents/monitoring-ui.md`.

- **저작은 뷰 탭뿐이다.** 카메라를 맞추고 "현재 화면을 뷰로 추가"(이름은 목록 끝 인라인 인풋 — Enter 커밋·Esc 취소·blur 커밋). 행 클릭은 그 구도로 이동, 이름 더블클릭은 이름 변경, 카메라 버튼은 현재 화면으로 다시 지정, 핀은 우상단 고정, ✕ 는 삭제. 이름은 공백·대소문자를 무시하고 유일해야 하고 최대 개수·길이는 `view-types.ts` 상수다.
- **순서는 행을 목록 안에서 끌어 바꾼다**(`withSceneViewMoved`, `insertBefore` 는 현재 목록 기준). 끄는 동안 놓일 자리에 빈 행이 생겨 다른 행이 밀리고, 자기 자리 앞뒤에는 빈 행을 만들지 않는다. 순서가 곧 우상단 고정 줄의 버튼 순서다. 모니터링은 고정한 뷰·고정한 분할만 보이므로 고정하지 않으면 에디터 밖으로 나가지 않는다.
- **분할 칸은 목록의 행을 끌어다 놓는다**(HTML5 DnD, `SCENE_VIEW_DRAG_TYPE` — `text/plain` 을 싣지 않아 캔버스 드롭이 모델 배치로 오해하지 않는다). 찬 칸에 놓으면 교체, 다른 칸에 있던 뷰면 이동이라 한 뷰는 한 칸에만 있다. 뷰를 지우면 그 칸도 빈다. 칸 순서는 좌상·우상·좌하·우하이고, 화면 배치(빈 행·열 접기)는 `resolveSplitLayout` 이 정한다.
- **메인 뷰**는 탭 맨 위 슬롯이다 — 목록의 행을 끌어다 놓고 ✕ 로 비운다. region 별 슬롯(`SavedSceneInfo.mainViewByRegion[regionId]`, `cameraByRegion` 과 같은 이유 — 파일을 공유하는 region 의 초기 시점이 다르다)이고 에디터는 자기 region 슬롯만 쓴다. 뷰를 지우면 슬롯도 빈다. 놓아도 에디터 카메라는 움직이지 않는다.
- **홈 카메라**(`resolveSceneHomeCamera(scene, regionId)`) = 메인 뷰의 구도, 없으면 `camera`(저장 시점 카메라). 세 캔버스의 초기 시점과 "메인 뷰" 버튼(구 원래 위치, `common:viewer3d.resetView`)이 이 값 하나를 본다. 에디터는 로드 때 홈 카메라에서 시작하고 저장 뒤에는 현재 카메라를 그대로 둔다. `camera`·`cameraByRegion` 은 여전히 저장 시점마다 기록되는 폴백이다.
- **고정**은 뷰마다 하나, 분할에 하나다(`pinned`, true 만 저장). 고정한 것만 에디터·모니터링 캔버스 우상단 고정 줄(`SceneViewBar`)에 상시 버튼으로 온다. 에디터는 고정 줄이 있으면 축 기즈모를 그 아래로 내린다(`SceneObjectsEditCanvas` 의 `axisGizmoTopOffset`).
- **에디터의 분할 버튼은 비활성**이다(`aria-disabled` + 툴팁 "모니터링 화면에서만") — 분할 화면은 모니터링에서 확인한다. 에디터 캔버스와 모니터링 타일은 가로세로 비율이 달라 세로 범위는 같고 가로 범위만 달라진다.
- 편집 의미는 `view-editor.ts` 의 순수 함수(`withSceneView*`, `withSplit*`)가 정하고 결과가 같으면 같은 참조를 돌려준다. 세터(`scene-manipulation-actions.ts`)는 그 함수를 `updateScene` 에 넘길 뿐이다. undo·dirty 는 다른 씬 설정과 같다.
- 뷰 id 는 씬 객체(모델·텍스트·눈금) id 집합과 별개다 — 뷰는 선택·기즈모·레지스트리 대상이 아니다.

### 카메라 up 과 탑뷰

- 카메라 `up` 은 항상 +Y 다. 탑뷰는 `top-view-pose.ts` 의 미세 tilt(`TOP_VIEW_TILT`)로 만든다.
- up=+Y 인 채 타깃 정확히 위에 서면 `lookAt` 이 퇴화해 roll 이 부동소수 노이즈로 정해지므로, 뷰어 `applyCameraState` 는 들어오는 모든 포즈를 `ensureTopViewTilt` 로 정규화한다 — 사이트 프리셋 `topViewPosition: [0,30,0]` 과 옛 북마크 방어.
- 에디터 캔버스는 `frameloop='demand'` 이며 `SceneFrameGovernor` 를 마운트한다. 카메라 이동 범위 제한·탑뷰 bounds 도 뷰어와 같은 합집합을 본다 — `docs/agents/rendering-perf.md`, `docs/agents/monitoring-ui.md`.

### 기즈모 스냅

- 스냅은 `snap-transform.ts` 의 순수 함수가 **저장값**(부모 프레임 위치 m · 오일러 도 · 배율) 기준으로 한다.
- 기즈모 경로(`use-scene-transform.ts` 의 liveSync — 드래그 시작 대비 변한 축만)와 인스펙터 스테퍼(`InputNumber` 의 `stepValue` 에 `stepOnGrid` 주입)가 같은 함수를 쓴다.
- 직접 타이핑한 값은 스냅하지 않는다.

### 다중 선택 변형 피벗

- `useSceneEditorViewStore.transformPivot`(세션 전용). `individual` = 각자 제자리 회전·크기(기본), `primary` = 프라이머리(마지막 Ctrl 클릭) 배치 위치를 피벗으로 강체 변형.
- 툴바 UI 는 `scene-transform-pivot-menu.tsx` 의 `SceneTransformPivotMenu` — "피벗" 팝업 하나에 좌표축 로컬/월드 행과 원점 개별/마지막 선택 행. 크기 모드에서도 좌표축을 잠그지 않는다(three 가 scale 에서 local 로 동작할 뿐이고 선택값은 다음 모드에 이어진다).
- 기즈모는 어느 쪽이든 프라이머리에 붙는다. `primary` 는 liveSync 가 세컨더리 위치를 `pivot-transform.ts`(`orbitAroundPivot`·`scaleAboutPivot`, 테스트 대상)로 궤도 이동시킨 뒤 **배치 프레임**으로 써넣는다(`readRootPlacement`→`writeRootPlacement`, 루트 태그 Δ 흡수 방지).
- 세컨더리는 개별 스냅하지 않는다 — 프라이머리가 먼저 스냅돼 델타가 격자 기준이고, 각자 스냅하면 강체성이 깨진다. 커밋은 회전·크기와 함께 `position` 을 담는다.

### 루트 태그 맵핑 모델의 rest handoff

- 루트 태그 맵핑이 있는 모델은 기즈모 드래그가 끝나는 프레임에 `use-rig-driver.ts` 가 루트 rest 를 **현재 자세**로 다시 잡는다(`reanchorRootIfMoved`). 커밋된 새 배치값은 React 렌더 + passive effect 를 거쳐야 드라이버에 도착하므로, 그 전 프레임에 옛 rest 로 되돌리면 모델이 이전 위치로 한 번 튄다.
- 드라이버가 마지막으로 적용한 자세 그대로인 루트(기즈모가 안 건드린 것)는 rest 를 유지한다.
- 기즈모가 잡는 자세는 rest+Δ 이므로 handoff 와 커밋(`use-scene-transform.ts`)·스냅은 드라이버가 readout 에 남긴 `rootDeltas`(루트에 마지막으로 적용한 Δ, 드래그 중엔 드래그 직전 값)를 벗겨 배치값을 얻는다(`strip-channel-delta.ts`, `root-placement.ts`). 그대로 저장하면 Δ 가 한 번 더 더해져 모델이 Δ 만큼 더 가서 멈춘다.

### 모델 안쪽 노드 선택

- 계층 목록의 자식·뷰포트 더블클릭 drill-in 으로 선택한 안쪽 노드는 **읽기 전용**이다. 인스펙터는 안내 문구만 보이고 기즈모는 붙지 않으며, 노드 선택은 항상 단일 선택(Ctrl 토글 없음)이다.
- 표시는 모델 선택과 같은 실루엣 테두리이며 대상만 그 노드 서브트리로 좁힌다 — `GltfModel` 의 `selectedMeshTarget` 이 `ObjectSilhouetteOutline` 대상이 된다(`selectionStyle='outline'` 인 에디터 한정). 실루엣 자체는 `docs/agents/3d-collision.md`.
- `selectionStyle='box'` 인 캔버스(에디터의 지도, 모니터링·리플레이·존 뷰어)는 노드 바운딩 박스다. 박스 점은 `selection-bounding-box.ts` 가 마운트 대상의 로컬 좌표로 계산하고, 노드 박스는 `createPortal` 로 노드 자식에 마운트해 리그·기즈모 움직임을 씬 그래프 상속으로 따라간다.
- 포털은 `target.uuid` key 로 재마운트해야 한다 — R3F `Portal` 이 컨테이너 교체 시 이전 노드에 붙는 문제가 있다(파일 주석). 실루엣 쪽도 같은 이유로 `node.uuid`·`mesh.uuid` 를 key 로 쓴다.
- 하위에 메시가 없는 리프 Empty 노드는 그릴 것이 없어 아무 표시도 나오지 않는다.
- 저장 씬의 `meshOverrides` 는 렌더에만 쓰이고 에디터에서 새로 만들지 않는다.

### 거리 눈금

바닥에 두 점을 찍어 그리는 씬 객체다(`SavedSceneInfo.rulers`). 시작점에서 끝점까지 간격마다 점과 거리 숫자를 보이고, 모니터링·3D 플레이·에디터 세 캔버스가 같은 컴포넌트(`SceneRuler`)로 그린다.

- **숫자는 씬에서 잰 거리**다. 태그(PLC) 값과 무관하므로 둘을 맞추려면 시작점을 PLC 원점에 두거나 시작 값에 그 지점의 PLC 값을 넣는다. 눈금은 시작점이 아니라 간격의 배수 값에 선다(`rulerTicks`).
- **단위가 섞여 있다**: 그린 기하(길이·보조선 길이)는 position 과 같은 씬 unit, 숫자에 해당하는 값(간격·시작 값)은 m 다. 표시·입력은 `getSceneMetersPerUnit` 으로 환산한다.
- **간격**은 `RULER_INTERVALS` 중에서만 고른다. 그 밖의 값이 든 저장본은 눈금을 버리지 않고 `RULER_INTERVAL_DEFAULT` 로 되돌린다.
- **그리기**: 헤더의 눈금 버튼이 세션 스토어 `useSceneEditorViewStore.rulerDrawing` 을 켠다. 캔버스 루트가 클릭을 **캡처 단계**에서 받아 전파를 끊고(선택·`onPointerMissed` 가 함께 돌지 않게) 드롭과 같은 바닥 raycast(`resolveDropPosition`)로 점을 찍는다. 클릭 두 번이고, 누른 자리와 뗀 자리가 멀면 카메라 드래그로 보고 무시한다. 그리는 동안 마퀴는 쉬고, 켜는 순간 선택을 비운다. 눈금 하나를 그리거나 Esc 를 누르면 꺼진다.
- 미리보기(`SceneRulerPreview`)는 훅 상태일 뿐 씬 데이터·레지스트리에 들어가지 않는다. 히스토리에는 추가 한 번만 남는다.
- 새 눈금의 표시 옵션은 전부 기본값이고(`createSceneRuler`, 보조선 없음) 간격만 그린 길이에 맞춰 고른다(`pickRulerInterval`). 이름은 번역한 실제 값으로 저장한다.
- **편집**: 표시 옵션은 인스펙터 눈금 탭(`updateSelectedRuler`), 배치는 트랜스폼 탭과 기즈모, 이름·잠금·삭제는 계층 목록이다. 선택·이름·잠금·트랜스폼·삭제는 모델·텍스트와 같은 공통 경로를 탄다.
- **크기(scale)는 없다.** 공통 트랜스폼 경로가 실어 온 scale 은 저장 전에 떼고, 눈금이 프라이머리일 때 크기 모드에서는 기즈모를 붙이지 않는다. 다중 선택 크기 드래그가 늘려 놓은 그룹은 렌더가 되돌린다.
- **점과 숫자**는 DOM(drei `Html`)으로 그려 바닥 메시가 없다. 숫자는 화면을 향하고 그림자·테두리가 없다. 색과 크기는 점·글자 각각 따로 정한다. 크기는 세 단계(`RULER_SIZES`)이고 기본(`RULER_SIZE_DEFAULT`)이 ACMS 그림의 크기다. 픽셀 값은 `ruler.ts` 의 `RULER_DOT_SIZE_PX`·`RULER_TEXT_SIZE_PX`. 크기가 깨진 저장본은 눈금을 버리지 않고 기본 크기로 되돌린다.
- **거리 축소**: 점과 숫자는 모델 라벨과 같은 규칙(`label-scale.ts`)으로 카메라가 멀어지면 줄고 같은 거리에서 사라진다. 축소의 기준점은 점의 중심(`rulerDotCenterPx`)이라 줄어도, 점 크기를 바꿔도 점이 눈금 자리를 벗어나지 않는다.
- **보조선**은 선택 옵션이다(`SavedRulerInfo.guide`). 눈금 점마다 진행 방향의 수직으로 긋고, 점에서 시작해 **한쪽으로만** 뻗는다 — 길이를 늘려도 반대쪽으로 자라지 않는다. 방향(진행 방향 기준 왼쪽·오른쪽)·길이·색·불투명도를 정한다. 화면 픽셀 두께 선을 바닥에서 `RULER_LINE_LIFT_M` 띄워 깊이 테스트를 켠다. 중심선은 그리지 않는다.
- 숫자는 눈금마다 카메라 거리로 화면 간격을 구해 촘촘하면 건너뛴다(`rulerLabelStride`). 기준 간격은 글자 크기에 비례하고(`rulerLabelMinSpacingPx`) 거리로 줄어든 만큼 함께 줄인다. 눈금 개수는 `RULER_MAX_TICKS` 를 넘지 않게 렌더가 간격을 정수 배로 올린다(`resolveRulerInterval`).
- 선택한 눈금은 시작점에서 끝점까지의 축선을 선택 색으로 보인다(`rulerAxisPoints`).
- 마퀴 선택에서는 지도처럼 항상 제외한다. Ctrl 토글·전체 선택에는 참여한다. 관제 화면에서는 클릭을 받지 않는다.

### 콤보박스 규약

`packages/ui/src/molecules/combobox.tsx` 는 base-ui `Combobox` 래핑이며 `usePortalContainer()` 로 포털하고 `z-9999` 를 쓴다. 인스펙터 안의 새 드롭다운은 이 규약을 따른다.

## 불변식

- 카메라 `up` 은 항상 +Y. 탑뷰는 `ensureTopViewTilt`/`TOP_VIEW_TILT` 로 만들고, 포즈를 적용하는 새 경로는 `ensureTopViewTilt` 로 정규화한다.
- 기즈모·스테퍼 스냅은 `snap-transform.ts` 순수 함수 한 곳. three `TransformControls` 의 `translationSnap`/`rotationSnap`/`scaleSnap` 은 쓰지 않는다.
- 씬 스키마에 필드를 추가하면 `sanitize-scene-info.ts`(또는 해당 `sanitize-*`)와 `scene-snapshot.ts` 의 동등 비교를 함께 고친다. 빠지면 편집이 동등 단락에 먹혀 dirty 가 서지 않고 저장되지 않는다(`isZoneListEqual` 이 선례 — `docs/agents/3d-zone.md`).
- region → 씬 파일 표는 `scene-file-map.ts` 하나. 미등록 region 은 `null`, 기본 파일 fallback 금지.
- `sea` 는 boolean 만 저장·비교한다 — `sanitizeSceneInfo` 는 boolean 이 아니면 필드를 버리고, `isSceneInfoEqual` 은 `!==` 로 본다(`undefined` 와 `false` 는 다르다). 바다 유무를 `environmentId` 로 유추하는 코드를 다른 곳에 두지 않는다(`resolveSeaVisible` 하나).
- `views`·`viewSplit`·`mainViewByRegion` 은 `sanitize-views.ts` 가 뷰 목록 **뒤에** 분할·메인 뷰를 정규화한다(존재하는 뷰만 가리키게). 빈 목록·빈 칸뿐이고 고정 아닌 분할·고정 false·빈 메인 뷰 맵은 필드를 생략하고, `isSceneViewListEqual`·`isViewSplitEqual`·`isMainViewByRegionEqual` 이 같은 규칙으로 비교한다. 필드를 추가하면 셋을 함께 고친다.
- 화면의 초기 시점·"메인 뷰" 버튼은 `resolveSceneHomeCamera` 하나로 정한다. `camera` 를 직접 읽어 초기 시점을 정하는 새 경로를 두지 않는다.
- 뷰 편집 함수(`view-editor.ts`)는 결과가 같으면 같은 참조를 돌려준다. 새 조작도 같은 규칙이다.
- 공유 씬의 카메라는 `camera` 를 직접 저장하지 않고 `withRegionCamera` 로 자기 region 슬롯에 쓴다. 씬을 로드하는 새 경로는 `loadSceneInfoByRegionId` 를 거쳐 `cameraByRegion` 해석을 받는다.
- 새 dev 저장 미들웨어를 만들면 쓰는 디렉토리를 `DEV_WRITTEN_DIRS` 에 추가한다. `server.watch.ignored` 로 막지 않는다.
- 루트 맵핑 모델의 배치값을 읽는 새 경로는 `rootDeltas` 를 벗겨야 한다(`readRootPlacement`). 기즈모 자세를 그대로 저장하면 Δ 가 이중 적용된다.
- 다중 선택 `primary` 피벗의 세컨더리 위치는 배치 프레임(`writeRootPlacement`)으로 써넣고 개별 스냅하지 않는다.
- 노드 박스·실루엣 포털은 대상 `uuid` 를 key 로 재마운트한다.
- 인스펙터 안의 수치 계산은 `packages/widgets/src/3d/lib/` 로 뺀다(`zone-editor.ts`, `tag-mapping-editor.ts` 선례) — 공통 규칙 "`ui/*.tsx` 안 수치 계산 금지".
- 씬 객체 종류를 새로 만들면 id 를 모델·텍스트·눈금과 같은 집합에서 발급한다(`sanitizeSceneInfo` 의 `seenIds`). 선택·기즈모·레지스트리가 id 하나로 객체를 찾는다.
- `SavedRulerInfo`·`SavedRulerGuide` 에 필드를 추가하면 `sanitize-rulers.ts` 와 `scene-snapshot.ts` 의 `isRulerInfoEqual`·`isRulerGuideEqual` 을 함께 고친다. 기본값은 저장하지 않는다(시작 값 0·단위 표시·점과 글자의 기본 크기·보조선 왼쪽·불투명도 1).
- 눈금의 점·글자 transform 은 React 가 아니라 렌더 코드가 DOM 에 직접 쓴다(`scene-ruler.tsx` 의 `writeLabelTransform`). 점의 중심을 바꾸는 옵션은 프레임을 기다리지 않고 렌더에서 바로 다시 쓴다 — 캔버스가 demand 라 다음 프레임이 바로 오지 않는다.
- 모델 라벨과 눈금의 거리 축소·숨김 기준은 `label-scale.ts` 하나다. 한쪽만 다른 거리·배율을 쓰지 않는다.
- 눈금 옵션을 고치는 함수는 값이 같으면 같은 참조를 돌려준다(`ruler-editor.ts` 의 `withRuler*`). 새 옵션도 같은 규칙으로 만든다 — 아니면 히스토리·dirty 가 오염된다.
- 눈금 보조선은 `renderOrder ≥ 0.5` 로 둔다(바다 위 오버레이 규칙, `docs/agents/rendering-perf.md`).

## 하지 않기로 한 것

- three `TransformControls` 의 `*Snap` — local 공간에서는 격자가 객체의 회전 프레임에 놓여 yaw 로 돌아간 모델의 X·Z 저장값이 격자를 벗어나고, world 회전은 델타 기준이라 시작 소수점이 남는다.
- 탑뷰용 `camera.up` 변경 — OrbitControls 극점이 틀어져 회전이 어색하고, `{position, target}` 만 저장하는 포즈(포커스 복귀·북마크·`SavedCameraInfo`)가 up 을 되살릴 수 없어 복원 시 화면이 돌아간다.
- 다중 선택용 임시 Group 재부모화·프록시 객체 — `ModelMesh` 가 래퍼 group 을 의도적으로 걷어낸 구조라(리그 rest·선택 박스 포털이 씬 그래프 상속에 기댐) 재부모화가 그것과 충돌한다.
- 미등록 region 의 기본 씬 파일 fallback — 남의 씬을 덮어쓴 사고의 원인.
- `server.watch.ignored` 로 dev 저장 디렉토리 무시 — 기동 후 생긴 파일이 404.
- 안쪽 노드에 기즈모·다중 선택·`meshOverrides` 생성 — 읽기 전용으로 유지.
- 에디터에서 `meshOverrides` 를 새로 만드는 것 — 렌더 전용 데이터.
- 눈금을 누른 채 끌어서 그리기 — 왼쪽 드래그는 마퀴, 가운데·오른쪽 드래그는 카메라라 겹치고, 긴 레일은 시작점을 찍은 뒤 카메라를 옮겨야 끝점을 찍을 수 있다.
- 뷰를 계층 목록의 씬 객체(카메라 기즈모)로 두기 — 선택·기즈모·id 발급까지 끌려 들어온다. 뷰 탭의 목록으로 충분하다.
- 에디터 안 분할 미리보기 — 축 기즈모(drei Hud)가 렌더를 넘겨받는 캔버스라 분할 렌더러와 충돌한다. 분할은 모니터링에서 본다.
- 눈금을 지도 GLB 에 굽거나 깊이 테스트 없는 오버레이로 그리기 — 앞쪽은 에디터에서 저작할 수 없고, 뒤쪽은 선이 크레인·선박을 뚫고 보인다.
- 눈금 보조선에 `polygonOffset` — 로그 깊이에서는 무시된다. 바닥에서 띄운다.
- 눈금의 중심선·"선" 표시 방식 — 점에 보조선을 더하는 옵션으로 바꿨다. 점을 가운데 두고 양쪽으로 뻗는 가로 선도 두지 않는다.
- 눈금 간격의 자유 입력 — 고를 수 있는 값만 받는다.
- 눈금 숫자를 태그 값에서 가져오기 — 눈금은 씬 거리다. PLC 값은 모델 라벨의 태그 값 줄이 보인다(`docs/agents/tag-mapping-rig.md`).

## 미룬 것

- 눈금: 끝점을 끌어서 길이 바꾸기, 복제, 지형 굴곡을 따라 붙이기, m 외 단위 환산.
- 눈금은 미니맵 재캡처 조건에 없다 — 보조선은 캡처 시점의 것만 미니맵 배경에 찍힌다.
