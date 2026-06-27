import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiPlugin = () => ({
  name: 'api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api/')) {
        try {
          const url = new URL(req.url, 'http://localhost');
          const apiName = url.pathname.slice(5); // remove /api/
          const filePath = path.resolve(__dirname, `api/${apiName}.ts`);

          if (fs.existsSync(filePath)) {
            const module = await server.ssrLoadModule(`/api/${apiName}.ts`);
            
            // Read body
            let body = '';
            await new Promise<void>((resolve) => {
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', () => { resolve(); });
            });

            const parsedBody = body ? JSON.parse(body) : {};
            const vercelReq = Object.assign(req, {
              body: parsedBody,
              query: Object.fromEntries(url.searchParams.entries())
            });

            const vercelRes = Object.assign(res, {
              status(statusCode: number) {
                res.statusCode = statusCode;
                return this;
              },
              json(jsonData: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(jsonData));
                return this;
              },
              send(data: any) {
                res.end(data);
                return this;
              }
            });

            await module.default(vercelReq, vercelRes);
          } else {
            res.statusCode = 404;
            res.end(`API route not found: ${url.pathname}`);
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
        }
      } else {
        next();
      }
    });
  }
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Expose env vars to process.env for local API runner
  Object.assign(process.env, env);

  return {
    plugins: [react(), apiPlugin()],
    server: {
      port: 3000,
      host: true
    }
  };
});
