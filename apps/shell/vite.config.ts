import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs/promises';

const DEV_SCENE_API_PATH = '/__dev/scene';

const DEFAULT_SCENE_FILE_URL = '/scenes/1dock.json';
const SCENE_FILE_URL_BY_REGION_ID: Record<string, string> = {
  'dock-1': '/scenes/1dock.json',
  'dock-2': '/scenes/2dock.json',
  'dock-in': '/scenes/dock-in.json',
  goliath: '/scenes/goliath.json',
  'philly-dock-2': '/scenes/philly-2dock.json',
};

function getSceneFileUrlByRegionId(regionId: string) {
  return SCENE_FILE_URL_BY_REGION_ID[regionId] ?? DEFAULT_SCENE_FILE_URL;
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
        const regionId = requestUrl.searchParams.get('regionId') ?? 'dock-1';
        const sceneFileUrl = getSceneFileUrlByRegionId(regionId);
        const sceneFilePath = path.resolve(
          server.config.root,
          `public${sceneFileUrl}`,
        );

        try {
          const requestBody = await readRequestBody(req);
          const sceneInfo = JSON.parse(requestBody);

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
    plugins: [react(), tailwindcss(), devSceneSavePlugin()],
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
