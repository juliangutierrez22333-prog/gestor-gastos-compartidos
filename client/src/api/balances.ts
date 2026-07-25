import type { GroupBalances, Settlement } from '../types/api';
import { api } from './client';

export function getBalances(groupId: number): Promise<GroupBalances> {
  return api<GroupBalances>(`/api/groups/${groupId}/balances`);
}

export function createSettlement(
  groupId: number,
  input: { toUser: number; amountCents: number },
): Promise<{ settlement: Settlement }> {
  return api<{ settlement: Settlement }>(`/api/groups/${groupId}/settlements`, {
    method: 'POST',
    body: input,
  });
}

export function listSettlements(groupId: number): Promise<{ settlements: Settlement[] }> {
  return api<{ settlements: Settlement[] }>(`/api/groups/${groupId}/settlements`);
}
