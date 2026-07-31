import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { ColaboradorResumo } from '../types/api';

/** Restrito a ADMIN_RH/VIEWER pela ProtectedRoute (ver App.tsx) — espelha o RolesGuard do backend. */
export function ColaboradoresPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => api.get<ColaboradorResumo[]>('/colaboradores'),
  });

  if (isLoading) return <p>A carregar…</p>;
  if (error) return <p className="error">Não foi possível carregar os colaboradores.</p>;

  return (
    <div>
      <h1>Colaboradores</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nome</th>
            <th>Cargo</th>
            <th>Gestor</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.nome}</td>
              <td>{c.cargoId ?? '—'}</td>
              <td>{c.managerId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
