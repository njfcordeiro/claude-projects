const NIVEL_NOMES = ['Inexistente', 'Familiarizado', 'Principiante', 'Proficiente', 'Especialista', 'Referência'];

/** "1 → 3" com cor indicando se o nível atual já cobre o exigido. */
export function NivelPill({ atual, exigido }: { atual: number; exigido: number }) {
  const cumpre = atual >= exigido;
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className={cumpre ? 'text-fiori-success' : 'text-fiori-error'} title={NIVEL_NOMES[atual]}>
        {atual}
      </span>
      <span className="text-fiori-text-secondary">→</span>
      <span className="text-fiori-text-secondary" title={NIVEL_NOMES[exigido]}>
        {exigido}
      </span>
    </span>
  );
}
