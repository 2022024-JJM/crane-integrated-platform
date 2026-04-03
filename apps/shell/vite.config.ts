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

const DEFAULT_DEV_PROXY_TARGET_HTTP = 'http://192.168.122.230:8080';
const DEFAULT_DEV_PROXY_TARGET_WS = 'ws://192.168.122.230:8080';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyHttpTarget =
    env.VITE_DEV_PROXY_TARGET_HTTP || DEFAULT_DEV_PROXY_TARGET_HTTP;
  const proxyWsTarget =
    env.VITE_DEV_PROXY_TARGET_WS || DEFAULT_DEV_PROXY_TARGET_WS;

  return {
    plugins: [react(), tailwindcss(), devSceneSavePlugin()],
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': {
          target: proxyHttpTarget,
          changeOrigin: true,
        },
        '/ws': {
          target: proxyWsTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
