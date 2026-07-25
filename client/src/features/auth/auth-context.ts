import { createContext, useContext } from 'react';

import type { PublicUser } from '../../types/api';

export interface AuthContextValue {
  user: PublicUser | null;
  // true mientras se valida el token guardado al cargar la app.
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
