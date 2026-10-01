// 3D 자산 라이브러리의 배포 파일 통계 표를 만든다.
//
// 사용법:
//   pnpm assets:stats            # 전체 다시 측정
//   pnpm assets:stats --check    # 표가 현재 파일과 맞는지만 확인(쓰지 않음)
//
// 무엇을 하나:
//   apps/shell/public 의 models·maps·asset-library/files 아래 GLB 와 drawings
//   아래 도면 파일을 훑어 `public/asset-library/stats.json` 에
//   { '/models/x.glb': { hash, bytes, stats } } 를 쓴다. 자산 라이브러리 목록은
//   이 표로 파일 크기·삼각형 수를 보여 주고 정렬한다 — GLB 수십 개를 브라우저가
//   열어 보지 않아도 된다.
//
//   hash 는 자산 해시 매니페스트(vite-plugin-asset-hash.ts)와 같은 값
//   (sha256 앞 8자)이다. GLB 를 교체하고 이 스크립트를 다시 돌리지 않으면
//   --check 가 그 파일을 "오래됨" 으로 보고한다.
//
// 측정 기준은 scripts/scene-perf-report.mjs 의 measureGlb 와 같다 — 드로우콜·
// 삼각형은 노드 사용 기준이고 LOD 사본(extras lod>0)은 뺀다. 브라우저 쪽
// 측정(packages/features/src/asset-library/lib/model-geometry-stats.ts)도 같은
// 기준을 쓴다. 이 스크립트는 항상 측정만 하고 게이트가 아니다(--check 만
// 불일치 시 exit 1).
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = join(repoRoot, 'apps/shell/public');
const OUTPUT_PATH = join(PUBLIC_DIR, 'asset-library/stats.json');

/** 훑을 디렉터리(public 기준)와 받을 확장자. */
const SOURCES = [
  { dir: 'models', extensions: ['glb'] },
  { dir: 'maps', extensions: ['glb'] },
  { dir: 'asset-library/files', extensions: null },
  { dir: 'drawings', extensions: null },
];

const HASH_LENGTH = 8;
const MIPMAP_OVERHEAD = 1.33;

const checkOnly = process.argv.includes('--check');

function collectFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute));
    else if (entry.isFile() && !entry.name.startsWith('.')) files.push(absolute);
  }
  return files;
}

function toPublicPath(absolute) {
  return `/${relative(PUBLIC_DIR, absolute).split(sep).join('/')}`;
}

function hashFile(absolute) {
  return createHash('sha256')
    .update(readFileSync(absolute))
    .digest('hex')
    .slice(0, HASH_LENGTH);
}

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

function countPrimitiveIndices(prim) {
  const indices = prim.getIndices();
  const position = prim.getAttribute('POSITION');
  return indices ? indices.getCount() : position ? position.getCount() : 0;
}

async function measureGlb(absolute) {
  const doc = await io.read(absolute);
  const root = doc.getRoot();

  let drawCalls = 0;
  let triangles = 0;
  let meshes = 0;
  let maxLod = 0;
  for (const node of root.listNodes()) {
    const lod = node.getExtras()?.lod;
    const level = typeof lod === 'number' && lod > 0 ? Math.floor(lod) : 0;
    maxLod = Math.max(maxLod, level);
    const mesh = node.getMesh();
    if (!mesh || level > 0) continue;
    for (const prim of mesh.listPrimitives()) {
      // 메쉬는 프리미티브 단위로 센다 — 브라우저(three)는 프리미티브마다 Mesh 를
      // 하나씩 만들므로 이 기준이어야 두 측정이 같은 수를 낸다.
      meshes += 1;
      drawCalls += 1;
      triangles += Math.floor(countPrimitiveIndices(prim) / 3);
    }
  }

  // 정점은 고유 지오메트리 기준 — LOD 사본은 LOD0 과 정점 accessor 를 공유한다.
  const positions = new Set();
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const position = prim.getAttribute('POSITION');
      if (position) positions.add(position);
    }
  }
  let vertices = 0;
  for (const position of positions) vertices += position.getCount();

  let textureMemoryBytes = 0;
  for (const texture of root.listTextures()) {
    if (texture.getMimeType() === 'image/ktx2') {
      // GPU 압축 텍스처는 압축된 채로 상주한다 — 파일 크기가 근사값이다.
      textureMemoryBytes += texture.getImage()?.byteLength ?? 0;
      continue;
    }
    const size = texture.getSize();
    if (size) textureMemoryBytes += size[0] * size[1] * 4 * MIPMAP_OVERHEAD;
  }

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  let size = null;
  if (scene) {
    const { min, max } = getBounds(scene);
    const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    if (extent.every((n) => Number.isFinite(n) && n >= 0)) {
      size = extent.map((n) => Math.round(n * 1000) / 1000);
    }
  }

  return {
    triangles,
    vertices,
    meshes,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    drawCalls,
    nodes: root.listNodes().length,
    textureMemoryBytes: Math.round(textureMemoryBytes),
    size,
    lodLevels: maxLod + 1,
    animations: root.listAnimations().length,
  };
}

const targets = [];
for (const source of SOURCES) {
  for (const absolute of collectFiles(join(PUBLIC_DIR, source.dir))) {
    const extension = absolute.split('.').pop()?.toLowerCase() ?? '';
    if (source.extensions && !source.extensions.includes(extension)) continue;
    targets.push({ absolute, extension });
  }
}
targets.sort((a, b) => a.absolute.localeCompare(b.absolute));

if (checkOnly) {
  const existing = existsSync(OUTPUT_PATH)
    ? JSON.parse(readFileSync(OUTPUT_PATH, 'utf8'))
    : {};
  const stale = [];
  for (const { absolute } of targets) {
    const key = toPublicPath(absolute);
    if (existing[key]?.hash !== hashFile(absolute)) stale.push(key);
  }
  const known = new Set(targets.map(({ absolute }) => toPublicPath(absolute)));
  const orphaned = Object.keys(existing).filter((key) => !known.has(key));
  if (stale.length === 0 && orphaned.length === 0) {
    console.log(`stats.json 이 현재 파일 ${targets.length}개와 일치합니다.`);
    process.exit(0);
  }
  for (const key of stale) console.log(`오래됨 또는 없음: ${key}`);
  for (const key of orphaned) console.log(`파일이 사라짐: ${key}`);
  console.log('\n`pnpm assets:stats` 로 다시 측정하세요.');
  process.exit(1);
}

const table = {};
let failed = 0;
for (const { absolute, extension } of targets) {
  const key = toPublicPath(absolute);
  const entry = { hash: hashFile(absolute), bytes: statSync(absolute).size };
  if (extension === 'glb') {
    try {
      entry.stats = await measureGlb(absolute);
    } catch (error) {
      // 못 여는 GLB 는 크기·해시만 남긴다 — 표 전체를 포기하지 않는다.
      failed += 1;
      console.warn(`측정 실패(크기만 기록): ${key} — ${error.message}`);
    }
  }
  table[key] = entry;
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, `${JSON.stringify(table, null, 2)}\n`, 'utf8');
console.log(
  `${Object.keys(table).length}개 파일을 측정해 ${relative(repoRoot, OUTPUT_PATH)} 에 썼습니다` +
    (failed > 0 ? ` (측정 실패 ${failed}개).` : '.'),
);
