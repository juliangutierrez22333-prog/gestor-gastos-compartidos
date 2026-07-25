import express from 'express';

// La app se crea en una factory separada del listen() de index.ts:
// los tests de integración (supertest) necesitan la app sin puerto abierto.
export function createApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
