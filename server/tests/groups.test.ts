import type express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDb } from '../src/db/connection.js';
import type { GroupMember, GroupSummary } from '../src/services/groupService.js';

interface AuthBody {
  user: { id: number; email: string; name: string };
  token: string;
}

let app: express.Express;

async function crearUsuario(nombre: string): Promise<{ id: number; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${nombre}@example.com`, name: nombre, password: 'clave-123456' });
  const body = res.body as AuthBody;
  return { id: body.user.id, token: body.token };
}

async function crearGrupo(token: string, name = 'Viaje a la costa'): Promise<GroupSummary> {
  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  return (res.body as { group: GroupSummary }).group;
}

beforeEach(() => {
  app = createApp({ db: createDb(':memory:'), jwtSecret: 'secreto-de-test' });
});

describe('POST /api/groups', () => {
  it('crea el grupo y suma al creador como miembro', async () => {
    const ana = await crearUsuario('ana');
    const grupo = await crearGrupo(ana.token);

    const detalle = await request(app)
      .get(`/api/groups/${grupo.id}`)
      .set('Authorization', `Bearer ${ana.token}`);
    const members = (detalle.body as { members: GroupMember[] }).members;

    expect(grupo.createdBy).toBe(ana.id);
    expect(members.map((m) => m.id)).toEqual([ana.id]);
  });

  it('rechaza la creación sin token con 401', async () => {
    const res = await request(app).post('/api/groups').send({ name: 'Sin dueño' });

    expect(res.status).toBe(401);
  });

  it('rechaza un nombre vacío con 400', async () => {
    const ana = await crearUsuario('ana');
    const res = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/groups', () => {
  it('lista solo los grupos donde el usuario es miembro', async () => {
    const ana = await crearUsuario('ana');
    const beto = await crearUsuario('beto');
    await crearGrupo(ana.token, 'Grupo de Ana');
    await crearGrupo(beto.token, 'Grupo de Beto');

    const res = await request(app).get('/api/groups').set('Authorization', `Bearer ${ana.token}`);
    const groups = (res.body as { groups: GroupSummary[] }).groups;

    expect(groups.map((g) => g.name)).toEqual(['Grupo de Ana']);
  });
});

describe('GET /api/groups/:id', () => {
  it('responde 404 (no 403) a un usuario que no es miembro', async () => {
    const ana = await crearUsuario('ana');
    const intruso = await crearUsuario('intruso');
    const grupo = await crearGrupo(ana.token);

    const res = await request(app)
      .get(`/api/groups/${grupo.id}`)
      .set('Authorization', `Bearer ${intruso.token}`);

    // 404 deliberado: un 403 confirmaría que el grupo existe.
    expect(res.status).toBe(404);
  });

  it('responde 400 ante un id no numérico', async () => {
    const ana = await crearUsuario('ana');
    const res = await request(app)
      .get('/api/groups/abc')
      .set('Authorization', `Bearer ${ana.token}`);

    expect(res.status).toBe(400);
  });
});

describe('POST /api/groups/:id/members', () => {
  it('agrega un usuario existente por email', async () => {
    const ana = await crearUsuario('ana');
    const beto = await crearUsuario('beto');
    const grupo = await crearGrupo(ana.token);

    const res = await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email: 'beto@example.com' });
    const members = (res.body as { members: GroupMember[] }).members;

    expect(res.status).toBe(201);
    expect(members.map((m) => m.id).sort()).toEqual([ana.id, beto.id].sort());
  });

  it('el miembro agregado ve el grupo en su listado', async () => {
    const ana = await crearUsuario('ana');
    const beto = await crearUsuario('beto');
    const grupo = await crearGrupo(ana.token);
    await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email: 'beto@example.com' });

    const res = await request(app).get('/api/groups').set('Authorization', `Bearer ${beto.token}`);
    const groups = (res.body as { groups: GroupSummary[] }).groups;

    expect(groups.map((g) => g.id)).toContain(grupo.id);
  });

  it('responde 404 si el email no corresponde a un usuario registrado', async () => {
    const ana = await crearUsuario('ana');
    const grupo = await crearGrupo(ana.token);

    const res = await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email: 'fantasma@example.com' });

    expect(res.status).toBe(404);
  });

  it('responde 409 si el usuario ya es miembro', async () => {
    const ana = await crearUsuario('ana');
    const grupo = await crearGrupo(ana.token);

    const res = await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email: 'ana@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /api/groups/:id/members/:userId', () => {
  async function grupoConDosMiembros(): Promise<{
    ana: { id: number; token: string };
    beto: { id: number; token: string };
    grupo: GroupSummary;
  }> {
    const ana = await crearUsuario('ana');
    const beto = await crearUsuario('beto');
    const grupo = await crearGrupo(ana.token);
    await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email: 'beto@example.com' });
    return { ana, beto, grupo };
  }

  it('un miembro puede salir del grupo y pierde el acceso', async () => {
    const { beto, grupo } = await grupoConDosMiembros();

    const salida = await request(app)
      .delete(`/api/groups/${grupo.id}/members/${beto.id}`)
      .set('Authorization', `Bearer ${beto.token}`);
    const acceso = await request(app)
      .get(`/api/groups/${grupo.id}`)
      .set('Authorization', `Bearer ${beto.token}`);

    expect(salida.status).toBe(204);
    expect(acceso.status).toBe(404);
  });

  it('el creador puede eliminar a otro miembro', async () => {
    const { ana, beto, grupo } = await grupoConDosMiembros();

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/members/${beto.id}`)
      .set('Authorization', `Bearer ${ana.token}`);

    expect(res.status).toBe(204);
  });

  it('un miembro común no puede eliminar a otro (403)', async () => {
    const { ana, beto, grupo } = await grupoConDosMiembros();

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/members/${ana.id}`)
      .set('Authorization', `Bearer ${beto.token}`);

    expect(res.status).toBe(403);
  });

  it('el creador no puede salir de su propio grupo (400)', async () => {
    const { ana, grupo } = await grupoConDosMiembros();

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/members/${ana.id}`)
      .set('Authorization', `Bearer ${ana.token}`);

    expect(res.status).toBe(400);
  });
});
