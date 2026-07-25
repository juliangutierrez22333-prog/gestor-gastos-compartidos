import { Link, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuth } from './features/auth/auth-context';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { GroupDetailPage } from './features/groups/GroupDetailPage';
import { GroupsPage } from './features/groups/GroupsPage';

export function App() {
  const { user, logout } = useAuth();

  return (
    <>
      <header className="app-header">
        <Link to="/" className="brand">
          Gastos compartidos
        </Link>
        {user && (
          <div className="header-user">
            <span>{user.name}</span>
            <button type="button" className="link-button" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        )}
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
