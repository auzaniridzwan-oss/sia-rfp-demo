/**
 * Local stand-in for the Vercel functions: serves /api/* on http://127.0.0.1:3000 using the
 * same @sia/server handlers. Each Vite dev server's proxy sends `x-sia-entity` so the
 * handler knows which site (SQ / TR) is calling.
 *
 * Usage: pnpm dev:api   (reads the repo-root .env)
 */
import { createServer } from 'node:http';
import type { WebEntity } from '../packages/core/src/entity';
import { handleBrazeProfile, handleFlights, handleHealth, type HandlerContext } from '../packages/server/src/handlers';

type Handler = (req: Request, ctx: HandlerContext) => Response | Promise<Response>;
const routes: Record<string, Handler> = {
  '/api/flights': handleFlights,
  '/api/braze/profile': handleBrazeProfile,
  '/api/health': handleHealth,
};

const PORT = Number(process.env.API_PORT ?? 3000);

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const handler = routes[url.pathname];
  const entity = (String(req.headers['x-sia-entity'] ?? 'SQ').toUpperCase() === 'TR' ? 'TR' : 'SQ') as WebEntity;
  const started = Date.now();
  let response: Response;
  if (!handler) {
    response = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  } else {
    try {
      response = await handler(new Request(url, { method: req.method }), { entity });
    } catch (e) {
      response = new Response(JSON.stringify({ error: String(e) }), { status: 500 });
    }
  }
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
  console.log(`${entity} ${req.method} ${url.pathname}${url.search} → ${response.status} (${Date.now() - started}ms)`);
}).listen(PORT, '127.0.0.1', () => console.log(`SIA demo API on http://127.0.0.1:${PORT}`));
