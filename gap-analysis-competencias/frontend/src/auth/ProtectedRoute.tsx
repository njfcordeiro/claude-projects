import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';
import { PapelUtilizador } from '../types/api';

interface ProtectedRouteProps {
  allowedRoles?: PapelUtilizador[];
}

/** Bloqueia por autenticação e, opcionalmente, por papel. */
export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) return <p>A carregar…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
