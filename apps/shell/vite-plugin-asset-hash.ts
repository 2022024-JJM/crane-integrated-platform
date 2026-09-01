import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { Plugin } from 'vite';

/**
 * public/ 정적 자산의 **콘텐츠 해시 매니페스트**를 만들어 가상 모듈로 주입한다.
 *
 * 왜 필요한가: dist/assets/ 의 번들 산출물은 Vite가 파일명에 내용 해시를 넣어
 * 주므로 내용이 바뀌면 URL도 바뀐다 → 캐시 문제가 원천적으로 없다. 반면
 * public/ 의 GLB·씬 JSON·이미지는 파일명이 고정이라, 모델을 교체 배포해도
 * URL이 그대로다. nginx가 `no-cache`(=매번 재검증)를 내려도 앞단 프록시/CDN이나
 * 브라우저의 휴리스틱 캐시가 끼면 옛 파일이 계속 보인다. 사용자가 직접 캐시를
 * 지워야 새 모델이 나오는 상황이 그 증상이다.
 *
 * 해결: URL 뒤에 `?v=<내용해시>`를 붙인다. 내용이 바뀐 파일만 URL이 바뀌므로
 * 그 파일만 다시 받고, 안 바뀐 파일(대부분의 25MB GLB들)은 캐시를 그대로
 * 재사용한다. 배포 전체에 하나의 빌드 버전을 붙이는 방식과 달리 불필요한
 * 재다운로드가 없다.
 *
 * 매니페스트를 별도 JSON으로 fetch 하지 않고 가상 모듈로 번들에 인라인하는
 * 이유: 매니페스트 파일 자체가 캐시되면 같은 문제가 한 겹 되풀이된다. 번들에
 * 넣으면 해시 파일명을 가진 dist/assets/ 청크에 실려 들어가므로 index.html
 * (no-cache) → 새 청크 → 새 매니페스트 순으로 항상 최신이 보장된다.
 */

export const ASSET_HASH_MODULE_ID = 'virtual:asset-hash-manifest';
const RESOLVED_MODULE_ID = `\0${ASSET_HASH_MODULE_ID}`;

/** 해시를 붙일 디렉터리 (public/ 기준). 번들러가 안 건드리는 것들만. */
const HASHED_DIRS = [
  'models',
  'maps',
  'scenes',
  'images',
  'icons',
  'drawings',
  'previews',
];

/** URL 길이만 늘리지 않도록 짧게 자른다. 8 hex = 32bit, 충돌은 실질적으로 무관. */
const HASH_LENGTH = 8;

async function hashFile(absolutePath: string): Promise<string> {
  const content = await fs.readFile(absolutePath);
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, HASH_LENGTH);
}

/** 디렉터리를 재귀 순회하며 public 기준 절대 경로 목록을 만든다. */
async function collectFiles(
  rootDir: string,
  relativeDir: string,
): Promise<string[]> {
  const absoluteDir = path.join(rootDir, relativeDir);

  let entries;
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    // 없는 디렉터리는 조용히 건너뛴다 — 앱마다 public 구성이 다르다.
    return [];
  }

  const collected: string[] = [];
  for (const entry of entries) {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      collected.push(...(await collectFiles(rootDir, relativePath)));
    } else if (entry.isFile()) {
      collected.push(relativePath);
    }
  }
  return collected;
}

/**
 * public/ 을 훑어 `{ '/models/x.glb': 'a3f91c2e' }` 형태의 표를 만든다.
 * 키는 씬 JSON·카탈로그가 쓰는 것과 같은 `/`로 시작하는 public 절대 경로다.
 */
export async function buildAssetHashManifest(
  publicDir: string,
): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};

  for (const dir of HASHED_DIRS) {
    const files = await collectFiles(publicDir, dir);
    for (const relativePath of files) {
      const absolutePath = path.join(publicDir, relativePath);
      manifest[`/${relativePath}`] = await hashFile(absolutePath);
    }
  }

  return manifest;
}

export function assetHashManifestPlugin(): Plugin {
  let publicDir = '';
  let manifest: Record<string, string> = {};

  return {
    name: 'asset-hash-manifest',

    configResolved(config) {
      publicDir = config.publicDir;
    },

    async buildStart() {
      manifest = await buildAssetHashManifest(publicDir);
      const count = Object.keys(manifest).length;
      this.info(`hashed ${count} public assets for cache busting`);
    },

    resolveId(id) {
      return id === ASSET_HASH_MODULE_ID ? RESOLVED_MODULE_ID : null;
    },

    load(id) {
      if (id !== RESOLVED_MODULE_ID) return null;
      return `export const ASSET_HASH_MANIFEST = ${JSON.stringify(manifest)};\n`;
    },

    /**
     * dev 서버에서 GLB·씬을 교체하면 해시가 즉시 바뀌어야 한다. 안 그러면
     * dev에서는 옛 URL을 계속 쓰다가 배포 후에야 문제가 드러난다.
     */
    configureServer(server) {
      const watchedRoots = HASHED_DIRS.map((dir) => path.join(publicDir, dir));

      const isWatchedAsset = (file: string) =>
        watchedRoots.some((root) => file.startsWith(root));

      const refresh = async (file: string) => {
        if (!isWatchedAsset(file)) return;
        manifest = await buildAssetHashManifest(publicDir);

        const module = server.moduleGraph.getModuleById(RESOLVED_MODULE_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };

      server.watcher.on('add', refresh);
      server.watcher.on('change', refresh);
      server.watcher.on('unlink', refresh);
    },
  };
}
