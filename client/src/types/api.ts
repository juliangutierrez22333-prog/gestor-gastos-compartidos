// Tipos de las respuestas de la API. Espejo de los DTOs del servidor:
// si el backend cambia una forma, estos tipos se actualizan a la par.

export interface PublicUser {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface GroupSummary {
  id: number;
  name: string;
  createdBy: number;
  createdAt: string;
}

export interface GroupMember {
  id: number;
  name: string;
  email: string;
  joinedAt: string;
}

export interface GroupDetail {
  group: GroupSummary;
  members: GroupMember[];
}

export interface ExpenseSplit {
  userId: number;
  amountCents: number;
}

export interface Expense {
  id: number;
  description: string;
  amountCents: number;
  paidBy: number;
  expenseDate: string;
  createdAt: string;
  splits: ExpenseSplit[];
}

export interface MemberBalance {
  userId: number;
  name: string;
  netCents: number;
}

export interface SuggestedSettlement {
  fromUser: number;
  toUser: number;
  amountCents: number;
}

export interface GroupBalances {
  balances: MemberBalance[];
  suggestedSettlements: SuggestedSettlement[];
}

export interface Settlement {
  id: number;
  fromUser: number;
  toUser: number;
  amountCents: number;
  createdAt: string;
}
