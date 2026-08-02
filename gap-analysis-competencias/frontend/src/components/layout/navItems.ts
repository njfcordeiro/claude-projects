import { BookOpen, Compass, Database, GraduationCap, Grid3x3, LayoutGrid, ShieldCheck, Target, UserCog, Users } from 'lucide-react';
import { PapelUtilizador } from '../../types/api';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  roles?: PapelUtilizador[]; // omitido = todos os papéis autenticados
}

/** Lista única de navegação, partilhada pelo SideNav (desktop/tablet) e pelo drawer mobile — nunca diverge entre os dois. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, roles: ['ADMIN_RH', 'MANAGER', 'VIEWER'] },
  { to: '/colaboradores', label: 'Colaboradores', icon: Users, roles: ['ADMIN_RH', 'VIEWER'] },
  { to: '/lobs', label: 'LOBs', icon: Target },
  { to: '/formacoes', label: 'Formações', icon: GraduationCap },
  { to: '/candidatos', label: 'Candidatos', icon: Compass, roles: ['ADMIN_RH', 'MANAGER', 'VIEWER'] },
  { to: '/skill-matrix', label: 'Skill Matrix', icon: Grid3x3, roles: ['ADMIN_RH', 'MANAGER', 'VIEWER'] },
  { to: '/dados', label: 'Gestão de Dados', icon: Database, roles: ['ADMIN_RH'] },
  { to: '/atribuicoes', label: 'Atribuição em Massa', icon: UserCog, roles: ['ADMIN_RH'] },
  { to: '/admin', label: 'Administração', icon: ShieldCheck, roles: ['ADMIN_RH'] },
  { to: '/como-funciona', label: 'Como Funciona', icon: BookOpen },
];

export function itensVisiveisParaPapel(papel: PapelUtilizador): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(papel));
}
