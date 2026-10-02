import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { assetHashManifestPlugin } from './vite-plugin-asset-hash';
import {
  SCENE_DIR,
  getKnownRegionIds,
  getSceneFileNameByRegionId,
  isKnownRegionId,
} from '../../packages/domain/src/3d/model/scene-file-map';
import {
  ASSET_ID_PATTERN,
  ASSET_LIBRARY_DIR,
  DEV_ASSET_LIBRARY_API_PATH,
  parseAssetLibraryFileKey,
  ASSET_LIBRARY_REVISION_HEADER,
  hashAssetLibraryText,
  ASSET_LIBRARY_ORIGINALS_DIR,
} from '../../packages/domain/src/asset-library/model/asset-library-paths';

const DEV_SCENE_API_PATH = '/__dev/scene';

/**
 * 가상 태그 저장 미들웨어 경로·파일. 브라우저 쪽 상수는
 * packages/domain/src/virtual-tag/lib/virtual-tag-storage.ts 에 있다 — 그 슬라이스는
 * import.meta 를 쓰는 모듈을 끌고 와 Node 설정 파일에서 import 할 수 없어
 * 문자열을 여기 한 번 더 둔다. 한쪽을 바꾸면 다른 쪽도 함께 바꾼다.
 */
const DEV_VIRTUAL_TAGS_API_PATH = '/__dev/virtual-tags';
const VIRTUAL_TAGS_PUBLIC_FILE = ['simulation', 'virtual-tags.json'];

/**
 * region→파일 표는 도메인 패키지와 공유한다(scene-file-map). 예전에는 이
 * 파일에 표가 복붙돼 있었는데, 한쪽만 고치면 저장과 로드가 다른 파일을
 * 가리키게 되어 씬이 조용히 파괴된다.
 *
 * scene-file-map은 의존성이 0이라(React·three·import.meta 없음) Node
 * 컨텍스트인 이 설정 파일에서도 그대로 import된다.
 */

/**
 * 씬 JSON의 최소 형태 검증.
 *
 * 예전에는 `JSON.parse` 결과를 그대로 write해서 `{}`·`null`·`"x"` 같은
 * 값도 씬 파일을 덮어썼다. 완전한 스키마 검증은 과하지만, "적어도 씬처럼
 * 생겼는가"는 확인해야 한 번의 잘못된 요청이 파일을 못 쓰게 만드는 걸 막는다.
 */
function isSceneInfoShaped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const scene = value as Record<string, unknown>;
  // models는 필수, maps는 없거나 배열이어야 한다(legacy 단수 map 씬 허용).
  if (!Array.isArray(scene.models)) return false;
  if (scene.maps !== undefined && !Array.isArray(scene.maps)) return false;
  return true;
}

interface JsonResponseLike {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (body?: string) => void;
}

async function readRequestBody(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(
      typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk),
    );
  }

  return Buffer.concat(chunks).toString('utf8');
}

function jsonResponse(res: unknown, statusCode: number, body: unknown) {
  const response = res as JsonResponseLike;
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

function devSceneSavePlugin(): Plugin {
  return {
    name: 'dev-scene-save-plugin',
    configureServer(server) {
      server.middlewares.use(DEV_SCENE_API_PATH, async (req, res, next) => {
        if (req.method !== 'POST' || !req.url) {
          next();
          return;
        }

        const requestUrl = new URL(req.url, 'http://localhost');
        const regionId = requestUrl.searchParams.get('regionId');

        // 미등록(또는 누락) regionId는 저장하지 않는다. 예전에는 'dock-1'과
        // 1dock.json으로 이중 폴백해서, 오타 하나로 남의 씬을 덮어썼다.
        if (!regionId || !isKnownRegionId(regionId)) {
          jsonResponse(res, 400, {
            message: `Unknown regionId: "${regionId ?? ''}". Known: ${getKnownRegionIds().join(', ')}`,
          });
          return;
        }

        const sceneFileName = getSceneFileNameByRegionId(regionId);
        if (!sceneFileName) {
          jsonResponse(res, 400, {
            message: `Unknown regionId: "${regionId}"`,
          });
          return;
        }

        const sceneFilePath = path.resolve(
          server.config.root,
          'public',
          SCENE_DIR,
          sceneFileName,
        );

        try {
          const requestBody = await readRequestBody(req);
          const sceneInfo = JSON.parse(requestBody);

          if (!isSceneInfoShaped(sceneInfo)) {
            jsonResponse(res, 400, {
              message:
                'Invalid scene payload: expected an object with a "models" array.',
            });
            return;
          }

          await fs.writeFile(
            sceneFilePath,
            JSON.stringify(sceneInfo, null, 2),
            'utf8',
          );

          jsonResponse(res, 200, sceneInfo);
        } catch (error) {
          console.error('Failed to save scene file.', error);
          jsonResponse(res, 500, {
            message: 'Failed to save scene file.',
          });
        }
      });
    },
  };
}

/** 가상 태그 세트의 최소 형태 — 객체이고 tags 가 배열. 정규화는 브라우저가 한다. */
function isVirtualTagSetShaped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as Record<string, unknown>).tags);
}

function devVirtualTagsSavePlugin(): Plugin {
  return {
    name: 'dev-virtual-tags-save-plugin',
    configureServer(server) {
      server.middlewares.use(
        DEV_VIRTUAL_TAGS_API_PATH,
        async (req, res, next) => {
          if (req.method !== 'POST') {
            next();
            return;
          }

          const filePath = path.resolve(
            server.config.root,
            'public',
            ...VIRTUAL_TAGS_PUBLIC_FILE,
          );

          try {
            const body = JSON.parse(await readRequestBody(req));
            if (!isVirtualTagSetShaped(body)) {
              jsonResponse(res, 400, {
                message:
                  'Invalid virtual tag payload: expected an object with a "tags" array.',
              });
              return;
            }
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(
              filePath,
              `${JSON.stringify(body, null, 2)}\n`,
              'utf8',
            );
            jsonResponse(res, 200, body);
          } catch (error) {
            console.error('Failed to save virtual tags file.', error);
            jsonResponse(res, 500, {
              message: 'Failed to save virtual tags file.',
            });
          }
        },
      );
    },
  };
}

const execFileAsync = promisify(execFile);

const DEV_PREVIEW_API_PATH = '/__dev/preview-thumbnail';

// PNG 시그니처(매직 넘버). 잘못된 바디가 public/previews/ 를 오염시키지 않게
// 최소한 "PNG 파일처럼 생겼는가"는 확인한다 (씬 저장의 isSceneInfoShaped 선례).
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function readRequestBodyBuffer(req: NodeJS.ReadableStream) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(
      typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk),
    );
  }

  return Buffer.concat(chunks);
}

/**
 * 모델 미리보기 썸네일 저장 미들웨어 (dev 전용).
 *
 * 씬 편집 페이지 모델 탭의 썸네일 생성 패널(PreviewThumbnailGeneratorPanel)이
 * offscreen 렌더러로 만든 PNG 를 여기로 POST 하면 public/previews/<id>.png
 * 로 저장된다. 생성물은 커밋해서 배포하고,
 * 런타임(SceneModelPreview)은 이 파일을 먼저 시도한 뒤 없으면 offscreen
 * 렌더로 폴백한다.
 */
function devPreviewSavePlugin(): Plugin {
  return {
    name: 'dev-preview-save-plugin',
    configureServer(server) {
      server.middlewares.use(DEV_PREVIEW_API_PATH, async (req, res, next) => {
        if (req.method !== 'POST' || !req.url) {
          next();
          return;
        }

        const requestUrl = new URL(req.url, 'http://localhost');
        const id = requestUrl.searchParams.get('id');

        // id 가 곧 파일명이므로 경로 탈출('../', '/')이 불가능한 문자만 허용한다.
        if (!id || !/^[a-z0-9-]+$/.test(id)) {
          jsonResponse(res, 400, {
            message: `Invalid preview id: "${id ?? ''}". Expected /^[a-z0-9-]+$/.`,
          });
          return;
        }

        try {
          const body = await readRequestBodyBuffer(req);

          if (
            body.length < PNG_MAGIC.length ||
            !body.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
          ) {
            jsonResponse(res, 400, {
              message: 'Invalid payload: expected a PNG binary body.',
            });
            return;
          }

          const previewDir = path.resolve(
            server.config.root,
            'public',
            'previews',
          );
          await fs.mkdir(previewDir, { recursive: true });
          await fs.writeFile(path.join(previewDir, `${id}.png`), body);

          jsonResponse(res, 200, { id, bytes: body.length });
        } catch (error) {
          console.error('Failed to save preview thumbnail.', error);
          jsonResponse(res, 500, {
            message: 'Failed to save preview thumbnail.',
          });
        }
      });
    },
  };
}

/** 최적화가 이보다 오래 걸리면 포기하고 원본을 쓴다. */
const GLB_OPTIMIZE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * GLB 를 최적화 파이프라인(`scripts/optimize-glb.mjs --single`)에 통과시킨다.
 * 스크립트를 그대로 자식 프로세스로 돌린다 — 파이프라인의 순서·정책이 한 곳에만
 * 있어야 `pnpm optimize:glb` 와 결과가 같다. 실패하면 null(호출부가 원본을 쓴다).
 */
async function optimizeGlbBuffer(
  repoRoot: string,
  input: Buffer,
): Promise<Buffer | null> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-optimize-'));
  const inputPath = path.join(workDir, 'input.glb');
  const outputPath = path.join(workDir, 'output.glb');
  try {
    await fs.writeFile(inputPath, input);
    await execFileAsync(
      process.execPath,
      [
        path.join(repoRoot, 'scripts', 'optimize-glb.mjs'),
        '--single',
        inputPath,
        outputPath,
      ],
      { timeout: GLB_OPTIMIZE_TIMEOUT_MS },
    );
    const output = await fs.readFile(outputPath);
    // 이미 최적화된 파일은 더 커질 수 있다 — 그때는 원본이 낫다.
    return output.length > 0 && output.length < input.length ? output : null;
  } catch (error) {
    console.warn('Failed to optimize GLB. Storing the original.', error);
    return null;
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

/** 라이브러리 문서의 최소 형태 — 객체이고 assets 가 배열. 정규화는 브라우저가 한다. */
function isAssetLibraryShaped(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as Record<string, unknown>).assets);
}

/**
 * 3D 자산 라이브러리 저장 미들웨어 (dev 전용).
 *
 * - `POST /__dev/asset-library` — 문서(JSON)를 public/asset-library/library.json 에.
 * - `POST /__dev/asset-library/file?key=…` — 버전 파일·썸네일(바이너리)을
 *   public/asset-library/ 아래에. 키는 `files/<id>/v<N>/<name>` 또는
 *   `thumbnails/<id>.png` 뿐이고 규칙은 도메인과 공유한다(asset-library-paths).
 *   버전 파일은 **불변**이라 이미 있는 경로에는 쓰지 않는다(409).
 * - `DELETE /__dev/asset-library/file?assetId=…` — 그 자산의 파일 전부.
 *
 * 생성물은 커밋해서 배포한다. 운영에는 이 미들웨어가 없어 브라우저 저장소로
 * 떨어진다(asset-library-storage.ts).
 */
function devAssetLibraryPlugin(): Plugin {
  return {
    name: 'dev-asset-library-plugin',
    configureServer(server) {
      const libraryDir = path.resolve(
        server.config.root,
        'public',
        ASSET_LIBRARY_DIR,
      );
      // 저장소 루트 — 최적화 스크립트와 원본 보관 위치의 기준.
      const repoRoot = path.resolve(server.config.root, '..', '..');

      server.middlewares.use(
        DEV_ASSET_LIBRARY_API_PATH,
        async (req, res, next) => {
          if (!req.url) {
            next();
            return;
          }
          // connect 는 마운트 경로를 떼고 넘긴다 — '/' 또는 '/file?...'.
          const requestUrl = new URL(req.url, 'http://localhost');

          try {
            if (requestUrl.pathname === '/' && req.method === 'POST') {
              const body = JSON.parse(await readRequestBody(req));
              if (!isAssetLibraryShaped(body)) {
                jsonResponse(res, 400, {
                  message:
                    'Invalid asset library payload: expected an object with an "assets" array.',
                });
                return;
              }
              // 보낸 쪽이 읽은 판과 지금 파일이 다르면 쓰지 않는다 — 문서를
              // 통째로 받으므로, 그대로 쓰면 다른 탭·다른 사람·git pull 의
              // 변경을 덮는다. 헤더가 없는 요청(판을 모르는 쪽)은 견주지 않는다.
              const documentPath = path.join(libraryDir, 'library.json');
              const baseRevision = req.headers[ASSET_LIBRARY_REVISION_HEADER];
              if (typeof baseRevision === 'string') {
                const currentText = await fs
                  .readFile(documentPath, 'utf8')
                  .catch(() => null);
                const currentRevision =
                  currentText === null ? '' : hashAssetLibraryText(currentText);
                if (currentRevision !== baseRevision) {
                  jsonResponse(res, 409, {
                    message:
                      'Asset library changed on disk since it was loaded.',
                  });
                  return;
                }
              }
              const nextText = `${JSON.stringify(body, null, 2)}\n`;
              await fs.mkdir(libraryDir, { recursive: true });
              await fs.writeFile(documentPath, nextText, 'utf8');
              jsonResponse(res, 200, {
                ok: true,
                revision: hashAssetLibraryText(nextText),
              });
              return;
            }

            if (requestUrl.pathname === '/file' && req.method === 'POST') {
              const key = requestUrl.searchParams.get('key') ?? '';
              const parsed = parseAssetLibraryFileKey(key);
              if (!parsed) {
                jsonResponse(res, 400, {
                  message: `Invalid asset file key: "${key}".`,
                });
                return;
              }
              const filePath = path.join(libraryDir, ...key.split('/'));
              if (parsed.kind === 'version') {
                const exists = await fs.stat(filePath).then(
                  () => true,
                  () => false,
                );
                if (exists) {
                  jsonResponse(res, 409, {
                    message: `Version file already exists: "${key}".`,
                  });
                  return;
                }
              }
              const body = await readRequestBodyBuffer(req);
              if (body.length === 0) {
                jsonResponse(res, 400, { message: 'Empty file body.' });
                return;
              }
              if (
                parsed.kind === 'thumbnail' &&
                !body.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC)
              ) {
                jsonResponse(res, 400, {
                  message: 'Invalid payload: expected a PNG binary body.',
                });
                return;
              }
              // 최적화 요청 — GLB 버전 파일을 scripts/optimize-glb.mjs 의
              // 파이프라인에 통과시켜 저장한다. 올린 원본은 assets-src 에 남긴다
              // (파이프라인을 고친 뒤 다시 최적화할 때의 입력). 실패하면 원본
              // 그대로 저장하고 그렇게 알린다 — 등록 자체를 막지 않는다.
              let payload = body;
              let optimized = false;
              if (
                parsed.kind === 'version' &&
                requestUrl.searchParams.get('optimize') === '1' &&
                parsed.fileName.toLowerCase().endsWith('.glb')
              ) {
                const result = await optimizeGlbBuffer(repoRoot, body);
                if (result) {
                  payload = result;
                  optimized = true;
                  const originalPath = path.join(
                    repoRoot,
                    ASSET_LIBRARY_ORIGINALS_DIR,
                    parsed.assetId,
                    `v${parsed.version}`,
                    parsed.fileName,
                  );
                  await fs.mkdir(path.dirname(originalPath), { recursive: true });
                  await fs.writeFile(originalPath, body);
                }
              }
              await fs.mkdir(path.dirname(filePath), { recursive: true });
              // 버전 파일은 "없을 때만" 쓴다(wx) — 위의 존재 확인과 쓰기
              // 사이에 다른 요청이 끼어들어도 덮어쓰지 않는다.
              try {
                await fs.writeFile(filePath, payload, {
                  flag: parsed.kind === 'version' ? 'wx' : 'w',
                });
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                  jsonResponse(res, 409, {
                    message: `Version file already exists: "${key}".`,
                  });
                  return;
                }
                throw error;
              }
              jsonResponse(res, 200, {
                key,
                bytes: payload.length,
                optimized,
              });
              return;
            }

            if (requestUrl.pathname === '/file' && req.method === 'DELETE') {
              const assetId = requestUrl.searchParams.get('assetId') ?? '';
              // id 가 곧 디렉터리명이다 — 경로 탈출이 불가능한 문자만 허용한다.
              if (!ASSET_ID_PATTERN.test(assetId)) {
                jsonResponse(res, 400, {
                  message: `Invalid asset id: "${assetId}".`,
                });
                return;
              }
              // version 이 있으면 그 버전의 파일만 지운다(지운 버전의 뒷정리).
              const versionParam = requestUrl.searchParams.get('version');
              if (versionParam !== null) {
                if (!/^[1-9]\d{0,5}$/.test(versionParam)) {
                  jsonResponse(res, 400, {
                    message: `Invalid version: "${versionParam}".`,
                  });
                  return;
                }
                await fs.rm(
                  path.join(libraryDir, 'files', assetId, `v${versionParam}`),
                  { recursive: true, force: true },
                );
                await fs.rm(
                  path.join(
                    repoRoot,
                    ASSET_LIBRARY_ORIGINALS_DIR,
                    assetId,
                    `v${versionParam}`,
                  ),
                  { recursive: true, force: true },
                );
                jsonResponse(res, 200, { ok: true });
                return;
              }
              await fs.rm(path.join(libraryDir, 'files', assetId), {
                recursive: true,
                force: true,
              });
              await fs.rm(
                path.join(repoRoot, ASSET_LIBRARY_ORIGINALS_DIR, assetId),
                { recursive: true, force: true },
              );
              await fs.rm(
                path.join(libraryDir, 'thumbnails', `${assetId}.png`),
                { force: true },
              );
              jsonResponse(res, 200, { ok: true });
              return;
            }

            next();
          } catch (error) {
            console.error('Failed to handle asset library request.', error);
            jsonResponse(res, 500, {
              message: 'Failed to handle asset library request.',
            });
          }
        },
      );
    },
  };
}

const DEFAULT_BASE_URL = '/crane_rnd/';

function normalizeBaseUrl(input: string | undefined): string {
  if (!input || input === '/') return '/';
  const withLeading = input.startsWith('/') ? input : `/${input}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/**
 * `vite --mode dev|stage|prod`(pnpm dev:dev 등) 는 저장소 루트 `deploy/env/<mode>.env` 의
 * 환경 값(BASE_PATH · INDOOR_PATH · DEPLOY_ENV)을 읽어 VITE_* 로 넘긴다.
 * 그냥 `vite`(pnpm dev, mode development) 도 운영과 같은 주소 체계로 crane · indoor 가 나뉘도록
 * `prod.env` 를 읽되 DEPLOY_ENV 만 `local` 로 바꿔 헤더에 LOCAL 이 뜨게 한다 — 별도 모드 파일 없음.
 * `vite build`(mode production) 는 건드리지 않는다: docker 빌드가 ENV 로 값을 주고, 값이 없으면 기본 /crane_rnd/ 하나다.
 * 환경별 값의 단일 소스는 그 파일이라 여기서 다시 적지 않는다(docker 빌드도 같은
 * 파일을 compose 인자로 읽는다). 셸에서 직접 export 한 VITE_* 가 있으면 그것이
 * 우선이고, 없을 때만 채운다. process.env 에 넣는 이유: Vite 는 설정 함수가 끝난
 * 뒤 다시 loadEnv 를 돌려 import.meta.env 를 만들고 그때 process.env 가 .env 파일보다
 * 앞서므로, 앱 코드(resolveAppScope 등)가 같은 값을 받는다.
 */
const DEPLOY_ENV_MODES = ['dev', 'stage', 'prod'] as const;
const DEPLOY_ENV_TO_VITE: Record<string, string> = {
  BASE_PATH: 'VITE_BASE_URL',
  INDOOR_PATH: 'VITE_INDOOR_BASE_URL',
  DEPLOY_ENV: 'VITE_APP_ENV',
};

const LOCAL_DEV_ENV = 'prod'; // pnpm dev 가 따라가는 주소 체계
const LOCAL_DEV_LABEL = 'local'; // 그때 헤더 표시(VITE_APP_ENV)

function applyDeployEnv(mode: string, command: 'serve' | 'build'): Record<string, string> {
  const isLocalDev = command === 'serve' && mode === 'development';
  const envName = isLocalDev ? LOCAL_DEV_ENV : mode;
  if (!(DEPLOY_ENV_MODES as readonly string[]).includes(envName)) return {};
  const file = path.resolve(__dirname, '../../deploy/env', `${envName}.env`);
  if (!existsSync(file)) {
    throw new Error(`[vite] --mode ${mode} 인데 ${file} 이 없습니다.`);
  }
  const applied: Record<string, string> = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value =
      isLocalDev && key === 'DEPLOY_ENV' ? LOCAL_DEV_LABEL : line.slice(eq + 1).trim();
    const viteKey = DEPLOY_ENV_TO_VITE[key];
    if (!viteKey) continue;
    if (process.env[viteKey] === undefined) process.env[viteKey] = value;
    applied[viteKey] = process.env[viteKey]!;
  }
  return applied;
}

/**
 * indoor 주소가 base 밖에 있을 때(dev · stage: /crane_rnd/indoor/dev/ vs /crane_rnd/dev/)
 * 그 주소의 HTML 요청을 base 의 index.html 로 넘긴다. 운영의 nginx.conf.template 맨 아래
 * `location /` catch-all 과 같은 역할이다. 브라우저 주소는 그대로라 앱의 resolveAppScope 가
 * indoor 범위로 판정하고, 에셋은 base 접두어로 요청하므로 HTML 만 넘기면 된다.
 * indoor 가 base 아래면(prod) Vite 의 기본 SPA 폴백이 이미 처리하므로 플러그인을 만들지 않는다.
 */
function devIndoorFallbackPlugin(
  base: string,
  indoorBaseUrl: string | undefined,
): Plugin | null {
  if (!indoorBaseUrl) return null;
  const indoor = normalizeBaseUrl(indoorBaseUrl);
  if (indoor === '/' || indoor.startsWith(base)) return null;
  const indoorNoSlash = indoor.slice(0, -1);
  return {
    name: 'crane-dev-indoor-fallback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const pathOnly = (req.url ?? '').split('?')[0];
        const isIndoor = pathOnly === indoorNoSlash || pathOnly.startsWith(indoor);
        const wantsHtml = (req.headers.accept ?? '').includes('text/html');
        if (isIndoor && wantsHtml) req.url = `${base}index.html`;
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...applyDeployEnv(mode, command) };
  // dev proxy 대상 IP 는 코드에 두지 않는다. 운영에서는 nginx 가 처리하고
  // 개발자는 apps/shell/.env.local 에 본인 환경의 백엔드/LiDAR 주소를 적는다.
  const proxyHttpTarget = env.VITE_DEV_PROXY_TARGET_HTTP;
  const proxyWsTarget = env.VITE_DEV_PROXY_TARGET_WS;
  const proxyLidarTarget = env.VITE_DEV_PROXY_TARGET_LIDAR;
  const proxyCabinTarget = env.VITE_DEV_PROXY_TARGET_CABIN;
  const baseUrl = normalizeBaseUrl(env.VITE_BASE_URL || DEFAULT_BASE_URL);
  const basePrefix = baseUrl.replace(/\/$/, ''); // '' | '/crane_rnd'
  const apiProxyKey = `${basePrefix}/api`;
  const wsProxyKey = `${basePrefix}/ws`;
  const lidarProxyKey = `${basePrefix}/lidar`;
  const cabinProxyKey = `${basePrefix}/cabin-bridge`;
  const apiProxyPattern = new RegExp(`^${basePrefix}/api`);
  const wsProxyPattern = new RegExp(`^${basePrefix}/ws`);
  const lidarProxyPattern = new RegExp(`^${basePrefix}/lidar`);
  const cabinProxyPattern = new RegExp(`^${basePrefix}/cabin-bridge`);

  if (!proxyHttpTarget || !proxyWsTarget) {
    console.warn(
      '[vite] VITE_DEV_PROXY_TARGET_HTTP / VITE_DEV_PROXY_TARGET_WS is not set. ' +
        'Backend dev proxy will not work until they are defined in apps/shell/.env.local.',
    );
  }
  if (!proxyLidarTarget) {
    console.warn(
      '[vite] VITE_DEV_PROXY_TARGET_LIDAR is not set. ' +
        'LiDAR dev proxy will not work until it is defined in apps/shell/.env.local.',
    );
  }
  if (!proxyCabinTarget) {
    console.warn(
      '[vite] VITE_DEV_PROXY_TARGET_CABIN is not set. ' +
        'Cabin bridge dev proxy will not work until it is defined in apps/shell/.env.local.',
    );
  }

  return {
    base: baseUrl,
    plugins: [
      react(),
      tailwindcss(),
      devIndoorFallbackPlugin(baseUrl, env.VITE_INDOOR_BASE_URL),
      devSceneSavePlugin(),
      devVirtualTagsSavePlugin(),
      devPreviewSavePlugin(),
      devAssetLibraryPlugin(),
      // 위 저장 미들웨어들이 쓰는 public/ 디렉토리(scenes·simulation·previews·
      // asset-library)는
      // 이 플러그인의 DEV_WRITTEN_DIRS 에 등록돼 있어 저장 시 전체 리로드를
      // 보내지 않는다. 새 저장 미들웨어를 추가하면 그 목록도 함께 갱신한다.
      assetHashManifestPlugin(),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-three': ['three'],
            'vendor-r3f': ['@react-three/fiber', '@react-three/drei'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-charts': ['recharts'],
          },
        },
      },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        // 프로덕션과 동일하게 sub-path(VITE_BASE_URL, 기본 /crane_rnd/) 아래
        // API/WS 를 받는다. network.ts 가 getBasePathPrefix() 로 생성하는
        // 경로를 dev proxy 단에서 /api, /ws 로 rewrite 하여 백엔드로 전달한다.
        // 이 proxy 블록은 반드시 일반 '/api', '/ws' 보다 먼저 선언되어야
        // Vite 가 sub-path 패턴을 먼저 매칭한다.
        ...(basePrefix && proxyHttpTarget
          ? {
              [apiProxyKey]: {
                target: proxyHttpTarget,
                changeOrigin: true,
                rewrite: (p: string) => p.replace(apiProxyPattern, '/api'),
              },
            }
          : {}),
        ...(basePrefix && proxyWsTarget
          ? {
              [wsProxyKey]: {
                target: proxyWsTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (p: string) => p.replace(wsProxyPattern, '/ws'),
              },
            }
          : {}),
        ...(basePrefix && proxyLidarTarget
          ? {
              [lidarProxyKey]: {
                target: proxyLidarTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (p: string) => p.replace(lidarProxyPattern, ''),
              },
            }
          : {}),
        ...(basePrefix && proxyCabinTarget
          ? {
              [cabinProxyKey]: {
                target: proxyCabinTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (p: string) => p.replace(cabinProxyPattern, ''),
              },
            }
          : {}),
        // 레거시/직접 접근 호환용 (dev 에서 BASE_URL 을 '/' 로 임시 변경해
        // 테스트 하는 경우에도 동작).
        ...(proxyHttpTarget
          ? {
              '/api': {
                target: proxyHttpTarget,
                changeOrigin: true,
              },
            }
          : {}),
        ...(proxyWsTarget
          ? {
              '/ws': {
                target: proxyWsTarget,
                changeOrigin: true,
                ws: true,
              },
            }
          : {}),
        ...(proxyLidarTarget
          ? {
              '/lidar': {
                target: proxyLidarTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (p: string) => p.replace(/^\/lidar/, ''),
              },
            }
          : {}),
        ...(proxyCabinTarget
          ? {
              '/cabin-bridge': {
                target: proxyCabinTarget,
                changeOrigin: true,
                ws: true,
                rewrite: (p: string) => p.replace(/^\/cabin-bridge/, ''),
              },
            }
          : {}),
        // Open-Meteo는 정상적으로 CORS를 허용하지만, 일부 사내망/방화벽에서
        // 외부 호출이 502로 차단되는 경우가 있어 dev 서버가 대신 호출한다.
        // 클라이언트는 baseUrl을 '/open-meteo'로 사용한다.
        '/open-meteo': {
          target: 'https://api.open-meteo.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/open-meteo/, ''),
        },
      },
    },
  };
});
