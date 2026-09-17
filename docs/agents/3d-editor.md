# 3D 씬 에디터

씬 편집 페이지(`3d-viewer-edit`)의 저장 경로, 카메라·탑뷰 규약, 기즈모 스냅·다중 선택 피벗·루트 rest handoff, 노드 선택 표시, region → 씬 파일 매핑.

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
| dev 저장 미들웨어 / public 자산 리로드 | `apps/shell/vite.config.ts`, `apps/shell/vite-plugin-asset-hash.ts`, `packages/domain/src/3d/lib/scene-dev-storage.ts` |
| 탑뷰 포즈(정수직 회피 tilt, 뷰어·에디터 공용) | `packages/core/src/lib/top-view-pose.ts`(`computeTopViewPose`, `ensureTopViewTilt`, 테스트 대상) |
| 기즈모 스냅 / 다중 선택 피벗 | `packages/features/src/3d/lib/snap-transform.ts`, `packages/widgets/src/3d/lib/pivot-transform.ts`, `packages/features/src/3d/ui/scene-transform-pivot-menu.tsx`, `packages/features/src/3d/model/use-scene-editor-view-store.ts` |
| 루트 Δ 벗기기 / 배치 프레임 | `packages/features/src/3d/lib/strip-channel-delta.ts`, `packages/features/src/3d/model/root-placement.ts`, `packages/features/src/3d/model/use-rig-driver.ts` |
| 선택 표시(박스·실루엣) | `packages/domain/src/3d/lib/selection-bounding-box.ts`, `packages/domain/src/3d/lib/silhouette-outline.ts`, `packages/domain/src/3d/ui/gltf-model.tsx`, `packages/domain/src/3d/ui/model-mesh.tsx` |
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

### 콤보박스 규약

`packages/ui/src/molecules/combobox.tsx` 는 base-ui `Combobox` 래핑이며 `usePortalContainer()` 로 포털하고 `z-9999` 를 쓴다. 인스펙터 안의 새 드롭다운은 이 규약을 따른다.

## 불변식

- 카메라 `up` 은 항상 +Y. 탑뷰는 `ensureTopViewTilt`/`TOP_VIEW_TILT` 로 만들고, 포즈를 적용하는 새 경로는 `ensureTopViewTilt` 로 정규화한다.
- 기즈모·스테퍼 스냅은 `snap-transform.ts` 순수 함수 한 곳. three `TransformControls` 의 `translationSnap`/`rotationSnap`/`scaleSnap` 은 쓰지 않는다.
- 씬 스키마에 필드를 추가하면 `sanitize-scene-info.ts`(또는 해당 `sanitize-*`)와 `scene-snapshot.ts` 의 동등 비교를 함께 고친다. 빠지면 편집이 동등 단락에 먹혀 dirty 가 서지 않고 저장되지 않는다(`isZoneListEqual` 이 선례 — `docs/agents/3d-zone.md`).
- region → 씬 파일 표는 `scene-file-map.ts` 하나. 미등록 region 은 `null`, 기본 파일 fallback 금지.
- 새 dev 저장 미들웨어를 만들면 쓰는 디렉토리를 `DEV_WRITTEN_DIRS` 에 추가한다. `server.watch.ignored` 로 막지 않는다.
- 루트 맵핑 모델의 배치값을 읽는 새 경로는 `rootDeltas` 를 벗겨야 한다(`readRootPlacement`). 기즈모 자세를 그대로 저장하면 Δ 가 이중 적용된다.
- 다중 선택 `primary` 피벗의 세컨더리 위치는 배치 프레임(`writeRootPlacement`)으로 써넣고 개별 스냅하지 않는다.
- 노드 박스·실루엣 포털은 대상 `uuid` 를 key 로 재마운트한다.
- 인스펙터 안의 수치 계산은 `packages/widgets/src/3d/lib/` 로 뺀다(`zone-editor.ts`, `tag-mapping-editor.ts` 선례) — 공통 규칙 "`ui/*.tsx` 안 수치 계산 금지".

## 하지 않기로 한 것

- three `TransformControls` 의 `*Snap` — local 공간에서는 격자가 객체의 회전 프레임에 놓여 yaw 로 돌아간 모델의 X·Z 저장값이 격자를 벗어나고, world 회전은 델타 기준이라 시작 소수점이 남는다.
- 탑뷰용 `camera.up` 변경 — OrbitControls 극점이 틀어져 회전이 어색하고, `{position, target}` 만 저장하는 포즈(포커스 복귀·북마크·`SavedCameraInfo`)가 up 을 되살릴 수 없어 복원 시 화면이 돌아간다.
- 다중 선택용 임시 Group 재부모화·프록시 객체 — `ModelMesh` 가 래퍼 group 을 의도적으로 걷어낸 구조라(리그 rest·선택 박스 포털이 씬 그래프 상속에 기댐) 재부모화가 그것과 충돌한다.
- 미등록 region 의 기본 씬 파일 fallback — 남의 씬을 덮어쓴 사고의 원인.
- `server.watch.ignored` 로 dev 저장 디렉토리 무시 — 기동 후 생긴 파일이 404.
- 안쪽 노드에 기즈모·다중 선택·`meshOverrides` 생성 — 읽기 전용으로 유지.
- 에디터에서 `meshOverrides` 를 새로 만드는 것 — 렌더 전용 데이터.
