import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs/promises';
import { getSceneFileUrlByRegionId } from './src/entities/3d/model/scene-file-registry';

const DEV_SCENE_API_PATH = '/__dev/scene';

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devSceneSavePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.122.230:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://192.168.122.230:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
