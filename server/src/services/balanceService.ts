import { ApiError } from '../errors.js';
import type { ExpenseRepository } from '../repositories/expenseRepository.js';
import type { GroupRepository } from '../repositories/groupRepository.js';
import type { SettlementRepository, SettlementRow } from '../repositories/settlementRepository.js';
import type { UserRepository } from '../repositories/userRepository.js';
import { computeNetBalances, suggestSettlements, type Transfer } from './balance.js';

export interface MemberBalance {
  userId: number;
  name: string;
  netCents: number;
}

export interface Settlement {
  id: number;
  fromUser: number;
  toUser: number;
  amountCents: number;
  createdAt: string;
}

export interface GroupBalances {
  balances: MemberBalance[];
  suggestedSettlements: Transfer[];
}

function toSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    fromUser: row.from_user,
    toUser: row.to_user,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
  };
}

export class BalanceService {
  constructor(
    private readonly groups: GroupRepository,
    private readonly expenses: ExpenseRepository,
    private readonly settlements: SettlementRepository,
    private readonly users: UserRepository,
  ) {}

  // Los balances se calculan siempre desde los datos crudos (gastos, splits
  // y pagos): única fuente de verdad, nada que pueda quedar desincronizado.
  getGroupBalances(groupId: number): GroupBalances {
    const members = this.groups.listMembers(groupId);
    const expenseRows = this.expenses.listByGroup(groupId);
    const splitRows = this.expenses.listSplitsByGroup(groupId);
    const settlementRows = this.settlements.listByGroup(groupId);

    const net = computeNetBalances({
      memberIds: members.map((m) => m.user_id),
      payments: expenseRows.map((e) => ({ userId: e.paid_by, amountCents: e.amount_cents })),
      shares: splitRows.map((s) => ({ userId: s.user_id, amountCents: s.amount_cents })),
      settlements: settlementRows.map((s) => ({
        fromUser: s.from_user,
        toUser: s.to_user,
        amountCents: s.amount_cents,
      })),
    });

    const nameById = new Map(members.map((m) => [m.user_id, m.name]));
    const balances = net.map((b) => ({
      userId: b.userId,
      // Un ex-miembro con movimientos históricos sigue apareciendo: su
      // nombre se busca aparte porque ya no está en group_members.
      name: nameById.get(b.userId) ?? this.users.findById(b.userId)?.name ?? 'Usuario desconocido',
      netCents: b.netCents,
    }));

    return { balances, suggestedSettlements: suggestSettlements(net) };
  }

  // fromUser es siempre quien hace la petición: solo registrás pagos que
  // hiciste vos, nadie puede inventar pagos en nombre de otro.
  createSettlement(
    groupId: number,
    fromUser: number,
    input: { toUser: number; amountCents: number },
  ): Settlement {
    if (input.toUser === fromUser) {
      throw ApiError.badRequest('No podés registrar un pago a vos mismo');
    }
    if (!this.groups.isMember(groupId, input.toUser)) {
      throw ApiError.badRequest('El destinatario debe ser miembro del grupo');
    }
    return toSettlement(this.settlements.create(groupId, fromUser, input.toUser, input.amountCents));
  }

  listSettlements(groupId: number): Settlement[] {
    return this.settlements.listByGroup(groupId).map(toSettlement);
  }
}
