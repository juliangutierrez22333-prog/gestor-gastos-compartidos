import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import * as authApi from '../../api/auth';
import { clearToken, getToken, setToken } from '../../api/client';
import type { PublicUser } from '../../types/api';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  // Solo hay que "cargar" si existe un token que validar: derivarlo en el
  // inicializador evita un setState síncrono dentro del efecto.
  const [loading, setLoading] = useState(() => getToken() !== null);

  // Al montar la app: si hay token guardado, validarlo contra /me.
  // Un token vencido o adulterado se descarta silenciosamente.
  useEffect(() => {
    if (!getToken()) {
      return;
    }
    void authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login({ email, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, name: string, password: string) => {
    const result = await authApi.register({ email, name, password });
    setToken(result.token);
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
