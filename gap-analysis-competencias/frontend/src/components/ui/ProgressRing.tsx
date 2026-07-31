/**
 * Anel de prontidão. A cor reforça o estado (bom/aviso/crítico) mas o
 * valor em texto vai sempre dentro do anel — nunca só a cor a comunicar
 * o número (ver skill de dataviz).
 */
function corPorPercentual(percentual: number): { stroke: string; text: string } {
  if (percentual >= 70) return { stroke: '#107E3E', text: 'text-fiori-success' }; // success
  if (percentual >= 40) return { stroke: '#E76500', text: 'text-fiori-warning' }; // warning
  return { stroke: '#BB0000', text: 'text-fiori-error' }; // error
}

export function ProgressRing({ percentual, size = 88, label }: { percentual: number; size?: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, percentual));
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const { stroke, text } = corPorPercentual(clamped);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${clamped}% de prontidão`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#EAECEE" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className={`text-lg font-semibold ${text}`} fill="currentColor">
          {clamped}%
        </text>
      </svg>
      {label && <span className="text-xs text-fiori-text-secondary">{label}</span>}
    </div>
  );
}
