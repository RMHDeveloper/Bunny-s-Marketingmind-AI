import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PROXY_APP_SLUG = 'bunnys-marketingmind-ai';

/**
 * Dev-only stand-in for api/proxy.ts (the Vercel Edge function). Lets `npm run
 * dev` talk to the dashboard proxy using the secret in .env.local without
 * exposing it to the client.
 */
function devProxyMiddleware(proxyUrl: string | undefined, proxySecret: string | undefined): Plugin {
  return {
    name: 'dev-dashboard-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        if (!proxyUrl || !proxySecret) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: 'DASHBOARD_PROXY_URL / DASHBOARD_PROXY_SECRET is not set in .env.local' }));
          return;
        }

        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = Buffer.concat(chunks).toString('utf8');

        try {
          const upstream = await fetch(`${proxyUrl}/api/proxy/${PROXY_APP_SLUG}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-proxy-secret': proxySecret,
            },
            body,
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader('content-type', 'application/json');
          res.end(text);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: `Could not reach the dashboard proxy: ${String(e)}` }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), devProxyMiddleware(env.DASHBOARD_PROXY_URL, env.DASHBOARD_PROXY_SECRET)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
