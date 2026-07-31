import { Link, Outlet } from 'react-router-dom';
import { useAuth } from './auth/useAuth';

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <nav>
          <Link to="/">Dashboard</Link>
          {(user?.role === 'ADMIN_RH' || user?.role === 'VIEWER') && (
            <Link to="/colaboradores">Colaboradores</Link>
          )}
        </nav>
        <button type="button" onClick={logout}>
          Sair
        </button>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
