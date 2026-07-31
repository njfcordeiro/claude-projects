import { AlertTriangle, CheckCircle2, HelpCircle, Info, XCircle } from 'lucide-react';
import { ReactNode } from 'react';

export type BadgeStatus = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const STATUS_STYLES: Record<BadgeStatus, string> = {
  success: 'bg-fiori-success-bg text-fiori-success',
  warning: 'bg-fiori-warning-bg text-fiori-warning',
  error: 'bg-fiori-error-bg text-fiori-error',
  info: 'bg-fiori-info-bg text-fiori-primary',
  neutral: 'bg-fiori-canvas text-fiori-text-secondary',
};

const STATUS_ICONS: Record<BadgeStatus, typeof CheckCircle2> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  neutral: HelpCircle,
};

/**
 * Nunca só cor a distinguir estado — ícone + texto sempre presentes (ver
 * skill de dataviz: cores de estado são reservadas e não passam no teste
 * de adjacência categórica sozinhas).
 */
export function Badge({ status, children }: { status: BadgeStatus; children: ReactNode }) {
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}
