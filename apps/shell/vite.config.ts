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
          jsonResponse(res, 400, { message: `Unknown regionId: "${regionId}"` });
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
