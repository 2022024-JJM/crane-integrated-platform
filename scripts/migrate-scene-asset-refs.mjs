// 씬 JSON 에 자산 참조를 적는다 — 자산 라이브러리가 모르던 시절의 씬 파일을
// 지금 스키마로 옮기는 도구.
//
// 사용법:
//   node scripts/migrate-scene-asset-refs.mjs          # 고쳐 쓴다
//   node scripts/migrate-scene-asset-refs.mjs --check  # 고칠 것이 있으면 exit 1
//
// 씬은 놓인 모델·지도·배경마다 "어느 자산의 어느 버전인가"(asset: { id,
// version })와 파일 경로를 함께 든다(packages/domain/src/3d/model/types.ts 의
// SceneAssetRef). 에디터가 놓을 때 적어 주지만, 그 전에 저장된 씬에는 경로만
// 있다. 이 스크립트가 `apps/shell/public/asset-library/library.json` 을 읽어:
//
//   - 모델·지도: 경로가 어떤 자산의 어떤 버전 파일인지 찾아 `asset` 을 적는다.
//   - 지도: `role`(ground·context)이 없으면 자산의 배치 속성에서 가져온다
//     (없으면 ground).
//   - 배경: 옛 `environmentId`(코드 카탈로그 id = 자산 id)를
//     `environment: { path, asset }` 로 바꾼다. 카탈로그는 그 자산의 버전 1
//     파일을 가리켰다.
//
// 이미 적혀 있는 값은 건드리지 않는다 — 여러 번 돌려도 결과가 같다. 라이브러리에
// 없는 경로는 그대로 두고 알린다(그 객체는 "라이브러리가 모르는 파일" 로 계속
// 렌더된다).
//
// 대상은 region 에 물린 씬 파일뿐이다(scene-file-map.ts 의 표). 같은 디렉터리에
// 남아 있는, 어느 region 도 쓰지 않는 옛 파일은 건드리지 않는다.
//
// 다른 브랜치의 씬 파일을 합친 뒤처럼, 자산 참조가 빠진 씬이 다시 생겼을 때
// 돌린다. 쓰는 모양은 dev 저장 미들웨어와 같다(JSON 2칸 들여쓰기 + 끝 줄바꿈).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SCENES_DIR = join(repoRoot, 'apps/shell/public/scenes');
const LIBRARY_PATH = join(
  repoRoot,
  'apps/shell/public/asset-library/library.json',
);
const SCENE_FILE_MAP_PATH = join(
  repoRoot,
  'packages/domain/src/3d/model/scene-file-map.ts',
);
const checkOnly = process.argv.includes('--check');

/**
 * region 에 물린 씬 파일 이름들. 표는 TypeScript 라 그대로 import 하지 않고
 * `'region': 'file.json'` 줄에서 파일 이름만 읽는다.
 */
function listSceneFiles() {
  const source = readFileSync(SCENE_FILE_MAP_PATH, 'utf8');
  const files = new Set();
  for (const match of source.matchAll(/:\s*'([\w.-]+\.json)'/g)) {
    files.add(match[1]);
  }
  if (files.size === 0) {
    throw new Error(`씬 파일 표를 읽지 못했다: ${SCENE_FILE_MAP_PATH}`);
  }
  return [...files].sort();
}

const library = JSON.parse(readFileSync(LIBRARY_PATH, 'utf8'));

/** public 절대 경로 → 그 파일의 자산·버전. */
const byPath = new Map();
const byId = new Map();
for (const asset of library.assets ?? []) {
  byId.set(asset.id, asset);
  for (const version of asset.versions ?? []) {
    const ref = version.file?.ref;
    if (ref?.storage !== 'public') continue;
    if (!byPath.has(ref.path)) {
      byPath.set(ref.path, { asset, version: version.version });
    }
  }
}

/** `after` 키 바로 뒤에 `entries` 를 끼운다 — 앱이 새로 만들 때의 키 순서와 맞춘다. */
function insertAfter(object, after, entries) {
  const out = {};
  let inserted = false;
  for (const [key, value] of Object.entries(object)) {
    if (key in entries) continue;
    out[key] = value;
    if (key === after) {
      Object.assign(out, entries);
      inserted = true;
    }
  }
  if (!inserted) Object.assign(out, entries);
  return out;
}

let changedFiles = 0;
let unresolved = 0;

for (const file of listSceneFiles()) {
  const path = join(SCENES_DIR, file);
  const scene = JSON.parse(readFileSync(path, 'utf8'));
  const notes = [];
  let changed = false;

  const withAsset = (item, label) => {
    if (item.asset) return item;
    const found = byPath.get(item.path);
    if (!found) {
      notes.push(`  라이브러리에 없는 경로: ${label} ${item.path}`);
      unresolved += 1;
      return item;
    }
    changed = true;
    return insertAfter(item, 'path', {
      asset: { id: found.asset.id, version: found.version },
    });
  };

  if (Array.isArray(scene.models)) {
    scene.models = scene.models.map((model) => withAsset(model, '모델'));
  }

  if (Array.isArray(scene.maps)) {
    scene.maps = scene.maps.map((map) => {
      let next = withAsset(map, '지도');
      if (!next.role && next.asset) {
        const role = byId.get(next.asset.id)?.placement?.mapRole ?? 'ground';
        // sanitize 가 내는 순서(id, path, locked, asset, role, …)에 맞춘다.
        const { asset, ...rest } = next;
        next = insertAfter(rest, 'locked' in rest ? 'locked' : 'path', {
          asset,
          role,
        });
        changed = true;
      }
      return next;
    });
  }

  if ('environmentId' in scene) {
    const environmentId = scene.environmentId;
    let environment = scene.environment;
    if (!environment && typeof environmentId === 'string') {
      const asset = byId.get(environmentId);
      const first = asset?.versions?.find((version) => version.version === 1);
      if (asset?.kind === 'environment' && first?.file?.ref?.storage === 'public') {
        environment = {
          path: first.file.ref.path,
          asset: { id: asset.id, version: 1 },
        };
      } else {
        notes.push(`  라이브러리에 없는 배경: ${environmentId}`);
        unresolved += 1;
      }
    }
    // 같은 자리에 바꿔 넣는다 — 앱의 저장 순서(배경은 바다 앞)와 같다.
    const out = {};
    for (const [key, value] of Object.entries(scene)) {
      if (key === 'environment') continue;
      if (key === 'environmentId') {
        if (environment) out.environment = environment;
        continue;
      }
      out[key] = value;
    }
    for (const key of Object.keys(scene)) delete scene[key];
    Object.assign(scene, out);
    changed = true;
  }

  if (changed) {
    changedFiles += 1;
    if (!checkOnly) writeFileSync(path, `${JSON.stringify(scene, null, 2)}\n`);
  }
  console.log(`${changed ? (checkOnly ? 'STALE' : 'FIXED') : 'OK   '} ${file}`);
  for (const note of notes) console.log(note);
}

if (unresolved > 0) {
  console.log(`라이브러리로 풀지 못한 참조 ${unresolved}개 — 그 객체는 경로만으로 렌더된다.`);
}
if (checkOnly && changedFiles > 0) {
  console.error(`자산 참조를 적어야 하는 씬 ${changedFiles}개. --check 없이 다시 실행.`);
  process.exit(1);
}
