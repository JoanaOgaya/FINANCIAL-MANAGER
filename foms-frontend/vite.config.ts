import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'paymongo-server-middleware',
        configureServer(server) {
          // POST /api/paymongo-link → calls PayMongo server-side (no CORS issues)
          server.middlewares.use('/api/paymongo-link', async (req: any, res: any) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end('Method Not Allowed');
              return;
            }

            let body = '';
            req.on('data', (chunk: any) => { body += chunk.toString(); });
            req.on('end', async () => {
              try {
                const secretKey = env.VITE_PAYMONGO_SECRET_KEY;
                if (!secretKey) throw new Error('VITE_PAYMONGO_SECRET_KEY not set in .env');

                const base64Key = Buffer.from(`${secretKey}:`).toString('base64');

                const pmRes = await fetch('https://api.paymongo.com/v1/links', {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Basic ${base64Key}`,
                  },
                  body,
                });

                const data = await pmRes.json();
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = pmRes.status;
                res.end(JSON.stringify(data));
              } catch (err: any) {
                console.error('[paymongo-middleware] Error:', err.message);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });
        },
      },
    ],
    server: {
      port: 5173,
      strictPort: false,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5007',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      port: 4173,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5007',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});

