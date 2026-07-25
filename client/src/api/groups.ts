import type { GroupDetail, GroupMember, GroupSummary } from '../types/api';
import { api } from './client';

export function listGroups(): Promise<{ groups: GroupSummary[] }> {
  return api<{ groups: GroupSummary[] }>('/api/groups');
}

export function createGroup(name: string): Promise<{ group: GroupSummary }> {
  return api<{ group: GroupSummary }>('/api/groups', { method: 'POST', body: { name } });
}

export function getGroup(groupId: number): Promise<GroupDetail> {
  return api<GroupDetail>(`/api/groups/${groupId}`);
}

export function addMember(groupId: number, email: string): Promise<{ members: GroupMember[] }> {
  return api<{ members: GroupMember[] }>(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: { email },
  });
}

export function removeMember(groupId: number, userId: number): Promise<void> {
  return api<void>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}
