import type { AuthResult, PublicUser } from '../types/api';
import { api } from './client';

export function register(input: { email: string; name: string; password: string }): Promise<AuthResult> {
  return api<AuthResult>('/api/auth/register', { method: 'POST', body: input });
}

export function login(input: { email: string; password: string }): Promise<AuthResult> {
  return api<AuthResult>('/api/auth/login', { method: 'POST', body: input });
}

export function me(): Promise<{ user: PublicUser }> {
  return api<{ user: PublicUser }>('/api/auth/me');
}
