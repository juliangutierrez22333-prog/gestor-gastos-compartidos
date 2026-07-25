import type express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDb } from '../src/db/connection.js';

// Tipos de las respuestas de la API: res.body de supertest es `any`,
// castearlo una vez por test mantiene el chequeo de tipos en las aserciones.
interface AuthBody {
  user: { id: number; email: string; name: string };
  token: string;
}

interface ErrorBody {
  error: string;
}

const ANA = { email: 'ana@example.com', name: 'Ana', password: 'secreta123' };

let app: express.Express;

beforeEach(() => {
  // Cada test arranca con una base vacía en memoria: aislados y rápidos.
  app = createApp({ db: createDb(':memory:'), jwtSecret: 'secreto-de-test' });
});

describe('POST /api/auth/register', () => {
  it('crea el usuario y devuelve un token', async () => {
    const res = await request(app).post('/api/auth/register').send(ANA);
    const body = res.body as AuthBody;

    expect(res.status).toBe(201);
    expect(body.user).toEqual({ id: 1, email: ANA.email, name: ANA.name });
    expect(typeof body.token).toBe('string');
  });

  it('nunca expone el hash de la contraseña', async () => {
    const res = await request(app).post('/api/auth/register').send(ANA);

    expect(JSON.stringify(res.body)).not.toContain('password');
  });

  it('rechaza un email ya registrado con 409', async () => {
    await request(app).post('/api/auth/register').send(ANA);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...ANA, name: 'Otra Ana' });

    expect(res.status).toBe(409);
  });

  it('trata el email como case-insensitive para duplicados', async () => {
    await request(app).post('/api/auth/register').send(ANA);
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...ANA, email: 'ANA@example.com' });

    expect(res.status).toBe(409);
  });

  it('rechaza contraseñas de menos de 8 caracteres con 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...ANA, password: 'corta' });
    const body = res.body as ErrorBody;

    expect(res.status).toBe(400);
    expect(body.error).toContain('contraseña');
  });

  it('rechaza un email con formato inválido con 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...ANA, email: 'no-es-un-email' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(ANA);
  });

  it('devuelve usuario y token con credenciales correctas', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: ANA.password });
    const body = res.body as AuthBody;

    expect(res.status).toBe(200);
    expect(body.user.email).toBe(ANA.email);
    expect(typeof body.token).toBe('string');
  });

  it('rechaza una contraseña incorrecta con 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: 'incorrecta1' });

    expect(res.status).toBe(401);
  });

  it('usa el mismo mensaje para email inexistente y contraseña incorrecta', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: 'incorrecta1' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nadie@example.com', password: 'loquesea1' });

    expect(unknownEmail.status).toBe(401);
    expect((unknownEmail.body as ErrorBody).error).toBe((wrongPassword.body as ErrorBody).error);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el perfil con un token válido', async () => {
    const registro = await request(app).post('/api/auth/register').send(ANA);
    const token = (registro.body as AuthBody).token;

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    const body = res.body as { user: AuthBody['user'] };

    expect(res.status).toBe(200);
    expect(body.user).toEqual({ id: 1, email: ANA.email, name: ANA.name });
  });

  it('rechaza la petición sin token con 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  it('rechaza un token adulterado con 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token.falso.xyz');

    expect(res.status).toBe(401);
  });

  it('rechaza un token firmado con otro secreto con 401', async () => {
    const otraApp = createApp({ db: createDb(':memory:'), jwtSecret: 'otro-secreto' });
    await request(otraApp).post('/api/auth/register').send(ANA);
    const login = await request(otraApp)
      .post('/api/auth/login')
      .send({ email: ANA.email, password: ANA.password });
    const tokenAjeno = (login.body as AuthBody).token;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenAjeno}`);

    expect(res.status).toBe(401);
  });
});
