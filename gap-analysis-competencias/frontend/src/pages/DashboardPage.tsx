import { useAuth } from '../auth/useAuth';

/**
 * Placeholder — o próximo passo é mostrar aqui o gap agregado (secção 8 do
 * doc de arquitetura: módulo gap-analysis ainda por implementar).
 */
export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h1>Bem-vindo{user?.colaborador ? `, ${user.colaborador.nome}` : ''}</h1>
      <p>
        Sessão iniciada como <strong>{user?.email}</strong> (papel <code>{user?.role}</code>).
      </p>
      <p>
        Esta página é um placeholder. Próximo passo: mostrar aqui o resumo do gap analysis
        (LOBs atingidas vs. exigidas) assim que o módulo <code>gap-analysis</code> do backend
        existir — ver secção 8 de <code>docs/02-arquitetura-tecnica.md</code>.
      </p>
    </div>
  );
}
