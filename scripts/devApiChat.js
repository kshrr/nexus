/**
 * Vite dev-server bridge for `/api/chat` (development only).
 *
 * In production, Vercel runs `api/chat.ts` as a server function. Plain `vite`
 * does not, so `npm run dev` used to answer `/api/chat` with 404 and the chat
 * panel showed "temporarily unavailable". This plugin runs the SAME handler
 * inside the dev server, so local chat behaves like production.
 *
 * Server-only values (GEMINI_API_KEY, optional GEMINI_MODEL /
 * GEMINI_FALLBACK_MODEL) are read from `.env` into this Node process only.
 * They are never exposed to browser code: Vite exposes only `VITE_`-prefixed
 * variables to the client, and `npm run check:secrets` verifies the bundle.
 */
import { loadEnv } from 'vite';

const SERVER_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_FALLBACK_MODEL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const MISSING_KEY_DETAIL =
  'Local dev: add GEMINI_API_KEY to .env (no VITE_ prefix), then restart npm run dev.';

/** @returns {import('vite').Plugin} */
export function devApiChat() {
  return {
    name: 'nexus-dev-api-chat',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const key of SERVER_KEYS) {
        if (!process.env[key] && env[key]) process.env[key] = env[key];
      }

      server.middlewares.use('/api/chat', async (req, res) => {
        try {
          if (!process.env.GEMINI_API_KEY && req.method !== 'OPTIONS') {
            res.statusCode = 503;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: {
                  code: 'AI_UNAVAILABLE',
                  message: 'The assistant is temporarily unavailable. Please try again shortly.',
                  detail: MISSING_KEY_DETAIL,
                },
              })
            );
            return;
          }

          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const headers = new Headers();
          for (const [name, value] of Object.entries(req.headers)) {
            if (typeof value === 'string') headers.set(name, value);
          }
          const request = new Request(`http://${req.headers.host}${req.originalUrl ?? req.url}`, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : Buffer.concat(chunks),
          });

          // Loaded per request so edits to api/chat.ts apply without a restart.
          const { default: handler } = await server.ssrLoadModule('/api/chat.ts');
          const response = await handler.fetch(request);

          res.statusCode = response.status;
          response.headers.forEach((value, name) => res.setHeader(name, value));
          if (response.body) {
            for await (const chunk of response.body) res.write(chunk);
          }
          res.end();
        } catch (err) {
          console.error('[dev /api/chat]', err instanceof Error ? err.message : 'request failed');
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
              })
            );
          } else {
            res.end();
          }
        }
      });
    },
  };
}

export default devApiChat;
