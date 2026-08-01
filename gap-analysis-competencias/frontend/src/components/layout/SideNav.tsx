import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { itensVisiveisParaPapel } from './navItems';

/** Navegação lateral estilo Fiori: item ativo com barra azul à esquerda + fundo tintado. Só visível a partir de md — abaixo disso, ver MobileNavDrawer. */
export function SideNav() {
  const { user } = useAuth();
  if (!user) return null;

  const itensVisiveis = itensVisiveisParaPapel(user.role);

  return (
    <nav className="hidden w-56 shrink-0 border-r border-fiori-border bg-fiori-surface py-2 md:block">
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
