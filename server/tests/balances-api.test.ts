import type express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createDb } from '../src/db/connection.js';
import type { GroupBalances, Settlement } from '../src/services/balanceService.js';
import type { GroupSummary } from '../src/services/groupService.js';

interface AuthBody {
  user: { id: number; email: string; name: string };
  token: string;
}

let app: express.Express;
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

async function verBalances(token: string): Promise<GroupBalances> {
  const res = await request(app)
    .get(`/api/groups/${grupo.id}/balances`)
    .set('Authorization', `Bearer ${token}`);
  return res.body as GroupBalances;
}

beforeEach(async () => {
  app = createApp({ db: createDb(':memory:'), jwtSecret: 'secreto-de-test' });
  ana = await crearUsuario('ana');
  beto = await crearUsuario('beto');
  carla = await crearUsuario('carla');

  const res = await request(app)
    .post('/api/groups')
    .set('Authorization', `Bearer ${ana.token}`)
    .send({ name: 'Vacaciones' });
  grupo = (res.body as { group: GroupSummary }).group;

  for (const email of ['beto@example.com', 'carla@example.com']) {
    await request(app)
      .post(`/api/groups/${grupo.id}/members`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ email });
  }
});

describe('GET /api/groups/:id/balances', () => {
  it('un grupo sin gastos tiene a todos en cero y sin sugerencias', async () => {
    const { balances, suggestedSettlements } = await verBalances(ana.token);

    expect(balances.every((b) => b.netCents === 0)).toBe(true);
    expect(suggestedSettlements).toEqual([]);
  });

  it('refleja un gasto pagado por una persona y dividido entre todas', async () => {
    await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Hotel',
        amountCents: 9000,
        paidBy: ana.id,
        splitAmong: [ana.id, beto.id, carla.id],
      });

    const { balances, suggestedSettlements } = await verBalances(beto.token);
    const porUsuario = new Map(balances.map((b) => [b.userId, b.netCents]));

    expect(porUsuario.get(ana.id)).toBe(6000);
    expect(porUsuario.get(beto.id)).toBe(-3000);
    expect(porUsuario.get(carla.id)).toBe(-3000);
    expect(suggestedSettlements).toEqual([
      { fromUser: beto.id, toUser: ana.id, amountCents: 3000 },
      { fromUser: carla.id, toUser: ana.id, amountCents: 3000 },
    ]);
  });

  it('un pago registrado reduce la deuda y desaparece de las sugerencias', async () => {
    await request(app)
      .post(`/api/groups/${grupo.id}/expenses`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({
        description: 'Hotel',
        amountCents: 9000,
        paidBy: ana.id,
        splitAmong: [ana.id, beto.id, carla.id],
      });
    await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${beto.token}`)
      .send({ toUser: ana.id, amountCents: 3000 });

    const { balances, suggestedSettlements } = await verBalances(ana.token);
    const porUsuario = new Map(balances.map((b) => [b.userId, b.netCents]));

    expect(porUsuario.get(beto.id)).toBe(0);
    expect(porUsuario.get(ana.id)).toBe(3000);
    expect(suggestedSettlements).toEqual([
      { fromUser: carla.id, toUser: ana.id, amountCents: 3000 },
    ]);
  });

  it('escenario cruzado: los balances netean gastos de varias personas', async () => {
    // Ana paga 6000 entre los tres; Beto paga 3000 entre los tres.
    for (const [paidBy, token, amountCents] of [
      [ana.id, ana.token, 6000],
      [beto.id, beto.token, 3000],
    ] as const) {
      await request(app)
        .post(`/api/groups/${grupo.id}/expenses`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          description: 'Gasto cruzado',
          amountCents,
          paidBy,
          splitAmong: [ana.id, beto.id, carla.id],
        });
    }

    const { balances } = await verBalances(ana.token);
    const porUsuario = new Map(balances.map((b) => [b.userId, b.netCents]));

    // Ana: pagó 6000, consume 3000 → +3000. Beto: pagó 3000, consume 3000 → 0.
    // Carla: consume 3000 → −3000.
    expect(porUsuario.get(ana.id)).toBe(3000);
    expect(porUsuario.get(beto.id)).toBe(0);
    expect(porUsuario.get(carla.id)).toBe(-3000);
  });

  it('un no-miembro no puede ver los balances (404)', async () => {
    const externo = await crearUsuario('externo');
    const res = await request(app)
      .get(`/api/groups/${grupo.id}/balances`)
      .set('Authorization', `Bearer ${externo.token}`);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/groups/:id/settlements', () => {
  it('registra el pago con el emisor tomado del token, no del body', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${beto.token}`)
      .send({ toUser: ana.id, amountCents: 1500 });
    const settlement = (res.body as { settlement: Settlement }).settlement;

    expect(res.status).toBe(201);
    expect(settlement.fromUser).toBe(beto.id);
    expect(settlement.toUser).toBe(ana.id);
  });

  it('rechaza pagarse a uno mismo (400)', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ toUser: ana.id, amountCents: 1000 });

    expect(res.status).toBe(400);
  });

  it('rechaza un destinatario que no es miembro (400)', async () => {
    const externo = await crearUsuario('externo');
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${ana.token}`)
      .send({ toUser: externo.id, amountCents: 1000 });

    expect(res.status).toBe(400);
  });

  it('rechaza montos no positivos (400)', async () => {
    const res = await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${beto.token}`)
      .send({ toUser: ana.id, amountCents: 0 });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/groups/:id/settlements', () => {
  it('lista los pagos del grupo, más recientes primero', async () => {
    await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${beto.token}`)
      .send({ toUser: ana.id, amountCents: 1000 });
    await request(app)
      .post(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${carla.token}`)
      .send({ toUser: ana.id, amountCents: 2000 });

    const res = await request(app)
      .get(`/api/groups/${grupo.id}/settlements`)
      .set('Authorization', `Bearer ${ana.token}`);
    const settlements = (res.body as { settlements: Settlement[] }).settlements;

    expect(settlements).toHaveLength(2);
    expect(settlements[0]?.amountCents).toBe(2000);
    expect(settlements[1]?.amountCents).toBe(1000);
  });
});
