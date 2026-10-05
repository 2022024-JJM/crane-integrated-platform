# assets-src — 3D 에셋 원본 보관소

배포되는 GLB 의 **압축 전 원본**이다. 배포본은 압축·리사이즈된 결과물이라
되돌릴 수 없다. 품질 설정을 바꿔 다시 압축하거나 옛 파일로 돌아가려면 이 원본이
반드시 있어야 하므로 레포에 함께 보관한다. **이 디렉토리를 지우지 말 것.**

| 위치 | 무엇 |
|---|---|
| `asset-library/<자산 id>/v<N>/<파일>` | 자산 라이브러리에서 "최적화" 를 켜고 등록하거나 새 버전으로 올린 파일의 원본. dev 서버가 넣고, 그 자산·버전을 지우면 함께 지운다 |
| `models/`, `maps/` | 라이브러리 디렉터리가 생기기 전에 배포된 파일(각 자산의 버전 1 — `apps/shell/public/models/`, `apps/shell/public/maps/`)의 원본. 올리기 전에 파일을 가공하는 스크립트의 작업 자리이기도 하다 |

100MB 를 넘는 원본은 커밋하지 않는다(GitHub 파일당 한도, git-lfs 는 쓰지 않는다).
`asset-library/` 아래는 dev 서버가 그런 파일을 `.gitignore` 에 올리고,
`maps/` 의 `philly-terrain.glb`·`okpo.glb`·`okpo-terrain.glb`·`okpo-tree.glb` 가
같은 이유로 빠져 있다. 그런 원본은 컨플루언스에 따로 보관한다.

## 반입과 교체 — 자산 라이브러리에서 한다

모델·지도는 dev 서버의 **3D 자산 라이브러리**(`/asset-library`)에서 등록하고,
바뀐 파일은 그 자산의 **새 버전**으로 올린다. "최적화" 스위치(기본 켜짐)가 켜져
있으면 dev 서버가 종류에 맞는 파이프라인을 돌려 압축본을 배포 경로
(`apps/shell/public/asset-library/files/<id>/v<N>/`)에, 올린 원본을 이
디렉터리에 둔다.

```bash
node scripts/optimize-glb.mjs --single <입력.glb> <출력.glb>   # 모델 — 등록 화면이 돌리는 명령
node scripts/optimize-map.mjs --single <입력.glb> <출력.glb>   # 지도
```

- **배포 파일을 같은 경로에 덮어쓰지 않는다.** 두 스크립트에는 파일 하나를 받아
  하나를 내는 모드뿐이다. 제자리에서 덮어쓰면 씬이 모르는 사이 파일이 바뀐다.
- 새 버전을 올려도 씬은 그대로다. 3D 화면 편집의 팔레트 아래에 "새 버전이 있는
  자산" 이 뜨고, 갱신을 누른 뒤 저장해야 그 씬이 새 파일을 쓴다. 화면 코드가 직접
  로드하는 모델은 `packages/domain/src/3d/model/code-asset-refs.ts` 의 버전과 경로를
  고친다.
- 옛 파일로 돌아가려면 라이브러리에서 그 버전을 현재로 지정하고 씬을 다시
  갱신한다. 옛 버전의 파일은 지우지 않는다.
- 배포 경로에 GLB 가 늘거나 바뀌었으면 `pnpm assets:stats` 로 통계 표를 다시 뽑아
  함께 커밋한다.

절차와 규칙의 현재 상태는 `docs/agents/asset-library.md`·`docs/agents/assets-glb.md` 다.

## 올리기 전에 손이 가야 하는 모델

모델 파이프라인은 텍스처와 지오메트리 압축만 한다. 아래는 파일을 먼저 가공한 뒤
그 결과를 올린다. 가공 스크립트는 `assets-src/models/` 의 파일을 고친다.

| 경우 | 명령 |
|---|---|
| 루트 노드에 월드 포즈가 실려 온 모델 | `node scripts/unbake-root-transform.mjs <파일>` — 출력은 `assets-src/models/<입력 파일명>` |
| 루트 Empty 에 uniform scale 이 실린 리깅본 | `node scripts/unbake-root-transform.mjs --fold-scale <파일>` |
| 골리앗 크레인(원점 중심 계약) | `node scripts/unbake-goliath-crane.mjs <새 export.glb>` |
| 거리별 LOD | `node scripts/add-model-lod.mjs <파일명.glb>` — LOD 전 사본이 `<파일>.nolod` 로 남는다 |
| 정적 장식 모델의 프리미티브 병합 | `node scripts/join-static-glb.mjs <파일명.glb>` — 병합 전 사본이 `<파일>.orig` 로 남는다 |
| 단색 텍스처 축소 | `node scripts/shrink-flat-textures.mjs <파일명.glb>` |

LOD·병합을 걸면 안 되는 조건(`meshOverrides`·내부 노드 태그 맵핑·리그·skin)은
`docs/agents/assets-glb.md`. **지도는 이 표의 어느 것도 따로 돌리지 않는다** —
지도 파이프라인이 루트 오프셋 제거와 단색 텍스처 축소를 스스로 한다.

### goliath_crane.glb — 원점 중심 계약 (⚠️ 새 버전을 만들 때 필수)

충돌 감지 존·FSD 카메라·에디터 기즈모가 "GLB 원점 = 크레인 중심(다리 사이),
거더 = 로컬 +X" 를 전제로 씬 배치 transform 에서 파생된다. Blender 에서
**월드 좌표가 지오메트리에 베이크된 채** 내보내면 존이 원점에 그려지고 회전
피벗이 틀어진다 (2026-08-20 발생).

```bash
node scripts/unbake-goliath-crane.mjs <새 export.glb>   # 원점 복원 → assets-src/models/goliath_crane.glb
# 그 파일을 자산 라이브러리에서 goliath-crane 의 새 버전으로 올린다
# 에디터에서 씬을 갱신하고, 출력된 "씬 배치값" 으로 크레인을 놓는다
```

### 루트 노드에 월드 포즈가 베이크된 모델 (Block_001/002 등)

Blender 에서 씬에 배치된 오브젝트를 그대로 내보내면 정점은 원점 중심이어도
루트 노드 translation/rotation 에 월드 좌표가 실려 온다. 그대로 올리면
에디터 드롭 지점에서 수 km 떨어진 곳에 나타난다.

```bash
node scripts/unbake-root-transform.mjs Block_001.glb   # 원점 복원 → assets-src/models/Block_001.glb
# 출력된 "씬 배치값" 은 원래 자리에 두고 싶을 때 쓴다
```

### LLC_002.glb — 리깅본 (⚠️ `--fold-scale` + 파일명)

디자이너 리깅본은 루트 `LLC` Empty 에 월드 포즈와 uniform scale 20.267 이 실려
온다. 루트 scale 을 직계 자식 `Base` 에 접어 넣어야 배치 scale 1 로 실제 미터가
된다. unbake 출력 파일명이 입력 basename 이므로 먼저 `LLC_002.glb` 로 이름을
맞춘다. 씬(`philly-2dock.json`)의 리그 관절·노드 맵핑은 `[0]LLC/[0]Base/[0]Link_01/…`
경로를 참조하므로 새 버전으로 갱신한 뒤 `Link_01` 자식 순서([0] Lower, [1] Upper)가
유지되는지 본다.

```bash
cp LLC_Rigged_YYYYMMDD.glb /tmp/LLC_002.glb
node scripts/unbake-root-transform.mjs --fold-scale /tmp/LLC_002.glb   # → assets-src/models/LLC_002.glb
node scripts/shrink-flat-textures.mjs LLC_002.glb                      # 단색 1024² 3장 → 4×4 (무손실)
```

버전 1(`LLC_Rigged_20260922`)은 `Upper Link_02` 아래 `Upper Link_03/Link_End`(끝단
메쉬) 체인이 있다. `Upper Link_03` 은 후크 피벗(rest 에서 로컬 Y 가 연직 아래)이라
`philly-2dock.json` 리그에 hinge 관절 `hook` 으로 등록돼 있고, 상위 체인
`Upper Link_01`(luff×1.14)·`Upper Link_02`(luff×−2.4)를 상쇄하는 luff×1.26 선형
구속으로 러핑 중에도 연직을 유지한다. 압축 9.9MB → 0.93MB.

### okpo_{goliath,oc,tc,ttc}.glb — 옥포 크레인 4종

디자이너 전달본 `Goliath/OC/TC/TTC 크레인_옥포.glb`. 미터 실척이고 루트 노드에
월드 오프셋이 베이크돼 있어(Goliath (178.8, 0.06, −234.0), OC (−6.0, 0, 0), TC
(0, 0, 15.2), TTC ≈0) 범용 언베이크로 제거했다. 자산 id `okpo-*`, 배치 scale 1.
압축 20.9MB → 5.8MB.

- OC·TC 의 캐빈 유리 `Window Glass` 는 `KHR_materials_transmission` 을 달고 온다.
  모델 파이프라인의 transmission 제거 스테이지가 알파 블렌딩 반투명으로 바꾼다.
- 단색 텍스처(Orange/Black/Yellow, Metallic-Roughness 흰색)는 4×4 로 축소하고
  Concrete/Beton 의 diffuse·normal 은 유지된다.
- **LOD·join 을 걸지 않는다.** `Trolly_Goliath_*`, `Base/Top/Link_*`(OC), `TC_Top`,
  `TTC_Top` 이 구동용 피벗 노드라 노드 맵핑·리깅 대상이고 LOD 사본은 따라가지 못한다.
- OC 는 루트 원점이 한쪽 다리 쪽에 있다(bbox x −12.8 ~ 72.2). 디자이너 피벗 그대로.

## maps/ (지형) — 전용 파이프라인 `optimize-map.mjs`

지도는 모델과 다른 파이프라인을 탄다. 텍스처 상한 2048px·노멀/ORM 손실 압축에
더해 transmission 제거·단면화·데시메이션·평면 레이어 보호(차선·횡단보도를
데시메이션에서 빼고, 바닥에 얹힌 표시는 띄우고, 뒤집힌 표시는 바로 세움)·meshopt
압축·출력 검증(동일 평면 겹침)·타일 + LOD 까지 한 번에 처리한다.

**고를 옵션이 없다.** 지도마다 달라야 하는 것은 파이프라인이 파일을 재서 정하고,
무엇을 골랐는지를 등록 알림에 적는다.

| 판단 | 기준 |
|---|---|
| 루트 오프셋 제거 | 루트 노드가 하나이고 이동만 실려 있을 때. 지운 값은 새로 등록하는 지도의 기본 위치가 된다 |
| 단색 텍스처 축소 | 모든 픽셀이 같은 텍스처만 4×4 로 |
| 양면 유지 | 알파(MASK·BLEND) 머티리얼은 양면 그대로, 불투명만 단면으로 |
| 겹친 표시 띄우기 | 양자화 그리드(지도 최대 폭 / 65535)보다 가깝게 얹힌 평면 표시를 그리드 정수 배만큼 |
| 타일 + LOD | 삼각형이 많고, 격자² × (텍스처 머티리얼 수 + 무텍스처 1) 이 드로우콜 예산 안에 드는 가장 촘촘한 격자가 있을 때 |
| 작은 지도는 모양 그대로 | 삼각형이 1만 개 미만이면 단면화·데시메이션을 하지 않고 텍스처와 압축만 |

디자이너 원본을 그대로 올리면 된다. 타일·LOD 로 나뉜 배포본을 다시 파이프라인에
넣지 않는다 — 새 버전은 항상 원본에서 만든다. 스테이지별 튜닝 근거는
`docs/지도-GLB-최적화-파이프라인.md`, 모델 파이프라인은
`docs/GLB-압축-파이프라인-작업보고.md`(둘 다 도입 시점의 기록이라 명령·절차는
`docs/agents/assets-glb.md` 가 맞다).

소형 지도(1dock·plane)는 모양이 그대로 남는다 — 줄일 것이 없고, unlit 플레인은
단면화가 오히려 위험하다. 압축한 결과가 원본보다 작지 않으면 원본이 그대로 저장된다.

### okpo.glb · okpo-terrain.glb · okpo-tree.glb — 옥포 지도 3장 (원본 미커밋 ⚠️)

디자이너 전달본 `Okpo Yard.glb`(192MB, 야드 3.3×3.8km, 삼각형 104만)·`Terrain.glb`
(198MB, 주변 지형 12.4×11.2km, 77만)·`Tree.glb`(271MB, 나무 레이어, 227만). 야드는
바닥 지도, 나머지 두 장은 주변 지형이다(자산의 배치 속성).

**세 원본 모두 100MB 를 넘어 커밋하지 않고 컨플루언스에서 관리한다.**
`assets-src/maps/` 에 놓이는 원본은 디자이너 파일에 무손실 가공(루트 오프셋 제거,
단색 텍스처 4×4 축소)만 한 것이다.

- 배포본: 야드 183MB → 17.8MB(통짜 메시), Terrain 188MB → 11.0MB, Tree 258MB →
  37.8MB(둘 다 4×4 타일 + LOD).
- 야드는 그리드가 5.8cm 다. 도로 표시(`Road Marking_White`)는 원본에서 세 높이다.
  아스팔트와 같은 높이(40.550)는 아스팔트가 그 자리만큼 도려져 맞물려 있고, 5mm
  위(40.554)는 횡단보도·정지선으로 아스팔트 위에 얹혀 있으며, 10cm 위(40.650)는
  중앙선 등으로 면이 아래를 향한다. 파이프라인이 둘째를 그리드 2칸(11.6cm) 띄우고
  셋째를 뒤집는다. 배포본 실측: 슬래브 40.325 / 아스팔트 40.558 / 표시
  40.558·40.674. 새 버전을 만든 뒤
  `node scripts/audit-map-layers.mjs <배포본>` 출력에 "← 얹힌 표시" 가 없어야
  한다 — 있으면 횡단보도가 화면에서 깜빡인다.
- Tree 는 잎이 alpha MASK 양면 카드라 단면화하면 절반이 사라진다 — 그 머티리얼은
  양면으로 남는다. TEXCOORD_1~4 는 미사용이라 파이프라인이 제거한다.
- 격자 4: 텍스처 머티리얼은 정점색으로 병합되지 않아 드로우콜 ≈ 타일 × 머티리얼이다.
  LOD 레벨당 Terrain 82 · Tree 36. Tree 의 LOD 는 멀수록 잎 카드가 Prune 으로 빠진다
  (LOD1 잎 41%, LOD3 잎 0) — 1080p 기준 LOD1 이 약 1.4km 밖이다.
- 야드는 텍스처 머티리얼이 31개인 단일 메시라 타일로 나뉘지 않는다(드로우콜 폭증).
- `pnpm perf:scene` 실측: 야드 89만 tris · 31 드로우콜 · 텍스처 VRAM 139MB(단색 축소 전
  267MB), Terrain LOD0 60만 · 97MB, Tree LOD0 169만 · 33MB.
- **씬 배치값**: 디자이너 Blender 씬에서 야드 (0, −6.882, 0), Terrain 원점, Tree
  (215.251, 30.479, 379.802). 야드 슬래브가 로컬 Y 40.35 라 슬래브를 y=0 에 두려고
  야드를 (0, −40.35, 0) 에 놓고, 나머지는 (자기 오프셋 − 야드 오프셋) 에 같은 양을
  더했다 → Terrain (0, −33.468, 0), Tree (215.251, −2.989, 379.802). 자산의 기본
  위치가 이 값이다.
- okpo.json(dock-1·dock-2 공유 씬)은 새 지도 위에 미터 축척으로 배치돼 있다
  (`scene-unit-scale.ts` 의 dock-1 · dock-2 는 1). 두 씬은 야드와 Terrain 을 모두
  원점에 둬 슬래브가 y≈40.3 이고, Terrain 이 디자이너 씬 기준보다 6.882m 낮다
  (야드 루트 오프셋만큼) — 경계가 어색하면 Terrain 의 Y 를 6.882 로 올린다.

### philly-area-1.glb · philly-area-2.glb — 필리조선소 지도

디자이너가 조선소 지도를 `Philly Area 1.glb`(35MB)·`Philly Area 2.glb`(60MB) 두
장으로 나눠 보낸 것이다(2026-09-11). 한 장짜리 옛 지도 `phillyshipyard.glb` 는
없어졌고 롤백 원본은 git 이력(V4 반입 `254c9af`)에 있다.

- 두 파일 모두 루트 노드에 (-263.125, -3.482, 31.333) 오프셋이 실려 왔고, 오프셋을
  지운 bbox 합집합이 옛 한 장짜리 원본 bbox 와 정확히 같다(배포본 기준 차이
  1.1cm = 양자화 그리드). 즉 **옛 조선소와 같은 좌표계**라 배치값(goliath: 원점·
  무회전, philly-2dock: yaw 354.4)을 그대로 두 장에 주면 제자리다.
- 둘 다 바닥 지도이고 두 씬 모두 `cameraBounds: true` 다 — 카메라 제한 합집합이
  옛 조선소 bbox 와 같다. 에디터 드롭 raycast 는 바닥 지도 전부를 본다
  (`resolveGroundMaps`).
- 지면 4096 텍스처 3장이 두 파일에 **중복**으로 들어 있어 텍스처 VRAM 이 옛 한 장
  대비 늘었다(`pnpm perf:scene` 기준 181MB → 138.6 + 133.0MB). 드로우콜 41 → 36 + 26.
- 경계에서 Ground·Sea·Water Front Wall 의 X 범위가 약 50m 겹친다.
- 지면 머티리얼은 lit PBR 3장(base/MR/normal, 각 4096 → 2048 webp)이다. 조명에
  따라 지면 밝기가 달라진다.
- 배포본: 33.3MB → 1.96MB, 57.1MB → 4.39MB.

### philly-terrain.glb — 조선소 주변 지형 레이어 (원본 미커밋 ⚠️)

디자이너 전달본 `Terrain.glb`(172MB, 필라델피아 시 전역 OSM 지형 — 건물 extrude·
도로·항공사진 overlay, 13.4×10.1km, 삼각형 237만). **조선소 자리가 구멍으로 잘려
있는 주변 지형**이라 조선소 지도(Area 1/2)를 대체하지 않고 goliath.json ·
philly-2dock.json 에 함께 깐다.

**원본은 커밋하지 않고 컨플루언스에서 별도 관리한다.** 새 버전을 만들거나 품질을
다시 맞추려면 컨플루언스에서 원본을 받아 올린다. 디자이너가 다시 보낸 파일은
올리기 전에 루트 오프셋과 bbox 가 이전과 같은지 먼저 비교해 씬 배치값을 유지할지
판단한다.

- 배포본: 163.9MB → 약 25MB, 8×8 타일(64) × LOD0~3. LOD 잔존율은 71.2/49.3/35.3%
  (2/4/8m).
- 텍스처 머티리얼(overlay, `Vegetation Area`)은 타일마다 따로 남고 무텍스처
  머티리얼은 정점색 하나로 병합된다 — LOD 레벨당 프리미티브 약 181.
- 도로 3개 프리미티브의 UV 12개가 [0,1] 을 최대 2.6e-5 벗어나 온다. 그대로 두면
  meshopt 가 그 UV 를 양자화하지 않아 타일 스크립트가 병합을 거부하므로,
  파이프라인이 노이즈 UV 를 클램프한다(범위 밖 값이 전부 1e-4 이내인 accessor 만).
- 폭이 넓어 16bit 그리드가 20cm 를 넘는다. 도로(Y 0.3)·숲(0.1)·지면 평면(0)은
  2~57m 기복의 지형 overlay 아래 묻혀 있어 보이지 않고, 건물·지형은 도시 스케일에서
  그 양자화가 비가시다. 압축을 생략하면 f32 로 123MB 가 남는다.
- simplify 는 0.4 목표에 못 미친다 — 건물 벽이 quad 하나짜리 박스라 오차 한도
  안에서 더 접을 게 없다. 추가 절감이 필요하면 건물·도로 프리미티브 제거가 다음 수단.
- **씬 배치값 (778.43, 3.482, -846.212)** 의 유도: 디자이너 Blender 씬에서 조선소는
  (-263.125, -3.482, 31.333) 에, Terrain 은 (515.305, 0, -814.879) 에 있었다.
  조선소의 오프셋을 지워 반입했으므로 Terrain 배치 = Terrain 오프셋 − 조선소 오프셋.
  50m 셀 실측으로 이 값에서 조선소 지면과 지형의 겹침이 3% (경계 노이즈)로,
  구멍이 조선소 발자국과 맞물린다. 자산의 기본 위치가 이 값이다.
  philly-2dock.json 은 조선소 지도가 yaw 354.4° 라 같은 회전을 원점 기준으로 함께
  적용한 값(현재 씬 파일은 에디터에서 미세 조정한 (858.135, 3.482, -765.266))이다.
- 조선소 지도의 좌표계가 바뀌면 터레인도 함께 옮긴다.
- 구멍 가장자리 지형 높이가 조선소 지면(3.68m)보다 약 1.8m 높다(SRTM 오차 수준).
  어색하면 에디터 계층 목록에서 터레인 잠금을 풀고 Y 를 내려 저장한다.
- 도로·보도는 Y=0.3 평면이라 지형 아래 묻혀 보이지 않는다 — 원본 특성이며 여기서
  고치지 않는다(드레이핑은 디자이너 요청 사항).
