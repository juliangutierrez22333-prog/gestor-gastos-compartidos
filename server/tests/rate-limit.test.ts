import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDb } from '../src/db/connection.js';

describe('rate limiting en /api/auth', () => {
  it('responde 429 al superar el límite de intentos de login', async () => {
    const app = createApp({
      db: createDb(':memory:'),
      jwtSecret: 'secreto-de-test',
      authRateLimit: { windowMs: 60_000, limit: 3 },
    });
    const credenciales = { email: 'nadie@example.com', password: 'incorrecta1' };

    for (let intento = 1; intento <= 3; intento++) {
      const res = await request(app).post('/api/auth/login').send(credenciales);
      expect(res.status).toBe(401);
    }

    const bloqueado = await request(app).post('/api/auth/login').send(credenciales);
    expect(bloqueado.status).toBe(429);
  });

  it('no limita /me: la SPA lo consulta en cada carga', async () => {
    const app = createApp({
      db: createDb(':memory:'),
      jwtSecret: 'secreto-de-test',
      authRateLimit: { windowMs: 60_000, limit: 2 },
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api/auth/me');
      // 401 por falta de token, nunca 429: el límite no aplica a /me.
      expect(res.status).toBe(401);
    }
  });
});
