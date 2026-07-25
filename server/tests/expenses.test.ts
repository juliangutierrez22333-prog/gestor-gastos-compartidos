import type express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDb } from '../src/db/connection.js';
import type { Expense } from '../src/services/expenseService.js';
import type { GroupSummary } from '../src/services/groupService.js';

interface AuthBody {
  user: { id: number; email: string; name: string };
  token: string;
}

let app: express.Express;

// Escenario base: Ana (creadora), Beto y Carla en un grupo.
let ana: { id: number; token: string };
let beto: { id: number; token: string };
let carla: { id: number; token: string };
let grupo: GroupSummary;

async function crearUsuario(nombre: string): Promise<{ id: number; token: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${nombre}@example.com`, name: nombre, password: 'clave-123456' });
  const body = res.body as AuthBody;
  return { id: body.user.id, token: body.token };
}

beforeEach(async () => {
  app = createApp({ db: createDb(':memory:'), jwtSecret: 'secreto-de-test' });
  ana = await crearUsuario('ana');
  beto = await crearUsuario('beto');
  carla = await crearUsuario('carla');

  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${ana.token}`)
    .send({ name: 'Depto compartido' });
  grupo = (res.body as { group: GroupSummary }).group;

  for (const email of ['beto@example.com', 'carla@example.com']) {
    await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email });
  }
});

describe('POST /api/groups/:id/expenses', () => {
  it('crea un gasto con montos explícitos', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Supermercado',
        amountCents: 15050,
        paidBy: ana.id,
        expenseDate: '2026-07-20',
        splits: [
          { userId: ana.id, amountCents: 5050 },
          { userId: beto.id, amountCents: 5000 },
          { userId: carla.id, amountCents: 5000 },
        ],
      });
    const expense = (res.body as { expense: Expense }).expense;

    expect(res.status).toBe(201);
    expect(expense.amountCents).toBe(15050);
    expect(expense.splits).toHaveLength(3);
  });

  it('divide en partes iguales con splitAmong y reparte el sobrante', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Cena',
        amountCents: 10000,
        paidBy: ana.id,
        splitAmong: [ana.id, beto.id, carla.id],
      });
    const expense = (res.body as { expense: Expense }).expense;
    const total = expense.splits.reduce((sum, s) => sum + s.amountCents, 0);

    expect(res.status).toBe(201);
    expect(total).toBe(10000);
    expect(expense.splits.map((s) => s.amountCents).sort()).toEqual([3333, 3333, 3334]);
  });

  it('rechaza una división que no suma el monto total (400)', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Error de suma',
        amountCents: 10000,
        paidBy: ana.id,
        splits: [
          { userId: ana.id, amountCents: 5000 },
          { userId: beto.id, amountCents: 4000 },
        ],
      });

    expect(res.status).toBe(400);
    expect((res.body as { error: string }).error).toContain('no coincide');
  });

  it('rechaza un pagador que no es miembro del grupo (400)', async () => {
    const externo = await crearUsuario('externo');
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Pagador externo',
        amountCents: 1000,
        paidBy: externo.id,
        splitAmong: [ana.id],
      });

    expect(res.status).toBe(400);
  });

  it('rechaza participantes que no son miembros (400)', async () => {
    const externo = await crearUsuario('externo');
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Participante externo',
        amountCents: 1000,
        paidBy: ana.id,
        splitAmong: [ana.id, externo.id],
      });

    expect(res.status).toBe(400);
  });

  it('rechaza enviar splits y splitAmong a la vez (400)', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Ambiguo',
        amountCents: 1000,
        paidBy: ana.id,
        splits: [{ userId: ana.id, amountCents: 1000 }],
        splitAmong: [ana.id],
      });

    expect(res.status).toBe(400);
  });

  it('rechaza un monto no entero (400): los centavos no tienen decimales', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Monto con decimales',
        amountCents: 100.5,
        paidBy: ana.id,
        splitAmong: [ana.id],
      });

    expect(res.status).toBe(400);
  });

  it('un no-miembro no puede registrar gastos (404)', async () => {
    const externo = await crearUsuario('externo');
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${externo.token}`)
      .send({
        description: 'Intruso',
        amountCents: 1000,
        paidBy: externo.id,
        splitAmong: [externo.id],
      });

    expect(res.status).toBe(404);
  });
});

describe('GET /api/groups/:id/expenses', () => {
  it('lista los gastos con sus divisiones, más recientes primero', async () => {
    for (const [description, expenseDate] of [
      ['Primero', '2026-07-01'],
      ['Segundo', '2026-07-15'],
    ] as const) {
      await request(app)
        .post(`/api/groups/${grupo.id}/expenses`)
        .set('Authorization', `Bearer ${ana.token}`)
        .send({
          description,
          expenseDate,
          amountCents: 3000,
          paidBy: ana.id,
          splitAmong: [ana.id, beto.id, carla.id],
        });
    }

    const res = await request(app)
      .get(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`);
    const expenses = (res.body as { expenses: Expense[] }).expenses;

    expect(expenses.map((e) => e.description)).toEqual(['Segundo', 'Primero']);
    expect(expenses[0]?.splits).toHaveLength(3);
  });
});

describe('DELETE /api/groups/:id/expenses/:expenseId', () => {
  async function crearGasto(paidBy: number, token: string): Promise<Expense> {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Gasto a borrar',
        amountCents: 3000,
        paidBy,
        splitAmong: [ana.id, beto.id, carla.id],
      });
    return (res.body as { expense: Expense }).expense;
  }

  it('quien pagó puede eliminar su gasto', async () => {
    const gasto = await crearGasto(beto.id, beto.token);

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/expenses/${gasto.id}`)
      .set('Authorization', `Bearer ${beto.token}`);

    expect(res.status).toBe(204);
  });

  it('el creador del grupo puede eliminar cualquier gasto', async () => {
    const gasto = await crearGasto(beto.id, beto.token);

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/expenses/${gasto.id}`)
      .set('Authorization', `Bearer ${ana.token}`);

    expect(res.status).toBe(204);
  });

  it('otro miembro no puede eliminar un gasto ajeno (403)', async () => {
    const gasto = await crearGasto(beto.id, beto.token);

    const res = await request(app)
      .delete(`/api/groups/${grupo.id}/expenses/${gasto.id}`)
      .set('Authorization', `Bearer ${carla.token}`);

    expect(res.status).toBe(403);
  });

  it('responde 404 para un gasto que pertenece a otro grupo', async () => {
    const gasto = await crearGasto(ana.id, ana.token);

    const otroGrupoRes = await request(app)
      .post('/api/groups')
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ name: 'Otro grupo' });
    const otroGrupo = (otroGrupoRes.body as { group: GroupSummary }).group;

    const res = await request(app)
      .delete(`/api/groups/${otroGrupo.id}/expenses/${gasto.id}`)
      .set('Authorization', `Bearer ${ana.token}`);

    expect(res.status).toBe(404);
  });
});
