import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createExpressApp, initializeSupabaseSync } from './src/serverApp';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT =
  NODE_ENV !== 'production'
    ? parseInt(process.env.APP_PORT || '3000', 10)
    : parseInt(process.env.APP_PORT || process.env.PORT || '3000', 10);

async function startServer() {
  const app = createExpressApp();

  // Non-blocking initialization so the server opens port 3000 instantly
  initializeSupabaseSync().catch(err => {
    console.warn('[Supabase Sync Warning] Background sync:', err.message);
  });

  // Vite development middleware or static production serving
  if (NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`================================================================`);
    console.log(`FARIOUSY DELIVERY — Serveur Logistique Full-Stack Opérationnel`);
    console.log(`Domaine de production : https://app.fariousy.com`);
    console.log(`Déploiement compatible : Vercel Serverless & VPS Linux (Node/PM2)`);
    console.log(`Écoute sur : http://0.0.0.0:${PORT} (Mode: ${NODE_ENV})`);
    console.log(`Route Health-check : http://0.0.0.0:${PORT}/api/health`);
    console.log(`================================================================`);
  });
}

process.on('uncaughtException', (err) => {
  console.error('[Process Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Process Unhandled Rejection]:', reason);
});

startServer().catch(err => {
  console.error('[Server Startup Fatal Error]:', err);
});
