import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs/promises';
import { assetHashManifestPlugin } from './vite-plugin-asset-hash';
import {
  SCENE_DIR,
  getKnownRegionIds,
  getSceneFileNameByRegionId,
  isKnownRegionId,
} from '../../packages/domain/src/3d/model/scene-file-map';

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

const DEFAULT_BASE_URL = '/crane_rnd/';

function normalizeBaseUrl(input: string | undefined): string {
  if (!input || input === '/') return '/';
  const withLeading = input.startsWith('/') ? input : `/${input}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
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
      devSceneSavePlugin(),
      devVirtualTagsSavePlugin(),
      devPreviewSavePlugin(),
      // 위 세 저장 미들웨어가 쓰는 public/ 디렉토리(scenes·simulation·previews)는
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
