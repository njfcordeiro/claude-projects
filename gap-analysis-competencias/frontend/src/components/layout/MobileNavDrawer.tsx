import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { itensVisiveisParaPapel } from './navItems';

/** Drawer de navegação para ecrãs abaixo de md — mesma lista de itens do SideNav, só o layout muda (off-canvas em vez de fixo). */
export function MobileNavDrawer({ aberto, onClose }: { aberto: boolean; onClose: () => void }) {
  const { user } = useAuth();
  if (!user || !aberto) return null;

  const itensVisiveis = itensVisiveisParaPapel(user.role);

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <nav className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto bg-fiori-surface shadow-lg">
        <div className="flex items-center justify-between border-b border-fiori-border px-4 py-3">
          <span className="text-base font-semibold text-fiori-text">Gap Analysis</span>
          <button type="button" onClick={onClose} className="text-fiori-text-secondary hover:text-fiori-text" aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <div className="py-2">
          {itensVisiveis.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 border-l-[3px] px-4 py-3 text-sm ${
                  isActive
                    ? 'border-fiori-primary bg-fiori-primary-bg font-medium text-fiori-primary'
                    : 'border-transparent text-fiori-text hover:bg-fiori-canvas'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
