import { ReactNode } from 'react';

interface KpiTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'error';
}

const TONE_TEXT: Record<NonNullable<KpiTileProps['tone']>, string> = {
  default: 'text-fiori-text',
  success: 'text-fiori-success',
  warning: 'text-fiori-warning',
  error: 'text-fiori-error',
};

/** Tile de KPI Fiori: número grande + rótulo pequeno por cima. */
export function KpiTile({ label, value, hint, tone = 'default' }: KpiTileProps) {
  return (
    <div className="rounded-md border border-fiori-border bg-fiori-surface p-4 shadow-fiori">
      <p className="text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${TONE_TEXT[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-fiori-text-secondary">{hint}</p>}
    </div>
  );
}
