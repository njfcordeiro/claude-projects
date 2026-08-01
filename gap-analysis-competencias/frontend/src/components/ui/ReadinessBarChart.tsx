import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ReadinessBarDatum {
  grupo: string;
  prontidaoMedia: number;
  totalColaboradores: number;
  emRisco: number;
}

/**
 * Um único hue de magnitude (azul de marca) — não é uma paleta categórica,
 * é uma comparação de UMA métrica (prontidão média) entre grupos, por
 * isso um único tom é o correto (ver skill de dataviz, "escolher a
 * forma"). Barras abaixo do limiar de risco mudam para a cor de estado
 * reservada, sempre com ícone + rótulo — nunca só a cor.
 */
const LIMIAR_RISCO = 60;

function corBarra(prontidao: number): string {
  if (prontidao < 40) return 'bg-fiori-error';
  if (prontidao < LIMIAR_RISCO) return 'bg-fiori-warning';
  return 'bg-fiori-primary';
}

export function ReadinessBarChart({ dados }: { dados: ReadinessBarDatum[] }) {
  const [hover, setHover] = useState<string | null>(null);

  if (dados.length === 0) {
    return <p className="text-sm text-fiori-text-secondary">Sem dados para mostrar.</p>;
  }

  return (
    <div className="space-y-3">
      {dados.map((d) => (
        <div
          key={d.grupo}
          className="relative"
          onMouseEnter={() => setHover(d.grupo)}
          onMouseLeave={() => setHover((v) => (v === d.grupo ? null : v))}
        >
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 font-medium text-fiori-text">
              {d.grupo}
              {d.emRisco > 0 && (
                <span className="flex items-center gap-0.5 text-xs text-fiori-warning">
                  <AlertTriangle size={11} /> {d.emRisco} em risco
                </span>
              )}
            </span>
            <span className="text-fiori-text-secondary">{d.prontidaoMedia}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-fiori-canvas">
            <div
              className={`h-full rounded-full transition-all ${corBarra(d.prontidaoMedia)}`}
              style={{ width: `${Math.max(2, d.prontidaoMedia)}%` }}
            />
          </div>
          {hover === d.grupo && (
            <div className="absolute -top-1 left-0 z-10 -translate-y-full rounded border border-fiori-border bg-fiori-surface px-2 py-1 text-xs text-fiori-text shadow-fiori">
              {d.totalColaboradores} colaborador{d.totalColaboradores === 1 ? '' : 'es'} · prontidão média {d.prontidaoMedia}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
