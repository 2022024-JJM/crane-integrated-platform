# GLB 자산 파이프라인 — 압축·원본 보관, 지형 타일·LOD, KTX2, philly 지도 3장, 썸네일

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

자산 파일을 반입·교체·최적화하는 절차와 그 산출물이 런타임에서 어떻게 읽히는지 적는다. 런타임 렌더 절감(DPR·Lambert·스텐실)은 `docs/agents/rendering-perf.md`, 씬 안 배치·드롭은 `docs/agents/3d-editor.md`.

## 진입점

| 관심사 | 위치 |
|---|---|
| 배포 GLB(압축본) | `apps/shell/public/models/`, `apps/shell/public/maps/` |
| 압축 전 원본 보관 | `assets-src/models/`, `assets-src/maps/` (+ `.nolod`·`.orig` 부산물), 절차 전문 `assets-src/README.md` |
| 모델 압축 `pnpm optimize:glb <파일>` | `scripts/optimize-glb.mjs` — 원본을 `assets-src/` 로 자동 백업 |
| 지도 압축 `pnpm optimize:map <파일>` | `scripts/optimize-map.mjs` — 파일명 인자 필수(없으면 모든 지도가 대상) |
| 지형 타일+LOD `node scripts/tile-terrain-glb.mjs --lod` | `scripts/tile-terrain-glb.mjs` |
| 모델 거리별 LOD `node scripts/add-model-lod.mjs <파일>` | `scripts/add-model-lod.mjs` — 이어서 `pnpm optimize:glb` 필수 |
| 정적 모델 프리미티브 병합 `node scripts/join-static-glb.mjs <파일>` | `scripts/join-static-glb.mjs` — 이어서 `pnpm optimize:glb` |
| 단색 텍스처 축소 | `scripts/shrink-flat-textures.mjs` |
| KTX2 인코딩 `node scripts/encode-ktx2.mjs <입력> <출력> [--srgb-only]` | `scripts/encode-ktx2.mjs`, 디코드 배선 `packages/domain/src/3d/lib/ktx2-loader.ts`(`extendGltfLoaderWithKtx2`), 트랜스코더 `apps/shell/public/basis/r<three REVISION>/` |
| 베이크된 월드 좌표 복원 | `scripts/unbake-goliath-crane.mjs`(골리앗 전용), `scripts/unbake-root-transform.mjs`(범용, `--fold-scale`) |
| 씬별 드로우콜·삼각형·VRAM 진단 `pnpm perf:scene [씬.json] [--json]` | `scripts/scene-perf-report.mjs` — 항상 exit 0, 게이트 아님 |
| LOD 런타임 전환 | `packages/features/src/3d/ui/scene-terrain-lod.tsx`(`SceneTerrainLod`), 수식 `lib/terrain-lod.ts`, 숨김 처리 `packages/domain/src/3d/ui/model-mesh.tsx`(`terrainLodProxy`) |
| 지도 카탈로그(`kind: 'ground' | 'context'`, `defaultPosition`) | `packages/domain/src/3d/model/scene-map-catalog.ts` |
| 드롭 바닥 지도 판정 | `packages/domain/src/3d/lib/resolve-ground-map.ts`(`resolveGroundMaps`), 사용 `packages/widgets/src/3d/ui/use-scene-drop.ts` |
| 카메라 범위 기준 지도 | `packages/domain/src/3d/lib/camera-bounds-maps.ts`(`resolveCameraBoundsMaps`) — 상세 `docs/agents/monitoring-ui.md` |
| 팔레트 맵 타일 상태 | `packages/widgets/src/3d/lib/map-palette-tiles.ts`, `packages/widgets/src/3d/ui/palette-map-section.tsx` |
| 모델 카탈로그·팔레트 썸네일 | `packages/domain/src/3d/model/scene-model-catalog.ts`(`sceneModelCatalog`), `apps/shell/public/previews/{catalogId}.png`, 폴백 렌더 `packages/widgets/src/3d/lib/offscreen-preview-renderer.ts`, 재생성 `packages/widgets/src/3d/ui/preview-thumbnail-generator.tsx` |
| 파이프라인 상세 문서 | `docs/지도-GLB-최적화-파이프라인.md`, `docs/GLB-압축-파이프라인-작업보고.md` |

## 동작

### 배포본과 원본

GLB 는 압축본만 `apps/shell/public/{models,maps}/` 에 배포되고, 압축 전 원본은 `assets-src/` 에 보관한다. 압축은 되돌릴 수 없으므로 이 디렉토리를 지우지 않는다.

- 신규 반입: `public/` 에 놓고 `pnpm optimize:glb <파일>`(지도는 `pnpm optimize:map <파일>`). 원본이 `assets-src/` 로 자동 백업된다.
- 루트 Empty 에 uniform scale 이 실린 리깅본(`LLC_002.glb`)은 `unbake-root-transform.mjs --fold-scale` 로 scale 을 직계 자식에 접어 넣는다. 출력 파일명은 입력 basename 이라 교체 시 먼저 기존 파일명으로 맞춘다.
- **기존 파일 교체는 순서가 반대다.** 스크립트가 백업본을 원본으로 취급하므로 새 버전을 `assets-src/` 에 먼저 넣고 실행한다. `public/` 에 덮어쓰고 실행하면 옛 백업이 새 파일을 되돌린다.
- 예외: `assets-src/maps/` 의 `philly-terrain.glb`·`okpo.glb`·`okpo-terrain.glb`·`okpo-tree.glb` 는 GitHub 100MB 한도를 넘어 **커밋하지 않는다**(`.gitignore`). 원본은 컨플루언스에서 별도 관리하며, 재압축·롤백은 거기서 받아 `assets-src/maps/` 에 놓고 돌린다. 반입 명령은 `assets-src/README.md`.
- Blender export 에 월드 좌표가 베이크돼 오면 `unbake-goliath-crane.mjs` 또는 `unbake-root-transform.mjs` 로 원점을 복원한 뒤 압축한다. 그냥 등록하면 존·기즈모가 수 km 어긋난다.
- `pnpm optimize:glb` 는 join/prune 을 쓰지 않아 Empty 계층·노드 이름이 보존된다(리깅 자산의 전제 — `docs/agents/tag-mapping-rig.md`).
- `pnpm optimize:glb` 는 지도 파이프라인과 같이 `KHR_materials_transmission` 을 알파 블렌딩 반투명으로 치환한다(`stripTransmission`). transmission 머티리얼 하나가 씬 전체를 한 번 더 그리게 만들기 때문이며, 배포 모델에는 이 확장이 남아 있지 않다.
- GLB/씬 자산을 추가하면 삼각형 수·텍스처 VRAM·로딩 시간 영향을 직접 확인한다. 자동화된 성능 게이트는 **없다**. `pnpm perf:scene` 은 진단 리포트일 뿐(경고와 join 후보 표기, LOD>0 노드는 렌더 집계에서 제외)이며 모델 추가·교체 후 한 번 돌려 본다.
- 카탈로그(`sceneModelCatalog`)에 없어도 런타임이 직접 로드하는 GLB 가 있다: `crane.glb`·`gantry_crane.glb`·`TTC-27.glb`(자산 크레인 타입 → 모델 표 `packages/domain/src/3d/model/crane-type-model.ts`, `packages/widgets/src/goliath-crane/ui/goliath-3d-viewer.tsx`), `goliath_crane_body.glb`·`goliath_crane_trolley.glb`(`crane-zone-config.ts` parts), `man.glb`·`car.glb`·`fork_lift.glb`(충돌 가드 시뮬레이션 `collision-guard-object-model.tsx`). 씬 JSON·카탈로그만 보고 GLB 를 지우지 않는다.

### philly-terrain: 공간 타일 + LOD 체인

배포된 `philly-terrain.glb` 는 `tile-terrain-glb.mjs --lod` 의 산출물이다.

- 8×8 공간 타일(64) × LOD0~3 형제 노드, extras `{tile, lod, lodError}`. 무텍스처 머티리얼은 COLOR_0 정점색으로 1개 병합하고 텍스처 머티리얼(overlay·Vegetation Area)은 유지한다(타일당 최대 3 프리미티브). LOD0 은 삼각형·bbox 완전 보존, LOD1~3 은 정점 accessor 를 LOD0 과 공유하고 인덱스만 별도.
- 단일 노드 시절엔 frustum 컬링이 전무해 어느 방위든 전량 렌더였고, 타일+LOD 로 최악 방위에서도 크게 줄었다 — 타일 구조를 유지하는 이유.
- **이 파일에 `pnpm optimize:map` 재실행 금지** — 데시메이션·정리 스테이지가 타일·LOD·정점색을 훼손한다.
- 재반입 순서: 컨플루언스 원본 → `pnpm optimize:map philly-terrain.glb` → `node scripts/tile-terrain-glb.mjs --lod`.
- 텍스처 머티리얼은 정점색으로 병합되지 않아 드로우콜이 타일 × 머티리얼로 는다. 텍스처 머티리얼이 많은 지형은 `--grid` 를 줄인다(옥포 두 장은 4).

### 옥포 지도 3장

`okpo.glb`(야드, `ground`)·`okpo-terrain.glb`·`okpo-tree.glb`(둘 다 `context`, 4×4 타일 + LOD)는 같은 좌표계이고 카탈로그 `defaultPosition` 이 야드 슬래브를 y=0 에 맞춘 값이다 — 한 장을 옮기면 나머지도 같은 양만큼 옮긴다. Tree 는 잎이 양면 alpha 카드라 `KEEP_DOUBLE_SIDED=1` 로 압축하고, 야드는 머티리얼이 많아 타일화하지 않는다. 명령·배치값 유도·실측은 `assets-src/README.md`.

### 런타임 LOD 전환

`SceneTerrainLod`(세 캔버스에 마운트)가 스크린 오차(`terrain-lod.ts`, `TERRAIN_LOD_THRESHOLD_PX` 미만 레벨 선택)로 레벨을 고른다. 모델 LOD 그룹은 매 프레임 LOD0 월드 위치로 거리를 재 주행하는 크레인도 따라간다.

- LOD>0 노드는 clone 시점에 숨김+raycast 제외되며(`model-mesh.tsx`, `terrainLodProxy` 표식) **최상위 캐리어만** 끈다. GLTFLoader 가 extras 를 다중 프리미티브의 자식 Mesh 에도 복제하므로 자식까지 끄면 그룹을 켜도 타일이 사라진다.
- raycast·BVH·실루엣 테두리·충돌은 항상 LOD0 담당이라 표면 높이·드롭·클릭은 LOD 상태와 무관하다.

### 모델 LOD

`node scripts/add-model-lod.mjs <파일>` 이 `assets-src/models/<파일>` 현재본에 거리별 LOD 체인을 형제 노드로 붙인다(extras `{lodGroup, lod, lodError}`, 지형 타일 LOD 와 같은 계약이라 `SceneTerrainLod` 가 그대로 전환). 기존 노드 뒤에만 붙여 `[index]name` 메쉬 경로가 변하지 않고, 정점 accessor 는 공유·인덱스만 추가라 파일 증가는 작다.

- **거부 조건**: 어떤 씬에서든 그 모델에 `meshOverrides`·내부 노드 대상 `tagMappings`·`rigId` 가 있거나 GLB 에 skin·animation 이 있으면 스크립트가 거부한다 — LOD 사본이 구동을 못 따라간다(`goliath_crane` 이 그 예). 노드당 `MIN_NODE_TRIS` 미만은 대상 아님(Block 류).
- 이어서 `pnpm optimize:glb <파일>` 필수. LOD 전 원본은 `assets-src/models/<파일>.nolod` — 자산을 새 버전으로 교체할 때 함께 지운다.
- 적용됨: TTC-27·gantry_crane·crane·hanwha-ocean-lngc-174k.

### 정적 장식 모델의 프리미티브 병합

노드 수백~수천 개인데 `meshOverrides`·내부 노드 `tagMappings`·리그 참조가 전혀 없는 모델은 `node scripts/join-static-glb.mjs <파일>` 로 프리미티브를 병합한 뒤 `pnpm optimize:glb <파일>` 를 이어 돌린다. 노드 계층이 사라지므로 위 참조가 하나라도 있으면 **금지** — 판정 기준은 스크립트 주석, 적격 여부는 `pnpm perf:scene` 이 자동 판정한다. 병합 전 계층 원본은 `assets-src/models/<파일>.orig`. 선례: `hanwha-ocean-lngc-174k.glb` 드로우콜 2,193→11, `crane.glb` 91→7.

### 단색 텍스처

`node scripts/shrink-flat-textures.mjs <파일>` 은 진짜 단색(모든 픽셀 동일) 텍스처만 4×4 로 무손실 축소한다. `pnpm perf:scene` 의 FLAT_TEXTURE 경고는 파일 크기 기반 **후보**일 뿐 오탐이 있다(`crane.glb` 의 소형 webp 들은 실제 콘텐츠였다) — 이 스크립트의 픽셀 검증이 최종 판정이며, 불균일이면 건드리지 않는다.

### KTX2(GPU 압축 텍스처)

디코드 배선은 완료 상태다. 모든 GLTF 로드 경로가 `extendGltfLoaderWithKtx2`(`ktx2-loader.ts`)를 물고 있고, 트랜스코더는 `apps/shell/public/basis/r<three REVISION>/` 에 커밋돼 있다 — three 업그레이드 시 새 REVISION 디렉터리로 재복사하고 옛 디렉터리를 지운다(경로에 버전을 넣어 고정 URL stale 캐시를 막는다, `ktx2-loader.ts` 주석).

에셋 변환은 `node scripts/encode-ktx2.mjs <입력> <출력> [--srgb-only]`(UASTC+zstd, 슬롯별 sRGB/normal 프리셋). UASTC 는 고품질이지만 무손실이 아니고 파일이 커진다(실측 VRAM 은 크게 줄고 파일은 늘었다) — 실 운영 장비에서 육안 A/B·BC7 지원 확인 전에 배포 GLB 를 일괄 전환하지 않는다.

### philly 두 씬의 지도 3장

`goliath.json`·`philly-2dock.json` 은 지도가 3장이다. 조선소 두 장(`philly-area-1.glb`·`philly-area-2.glb`, 옛 단일 지도를 분할한 것으로 좌표계가 같아 옛 배치값을 공유)과 주변 지형(`philly-terrain.glb`, 조선소 자리가 구멍으로 잘린 시 전역 OSM 지형).

- 에디터 팔레트 "맵" 탭은 타일별 **추가/제거 토글**이라 지도를 여러 장 놓을 수 있다(`addSceneMap` append, 제거는 `deletePlacedMap`, 같은 경로는 한 장). 터레인도 카탈로그에 `kind: 'context'` + `defaultPosition`(goliath 기준 오프셋)으로 등록돼 있다. 타일 상태 파생은 `map-palette-tiles.ts`. 잠긴 지도 타일은 클릭을 무시하고 계층 목록·타일 자물쇠로 해제한다.
- 드롭 raycast 의 바닥 지도는 배열 인덱스가 아니라 카탈로그 `kind` 로 판정한다(`resolveGroundMaps`: `ground` 전부 — 분할 지도 대응, 없으면 `maps[0]` 한 장 폴백). `use-scene-drop.ts` 가 그 전부를 `intersectObjects` 해 최근접 표면을 쓴다.
- 카메라 이동 범위·탑뷰 bounds 는 kind 가 아니라 씬 데이터 `cameraBounds`(인스펙터 카메라 탭)로 고른다 — 폭 수 km 컨텍스트 지형이 탑뷰 프레이밍을 잡아먹지 않게 하는 구분. 두 씬 모두 조선소 두 장만 체크돼 있다. 상세는 `docs/agents/monitoring-ui.md`.
- 터레인 배치값은 디자이너 Blender 씬의 조선소 오프셋을 보정한 값이라 조선소 지도를 다시 반입해 좌표계가 바뀌면 터레인도 함께 옮긴다.

### 모델 팔레트 썸네일

정적 썸네일 `apps/shell/public/previews/{catalogId}.png` 을 먼저 쓰고, 없으면 런타임 offscreen WebGL 렌더(`offscreen-preview-renderer.ts`)로 폴백한다. `sceneModelCatalog` 항목을 추가·교체하거나 미리보기 렌더 룩을 바꾸면 dev 서버의 씬 편집 페이지 모델 탭에서 썸네일 버튼(dev 전용 토글)으로 재생성해 `public/previews/` 를 함께 커밋한다. 썸네일은 투명 배경 PNG 로 테마 중립이어야 한다 — 씬에 배경·바닥판을 굽지 않는다.

## 불변식

- **새 GLTF 로드 경로(`useGLTF`·`GLTFLoader`)를 추가하면 반드시 `extendGltfLoaderWithKtx2` 를 함께 건다.** 누락된 경로가 KTX2 GLB 를 열면 통째로 throw 된다. 불투명 머티리얼이면 `markSceneOpaqueStencil` 도 켠다(`docs/agents/rendering-perf.md`).
- **기존 GLB 교체는 `assets-src/` 에 새 버전을 먼저 넣고 스크립트를 돈다.** `public/` 에 덮어쓰면 옛 백업이 되돌린다.
- **`philly-terrain.glb` 에 `pnpm optimize:map` 재실행 금지.** 재반입은 원본 → `optimize:map`(파일명 지정) → `tile-terrain-glb --lod` 순서.
- `pnpm optimize:map` 은 항상 파일명을 지정한다 — 인자 없이 돌리면 모든 지도가 대상.
- 잎 카드처럼 양면 alpha 머티리얼이 있는 지도는 `KEEP_DOUBLE_SIDED=1` 로 돌린다. 단면화는 머티리얼을 가리지 않는다.
- 타일·LOD 가 적용된 `okpo-terrain.glb`·`okpo-tree.glb` 도 `philly-terrain.glb` 와 같다 — 원본 없이 `optimize:map` 을 돌리지 않고, 재반입은 원본 → `optimize:map` → `tile-terrain-glb --grid=4 --lod` 순서.
- `add-model-lod`·`join-static-glb` 뒤에는 `pnpm optimize:glb <파일>` 을 이어 돌린다.
- `meshOverrides`·내부 노드 `tagMappings`·`rigId`·skin 이 있는 모델에 LOD·join 을 걸지 않는다(스크립트가 거부하지만 손으로도 지킨다).
- 자산을 새 버전으로 교체할 때 `assets-src/models/<파일>.nolod`·`.orig` 도 함께 갱신·삭제한다.
- LOD 노드 숨김은 최상위 캐리어만 — 자식 Mesh 의 복제된 extras 로 끄지 않는다.
- three 를 업그레이드하면 `apps/shell/public/basis/r<REVISION>/` 을 새 REVISION 으로 재복사한다.
- `sceneModelCatalog` 변경·미리보기 룩 변경 시 `public/previews/` 를 재생성해 함께 커밋한다.
- GLB 를 지우기 전에 씬 JSON·카탈로그뿐 아니라 코드 참조(`grep -rn <파일명> packages apps scripts`)까지 확인한다 — 카탈로그 밖에서 직접 로드하는 GLB 목록은 위 "배포본과 원본".
- 새 카탈로그 지도는 `kind` 를 정한다 — `ground` 는 드롭 바닥·(체크 시) 카메라 기준, `context` 는 Lambert·LOD·그림자 제외 규칙을 받는다.
- 배포 GLB 를 KTX2 로 일괄 전환하지 않는다(운영 장비 육안 A/B·BC7 확인 전).

## 하지 않기로 한 것

- **단일 노드 지형** — frustum 컬링이 안 걸려 어느 방위든 전량 렌더. 타일+LOD 로 대체.
- **지형 LOD 를 `optimize:map` 데시메이션으로** — 타일·LOD·정점색이 훼손된다. 전용 스크립트만 쓴다.
- **`public/` 에 덮어쓴 뒤 압축** — 백업본이 원본으로 취급돼 새 파일이 되돌아간다.
- **베이크된 월드 좌표 그대로 등록** — 존·기즈모가 수 km 어긋난다. unbake 먼저.
- **FLAT_TEXTURE 경고만 보고 텍스처 축소** — 파일 크기 기반 후보라 오탐. 픽셀 검증 스크립트가 최종.
- **`philly-terrain.glb` 원본 커밋** — 100MB 한도 초과. 컨플루언스 관리.
- **모델 LOD 를 첫 노드 앞에 삽입** — `[index]name` 메쉬 경로가 바뀌어 meshOverrides·맵핑이 깨진다. 기존 노드 뒤에만 붙인다.

## 미룬 것

- 지도 KTX2 전환(운영 장비 확인 후), 타워크레인 데시메이션/LOD 확대.
