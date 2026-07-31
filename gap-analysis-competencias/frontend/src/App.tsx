import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ColaboradoresPage } from './pages/ColaboradoresPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />

            <Route element={<ProtectedRoute allowedRoles={['ADMIN_RH', 'VIEWER']} />}>
              <Route path="/colaboradores" element={<ColaboradoresPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
