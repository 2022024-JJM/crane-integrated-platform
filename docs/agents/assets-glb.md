# GLB 자산 파이프라인 — 등록 시 최적화·원본 보관, 지형 타일·LOD, KTX2, philly 지도 3장

> 이 문서는 현재 상태만 적는다. 갱신은 덧붙이기가 아니라 덮어쓰기. 날짜·경위·사라진 UI 는 쓰지 않는다.

자산 파일을 최적화하는 파이프라인과 그 산출물이 런타임에서 어떻게 읽히는지 적는다. 자산을 등록하고 버전을 올리고 씬에 반영하는 길은 `docs/agents/asset-library.md`, 런타임 렌더 절감(DPR·Lambert·스텐실)은 `docs/agents/rendering-perf.md`, 씬 안 배치·드롭은 `docs/agents/3d-editor.md`.

## 진입점

| 관심사 | 위치 |
|---|---|
| 배포 GLB(압축본) | 새 버전은 `apps/shell/public/asset-library/files/<id>/v<N>/`, 라이브러리 디렉터리 이전부터 있던 버전 1 은 `apps/shell/public/models/`·`apps/shell/public/maps/` |
| 압축 전 원본 보관 | 등록분 `assets-src/asset-library/<id>/v<N>/`, 옛 경로 파일의 원본 `assets-src/models/`·`assets-src/maps/`(+ `.nolod`·`.orig` 부산물), 절차 전문 `assets-src/README.md` |
| 모델 최적화 `node scripts/optimize-glb.mjs --single <입력> <출력> [--report <json>]` | `scripts/optimize-glb.mjs` — 파일 하나를 받아 하나를 낸다. 자산 등록 화면의 최적화가 돌린다 |
| 지도 최적화 `node scripts/optimize-map.mjs --single <입력> <출력> [--report <json>]` | `scripts/optimize-map.mjs` — 같은 형태. 타일·LOD 까지 스스로 정해 이어 돌린다 |
| 지도 동일 평면 겹침 검사 `node scripts/audit-map-layers.mjs <파일>` | `scripts/audit-map-layers.mjs` — 진단 전용(항상 exit 0). 지도 파이프라인이 같은 함수로 표시를 띄우고 출력을 검증한다 |
| 지형 타일+LOD `node scripts/tile-terrain-glb.mjs <입력> <출력> [--grid=N] [--lod]` | `scripts/tile-terrain-glb.mjs` — 지도 파이프라인이 조건이 맞으면 이어 돌린다 |
| 모델 거리별 LOD `node scripts/add-model-lod.mjs <파일>` | `scripts/add-model-lod.mjs` — 올리기 전에 원본을 가공한다 |
| 정적 모델 프리미티브 병합 `node scripts/join-static-glb.mjs <파일>` | `scripts/join-static-glb.mjs` — 올리기 전에 원본을 가공한다 |
| 단색 텍스처 축소 | `scripts/shrink-flat-textures.mjs`(`shrinkFlatTextures`) — 지도 파이프라인이 첫 단계로 부른다 |
| KTX2 인코딩 `node scripts/encode-ktx2.mjs <입력> <출력> [--srgb-only]` | `scripts/encode-ktx2.mjs`, 디코드 배선 `packages/domain/src/3d/lib/ktx2-loader.ts`(`extendGltfLoaderWithKtx2`), 트랜스코더 `apps/shell/public/basis/r<three REVISION>/` |
| 베이크된 월드 좌표 복원 | `scripts/unbake-goliath-crane.mjs`(골리앗 전용), `scripts/unbake-root-transform.mjs`(범용, `--fold-scale`) |
| 씬별 드로우콜·삼각형·VRAM 진단 `pnpm perf:scene [씬.json] [--json]` | `scripts/scene-perf-report.mjs` — 항상 exit 0, 게이트 아님 |
| LOD 런타임 전환 | `packages/features/src/3d/ui/scene-terrain-lod.tsx`(`SceneTerrainLod`), 수식 `lib/terrain-lod.ts`, 숨김 처리 `packages/domain/src/3d/ui/model-mesh.tsx`(`terrainLodProxy`) |
| 지도의 역할(바닥·주변 지형)·기본 위치 | 자산의 배치 속성(`docs/agents/asset-library.md`) → 놓을 때 씬의 `SavedMapInfo.role`·`position` 으로 복사 |
| 드롭 바닥 지도·주변 지형 판정 | `packages/domain/src/3d/lib/resolve-ground-map.ts`(`resolveGroundMaps`·`isContextMap`), 사용 `packages/widgets/src/3d/ui/use-scene-drop.ts` |
| 카메라 범위 기준 지도 | `packages/domain/src/3d/lib/camera-bounds-maps.ts`(`resolveCameraBoundsMaps`) — 상세 `docs/agents/monitoring-ui.md` |
| 팔레트 맵 타일 상태 | `packages/widgets/src/3d/lib/map-palette-tiles.ts`, `packages/widgets/src/3d/ui/palette-map-section.tsx`(바다 표시 스위치도 이 절에 있다 — `docs/agents/3d-editor.md`) |
| 팔레트 썸네일 | 자산 라이브러리의 썸네일(`/asset-library/thumbnails/<id>.png`), 없을 때의 폴백 렌더 `packages/widgets/src/3d/lib/offscreen-preview-renderer.ts` |
| 스테이지별 튜닝 근거(도입 시점의 기록 — 명령·절차는 이 문서가 맞다) | `docs/지도-GLB-최적화-파이프라인.md`, `docs/GLB-압축-파이프라인-작업보고.md` |

## 동작

### 배포본과 원본

GLB 는 압축본만 배포되고, 압축 전 원본은 `assets-src/` 에 보관한다. 압축은 되돌릴 수 없으므로 이 디렉토리를 지우지 않는다.

- **파일은 자산 라이브러리로만 들어간다.** 등록하거나 새 버전을 올릴 때 "최적화" 를 켜면 dev 미들웨어가 그 종류의 스크립트를 돌려 압축본을 `files/<id>/v<N>/` 에, 올린 원본을 `assets-src/asset-library/<id>/v<N>/` 에 둔다. 배포 파일을 같은 경로에 덮어쓰는 길은 없다 — 스크립트에 그런 모드가 없다.
- 100MB 를 넘는 원본은 미들웨어가 `.gitignore` 에 올린다(GitHub 한도). 그런 원본은 컨플루언스에 따로 보관한다. `assets-src/maps/` 의 `philly-terrain.glb`·`okpo.glb`·`okpo-terrain.glb`·`okpo-tree.glb` 가 같은 이유로 커밋돼 있지 않다.
- 모델 파이프라인(`optimize-glb.mjs`)은 텍스처 상한·WebP·transmission 제거·meshopt 다. join/prune 을 쓰지 않아 Empty 계층·노드 이름이 보존된다(리깅 자산의 전제 — `docs/agents/tag-mapping-rig.md`). `KHR_materials_transmission` 은 알파 블렌딩 반투명으로 치환한다(`stripTransmission`) — 그 머티리얼 하나가 씬 전체를 한 번 더 그리게 만든다.
- **모델은 올리기 전에 손이 가야 하는 경우가 있다.** Blender export 에 월드 좌표가 베이크돼 오면 `unbake-goliath-crane.mjs` 또는 `unbake-root-transform.mjs` 로 원점을 복원한다(그냥 올리면 존·기즈모가 수 km 어긋난다). 루트 Empty 에 uniform scale 이 실린 리깅본(`LLC_002.glb`)은 `--fold-scale` 로 scale 을 직계 자식에 접어 넣는다. 거리별 LOD·정적 병합도 아래 절의 스크립트로 먼저 가공한다. 가공한 파일을 올린다.
- GLB/씬 자산을 추가하면 삼각형 수·텍스처 VRAM·로딩 시간 영향을 직접 확인한다. 자동화된 성능 게이트는 **없다**. `pnpm perf:scene` 은 진단 리포트일 뿐(경고와 join 후보 표기, LOD>0 노드는 렌더 집계에서 제외)이며 모델 추가·교체 후 한 번 돌려 본다.
- 씬에 놓이지 않고 화면 코드가 직접 로드하는 GLB 가 있다(자산 크레인 타입 표, 골리앗 부품, 충돌 가드 객체). 목록은 `CODE_ASSETS`(`packages/domain/src/3d/model/code-asset-refs.ts`)이고 자산 라이브러리가 그것을 사용처로 읽어 지우지 못하게 막는다.

### 지도 파이프라인의 자동 판단

지도는 지도마다 달리 다뤄야 하는 것이 있다. 등록하는 사람이 고르지 않고 `optimize-map.mjs` 가 파일을 재서 정한다. 무엇을 골랐는지는 보고에 적혀 등록 알림에 나온다.

- **루트 오프셋** — 루트 노드가 하나이고 이동만 실려 있으면 지운다. 지운 값은 새로 등록하는 지도의 기본 위치가 된다. 같은 지도의 새 버전도 같은 오프셋을 달고 오므로 매번 지워야 씬의 배치가 그대로 맞는다. 회전·스케일이 섞였거나 루트가 여럿이면 그대로 둔다.
- **단색 텍스처** — 모든 픽셀이 같은 텍스처만 4×4 로 줄인다.
- **양면 유지** — 불투명 머티리얼만 단면으로 만든다. 알파(MASK·BLEND) 머티리얼은 잎 카드처럼 뒷면이 보여야 하는 것이라 양면 그대로다.
- **지오메트리 압축(meshopt)** — 항상 건다. 양자화 그리드(지도 최대 폭 / 65535)보다 가깝게 얹힌 평면 표시는 압축 전에 그리드 정수 배만큼 띄워, 양자화로 두 층이 붙지 않게 한다(아래 절).
- **작은 지도** — 삼각형이 `SURGERY_MIN_TRIANGLES` 미만이면 모양을 고치지 않는다(단면화·평면 레이어 보호·데시메이션 생략). 줄일 것이 없고, 평면 한 장짜리 지도는 단면화하면 뒤에서 사라진다. 텍스처와 압축만 건다.
- **타일 + LOD** — 삼각형이 `TILE_MIN_TRIANGLES` 이상이고 "격자² × 타일당 프리미티브" 가 `TILE_DRAW_CALL_BUDGET` 안에 드는 가장 촘촘한 격자가 있을 때만 나눈다(`pickTileGrid`). 타일당 프리미티브는 텍스처 머티리얼 수 + (무텍스처가 있으면) 1 이다. 텍스처 머티리얼이 수십 개인 야드는 어느 격자도 예산에 들지 않아 나누지 않는다. 타일 분할이 실패하면 통짜 메시로 저장한다.

### 지도의 평면 레이어(차선·횡단보도) 보호

지도 파이프라인은 삼각형이 전부 수평면인 프리미티브를 평면 레이어로 보고 따로 다룬다. 판정은 머티리얼 이름이 아니라 지오메트리 실측이다(`audit-map-layers.mjs`).

- **simplify 제외** — 허용 오차보다 좁은 줄무늬가 쐐기로 접히고, 아스팔트가 차선 자리만큼 도려져 맞물린 경계(같은 높이지만 겹치지 않음)가 깨져 겹친다.
- **띄우기** — 다른 레이어 위에 양자화 그리드(최소 `COPLANAR_EPS`) 안쪽으로 얹힌 높이는 `OVERLAY_LIFT` 이상, 그리드의 정수 배만큼 올린다. 간격 0 인 겹침은 로그 깊이로도 갈리지 않아 카메라가 움직이는 동안 깜빡인다. 한 번 띄운 층이 그 위의 층과 다시 가까워질 수 있어 더 띄울 것이 없을 때까지 되풀이한다(`LIFT_PASSES_MAX`).
- **뒤집기** — 받치는 윗면 위 `OVERLAY_REACH` 안쪽의 아래 향한 면은 위로 뒤집는다(단면화로 사라지는 표시). 받치는 면이 없는 것은 가려 둔다.
- **출력 검증** — 양자화된 결과에서 겹침을 다시 잰다. 남은 얹힌 표시는 띄우기가 못 고치는 원본의 결함이라(평면이 아닌 바닥과 맞물린 표시 등) 저장을 막지 않고 보고에 경고로 남긴다. 로그의 "동일 평면 겹침" 중 "← 얹힌 표시" 표식이 없는 줄은 건물 모서리·타일 이음매의 국소 겹침이다.

### 지형의 공간 타일 + LOD 체인

타일로 나눈 지도(`philly-terrain.glb`·`okpo-terrain.glb`·`okpo-tree.glb`)는 `tile-terrain-glb.mjs --lod` 의 산출물이다.

- N×N 공간 타일 × LOD0~3 형제 노드, extras `{tile, lod, lodError}`. 무텍스처 머티리얼은 COLOR_0 정점색으로 1개 병합하고 텍스처 머티리얼은 유지한다. LOD0 은 삼각형·bbox 완전 보존, LOD1~3 은 정점 accessor 를 LOD0 과 공유하고 인덱스만 별도.
- 통짜 메시는 frustum 컬링이 걸리지 않아 어느 방위든 전량 렌더된다 — 타일로 나누는 이유.
- 타일 스크립트는 압축(양자화)이 끝난 파일을 받는다. 이미 타일로 나뉜 파일을 다시 지도 파이프라인에 넣지 않는다 — 데시메이션·정리 스테이지가 타일·LOD·정점색을 훼손한다. 새 버전은 항상 디자이너 원본에서 만든다.
- 텍스처 머티리얼은 정점색으로 병합되지 않아 드로우콜이 타일 × 머티리얼로 는다. 그래서 격자 수는 텍스처 머티리얼 수가 정한다(필리 지형 8, 옥포 두 장 4).

### 옥포 지도 3장

`okpo.glb`(야드, 바닥)·`okpo-terrain.glb`·`okpo-tree.glb`(둘 다 주변 지형, 4×4 타일 + LOD)는 같은 좌표계이고 자산의 기본 위치가 야드 슬래브를 y=0 에 맞춘 값이다 — 한 장을 옮기면 나머지도 같은 양만큼 옮긴다. Tree 는 잎이 양면 alpha 카드라 그 머티리얼이 양면으로 남고, 야드는 텍스처 머티리얼이 많아 타일로 나뉘지 않는다. 배치값 유도·실측은 `assets-src/README.md`.

### 런타임 LOD 전환

`SceneTerrainLod`(세 캔버스에 마운트)가 스크린 오차(`terrain-lod.ts`, `TERRAIN_LOD_THRESHOLD_PX` 미만 레벨 선택)로 레벨을 고른다. 모델 LOD 그룹은 매 프레임 LOD0 월드 위치로 거리를 재 주행하는 크레인도 따라간다.

- LOD>0 노드는 clone 시점에 숨김+raycast 제외되며(`model-mesh.tsx`, `terrainLodProxy` 표식) **최상위 캐리어만** 끈다. GLTFLoader 가 extras 를 다중 프리미티브의 자식 Mesh 에도 복제하므로 자식까지 끄면 그룹을 켜도 타일이 사라진다.
- raycast·BVH·실루엣 테두리·충돌은 항상 LOD0 담당이라 표면 높이·드롭·클릭은 LOD 상태와 무관하다.

### 모델 LOD

`node scripts/add-model-lod.mjs <파일>` 이 `assets-src/models/<파일>` 현재본에 거리별 LOD 체인을 형제 노드로 붙인다(extras `{lodGroup, lod, lodError}`, 지형 타일 LOD 와 같은 계약이라 `SceneTerrainLod` 가 그대로 전환). 기존 노드 뒤에만 붙여 `[index]name` 메쉬 경로가 변하지 않고, 정점 accessor 는 공유·인덱스만 추가라 파일 증가는 작다.

- **거부 조건**: 어떤 씬에서든 그 모델에 `meshOverrides`·내부 노드 대상 `tagMappings`·`rigId` 가 있거나 GLB 에 skin·animation 이 있으면 스크립트가 거부한다 — LOD 사본이 구동을 못 따라간다(`goliath_crane` 이 그 예). 노드당 `MIN_NODE_TRIS` 미만은 대상 아님(Block 류).
- 가공한 파일을 자산 라이브러리에서 새 버전으로 올린다(최적화 켬). LOD 전 원본은 `assets-src/models/<파일>.nolod` — 자산을 새 버전으로 교체할 때 함께 지운다.
- 적용됨: TTC-27·gantry_crane·crane·hanwha-ocean-lngc-174k.

### 정적 장식 모델의 프리미티브 병합

노드 수백~수천 개인데 `meshOverrides`·내부 노드 `tagMappings`·리그 참조가 전혀 없는 모델은 `node scripts/join-static-glb.mjs <파일>` 로 프리미티브를 병합한 뒤 그 파일을 자산 라이브러리에서 새 버전으로 올린다(최적화 켬). 노드 계층이 사라지므로 위 참조가 하나라도 있으면 **금지** — 판정 기준은 스크립트 주석, 적격 여부는 `pnpm perf:scene` 이 자동 판정한다. 병합 전 계층 원본은 `assets-src/models/<파일>.orig`. 선례: `hanwha-ocean-lngc-174k.glb` 드로우콜 2,193→11, `crane.glb` 91→7.

### 단색 텍스처

`node scripts/shrink-flat-textures.mjs <파일>` 은 진짜 단색(모든 픽셀 동일) 텍스처만 4×4 로 무손실 축소한다. 모델은 올리기 전에 이 스크립트로 가공하고, 지도는 파이프라인이 스스로 한다. `pnpm perf:scene` 의 FLAT_TEXTURE 경고는 파일 크기 기반 **후보**일 뿐 오탐이 있다(`crane.glb` 의 소형 webp 들은 실제 콘텐츠였다) — 이 스크립트의 픽셀 검증이 최종 판정이며, 불균일이면 건드리지 않는다.

### KTX2(GPU 압축 텍스처)

디코드 배선은 완료 상태다. 모든 GLTF 로드 경로가 `extendGltfLoaderWithKtx2`(`ktx2-loader.ts`)를 물고 있고, 트랜스코더는 `apps/shell/public/basis/r<three REVISION>/` 에 커밋돼 있다 — three 업그레이드 시 새 REVISION 디렉터리로 재복사하고 옛 디렉터리를 지운다(경로에 버전을 넣어 고정 URL stale 캐시를 막는다, `ktx2-loader.ts` 주석).

에셋 변환은 `node scripts/encode-ktx2.mjs <입력> <출력> [--srgb-only]`(UASTC+zstd, 슬롯별 sRGB/normal 프리셋). UASTC 는 고품질이지만 무손실이 아니고 파일이 커진다(실측 VRAM 은 크게 줄고 파일은 늘었다) — 실 운영 장비에서 육안 A/B·BC7 지원 확인 전에 배포 GLB 를 일괄 전환하지 않는다.

### philly 씬의 지도 3장

`philly-2dock.json` 은 지도가 3장이다. 조선소 두 장(`philly-area-1.glb`·`philly-area-2.glb`, 옛 단일 지도를 분할한 것으로 좌표계가 같아 옛 배치값을 공유)과 주변 지형(`philly-terrain.glb`, 조선소 자리가 구멍으로 잘린 시 전역 OSM 지형).

- 에디터 팔레트 "맵" 탭은 타일별 **추가/제거 토글**이라 지도를 여러 장 놓을 수 있다(`addSceneMap` append, 제거는 `deletePlacedMap`, 같은 자산은 한 장). 터레인은 자산의 배치 속성이 주변 지형 + 기본 위치(goliath 기준 오프셋)다. 타일 상태 파생은 `map-palette-tiles.ts`. 잠긴 지도 타일은 클릭을 무시하고 계층 목록·타일 자물쇠로 해제한다.
- 드롭 raycast 의 바닥 지도는 배열 인덱스가 아니라 씬 지도의 `role` 로 판정한다(`resolveGroundMaps`: `ground` 전부 — 분할 지도 대응, 없으면 `maps[0]` 한 장 폴백). `use-scene-drop.ts` 가 그 전부를 `intersectObjects` 해 최근접 표면을 쓴다.
- 카메라 이동 범위·탑뷰 bounds 는 역할이 아니라 씬 데이터 `cameraBounds`(인스펙터 카메라 탭)로 고른다 — 폭 수 km 컨텍스트 지형이 탑뷰 프레이밍을 잡아먹지 않게 하는 구분. 두 씬 모두 조선소 두 장만 체크돼 있다. 상세는 `docs/agents/monitoring-ui.md`.
- 터레인 배치값은 디자이너 Blender 씬의 조선소 오프셋을 보정한 값이라 조선소 지도를 다시 반입해 좌표계가 바뀌면 터레인도 함께 옮긴다.

## 불변식

- **새 GLTF 로드 경로(`useGLTF`·`GLTFLoader`)를 추가하면 반드시 `extendGltfLoaderWithKtx2` 를 함께 건다.** 누락된 경로가 KTX2 GLB 를 열면 통째로 throw 된다. 불투명 머티리얼이면 `markSceneOpaqueStencil` 도 켠다(`docs/agents/rendering-perf.md`).
- **배포 파일을 같은 경로에 덮어쓰지 않는다.** GLB 가 바뀌면 자산 라이브러리의 새 버전이다. 두 최적화 스크립트는 파일 하나를 받아 하나를 내는 모드뿐이다.
- **지도 파이프라인에 사람이 고르는 옵션을 넣지 않는다.** 지도마다 달라야 하는 것은 파일을 재서 정하고 보고에 적는다. 새 판단이 필요해지면 `optimize-map.mjs` 에 규칙을 더한다.
- **지도의 새 버전은 디자이너 원본에서 만든다.** 타일·LOD 로 나뉜 배포본을 다시 파이프라인에 넣지 않는다.
- 최적화 스크립트의 보고(`--report`)는 `{ lines, rootOffset? }` 다. 미들웨어와 화면이 이 모양을 읽는다 — 줄은 등록 알림에 그대로 나오므로 짧은 한국어 문장으로 적는다.
- `add-model-lod`·`join-static-glb`·unbake 는 `assets-src/models/` 의 파일을 고친다. 고친 파일을 자산 라이브러리에서 새 버전으로 올린다.
- `meshOverrides`·내부 노드 `tagMappings`·`rigId`·skin 이 있는 모델에 LOD·join 을 걸지 않는다(스크립트가 거부하지만 손으로도 지킨다).
- 자산을 새 버전으로 교체할 때 `assets-src/models/<파일>.nolod`·`.orig` 도 함께 갱신·삭제한다.
- LOD 노드 숨김은 최상위 캐리어만 — 자식 Mesh 의 복제된 extras 로 끄지 않는다.
- three 를 업그레이드하면 `apps/shell/public/basis/r<REVISION>/` 을 새 REVISION 으로 재복사한다.
- 배포 경로에 GLB 가 늘거나 바뀌면 `pnpm assets:stats` 로 자산 라이브러리의 통계 표를 다시 뽑아 함께 커밋한다(`docs/agents/asset-library.md`).
- GLB 는 자산 라이브러리에서 지운다. 씬이나 화면 코드가 쓰는 자산은 지워지지 않는다 — 파일을 손으로 지우지 않는다.
- 지도를 반입·재생성하면 `node scripts/audit-map-layers.mjs <배포본>` 출력에 "← 얹힌 표시" 가 없어야 한다.
- 새 지도는 자산의 배치 속성에서 역할을 정한다 — 바닥은 드롭 바닥·(체크 시) 카메라 기준, 주변 지형은 Lambert·그림자 제외·바다 반사 제외 규칙을 받는다. 놓은 뒤에는 씬의 `role` 이 그 값이다.
- 지도의 드라이독은 수면 위까지 올라온 벽·게이트로 사방이 막혀 있어야 한다. `SEA_REACH_CELL_SIZE` 보다 넓은 틈이 있으면 바다로 이어진 곳으로 분류돼 도크 안에 잠김 안개가 낀다. 위에서 보이는 수평면이 바다를 덮고 있으면 그 아래가 전부 마른 곳이 된다(`docs/agents/rendering-perf.md`).
- 배포 GLB 를 KTX2 로 일괄 전환하지 않는다(운영 장비 육안 A/B·BC7 확인 전).

## 하지 않기로 한 것

- **단일 노드 지형** — frustum 컬링이 안 걸려 어느 방위든 전량 렌더. 타일+LOD 로 대체.
- **지형 LOD 를 지도 파이프라인의 데시메이션으로** — 타일·LOD·정점색이 훼손된다. 타일 스크립트가 LOD 를 만든다.
- **배포 파일을 제자리에서 덮어쓰는 일괄 압축 명령** — 씬이 모르는 사이 파일이 바뀐다. 버전으로만 바꾼다.
- **지도 압축의 환경 변수 옵션(양면 유지·검사 무시)** — 등록하는 사람이 그 값을 알 수 없다. 머티리얼의 알파 모드와 양자화 그리드로 정한다.
- **양자화 안전 가드로 압축을 통째로 생략하기** — 넓은 지도는 압축 없이는 100MB 를 넘는다. 붙을 층을 그리드만큼 띄운 뒤 압축한다.
- **출력 검증에 걸리면 파일을 실패시키기** — 남는 겹침은 원본의 결함이라 원본을 그대로 저장해도 똑같이 깜빡이고 용량만 는다. 저장하고 경고한다.
- **베이크된 월드 좌표 그대로 등록** — 존·기즈모가 수 km 어긋난다. unbake 먼저.
- **FLAT_TEXTURE 경고만 보고 텍스처 축소** — 파일 크기 기반 후보라 오탐. 픽셀 검증 스크립트가 최종.
- **`philly-terrain.glb` 원본 커밋** — 100MB 한도 초과. 컨플루언스 관리.
- **지도 z-fighting 을 런타임 `polygonOffset` 으로** — 로그 깊이는 프래그먼트가 `gl_FragDepth` 를 직접 써 오프셋이 무시된다. 파이프라인에서 띄운다.
- **평면 레이어의 아래 향한 면 일괄 뒤집기** — philly 지도에 딸려 온 `Sea` 평면까지 위를 향해 런타임 바다를 덮는다. 받치는 면이 있는 높이만 뒤집는다.
- **모델 LOD 를 첫 노드 앞에 삽입** — `[index]name` 메쉬 경로가 바뀌어 meshOverrides·맵핑이 깨진다. 기존 노드 뒤에만 붙인다.

## 미룬 것

- 지도 KTX2 전환(운영 장비 확인 후), 타워크레인 데시메이션/LOD 확대.
