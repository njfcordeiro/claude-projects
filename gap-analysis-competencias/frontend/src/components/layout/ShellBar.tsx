import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Search } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';

const ROLE_LABEL: Record<string, string> = {
  ADMIN_RH: 'Admin RH',
  MANAGER: 'Gestor',
  EMPLOYEE: 'Colaborador',
  VIEWER: 'Leitura',
};

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[partes.length - 1]?.[0] ?? '')).toUpperCase();
}

/** Barra superior estilo SAP Shell Bar: logo, pesquisa global, perfil. */
export function ShellBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [termo, setTermo] = useState('');
  const [menuAberto, setMenuAberto] = useState(false);

  function pesquisar(e: FormEvent) {
    e.preventDefault();
    if (termo.trim()) navigate(`/colaboradores?q=${encodeURIComponent(termo.trim())}`);
  }

  const nome = user?.colaborador?.nome ?? user?.email ?? '';

  return (
    <header className="flex h-12 items-center gap-4 bg-fiori-shell px-4 text-fiori-text-inverse">
      <span className="text-base font-semibold tracking-tight">Gap Analysis</span>

      {/* GET /colaboradores (lista) só existe para ADMIN_RH/VIEWER no backend
          — esconder a pesquisa global para os papéis que não a conseguem usar,
          em vez de mostrar um 403 depois de pesquisar. */}
      {(user?.role === 'ADMIN_RH' || user?.role === 'VIEWER') && (
        <form onSubmit={pesquisar} className="flex flex-1 max-w-md items-center gap-2 rounded bg-white/10 px-3 py-1.5 focus-within:bg-white/20">
          <Search size={16} className="text-white/70" aria-hidden="true" />
          <input
            type="search"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Pesquisar colaboradores…"
            className="w-full border-none bg-transparent text-sm text-white placeholder:text-white/60 outline-none"
          />
        </form>
      )}

      <div className="ml-auto relative">
        <button
          type="button"
          onClick={() => setMenuAberto((v) => !v)}
          className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fiori-primary text-xs font-semibold">
            {iniciais(nome)}
          </span>
          <span className="hidden text-sm sm:block">
            {nome}
            <span className="ml-1 text-white/60">· {user ? ROLE_LABEL[user.role] : ''}</span>
          </span>
          <ChevronDown size={14} />
        </button>

        {menuAberto && (
          <div className="absolute right-0 top-10 w-44 rounded border border-fiori-border bg-fiori-surface py-1 text-fiori-text shadow-fiori">
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-fiori-canvas"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
