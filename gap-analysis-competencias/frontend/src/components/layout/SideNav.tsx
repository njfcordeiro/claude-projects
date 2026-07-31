import { NavLink } from 'react-router-dom';
import { GraduationCap, LayoutGrid, ShieldCheck, Target, Users } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { PapelUtilizador } from '../../types/api';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  roles?: PapelUtilizador[]; // omitido = todos os papéis autenticados
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, roles: ['ADMIN_RH', 'MANAGER', 'VIEWER'] },
  // Lista completa: só ADMIN_RH/VIEWER (o backend restringe GET /colaboradores
  // da mesma forma — um MANAGER chega à sua equipa a partir do Dashboard).
  { to: '/colaboradores', label: 'Colaboradores', icon: Users, roles: ['ADMIN_RH', 'VIEWER'] },
  { to: '/lobs', label: 'LOBs', icon: Target },
  { to: '/formacoes', label: 'Formações', icon: GraduationCap },
  { to: '/admin', label: 'Administração', icon: ShieldCheck, roles: ['ADMIN_RH'] },
];

/** Navegação lateral estilo Fiori: item ativo com barra azul à esquerda + fundo tintado. */
export function SideNav() {
  const { user } = useAuth();
  if (!user) return null;

  const itensVisiveis = ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));

  return (
    <nav className="w-56 shrink-0 border-r border-fiori-border bg-fiori-surface py-2">
      {itensVisiveis.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 border-l-[3px] px-4 py-2.5 text-sm ${
              isActive
                ? 'border-fiori-primary bg-fiori-primary-bg font-medium text-fiori-primary'
                : 'border-transparent text-fiori-text hover:bg-fiori-canvas'
            }`
          }
        >
          <item.icon size={17} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
