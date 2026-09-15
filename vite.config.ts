import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/scan-extract')) {
          try {
            const { default: handler } = await import('./api/scan-extract.ts');
            let rawBody = '';
            req.on('data', chunk => { rawBody += chunk; });
            req.on('end', async () => {
              const body = rawBody ? JSON.parse(rawBody) : {};
              const resMock: any = res;
              resMock.status = (statusCode: number) => {
                resMock.statusCode = statusCode;
                return resMock;
              };
              resMock.json = (data: any) => {
                resMock.setHeader('Content-Type', 'application/json');
                resMock.end(JSON.stringify(data));
                return resMock;
              };
              (req as any).body = body;
              await handler(req, resMock);
            });
            return;
          } catch (err: any) {
            console.error('API dev middleware error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
            return;
          }
        }
        next();
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), apiDevMiddleware()],
})
