import http from 'node:http';
import fs from 'node:fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import express from 'express';
import { createApp } from './src/server/app.ts';
import { initPostgresTables } from './src/db/index.ts';

async function startServer() {
  const app = createApp();
  const httpServer = http.createServer(app);

  // Dev server in AI Studio must listen on port 3000, 0.0.0.0
  const PORT = 3000;

  // Attempt non-blocking DB initialization for Supabase / PostgreSQL / pg-mem
  initPostgresTables().catch(err => {
    console.warn('Database table initialization notice:', err?.message || err);
  });

  // Always mount Vite middleware in development or when dist doesn't exist
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));

  if (process.env.NODE_ENV !== 'production' || !hasDist) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🚀 DA Hinunangan Swine Registry`);
    console.log(`  ➜ Local:   http://localhost:${PORT}`);
    console.log(`  ➜ Network: http://0.0.0.0:${PORT}\n`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();

