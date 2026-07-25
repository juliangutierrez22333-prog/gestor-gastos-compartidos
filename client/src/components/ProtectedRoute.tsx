import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../features/auth/auth-context';

// Envuelve las rutas privadas: espera la validación del token inicial
// (evita el parpadeo de "no autenticado") y redirige al login si no hay sesión.
export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="status-message">Cargando…</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
