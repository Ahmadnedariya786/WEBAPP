import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

function tesseractAssetsMiddleware(): Plugin {
  const handler = (req: any, res: any, next: () => void) => {
    if (!req.url) return next();
    try {
      const urlObj = new URL(req.url, 'http://localhost');
      const pathname = urlObj.pathname;

      if (pathname.startsWith('/tesseract/lang-data/')) {
        const fileName = pathname.replace('/tesseract/lang-data/', '');
        const distPath = path.resolve(process.cwd(), 'dist', 'tesseract', 'lang-data', fileName);
        const publicPath = path.resolve(process.cwd(), 'public', 'tesseract', 'lang-data', fileName);
        const filePath = fs.existsSync(distPath) ? distPath : publicPath;

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const stat = fs.statSync(filePath);
          const contentType = fileName.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream';

          if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            return res.end();
          }

          if (req.method === 'HEAD') {
            res.writeHead(200, {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable',
              'Content-Disposition': 'inline',
              'Content-Length': String(stat.size),
              'Access-Control-Allow-Origin': '*'
            });
            return res.end();
          }

          res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'Content-Disposition': 'inline',
            'Content-Length': String(stat.size),
            'Access-Control-Allow-Origin': '*'
          });
          const stream = fs.createReadStream(filePath);
          return stream.pipe(res);
        }
      }
    } catch (err) {
      console.warn('Tesseract assets middleware warning:', err);
    }
    next();
  };

  return {
    name: 'tesseract-assets-middleware',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    }
  };
}

function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/scan-extract')) {
          try {
            const { default: handler } = await import('./api/scan-extract.ts');
            if (!process.env.GEMINI_API_KEY) {
              process.env.SCAN_MOCK = 'true';
            }
            const urlObj = new URL(req.url, 'http://localhost');
            (req as any).query = Object.fromEntries(urlObj.searchParams.entries());

            let rawBody = '';
            req.on('data', chunk => { rawBody += chunk; });
            req.on('end', async () => {
              let body = {};
              if (rawBody && rawBody.trim()) {
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  body = rawBody;
                }
              }
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
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/scan-extract')) {
          try {
            const { default: handler } = await import('./api/scan-extract.ts');
            if (!process.env.GEMINI_API_KEY) {
              process.env.SCAN_MOCK = 'true';
            }
            const urlObj = new URL(req.url, 'http://localhost');
            (req as any).query = Object.fromEntries(urlObj.searchParams.entries());

            let rawBody = '';
            req.on('data', chunk => { rawBody += chunk; });
            req.on('end', async () => {
              let body = {};
              if (rawBody && rawBody.trim()) {
                try {
                  body = JSON.parse(rawBody);
                } catch {
                  body = rawBody;
                }
              }
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
            console.error('API preview middleware error:', err);
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
  plugins: [react(), tesseractAssetsMiddleware(), apiDevMiddleware()],
})

