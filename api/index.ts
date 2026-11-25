import { createExpressApp, initializeSupabaseSync } from '../src/serverApp';

const app = createExpressApp();

// Non-blocking initialization on serverless container cold-start
initializeSupabaseSync().catch(err => {
  console.warn('[Vercel Serverless Sync Notice]', err.message);
});

export default app;
