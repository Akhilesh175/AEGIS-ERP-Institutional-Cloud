import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mirror of vercel.json rewrite rules for local dev (keep in sync with vercel.json)
const VERCEL_REWRITES: Record<string, string> = {
  // Auth
  '/api/request-otp':            '/api/auth?action=request-otp',
  '/api/verify-otp':             '/api/auth?action=verify-otp',
  '/api/reset-password':         '/api/auth?action=reset-password',
  '/api/change-password':        '/api/auth?action=change-password',
  // Registration
  '/api/register-school':            '/api/registration?action=register-school',
  '/api/verify-registration-otp':    '/api/registration?action=verify-registration-otp',
  '/api/create-school-account':      '/api/registration?action=create-school-account',
  // Payments
  '/api/create-payment':         '/api/payments?action=create-payment',
  '/api/verify-payment':         '/api/payments?action=verify-payment',
  '/api/payments/webhook':       '/api/payments?action=webhook',
  '/api/payments/refund':        '/api/payments?action=refund',
  '/api/payments/history':       '/api/payments?action=history',
  '/api/payments/invoice':       '/api/payments?action=invoice',
};

const apiPlugin = () => ({
  name: 'api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith('/api/')) {
        try {
          const originalUrl = new URL(req.url, 'http://localhost');
          const pathname = originalUrl.pathname;

          // Apply Vercel-style rewrites for local dev
          let resolvedUrl: URL;
          if (VERCEL_REWRITES[pathname]) {
            resolvedUrl = new URL(VERCEL_REWRITES[pathname], 'http://localhost');
            // Merge any original query params (they override rewrite defaults)
            originalUrl.searchParams.forEach((value, key) => {
              resolvedUrl.searchParams.set(key, value);
            });
          } else {
            resolvedUrl = originalUrl;
          }

          const apiName = resolvedUrl.pathname.slice(5); // remove /api/
          const filePath = path.resolve(__dirname, `api/${apiName}.ts`);

          if (fs.existsSync(filePath)) {
            const module = await server.ssrLoadModule(`/api/${apiName}.ts`);

            // Read body
            let body = '';
            await new Promise<void>((resolve) => {
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', () => { resolve(); });
            });

            // Safely parse JSON body
            let parsedBody = {};
            if (body) {
              try { parsedBody = JSON.parse(body); } catch { parsedBody = {}; }
            }

            const vercelReq = Object.assign(req, {
              body: parsedBody,
              query: Object.fromEntries(resolvedUrl.searchParams.entries()),
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
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: `API route not found: ${pathname}` }));
          }
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
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

  const maskKey = (key: string | undefined) => {
    if (!key) return 'empty';
    if (key.length <= 12) return '***';
    return `${key.slice(0, 6)}...${key.slice(-6)}`;
  };

  console.log(`\n======================================================`);
  console.log(`[Vite Config] Resolved VITE_SUPABASE_URL: ${env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL}`);
  console.log(`[Vite Config] Resolved VITE_SUPABASE_ANON_KEY: ${maskKey(env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)}`);
  console.log(`======================================================\n`);

  return {
    plugins: [react(), apiPlugin()],
    server: {
      port: 3000,
      host: true
    }
  };
});
