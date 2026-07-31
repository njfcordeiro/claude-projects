import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ColaboradoresListPage } from './pages/ColaboradoresListPage';
import { ColaboradorProfilePage } from './pages/ColaboradorProfilePage';
import { LobsListPage } from './pages/LobsListPage';
import { LobDetailPage } from './pages/LobDetailPage';
import { FormacoesPage } from './pages/FormacoesPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<ProtectedRoute allowedRoles={['ADMIN_RH', 'MANAGER', 'VIEWER']} />}>
              <Route path="/" element={<DashboardPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN_RH', 'VIEWER']} />}>
              <Route path="/colaboradores" element={<ColaboradoresListPage />} />
            </Route>
            {/* Ficha individual: sem restrição de papel na rota — o backend
                aplica RBAC fino (gestor só a equipa, colaborador só a si). */}
            <Route path="/colaboradores/:id" element={<ColaboradorProfilePage />} />

            <Route path="/lobs" element={<LobsListPage />} />
            <Route path="/lobs/:id" element={<LobDetailPage />} />

            <Route path="/formacoes" element={<FormacoesPage />} />

            <Route element={<ProtectedRoute allowedRoles={['ADMIN_RH']} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
