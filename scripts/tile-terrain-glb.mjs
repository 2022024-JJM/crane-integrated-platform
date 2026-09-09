// philly-terrain.glb 공간 타일링 재구성 — Phase 1 (타일링 + 정점색 병합 + weld)
//                                        + Phase 2 (--lod: 타일별 LOD 인덱스 체인).
//
// 사용법:
//   node scripts/tile-terrain-glb.mjs <입력.glb> <출력.glb> [--grid=8] [--lod]
//
//   입력이 이미 타일 구조(terrain-tile-<x>-<z> 노드 존재)면 타일링 스테이지를
//   건너뛰고 LOD 만 추가한다 — 타일링은 멱등이 아니므로(버킷팅·weld 재실행이
//   기존 타일 경계를 다시 자름) 재타일링을 시도하지 않는 것이 방어다. 이미
//   LOD 체인(terrain-tile-*-lod*)까지 있는 파일은 거부한다.
//
// 왜 이 스크립트인가 (2026-09-09 리서치 실측 근거):
//   philly-terrain.glb 는 노드 1개·프리미티브 29개·삼각형 178만 장짜리 시 전역
//   OSM 지형인데, three 는 지오메트리(=프리미티브) 단위로 frustum 컬링을 하므로
//   지금은 어느 방향을 보든 178만 장 전부가 그려진다. 삼각형 centroid 기준으로
//   XZ 8×8 그리드에 버킷팅해 타일별 프리미티브로 쪼개면 three 네이티브 컬링만으로
//   시점 평균 45~49% 만 그리게 된다(24방위 시뮬레이션 실측). 드로우콜은 29 → ~82로
//   늘지만 화면 안에는 38~48개라 현재 씬 103콜 수준에서 흡수된다.
//
//   머티리얼 29개 중 28개는 무텍스처 lit 이고 metallic 0·roughness 0.5·OPAQUE·
//   emissive 0 이 전부 동일, baseColorFactor 만 다르다(실측). factor 를 COLOR_0
//   정점색으로 굽고 1개 머티리얼로 병합하면 타일 하나가 (병합 lit + overlay) 최대
//   2 프리미티브로 끝난다. three GLTFLoader 는 geometry 에 color attribute 가
//   있으면 그것만으로 material.vertexColors 를 켠다(GLTFLoader.js 의
//   `useVertexColors = geometry.attributes.color !== undefined` → clone 후
//   `vertexColors = true`). 셰이더는 diffuse = material.color × 정점색이므로
//   baseColorFactor 를 흰색으로 두고 원래 factor 를 정점색에 실으면 렌더 결과가
//   동일하다. baseColorFactor 와 COLOR_0 은 둘 다 linear 공간이라 변환도 없다.
//
//   COLOR_0 은 unorm16(UNSIGNED_SHORT normalized) VEC4 로 굽는다 — unorm8 은
//   양자화 오차가 1/255 로 계단이 보일 수 있고, unorm16 은 오차 상한이
//   1/65535(비가시)다. COLOR_0 unorm16 은 glTF 코어 스펙에서 합법이라
//   KHR_mesh_quantization 없이도 유효하다(어차피 이 파일은 POSITION int16 때문에
//   해당 확장이 required 로 이미 붙어 있다).
//
// LOD 체인 (--lod, Phase 2) — 설계 근거:
//   frustum 컬링 단독은 worst(작업구역에서 다운타운 정면) 90% 가시라 부족하다.
//   타일 단위 simplify 실측 곡선(scratchpad research2/r3.json — 다운타운 30만
//   tris 타일, ErrorAbsolute+Prune)은 오차 2m→67.8%, 4m→39.3%, 8m→23.5% 잔존
//   이고, 서브픽셀(1 device px) LOD 스케줄과 결합하면 terrain 렌더 tris 가
//   평균 ~30%·worst 60% 로 내려간다. 1m 티어는 잔존 83%라 ROI 가 없어 제외.
//
//   - 정점 버퍼는 LOD 간 공유한다. meshoptimizer 의 simplify 계열은 정점을 새로
//     만들지 않고 기존 정점으로 collapse 한 "인덱스 배열만" 반환하므로, LOD1~3
//     프리미티브는 LOD0 과 같은 POSITION/NORMAL/COLOR_0/TEXCOORD accessor 를
//     그대로 참조하고 인덱스 accessor 만 새로 만든다(파일 증가 = 인덱스뿐).
//     타일 "간" accessor 공유 금지는 그대로다(아래 컬링 성립 조건 참고) —
//     공유는 타일 "안" LOD 사이에서만 일어난다. three 는 같은 정점 buffer 를
//     참조하는 LOD 지오메트리의 bounds 를 그 accessor 전체(=타일)로 잡으므로
//     LOD 노드도 타일 단위로 컬링된다.
//   - simplify 입력 좌표는 디퀀타이즈한 float 미터(월드 행렬 = 양자화 해제
//     scale 9449.15 적용)로 넘겨 target_error 를 절대 미터로 판정한다
//     (ErrorAbsolute). 저장 정점은 기존 int16 양자화 비트 그대로 두고, float
//     변환은 simplify 입력용 임시 버퍼에만 한다 — 품질 무손실 원칙 유지.
//   - **simplify 는 프리미티브별 "shadow weld" 공간에서 돌린다** (2026-09-09
//     실측 — scratchpad lod-flag/shadow-experiment.mjs). 저장 스트림을 그대로
//     넘기면 잔존 92.8/90.7/89.0%(2/4/8m)로 곡선이 죽는다: OSM 건물이 flat
//     shading 이라 baked 정점 314만 중 ~45% 가 NORMAL 만 다른 wedge 복제고
//     (UV 제외 시 313만 → NORMAL 제외 시 172만), meshopt 는 다중 wedge 모서리
//     (박스 코너 = 노멀 3개)를 complex 정점으로 잠가 collapse 를 막는다.
//     r3 곡선 자체가 위치-weld 공간 실측(재현 66.9/41.0/24.3%)이다.
//     Permissive 플래그는 +0.5~15pp 에 그쳐(74.5% @8m) 해법이 못 된다.
//     그래서 simplify 입력만 "위치 + 렌더에 보존돼야 하는 이산 속성" 키로
//     병합한다 — baked(무텍스처 lit)는 COLOR_0(색 경계는 눈에 보이므로 유지),
//     overlay(unlit 텍스처)는 TEXCOORD_0. NORMAL 은 키에서 제외(음영 전용,
//     아래 참고), 텍스처 없는 머티리얼의 UV 도 제외(렌더 무관). 결과 인덱스는
//     실 정점으로 되매핑한다: 살아남은 삼각형(LOD1 의 ~70%)은 원본 wedge
//     인덱스를 그대로 복원해 렌더 변화가 0이고, collapse 로 수정된 코너만
//     같은 위치·같은 색의 지배 wedge(참조 수 최다)로 폴백한다 — 위치·색·UV 는
//     정확하고 노멀만 그 코너에서 이웃 면의 것일 수 있다. LOD1+ 는 기하 오차가
//     1 device px 미만인 거리에서만 보이므로(런타임 스케줄) 수 px 크기 건물의
//     국소 음영 변화는 허용 오차 안이다. 이 방식으로 잔존 70.9/48.6/34.6% —
//     색 경계 보존 때문에 r3 곡선(색 무시)보다 원거리 티어가 8~11pp 높게
//     남는 것은 구조적 갭이라 ±20% 밴드 경고로 표시하고 실패로 치지 않는다.
//   - 'LockBorder' 는 쓰지 않는다. OSM 건물의 열린 모서리(경계 에지) 전부를
//     잠가 달성률이 죽는다. 대신 simplifyWithAttributes 의 vertex_lock 배열로
//     "타일 경계 공유 정점"만 잠근다 — 전 타일에 걸쳐 정점 위치(양자화 정수
//     3튜플, 모든 타일 노드가 동일 TRS 라 같은 좌표계)를 해시해 2개 이상
//     타일에 등장하는 위치만 lock. 타일 경계 크랙(LOD 가 경계 정점을 움직여
//     이웃 타일과 어긋나는 것)을 막는 최소 범위다.
//   - 'Prune' 으로 오차 한도 이하의 소형 고립 컴포넌트(원거리에서 서브픽셀인
//     작은 건물)를 제거한다. targetIndexCount 는 0 — 오차 상한이 실질 제약.
//   - 플래그 문자열·시그니처는 meshoptimizer 1.0.1 의 meshopt_simplifier.js
//     (simplifyOptions = { LockBorder:1, Sparse:2, ErrorAbsolute:4, Prune:8,
//     Regularize:16, Permissive:32 })와 .d.ts 의 simplifyWithAttributes(
//     indices, positions f32, 3, attrs f32, attrStride, weights[], lock u8|null,
//     targetIndexCount, targetError, flags) 로 확인했다. attribute 항은 쓰지
//     않으므로 빈 Float32Array + stride 0 + weights [] (assert 가 허용).
//   - LOD 프리미티브는 타일 노드의 "형제 노드"로 배치한다(three GLTFLoader 가
//     노드별 Mesh/Group 을 만들어 visible 토글 단위가 된다). 이름
//     `terrain-tile-<x>-<z>-lod<N>`, extras { tile:[x,z], lod:N, lodError:<m> }.
//     LOD0 노드에도 { tile, lod:0, lodError:0 } 을 넣는다 — 런타임
//     (packages/features/src/3d/ui/scene-terrain-lod.tsx + lib/terrain-lod.ts)이
//     lod 유무로 캐리어를 그룹핑하고 lodError(m)로 스크린 오차를 계산한다.
//     extras 의 lodError 는 달성치가 아니라 "상한"(target_error)이다 — 런타임
//     보장이 상한 기준이고, 달성치는 리포트로만 출력한다.
//   - overlay(unlit) 프리미티브도 같은 방식으로 LOD 를 만든다. 텍스처 UV 는
//     공유 정점 스트림에 있으므로 자동 보존된다.
//   - Prune 이 프리미티브를 통째로 비우면(원거리 LOD 에서 타일 내용 전체가
//     오차 이하) 그 프리미티브는 만들지 않고, 타일의 모든 프리미티브가 비면
//     그 레벨 노드 자체를 만들지 않는다 — 런타임 discoverTiles 가 결손 레벨
//     위를 잘라내는 폴백을 이미 갖고 있다.
//
// 품질 무손실 원칙 — dequantize/quantize() 를 쓰지 않는 이유:
//   입력은 KHR_mesh_quantization(POSITION int16n·NORMAL int8n·TEXCOORD u16n) +
//   노드 uniform scale 9449.15 + EXT_meshopt_compression 이다. gltf-transform 이
//   읽으면 meshopt 는 자동 디코드되지만 양자화 값은 정수 그대로 남는데, 이
//   스크립트는 그 정수를 **비트 그대로 보존**하고 타일 노드마다 원본 노드의
//   TRS 를 복제한다. 그래서 월드 좌표·노멀·UV 가 입력과 완전히 동일하고
//   (bbox diff = 0), 검증도 자명하게 통과한다. 반면 dequantize → quantize()
//   재실행은 새 양자화 볼륨 기준으로 재반올림하므로 정점이 최대 반 그리드
//   (mesh 볼륨 기준 ~2cm) 이동한다 — "품질 저하 절대 금지" 위반이자 bbox 1cm
//   검증 실패 요인이라 의도적으로 쓰지 않는다. 참고로 quantize() 기본값은
//   quantizeColor 8bit 라 우리 unorm16 COLOR_0 도 8bit 로 뭉개 버린다.
//
//   같은 이유로 EXT_meshopt_compression 재인코딩은 EncoderMethod.QUANTIZE 로
//   고정한다. 이름과 달리 이 모드는 "데이터가 이미 양자화됐다고 보고 필터 없이
//   무손실 바이트 재인코딩"이다. FILTER 모드는 NORMAL 을 8bit octahedral 로
//   재양자화(손실)하므로 금지.
//
// 타일 간 accessor 공유 금지 (컬링 성립 조건):
//   three 는 BufferGeometry 의 boundingSphere 를 attribute accessor **전체**로
//   계산한다. 여러 타일이 정점 accessor 를 공유하면 모든 타일의 바운딩이 지형
//   전체가 되어 컬링이 무력화된다. 그래서 정점·인덱스 accessor 는 타일별로
//   완전히 분리해 만들고, 검증 단계에서 공유가 없음을 실제로 확인한다.
//   (과거 "머티리얼 분할 0~2.6% 실패"의 원인이 정확히 이것이었다.)
//
// weld (타일 내 무손실 정점 병합):
//   타일링은 타일 경계 정점을 타일마다 복제시키므로, 타일 안에서 위치+NORMAL+
//   COLOR_0+UV 가 전부 같은 정점만 다시 병합한다. 속성 무시 위치-only weld 는
//   색 경계 번짐·플랫 셰이딩 노멀 파괴(=품질 저하)라 금지. gltf-transform v4 의
//   weld() 가 정확히 이것이다 — 모든 attribute 의 raw byte 를 통째로 해시해
//   "bitwise identical" 정점만 병합한다(VertexStream 이 원시 바이트를 읽으므로
//   양자화 정수 비교 = 정확 비교). 굽기로 색이 다른 정점은 COLOR_0 바이트가
//   달라 자연히 분리 유지된다.
//   주의: prune() 기본값(keepAttributes:false)은 무텍스처 머티리얼의 TEXCOORD_0
//   를 "안 쓰는 속성"으로 지워 버린다. 입력 데이터 보존 원칙에 따라 keep 옵션을
//   명시해 막는다.
//
// 산출물 교체 절차 (AGENTS.md 규약):
//   이 스크립트의 출력을 apps/shell/public/maps/ 에 직접 두지 말 것 — 기존 파일
//   교체는 assets-src/maps/ 에 먼저 넣는 순서다(optimize 스크립트가 백업본을
//   원본으로 취급해, public 에 직접 덮으면 옛 백업이 새 파일을 되돌린다).
//
// 내장 검증 (하나라도 실패하면 출력 파일을 지우고 exit 1):
//   (1) LOD0(원본 지오메트리) 총 삼각형 수가 입력과 정확히 같다 — --lod 는
//       인덱스 accessor 를 "추가"만 하므로, 이것과 (2)로 LOD0 가 --lod 없이
//       돌린 결과와 같음을 확인한다(코드 경로도 LOD 스테이지 전까지 동일).
//   (2) 월드 bbox(getBounds, 노드 transform 포함)가 입력과 1cm 이내로 같다.
//       LOD 노드는 정점 accessor 를 공유하므로 bounds 에 영향이 없다.
//   (3) COLOR_0 굽기 오차(원본 factor vs round(factor×65535)/65535)가 1/65535
//       이하이고, 출력 파일의 모든 COLOR_0 값이 정확히 그 굽기 값 집합에 속한다
//       (타일링 스테이지를 실행했을 때만 — LOD-only 모드에선 정점 데이터 불변).
//   (4) 머티리얼별 LOD0 삼각형 보존.
//   (5) 노드/메시 이름·extras {tile,lod,lodError} 계약(scene-terrain-lod.tsx 가
//       소비하는 형태) 일관성.
//   (6) accessor 스코프: 타일 간 공유 없음(컬링 성립 조건), 인덱스 accessor 는
//       프리미티브당 정확히 1개, --lod 시 LOD 프리미티브가 같은 타일 LOD0 의
//       정점 accessor 를 실제로 공유(파일 증가 = 인덱스만이라는 전제 확인).
//   (7) meshopt 재압축 여부.
//   (8) --lod: 모든 프리미티브의 인덱스가 해당 정점 accessor 범위 안.
//   경고(비실패): LOD 별 삼각형 합계가 실측 곡선 기대치(잔존 67.8/39.3/23.5%)
//   ±20% 밖이면 표시, --lod 산출물이 21MB 를 넘으면 표시.
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { prune, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

// ---------------------------------------------------------------------------
// 인자 파싱
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith('--'));
const flagArgs = args.filter((a) => a.startsWith('--'));
const gridArg = flagArgs.find((a) => a.startsWith('--grid='));
const LOD = flagArgs.includes('--lod');
const GRID = gridArg ? Number(gridArg.split('=')[1]) : 8;

const unknownFlags = flagArgs.filter((a) => a !== '--lod' && !a.startsWith('--grid='));
if (unknownFlags.length > 0) {
  console.error(`알 수 없는 플래그: ${unknownFlags.join(' ')} (허용: --grid=N, --lod)`);
  process.exit(1);
}
if (positional.length !== 2 || !positional[0].endsWith('.glb') || !positional[1].endsWith('.glb')) {
  console.error('사용법: node scripts/tile-terrain-glb.mjs <입력.glb> <출력.glb> [--grid=8] [--lod]');
  process.exit(1);
}
if (!Number.isInteger(GRID) || GRID < 2 || GRID > 64) {
  console.error(`--grid 는 2~64 정수여야 합니다: ${gridArg}`);
  process.exit(1);
}
const inPath = resolve(positional[0]);
const outPath = resolve(positional[1]);
if (!existsSync(inPath)) {
  console.error(`입력 파일이 없습니다: ${inPath}`);
  process.exit(1);
}
if (inPath === outPath) {
  console.error('입력과 출력이 같은 파일입니다 — 입력을 덮어쓰지 않습니다.');
  process.exit(1);
}
if (/apps[\\/]shell[\\/]public[\\/]/.test(outPath)) {
  // 헤더 주석 "산출물 교체 절차" 참고 — 막지는 않되 사고 패턴이라 경고한다.
  console.warn('경고: 출력이 public/ 하위입니다. 배포 교체는 assets-src/maps/ 를 먼저 갱신하는 순서입니다.');
}

// LOD 티어 — 실측 곡선(헤더 주석 참고) 기준. lodError(extras 상한, m)와 기대
// 잔존율(r3.json 다운타운 타일 실측: 2m 67.8% / 4m 39.3% / 8m 23.5%)을 함께 둔다.
const LOD_LEVELS = [
  { lod: 1, error: 2, expectRemain: 0.678 },
  { lod: 2, error: 4, expectRemain: 0.393 },
  { lod: 3, error: 8, expectRemain: 0.235 },
];
// 플래그 근거는 헤더 주석 — LockBorder 대신 vertex_lock, 오차는 절대 미터.
const SIMPLIFY_FLAGS = ['ErrorAbsolute', 'Prune'];

// 타일/LOD 노드 이름 규약 (런타임 scene-terrain-lod.tsx 와 계약).
const TILE_NAME_RE = /^terrain-tile-(\d+)-(\d+)$/;
const TILE_OR_LOD_NAME_RE = /^terrain-tile-(\d+)-(\d+)(?:-lod([1-9]\d*))?$/;

// ---------------------------------------------------------------------------
// IO 셋업 (레포 관례: join-static-glb.mjs / optimize-map.mjs 와 동일 패턴)
// ---------------------------------------------------------------------------
await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
if (LOD) await MeshoptSimplifier.ready;
const createIO = () =>
  new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

// ---------------------------------------------------------------------------
// 공용 헬퍼
// ---------------------------------------------------------------------------
/** 프리미티브 삼각형 수 (mode TRIANGLES 전제 — 입력 검증에서 확인). */
function primTris(prim) {
  const idx = prim.getIndices();
  const pos = prim.getAttribute('POSITION');
  return Math.floor((idx ? idx.getCount() : pos.getCount()) / 3);
}

/** 문서 전체 삼각형·정점 수 (verts 는 프리미티브 합 — LOD 공유 시 중복 포함). */
function docCounts(doc) {
  let tris = 0;
  let verts = 0;
  let prims = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      prims += 1;
      tris += primTris(prim);
      verts += prim.getAttribute('POSITION').getCount();
    }
  }
  return { tris, verts, prims };
}

/** 고유 POSITION accessor 기준 정점 수 — LOD 프리미티브가 정점을 공유하므로
 *  저장 정점 수는 이걸로 세야 맞다(docCounts.verts 는 참조 횟수만큼 중복). */
function docUniqueVerts(doc) {
  const seen = new Set();
  let verts = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute('POSITION');
      if (seen.has(acc)) continue;
      seen.add(acc);
      verts += acc.getCount();
    }
  }
  return verts;
}

/** 정규화 정수 → float 복원 계수 (POSITION centroid 계산용; signed 는 -1 로 클램프). */
function denormalizer(array) {
  if (array instanceof Int16Array) return (v) => Math.max(v / 32767, -1);
  if (array instanceof Int8Array) return (v) => Math.max(v / 127, -1);
  if (array instanceof Uint16Array) return (v) => v / 65535;
  if (array instanceof Uint8Array) return (v) => v / 255;
  return (v) => v;
}

/** 머티리얼의 "굽기 시그니처" — baseColorFactor 외 렌더 파라미터 전부.
 *  텍스처·확장이 하나라도 있으면 굽기 불가(null). 시그니처가 같은 것끼리만
 *  하나의 정점색 머티리얼로 병합한다 — 나중에 다른 roughness 의 무텍스처
 *  머티리얼이 반입돼도 소리 없이 뭉개지지 않게 하기 위한 방어다. */
function bakeSignature(material) {
  if (
    material.getBaseColorTexture() ||
    material.getMetallicRoughnessTexture() ||
    material.getNormalTexture() ||
    material.getOcclusionTexture() ||
    material.getEmissiveTexture() ||
    material.listExtensions().length > 0
  ) {
    return null;
  }
  return JSON.stringify({
    metallic: material.getMetallicFactor(),
    roughness: material.getRoughnessFactor(),
    emissive: material.getEmissiveFactor(),
    doubleSided: material.getDoubleSided(),
    alphaMode: material.getAlphaMode(),
    alphaCutoff: material.getAlphaCutoff(),
  });
}

/** GLB 의 JSON 청크만 파싱 (출력의 meshopt bufferView 재압축 확인용). */
function readGlbJson(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`GLB 매직이 아닙니다: ${path}`);
  const jsonLen = buf.readUInt32LE(12);
  if (buf.toString('ascii', 16, 20) !== 'JSON') throw new Error(`첫 청크가 JSON 이 아닙니다: ${path}`);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

/** 양자화 int16 3튜플 → 단일 number 키. (v+32768) ∈ [0,65535] 이므로
 *  x·2^32 + y·2^16 + z < 2^48 < 2^53 — 충돌 없는 정확 패킹.
 *  타일 경계 공유 정점 판정(vertex_lock)에 쓴다 — 모든 타일 노드가 동일 TRS 라
 *  양자화 정수가 같으면 월드 좌표도 비트 동일하다. */
const packPos = (x, y, z) => (x + 32768) * 4294967296 + (y + 32768) * 65536 + (z + 32768);

const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)}MB`;
const fmtN = (n) => n.toLocaleString('en-US');

// ---------------------------------------------------------------------------
// 1. 입력 읽기 + 모드 판별(신규 타일링 vs LOD-only) + 전제 검증
// ---------------------------------------------------------------------------
console.log(`입력: ${inPath}`);
const io = createIO();
const doc = await io.read(inPath);
const root = doc.getRoot();

const scene = root.getDefaultScene() ?? root.listScenes()[0];
if (!scene) {
  console.error('scene 이 없습니다.');
  process.exit(1);
}
const meshNodes = root.listNodes().filter((n) => n.getMesh());
if (meshNodes.some((n) => /-lod\d+$/.test(n.getName()))) {
  console.error('이미 LOD 체인이 있는 파일입니다 — 중복 추가를 막습니다. 타일 구조(LOD 없음) 파일로 다시 실행하세요.');
  process.exit(1);
}
const alreadyTiled = meshNodes.some((n) => TILE_NAME_RE.test(n.getName()));

let srcNode = null;
let srcMesh = null;
if (alreadyTiled) {
  // LOD-only 모드 전제: 모든 mesh 노드가 타일이고 scene 직속이며 좌표가 유일.
  const bad = meshNodes.filter((n) => !TILE_NAME_RE.test(n.getName()));
  if (bad.length > 0) {
    console.error(`타일 구조 입력에 타일이 아닌 mesh 노드가 섞여 있습니다: ${bad.map((n) => n.getName()).join(', ')}`);
    process.exit(1);
  }
  if (meshNodes.some((n) => scene.listChildren().indexOf(n) === -1)) {
    console.error('타일 노드가 scene 직속이 아닙니다 — LOD 형제 노드의 TRS 복제가 성립하지 않습니다.');
    process.exit(1);
  }
  if (new Set(meshNodes.map((n) => n.getName())).size !== meshNodes.length) {
    console.error('타일 좌표가 중복된 노드가 있습니다.');
    process.exit(1);
  }
  if (!LOD) {
    console.error('입력이 이미 타일 구조입니다 — --lod 없이는 할 일이 없습니다 (재타일링은 멱등이 아니라 지원하지 않음).');
    process.exit(1);
  }
  if (gridArg) console.warn('경고: 입력이 이미 타일 구조라 --grid 는 무시됩니다.');
} else {
  if (meshNodes.length !== 1) {
    console.error(
      `mesh 노드가 정확히 1개여야 합니다 (현재 ${meshNodes.length}개) — ` +
        'philly-terrain 구조(단일 Terrain 노드) 전용 스크립트입니다.',
    );
    process.exit(1);
  }
  srcNode = meshNodes[0];
  if (scene.listChildren().indexOf(srcNode) === -1) {
    // 타일 노드에 srcNode 의 local TRS 를 복제하므로, 부모가 scene 이 아니면
    // world transform 이 달라진다. 현재 자산은 scene 직속이다.
    console.error('Terrain 노드가 scene 직속이 아닙니다 — 상위 transform 이 있어 이 스크립트로는 처리할 수 없습니다.');
    process.exit(1);
  }
  srcMesh = srcNode.getMesh();
}

const inStats = docCounts(doc);
const inBounds = getBounds(scene);
const inSize = statSync(inPath).size;
console.log(
  `  prims=${inStats.prims} tris=${fmtN(inStats.tris)} verts=${fmtN(inStats.verts)} ` +
    `size=${fmtMB(inSize)} materials=${root.listMaterials().length}` +
    (alreadyTiled ? ` — 이미 타일 구조(${meshNodes.length}타일), 타일링 건너뜀` : ''),
);

// 입력 프리미티브 공통 전제(indexed TRIANGLES) + 머티리얼별 삼각형 수(검증 4).
const inputPrims = alreadyTiled
  ? meshNodes.flatMap((n) => n.getMesh().listPrimitives())
  : srcMesh.listPrimitives();
const inTrisByMaterial = new Map();
for (const prim of inputPrims) {
  if (prim.getMode() !== 4) {
    console.error(`mode=TRIANGLES(4) 가 아닌 프리미티브가 있습니다: mode=${prim.getMode()}`);
    process.exit(1);
  }
  if (!prim.getIndices()) {
    console.error('인덱스 없는 프리미티브가 있습니다 — 이 스크립트는 indexed TRIANGLES 전제입니다.');
    process.exit(1);
  }
  const mat = prim.getMaterial();
  inTrisByMaterial.set(mat, (inTrisByMaterial.get(mat) ?? 0) + primTris(prim));
}

const buffer = root.listBuffers()[0];

// 타일링 스테이지가 채우는 상태 — LOD-only 모드에선 비어 있다.
const bakeGroups = new Map(); // signature → { baked: Material(흰색+정점색), members: Material[] }
const bakeTable = new Map(); // 원본 Material → { quad: [u16 ×4], err: number }
let bakeErrMax = 0;
let tileTris = []; // { gx, gz, tris } — 리포트용 (신규 타일링 모드)
let builtCounts = null;
let weldedCounts = null;

if (!alreadyTiled) {
  const srcPrims = srcMesh.listPrimitives();

  // -------------------------------------------------------------------------
  // 2. 굽기 대상 판정 + factor → unorm16 변환표
  // -------------------------------------------------------------------------
  for (const mat of new Set(srcPrims.map((p) => p.getMaterial()))) {
    const sig = bakeSignature(mat);
    if (sig === null) continue; // 텍스처/확장 보유(overlay 등) — 그대로 유지
    if (!bakeGroups.has(sig)) {
      const params = JSON.parse(sig);
      const baked = doc
        .createMaterial('terrain-baked')
        .setBaseColorFactor([1, 1, 1, 1]) // 색은 전부 COLOR_0 로 이동
        .setMetallicFactor(params.metallic)
        .setRoughnessFactor(params.roughness)
        .setEmissiveFactor(params.emissive)
        .setDoubleSided(params.doubleSided)
        .setAlphaMode(params.alphaMode)
        .setAlphaCutoff(params.alphaCutoff);
      bakeGroups.set(sig, { baked, members: [] });
    }
    bakeGroups.get(sig).members.push(mat);

    const factor = mat.getBaseColorFactor();
    const quad = factor.map((c) => Math.min(65535, Math.max(0, Math.round(c * 65535))));
    const err = Math.max(...factor.map((c, i) => Math.abs(c - quad[i] / 65535)));
    bakeErrMax = Math.max(bakeErrMax, err);
    bakeTable.set(mat, { quad, err });
  }
  // 시그니처가 2개 이상이면 병합 후에도 정점색 머티리얼이 그 수만큼 남는다 —
  // philly-terrain 실측은 1개(28개 머티리얼 전부 동일 파라미터)다.
  console.log(
    `굽기: 무텍스처 lit ${bakeTable.size}개 머티리얼 → 정점색 머티리얼 ${bakeGroups.size}개, ` +
      `유지 ${root.listMaterials().length - bakeTable.size - bakeGroups.size}개, ` +
      `factor→unorm16 오차 최대 ${bakeErrMax.toExponential(3)} (허용 ${(1 / 65535).toExponential(3)})`,
  );

  // -------------------------------------------------------------------------
  // 3. 삼각형 centroid 버킷팅 (월드 XZ 그리드)
  // -------------------------------------------------------------------------
  // 노드 world matrix(양자화 해제 scale 포함)를 적용한 미터 좌표로 버킷팅한다 —
  // 리서치 시뮬레이션(terrain-tiling.mjs)과 동일 기준이라 타일 분포가 그대로
  // 재현된다. column-major mat4.
  const M = srcNode.getWorldMatrix();
  const applyXZ = (x, y, z) => [
    M[0] * x + M[4] * y + M[8] * z + M[12],
    M[2] * x + M[6] * y + M[10] * z + M[14],
  ];

  const primInfos = srcPrims.map((prim) => {
    const mat = prim.getMaterial();
    const semantics = prim.listSemantics().sort();
    const attrs = semantics.map((sem) => {
      const acc = prim.getAttribute(sem);
      return {
        sem,
        array: acc.getArray(),
        elSize: acc.getElementSize(),
        normalized: acc.getNormalized(),
        type: acc.getType(),
        ctor: acc.getArray().constructor,
      };
    });
    const pos = prim.getAttribute('POSITION');
    if (pos.getCount() >= 2 ** 25) {
      // 버킷 정점 키가 primIdx*2^25 + vertIdx 라 상한을 확인한다(실측 최대 ~2.5M).
      console.error(`프리미티브 정점 수가 2^25 를 넘습니다: ${pos.getCount()}`);
      process.exit(1);
    }
    return {
      mat,
      attrs,
      attrSig: attrs.map((a) => `${a.sem}:${a.ctor.name}${a.normalized ? 'n' : ''}x${a.elSize}`).join('+'),
      posArray: pos.getArray(),
      denorm: denormalizer(pos.getArray()),
      idx: prim.getIndices().getArray(),
      bake: bakeTable.get(mat) ?? null,
      groupKey: bakeTable.has(mat) ? `baked:${bakeSignature(mat)}` : `mat:${root.listMaterials().indexOf(mat)}`,
    };
  });

  // 그룹 안에서 attribute 구성이 다르면 정점 스트림을 합칠 수 없다 — 전제 확인.
  const groupSig = new Map();
  for (const info of primInfos) {
    const prev = groupSig.get(info.groupKey);
    if (prev && prev !== info.attrSig) {
      console.error(`같은 그룹의 attribute 구성이 다릅니다: ${info.groupKey}\n  ${prev}\n  ${info.attrSig}`);
      process.exit(1);
    }
    groupSig.set(info.groupKey, info.attrSig);
  }

  // 전체 월드 AABB (그리드 기준). getBounds 와 같은 클램프 규칙으로 계산한다.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const { posArray, denorm } of primInfos) {
    for (let i = 0; i < posArray.length; i += 3) {
      const [wx, wz] = applyXZ(denorm(posArray[i]), denorm(posArray[i + 1]), denorm(posArray[i + 2]));
      if (wx < minX) minX = wx;
      if (wx > maxX) maxX = wx;
      if (wz < minZ) minZ = wz;
      if (wz > maxZ) maxZ = wz;
    }
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  console.log(
    `그리드: ${GRID}x${GRID}, XZ span ${spanX.toFixed(0)}m × ${spanZ.toFixed(0)}m ` +
      `(타일 ${(spanX / GRID).toFixed(0)}m × ${(spanZ / GRID).toFixed(0)}m)`,
  );

  // buckets[tileKey] = Map<groupKey, { primOfTri: number[], indices: number[] }>
  const buckets = new Map();
  for (let p = 0; p < primInfos.length; p++) {
    const { posArray, denorm, idx, groupKey } = primInfos[p];
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3;
      const i1 = idx[t + 1] * 3;
      const i2 = idx[t + 2] * 3;
      // 삼각형 centroid — 한 삼각형은 정확히 한 타일에만 속한다(경계 분할 없음).
      const cx =
        (denorm(posArray[i0]) + denorm(posArray[i1]) + denorm(posArray[i2])) / 3;
      const cy =
        (denorm(posArray[i0 + 1]) + denorm(posArray[i1 + 1]) + denorm(posArray[i2 + 1])) / 3;
      const cz =
        (denorm(posArray[i0 + 2]) + denorm(posArray[i1 + 2]) + denorm(posArray[i2 + 2])) / 3;
      const [wx, wz] = applyXZ(cx, cy, cz);
      const gx = Math.min(GRID - 1, Math.max(0, Math.floor(((wx - minX) / spanX) * GRID)));
      const gz = Math.min(GRID - 1, Math.max(0, Math.floor(((wz - minZ) / spanZ) * GRID)));
      const tileKey = gz * GRID + gx;
      let tile = buckets.get(tileKey);
      if (!tile) buckets.set(tileKey, (tile = new Map()));
      let group = tile.get(groupKey);
      if (!group) tile.set(groupKey, (group = { primOfTri: [], indices: [] }));
      group.primOfTri.push(p);
      group.indices.push(idx[t], idx[t + 1], idx[t + 2]);
    }
  }

  // -------------------------------------------------------------------------
  // 4. 타일별 node/mesh/primitive 구성 (accessor 는 타일 간 공유 금지)
  // -------------------------------------------------------------------------
  const srcT = srcNode.getTranslation();
  const srcR = srcNode.getRotation();
  const srcS = srcNode.getScale();

  const sortedTileKeys = [...buckets.keys()].sort((a, b) => a - b);

  for (const tileKey of sortedTileKeys) {
    const gx = tileKey % GRID;
    const gz = Math.floor(tileKey / GRID);
    const name = `terrain-tile-${gx}-${gz}`;
    const mesh = doc.createMesh(name).setExtras({ tile: [gx, gz] });

    let trisInTile = 0;
    for (const [groupKey, group] of buckets.get(tileKey)) {
      const triCount = group.primOfTri.length;
      trisInTile += triCount;
      const isBaked = groupKey.startsWith('baked:');
      // 그룹 대표 프리미티브의 attribute 구성(그룹 내 동일 — 위에서 검증).
      const proto = primInfos[group.primOfTri[0]];

      // 소스 (primIdx, vertIdx) 단위로 중복 없이 정점을 복사한다. 소스가 이미
      // 공유하던 정점은 여기서도 공유되고, 프리미티브 경계를 넘는 bitwise 중복은
      // 이후 weld() 가 병합한다.
      const maxVerts = triCount * 3;
      const outAttrs = proto.attrs.map((a) => ({ ...a, out: new a.ctor(maxVerts * a.elSize) }));
      const outColor = isBaked ? new Uint16Array(maxVerts * 4) : null;
      const outIdx = new Uint32Array(triCount * 3);
      const vmap = new Map();
      let vertCount = 0;

      for (let t = 0; t < triCount; t++) {
        const p = group.primOfTri[t];
        const info = primInfos[p];
        for (let c = 0; c < 3; c++) {
          const srcIdx = group.indices[t * 3 + c];
          const key = p * 0x2000000 + srcIdx;
          let dst = vmap.get(key);
          if (dst === undefined) {
            dst = vertCount++;
            vmap.set(key, dst);
            for (let a = 0; a < outAttrs.length; a++) {
              const { array, elSize, out } = outAttrs[a];
              // 그룹 내 attr 순서는 semantics 정렬로 동일 — info.attrs[a] 가 대응.
              const src = info.attrs[a].array;
              for (let k = 0; k < elSize; k++) out[dst * elSize + k] = src[srcIdx * elSize + k];
            }
            if (outColor) {
              const quad = info.bake.quad;
              outColor[dst * 4] = quad[0];
              outColor[dst * 4 + 1] = quad[1];
              outColor[dst * 4 + 2] = quad[2];
              outColor[dst * 4 + 3] = quad[3];
            }
          }
          outIdx[t * 3 + c] = dst;
        }
      }

      const prim = doc.createPrimitive().setMode(4);
      prim.setMaterial(isBaked ? bakeGroups.get(groupKey.slice(6)).baked : proto.mat);
      for (const a of outAttrs) {
        const acc = doc
          .createAccessor()
          .setType(a.type)
          .setNormalized(a.normalized)
          .setArray(a.out.slice(0, vertCount * a.elSize))
          .setBuffer(buffer);
        prim.setAttribute(a.sem, acc);
      }
      if (outColor) {
        const acc = doc
          .createAccessor()
          .setType('VEC4')
          .setNormalized(true)
          .setArray(outColor.slice(0, vertCount * 4))
          .setBuffer(buffer);
        prim.setAttribute('COLOR_0', acc);
      }
      // 인덱스는 일단 u32 — weld()/reorder() 가 병합 후 u16 으로 자동 축소한다.
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(outIdx).setBuffer(buffer));
      mesh.addPrimitive(prim);
    }

    // 원본 노드의 TRS 복제 — 양자화 해제 scale(9449.15)이 그대로라 정점 정수값이
    // 비트 동일해도 월드 좌표가 입력과 일치한다.
    const node = doc
      .createNode(name)
      .setMesh(mesh)
      .setTranslation(srcT)
      .setRotation(srcR)
      .setScale(srcS)
      .setExtras({ tile: [gx, gz] });
    scene.addChild(node);
    tileTris.push({ gx, gz, tris: trisInTile });
  }

  // 원본 노드·메시·굽힌 머티리얼 제거 (고아 accessor 는 prune 이 정리).
  for (const prim of srcMesh.listPrimitives()) prim.dispose();
  srcMesh.dispose();
  srcNode.dispose();
  for (const mat of bakeTable.keys()) mat.dispose();

  builtCounts = docCounts(doc);
  console.log(
    `타일링: 타일 ${tileTris.length}/${GRID * GRID}개, 프리미티브 ${builtCounts.prims}개, ` +
      `verts(경계 복제 후) ${fmtN(builtCounts.verts)}`,
  );

  // -------------------------------------------------------------------------
  // 5. weld → prune → reorder (meshopt 재인코딩 write 준비)
  // -------------------------------------------------------------------------
  // weld: 헤더 주석 참고 — bitwise exact, 속성 포함.
  // prune: keepAttributes/keepIndices/keepExtras 명시 — 기본값이 무텍스처 프리미
  //        티브의 TEXCOORD_0 와 extras 를 제거하기 때문(헤더 주석 참고).
  // reorder: meshopt 압축률을 위한 무손실 정점 순서 최적화(타일 분할로 흐트러진
  //        지역성 복원). 내부 cleanup 은 accessor 한정 + keep* true 라 안전.
  //        LOD 스테이지는 반드시 이 뒤에 온다 — LOD 인덱스가 reorder 후의 정점
  //        순서를 참조해야 하고, 반대로 LOD 프리미티브가 생긴 뒤 reorder 를
  //        돌리면 공유 정점 accessor 가 프리미티브마다 따로 재배열되어 깨진다.
  await doc.transform(
    weld(),
    prune({ keepAttributes: true, keepIndices: true, keepExtras: true }),
    reorder({ encoder: MeshoptEncoder, target: 'size' }),
  );

  weldedCounts = docCounts(doc);
}

// 여기서의 doc 상태가 "LOD0" = --lod 없이 돌렸을 때 그대로 기록될 지오메트리다.
// LOD 스테이지는 이 상태에 인덱스 accessor 와 형제 노드를 "추가"만 한다.
const expectedTileCount = root.listNodes().filter((n) => n.getMesh() && TILE_NAME_RE.test(n.getName())).length;

// ---------------------------------------------------------------------------
// 6. LOD 체인 생성 (--lod) — 헤더 주석 "LOD 체인" 참고
// ---------------------------------------------------------------------------
const lodStats = {
  lockedUnique: 0, // 2개 이상 타일에 등장해 lock 된 고유 위치 수
  lockedInstances: 0, // lock 플래그가 1 인 정점 인스턴스 수(실 정점 기준, 프리미티브 합)
  realVerts: 0, // 실 정점 수 합(프리미티브 기준)
  shadowVerts: 0, // shadow weld 후 정점 수 합 — 헤더 주석 "shadow weld" 참고
  byLevel: new Map(
    LOD_LEVELS.map(({ lod }) => [lod, { tris: 0, prims: 0, nodes: 0, emptyPrims: 0, maxErr: 0, restoredTris: 0 }]),
  ),
};

if (LOD) {
  const t0 = Date.now();
  const tileEntries = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = TILE_NAME_RE.exec(node.getName());
    if (!m) continue;
    tileEntries.push({ node, mesh, gx: Number(m[1]), gz: Number(m[2]) });
  }

  // 전제: 모든 타일 노드의 TRS 동일(경계 정점 판정이 양자화 정수 비교라서),
  // POSITION 은 int16 normalized (packPos 의 값 범위 전제).
  const trsKey = (n) => JSON.stringify([n.getTranslation(), n.getRotation(), n.getScale()]);
  const trs0 = trsKey(tileEntries[0].node);
  if (tileEntries.some(({ node }) => trsKey(node) !== trs0)) {
    console.error('타일 노드들의 TRS 가 서로 다릅니다 — 경계 정점 판정(양자화 정수 비교)이 성립하지 않습니다.');
    process.exit(1);
  }
  for (const { node, mesh } of tileEntries) {
    for (const prim of mesh.listPrimitives()) {
      const acc = prim.getAttribute('POSITION');
      if (!(acc.getArray() instanceof Int16Array) || !acc.getNormalized()) {
        console.error(`${node.getName()}: POSITION 이 int16 normalized 가 아닙니다 — LOD 스테이지 전제 위반.`);
        process.exit(1);
      }
    }
  }

  // 6-1. LOD0 노드/메시에 lod:0 extras 도장 — 런타임이 lod 유무로 그룹핑한다.
  for (const { node, mesh, gx, gz } of tileEntries) {
    node.setExtras({ ...node.getExtras(), tile: [gx, gz], lod: 0, lodError: 0 });
    mesh.setExtras({ ...mesh.getExtras(), tile: [gx, gz], lod: 0, lodError: 0 });
  }

  // 6-2. 타일 경계 공유 정점 판정 — 위치(양자화 정수 3튜플)가 2개 이상 타일에
  //      등장하면 lock. 같은 타일 안의 중복(속성 seam·프리미티브 간 공유)은
  //      잠그지 않는다 — simplify 가 seam 을 자체 처리하고, 잠글수록 달성률이
  //      떨어지므로 크랙 방지에 필요한 최소 집합만 잠근다.
  const posFirstTile = new Map(); // packed → 첫 등장 타일 index
  const lockedPositions = new Set(); // packed (2개 이상 타일)
  tileEntries.forEach(({ mesh }, tileIndex) => {
    for (const prim of mesh.listPrimitives()) {
      const raw = prim.getAttribute('POSITION').getArray();
      for (let i = 0; i < raw.length; i += 3) {
        const key = packPos(raw[i], raw[i + 1], raw[i + 2]);
        const first = posFirstTile.get(key);
        if (first === undefined) posFirstTile.set(key, tileIndex);
        else if (first !== tileIndex) lockedPositions.add(key);
      }
    }
  });
  lodStats.lockedUnique = lockedPositions.size;

  // 6-3. 타일·프리미티브별 simplify → LOD 프리미티브/노드 생성.
  const M = tileEntries[0].node.getWorldMatrix(); // 전 타일 동일(위에서 검증)
  const EMPTY_F32 = new Float32Array(0);
  for (const { node, mesh, gx, gz } of tileEntries) {
    // 프리미티브별 simplify 입력을 한 번만 만들어 세 레벨에 재사용한다.
    // simplify 는 shadow weld 공간에서 돈다(헤더 주석 "shadow weld" — 저장
    // 스트림 그대로는 flat shading 노멀 wedge 가 complex 정점으로 잠겨 잔존
    // ~90%). 저장 정점·LOD0 은 여기서 절대 건드리지 않는다.
    const primPre = mesh.listPrimitives().map((prim) => {
      const posAcc = prim.getAttribute('POSITION');
      const raw = posAcc.getArray();
      const vertCount = posAcc.getCount();
      const denorm = denormalizer(raw);

      // shadow 키에 넣을 "렌더 보존 속성": COLOR_0 은 항상(색 경계는 보임),
      // TEXCOORD_* 는 머티리얼에 텍스처가 있을 때만(무텍스처 lit 의 UV 는
      // 렌더 무관). NORMAL 은 넣지 않는다 — 근거·허용 이유는 헤더 주석.
      const mat = prim.getMaterial();
      const hasTexture = !!(
        mat &&
        (mat.getBaseColorTexture() ||
          mat.getMetallicRoughnessTexture() ||
          mat.getNormalTexture() ||
          mat.getOcclusionTexture() ||
          mat.getEmissiveTexture())
      );
      const keyArrays = [];
      for (const sem of prim.listSemantics()) {
        if (sem === 'COLOR_0' || (sem.startsWith('TEXCOORD_') && hasTexture)) {
          const acc = prim.getAttribute(sem);
          keyArrays.push({ array: acc.getArray(), elSize: acc.getElementSize() });
        }
      }

      const srcIdx = prim.getIndices().getArray();
      // 바인딩이 u16 입력도 받지만(내부 변환) 명시적으로 u32 로 맞춘다.
      const realIdx = srcIdx instanceof Uint32Array ? srcIdx : new Uint32Array(srcIdx);
      // 실 정점 참조 수 — 폴백 wedge 는 참조가 가장 많은 것(지배 면의 노멀).
      const refCount = new Uint32Array(vertCount);
      for (let i = 0; i < realIdx.length; i++) refCount[realIdx[i]] += 1;

      // shadow weld: 위치(양자화 정수)+키 속성(원시 정수)이 같은 wedge 병합.
      const remap = new Map(); // key 문자열 → shadow index
      const vmap = new Uint32Array(vertCount); // real → shadow
      const w2v = []; // shadow → 지배 wedge(real index)
      for (let i = 0; i < vertCount; i++) {
        let key = `${raw[i * 3]},${raw[i * 3 + 1]},${raw[i * 3 + 2]}`;
        for (const { array, elSize } of keyArrays) {
          key += '|';
          for (let k = 0; k < elSize; k++) key += `${array[i * elSize + k]},`;
        }
        let s = remap.get(key);
        if (s === undefined) {
          s = w2v.length;
          remap.set(key, s);
          w2v.push(i);
        } else if (refCount[i] > refCount[w2v[s]]) {
          w2v[s] = i;
        }
        vmap[i] = s;
      }
      const shadowCount = w2v.length;
      lodStats.realVerts += vertCount;
      lodStats.shadowVerts += shadowCount;

      // shadow 정점의 디퀀타이즈 float 미터 좌표 — 같은 shadow 정점의 wedge 는
      // 위치 정수가 동일하므로 어느 wedge 로 계산해도 같다.
      const posF32 = new Float32Array(shadowCount * 3);
      for (let s = 0; s < shadowCount; s++) {
        const i = w2v[s];
        const x = denorm(raw[i * 3]);
        const y = denorm(raw[i * 3 + 1]);
        const z = denorm(raw[i * 3 + 2]);
        posF32[s * 3] = M[0] * x + M[4] * y + M[8] * z + M[12];
        posF32[s * 3 + 1] = M[1] * x + M[5] * y + M[9] * z + M[13];
        posF32[s * 3 + 2] = M[2] * x + M[6] * y + M[10] * z + M[14];
      }
      // 경계 lock — wedge 중 하나라도 경계 위치면 shadow 정점을 잠근다.
      const lock = new Uint8Array(shadowCount);
      for (let i = 0; i < vertCount; i++) {
        if (lockedPositions.has(packPos(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]))) {
          lock[vmap[i]] = 1;
          lodStats.lockedInstances += 1;
        }
      }
      const shadowIdx = new Uint32Array(realIdx.length);
      for (let i = 0; i < realIdx.length; i++) shadowIdx[i] = vmap[realIdx[i]];

      // 살아남은 삼각형의 원본 wedge 복원용: shadow 3튜플(코너 순서 그대로 —
      // meshopt 는 남는 삼각형의 순서를 보존한다) → 원본 삼각형 오프셋.
      const triMap = new Map();
      for (let t = 0; t < shadowIdx.length; t += 3) {
        const key = `${shadowIdx[t]},${shadowIdx[t + 1]},${shadowIdx[t + 2]}`;
        if (!triMap.has(key)) triMap.set(key, t);
      }

      return { prim, posF32, lock, shadowIdx, w2v, realIdx, triMap, vertCount };
    });

    for (const { lod, error } of LOD_LEVELS) {
      const stat = lodStats.byLevel.get(lod);
      const lodName = `${node.getName()}-lod${lod}`;
      const lodMesh = doc.createMesh(lodName).setExtras({ tile: [gx, gz], lod, lodError: error });
      for (const pre of primPre) {
        const [resIdx, achievedErr] = MeshoptSimplifier.simplifyWithAttributes(
          pre.shadowIdx,
          pre.posF32,
          3,
          EMPTY_F32,
          0,
          [],
          pre.lock,
          0, // targetIndexCount 0 — 오차 상한(ErrorAbsolute)이 실질 제약
          error,
          SIMPLIFY_FLAGS,
        );
        if (resIdx.length === 0) {
          // Prune 이 전부 걷어냄(타일 내용 전체가 오차 이하) — 프리미티브 생략.
          stat.emptyPrims += 1;
          continue;
        }
        // shadow → 실 정점 되매핑: 원본과 같은 삼각형이면 원본 wedge 그대로
        // (렌더 변화 0), collapse 로 바뀐 삼각형만 지배 wedge 폴백(위치·색·UV
        // 정확, 노멀만 국소 변화 — 헤더 주석 참고).
        const mapped = new Uint32Array(resIdx.length);
        for (let t = 0; t < resIdx.length; t += 3) {
          const orig = pre.triMap.get(`${resIdx[t]},${resIdx[t + 1]},${resIdx[t + 2]}`);
          if (orig !== undefined) {
            mapped[t] = pre.realIdx[orig];
            mapped[t + 1] = pre.realIdx[orig + 1];
            mapped[t + 2] = pre.realIdx[orig + 2];
            stat.restoredTris += 1;
          } else {
            mapped[t] = pre.w2v[resIdx[t]];
            mapped[t + 1] = pre.w2v[resIdx[t + 1]];
            mapped[t + 2] = pre.w2v[resIdx[t + 2]];
          }
        }
        // 정점 accessor 는 LOD0 의 것을 그대로 참조 — 인덱스만 새로 만든다.
        // 컴포넌트 타입은 실 정점 수에 맞춰 최소로(u16 이면 절반 크기).
        const IdxCtor = pre.vertCount > 65535 ? Uint32Array : Uint16Array;
        const idxAcc = doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(IdxCtor === Uint32Array ? mapped : new IdxCtor(mapped))
          .setBuffer(buffer);
        const lodPrim = doc
          .createPrimitive()
          .setMode(4)
          .setMaterial(pre.prim.getMaterial())
          .setIndices(idxAcc);
        for (const sem of pre.prim.listSemantics()) lodPrim.setAttribute(sem, pre.prim.getAttribute(sem));
        lodMesh.addPrimitive(lodPrim);
        stat.prims += 1;
        stat.tris += resIdx.length / 3;
        stat.maxErr = Math.max(stat.maxErr, achievedErr); // ErrorAbsolute → 미터
      }
      if (lodMesh.listPrimitives().length === 0) {
        lodMesh.dispose();
        continue;
      }
      // 형제 노드 — 타일 노드와 같은 TRS(scene 직속, 위에서 검증).
      const lodNode = doc
        .createNode(lodName)
        .setMesh(lodMesh)
        .setTranslation(node.getTranslation())
        .setRotation(node.getRotation())
        .setScale(node.getScale())
        .setExtras({ tile: [gx, gz], lod, lodError: error });
      scene.addChild(lodNode);
      stat.nodes += 1;
    }
  }

  const lod0Tris = docCounts(doc).tris - [...lodStats.byLevel.values()].reduce((s, v) => s + v.tris, 0);
  console.log(
    `LOD: 경계 lock 위치 ${fmtN(lodStats.lockedUnique)}개(정점 인스턴스 ${fmtN(lodStats.lockedInstances)}개), ` +
      `shadow weld ${fmtN(lodStats.realVerts)} → ${fmtN(lodStats.shadowVerts)} verts(simplify 입력 전용), ` +
      `${Date.now() - t0}ms`,
  );
  for (const { lod, error } of LOD_LEVELS) {
    const s = lodStats.byLevel.get(lod);
    console.log(
      `  LOD${lod}(오차 ${error}m): tris ${fmtN(s.tris)} (${((s.tris / lod0Tris) * 100).toFixed(1)}%), ` +
        `노드 ${s.nodes}개·프리미티브 ${s.prims}개(빈 프리미티브 생략 ${s.emptyPrims}개), ` +
        `원본 wedge 복원 ${((s.restoredTris / Math.max(s.tris, 1)) * 100).toFixed(1)}%, ` +
        `달성 오차 최대 ${s.maxErr.toFixed(2)}m`,
    );
  }
}

// ---------------------------------------------------------------------------
// 7. meshopt 재인코딩 write
// ---------------------------------------------------------------------------
// weld/reorder 가 만든 새 accessor 는 buffer 미지정일 수 있다 — meshopt 인코더가
// buffer 없는 accessor 를 거부하므로 여기서 일괄 지정한다.
for (const acc of root.listAccessors()) {
  if (!acc.getBuffer()) acc.setBuffer(buffer);
}

// EXT_meshopt_compression 재인코딩 옵션 고정 — QUANTIZE = 필터 없는 무손실
// 바이트 인코딩(헤더 주석 참고. FILTER 는 NORMAL 손실이라 금지).
doc
  .createExtension(EXTMeshoptCompression)
  .setRequired(true)
  .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

mkdirSync(dirname(outPath), { recursive: true });
await io.write(outPath, doc);
const outSize = statSync(outPath).size;
console.log(`쓰기 완료: ${outPath} (${fmtMB(outSize)})`);

// ---------------------------------------------------------------------------
// 8. 내장 검증 — 출력을 다시 읽어 원본과 대조
// ---------------------------------------------------------------------------
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${message}`);
};
// 경고 — 실패로 치지 않는 항목(실측 기대 밴드·파일 크기 목표).
const warnings = [];
const warn = (ok, message) => {
  if (!ok) warnings.push(message);
  console.log(`  ${ok ? 'PASS' : 'WARN'}  ${message}`);
};

console.log('검증:');
const outDoc = await createIO().read(outPath);
const outRoot = outDoc.getRoot();
const outScene = outRoot.getDefaultScene() ?? outRoot.listScenes()[0];
const outBounds = getBounds(outScene);

// 출력 노드 분류 — 이후 검증의 공통 재료. 이름이 규약을 벗어나면 (5)에서 잡힌다.
const outEntries = [];
let namesOk = true;
for (const node of outRoot.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  const m = TILE_OR_LOD_NAME_RE.exec(node.getName());
  if (!m) {
    namesOk = false;
    continue;
  }
  outEntries.push({ node, mesh, gx: Number(m[1]), gz: Number(m[2]), lod: m[3] ? Number(m[3]) : 0 });
}
const outTrisByLod = new Map();
for (const e of outEntries) {
  for (const prim of e.mesh.listPrimitives()) {
    outTrisByLod.set(e.lod, (outTrisByLod.get(e.lod) ?? 0) + primTris(prim));
  }
}
const outLod0Tris = outTrisByLod.get(0) ?? 0;

// (1) LOD0 삼각형 수 보존 — 타일링·weld·reorder 는 삼각형을 제거하지 않고,
//     LOD 스테이지는 LOD0 지오메트리에 손대지 않는다(추가만).
check(
  outLod0Tris === inStats.tris,
  `LOD0 삼각형 수 보존: ${fmtN(outLod0Tris)} == ${fmtN(inStats.tris)}`,
);

// (2) 월드 bbox 1cm 이내 — LOD 노드는 LOD0 정점 accessor 공유라 bounds 불변.
const bboxDiff = Math.max(
  ...[0, 1, 2].map((k) => Math.abs(outBounds.min[k] - inBounds.min[k])),
  ...[0, 1, 2].map((k) => Math.abs(outBounds.max[k] - inBounds.max[k])),
);
check(bboxDiff <= 0.01, `월드 bbox 차이 ${bboxDiff.toExponential(3)}m <= 0.01m`);

// (3) COLOR_0 굽기 오차 + 저장값 정합 — 타일링을 실행한 경우만(LOD-only 모드는
//     정점 데이터 자체를 만지지 않으므로 대조표가 없다).
if (!alreadyTiled) {
  check(bakeErrMax <= 1 / 65535, `굽기 색 오차 최대 ${bakeErrMax.toExponential(3)} <= ${(1 / 65535).toExponential(3)}`);
  const expectedQuads = new Set([...bakeTable.values()].map(({ quad }) => quad.join(',')));
  const bakedNames = new Set([...bakeGroups.values()].map(({ baked }) => baked.getName()));
  let colorOk = true;
  let colorVerts = 0;
  const scanned = new Set(); // LOD 프리미티브가 공유하는 accessor 는 한 번만 스캔
  for (const mesh of outRoot.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const isBakedPrim = bakedNames.has(prim.getMaterial()?.getName());
      const color = prim.getAttribute('COLOR_0');
      if (!isBakedPrim) {
        if (color) colorOk = false; // 유지 머티리얼(overlay)에 색이 새면 안 된다
        continue;
      }
      if (
        !color ||
        color.getType() !== 'VEC4' ||
        !color.getNormalized() ||
        !(color.getArray() instanceof Uint16Array)
      ) {
        colorOk = false;
        continue;
      }
      if (scanned.has(color)) continue;
      scanned.add(color);
      const arr = color.getArray();
      for (let i = 0; i < arr.length; i += 4) {
        colorVerts += 1;
        if (!expectedQuads.has(`${arr[i]},${arr[i + 1]},${arr[i + 2]},${arr[i + 3]}`)) {
          colorOk = false;
          break;
        }
      }
    }
  }
  check(colorOk, `COLOR_0 unorm16 VEC4 + 저장값이 굽기 표와 일치 (${fmtN(colorVerts)} verts)`);
}

// (4) 머티리얼(그룹)별 LOD0 삼각형 보존 — 굽기 그룹은 합산 비교. LOD 프리미티브
//     는 의도적으로 삼각형이 줄어드니 LOD0 만 대조한다.
{
  const expected = new Map(); // 출력 머티리얼 이름 → 기대 tris
  for (const [mat, tris] of inTrisByMaterial) {
    const info = !alreadyTiled ? bakeTable.get(mat) : null;
    const name = info ? bakeGroups.get(bakeSignature(mat)).baked.getName() : mat.getName();
    expected.set(name, (expected.get(name) ?? 0) + tris);
  }
  const actual = new Map();
  for (const e of outEntries) {
    if (e.lod !== 0) continue;
    for (const prim of e.mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName();
      actual.set(name, (actual.get(name) ?? 0) + primTris(prim));
    }
  }
  const ok =
    expected.size === actual.size &&
    [...expected].every(([name, tris]) => actual.get(name) === tris);
  check(
    ok,
    `머티리얼별 LOD0 삼각형 보존: ${[...expected].map(([n, t]) => `${n}=${fmtN(t)}`).join(', ')}`,
  );
}

// (5) 노드/메시 이름·extras 일관성 — scene-terrain-lod.tsx 가 소비하는 계약:
//     node·mesh 모두 extras { tile:[x,z] }, --lod 시 { lod, lodError } 포함
//     (LOD0 는 lod:0·lodError:0, LOD N 은 상한 미터).
{
  let extrasOk = namesOk;
  let lod0Count = 0;
  for (const e of outEntries) {
    if (e.lod === 0) lod0Count += 1;
    const wantErr = e.lod === 0 ? 0 : LOD_LEVELS.find((l) => l.lod === e.lod)?.error;
    if (!LOD && e.lod !== 0) extrasOk = false; // --lod 없이는 lod 노드가 없어야 한다
    if (wantErr === undefined) extrasOk = false;
    for (const ex of [e.node.getExtras() ?? {}, e.mesh.getExtras() ?? {}]) {
      if (!Array.isArray(ex.tile) || ex.tile[0] !== e.gx || ex.tile[1] !== e.gz) extrasOk = false;
      if (LOD && (ex.lod !== e.lod || ex.lodError !== wantErr)) extrasOk = false;
    }
  }
  check(
    extrasOk && lod0Count === expectedTileCount,
    `타일/LOD node·mesh 이름·extras {tile,lod,lodError} 일관성 (LOD0 ${lod0Count}/${expectedTileCount}타일, ` +
      `LOD 노드 ${outEntries.length - lod0Count}개)`,
  );
}

// (6)+(8) accessor 스코프와 인덱스 범위 — 한 번의 순회로 확인한다.
//   - 타일 간 accessor 공유 금지: three 는 accessor 전체로 bounds 를 계산하므로
//     공유되면 컬링이 죽는다(헤더 주석). LOD 는 같은 타일 안에서만 정점 공유.
//   - 인덱스 accessor 는 프리미티브당 정확히 1개(LOD 마다 새로 만든다는 전제).
//   - --lod: LOD 프리미티브의 attribute accessor 가 같은 타일 LOD0 의 것과 동일
//     객체인지(= 파일 증가가 인덱스뿐이라는 전제), 인덱스가 정점 범위 안인지.
{
  const accTiles = new Map(); // accessor → Set<'gx,gz'>
  const idxUse = new Map(); // index accessor → 참조 프리미티브 수
  const lod0Attrs = new Map(); // 'gx,gz' → Set<attribute accessor>
  let rangeOk = true;
  for (const e of outEntries) {
    const tileKey = `${e.gx},${e.gz}`;
    for (const prim of e.mesh.listPrimitives()) {
      const idxAcc = prim.getIndices();
      idxUse.set(idxAcc, (idxUse.get(idxAcc) ?? 0) + 1);
      for (const acc of [idxAcc, ...prim.listSemantics().map((s) => prim.getAttribute(s))]) {
        let set = accTiles.get(acc);
        if (!set) accTiles.set(acc, (set = new Set()));
        set.add(tileKey);
      }
      if (e.lod === 0) {
        let set = lod0Attrs.get(tileKey);
        if (!set) lod0Attrs.set(tileKey, (set = new Set()));
        for (const s of prim.listSemantics()) set.add(prim.getAttribute(s));
      }
      const vertCount = prim.getAttribute('POSITION').getCount();
      const idx = idxAcc.getArray();
      for (let i = 0; i < idx.length; i++) {
        if (idx[i] >= vertCount) {
          rangeOk = false;
          break;
        }
      }
    }
  }
  const crossTile = [...accTiles.values()].some((set) => set.size > 1);
  const idxShared = [...idxUse.values()].some((n) => n > 1);
  check(!crossTile && !idxShared, 'accessor 타일 간 공유 없음 + 인덱스 accessor 프리미티브당 1개');
  if (LOD) {
    let lodShareOk = true;
    for (const e of outEntries) {
      if (e.lod === 0) continue;
      const set = lod0Attrs.get(`${e.gx},${e.gz}`);
      for (const prim of e.mesh.listPrimitives()) {
        for (const s of prim.listSemantics()) {
          if (!set || !set.has(prim.getAttribute(s))) lodShareOk = false;
        }
      }
    }
    check(lodShareOk, 'LOD 프리미티브가 같은 타일 LOD0 의 정점 accessor 를 공유');
    check(rangeOk, '모든 인덱스가 해당 정점 accessor 범위 안');
  }
}

// (7) meshopt 재압축 확인
{
  const json = readGlbJson(outPath);
  const meshoptViews = (json.bufferViews ?? []).filter(
    (bv) => bv.extensions?.EXT_meshopt_compression,
  ).length;
  const required = (json.extensionsRequired ?? []).includes('EXT_meshopt_compression');
  check(
    meshoptViews > 0 && required,
    `EXT_meshopt_compression 재인코딩 (${meshoptViews}개 bufferView)`,
  );
}

// 경고 항목 — LOD 삼각형 합계가 실측 곡선 기대치 ±20% 밖이면 표시(실패 아님 —
// 곡선은 다운타운 타일 위치-only weld 기준이라 attribute seam·경계 lock 이 있는
// 실 데이터에선 달성률이 낮게 나올 수 있다, r3.json risks 참고). 파일 크기도 동일.
if (LOD) {
  for (const { lod, expectRemain } of LOD_LEVELS) {
    const actual = outTrisByLod.get(lod) ?? 0;
    const expect = Math.round(outLod0Tris * expectRemain);
    const dev = expect > 0 ? actual / expect - 1 : 0;
    warn(
      Math.abs(dev) <= 0.2,
      `LOD${lod} 삼각형 합계 ${fmtN(actual)} — 기대 ${fmtN(expect)}(잔존 ${(expectRemain * 100).toFixed(1)}%) ` +
        `대비 ${dev >= 0 ? '+' : ''}${(dev * 100).toFixed(1)}% (±20% 밴드)`,
    );
  }
  warn(outSize <= 21 * 1024 * 1024, `파일 크기 ${fmtMB(outSize)} <= 목표 21MB`);
}

if (failures.length > 0) {
  console.error(`\n검증 실패 ${failures.length}건 — 출력 파일을 삭제합니다.`);
  try {
    unlinkSync(outPath);
  } catch {
    /* 삭제 실패해도 exit 1 은 유지 */
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 9. 스탯 출력
// ---------------------------------------------------------------------------
console.log('\n=== 결과 ===');
if (!alreadyTiled) {
  tileTris.sort((a, b) => b.tris - a.tris);
  console.log(`타일: ${tileTris.length}/${GRID * GRID} (비어있지 않은 타일만 생성)`);
  console.log(
    `타일별 tris 상위 5: ${tileTris
      .slice(0, 5)
      .map((t) => `(${t.gx},${t.gz})=${fmtN(t.tris)}`)
      .join(', ')}`,
  );
} else {
  console.log(`타일: ${expectedTileCount} (입력의 타일 구조 유지, 타일링 건너뜀)`);
}
const outStats = docCounts(outDoc);
console.log(`프리미티브(드로우콜): ${inStats.prims} → ${outStats.prims}${LOD ? ' (LOD 는 레벨당 1세트만 표시됨)' : ''}`);
console.log(`LOD0 tris: ${fmtN(inStats.tris)} → ${fmtN(outLod0Tris)} (보존)`);
if (LOD) {
  for (const { lod, error } of LOD_LEVELS) {
    const s = lodStats.byLevel.get(lod);
    console.log(
      `LOD${lod} tris(오차 상한 ${error}m): ${fmtN(s.tris)} (LOD0 대비 ${((s.tris / outLod0Tris) * 100).toFixed(1)}%), ` +
        `노드 ${s.nodes}개, 원본 wedge 복원 ${((s.restoredTris / Math.max(s.tris, 1)) * 100).toFixed(1)}%, ` +
        `달성 오차 최대 ${s.maxErr.toFixed(2)}m`,
    );
  }
  console.log(
    `경계 lock: 고유 위치 ${fmtN(lodStats.lockedUnique)}개, 정점 인스턴스 ${fmtN(lodStats.lockedInstances)}개`,
  );
}
if (!alreadyTiled) {
  console.log(
    `verts: ${fmtN(inStats.verts)} → ${fmtN(docUniqueVerts(outDoc))} ` +
      `(경계 복제 ${fmtN(builtCounts.verts)} → weld ${fmtN(weldedCounts.verts)}${LOD ? ', LOD 는 정점 공유라 불변' : ''})`,
  );
} else {
  console.log(`verts(고유 accessor 기준): ${fmtN(docUniqueVerts(outDoc))} (LOD 는 정점 공유라 불변)`);
}
console.log(`파일: ${fmtMB(inSize)} → ${fmtMB(outSize)}${LOD ? ' (목표 <= 21MB)' : ''}`);
if (!alreadyTiled) {
  console.log(`굽기 색 오차 최대: ${bakeErrMax.toExponential(3)} (1/65535 = ${(1 / 65535).toExponential(3)})`);
}
console.log(`월드 bbox 차이 최대: ${bboxDiff.toExponential(3)}m`);
if (warnings.length > 0) {
  console.log(`경고 ${warnings.length}건 (실패 아님 — 검증 출력의 WARN 참고)`);
}
console.log('\n검증 통과. 배포 교체는 assets-src/maps/ 우선 규약을 따르세요 (헤더 주석 참고).');
