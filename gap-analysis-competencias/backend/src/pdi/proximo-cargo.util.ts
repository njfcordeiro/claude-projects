/**
 * Lógica pura de escolha do "Próximo Cargo" automático entre vários
 * candidatos de CargoProgressao (ver comentário completo em
 * ProximoCargoService) — extraída para aqui, sem nenhuma dependência de
 * NestJS DI, para poder ser reutilizada em ColaboradoresService (round-trip
 * de Excel) sem criar um ciclo de módulos (ColaboradoresModule ->
 * PdiModule -> ColaboradoresModule).
 */
export interface CargoComCategoriaOrdem {
  id: string;
  nome: string;
  categoria: { nome: string; ordem: number | null };
}

export function escolherMelhorProximoCargo(candidatos: CargoComCategoriaOrdem[]): { cargoId: string; cargoNome: string } | null {
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return { cargoId: candidatos[0].id, cargoNome: candidatos[0].nome };

  const principal = candidatos.find((c) => c.categoria.nome.toLowerCase().includes('principal'));
  if (principal) return { cargoId: principal.id, cargoNome: principal.nome };

  const comOrdem = candidatos.filter((c) => c.categoria.ordem !== null);
  if (comOrdem.length > 0) {
    const melhor = comOrdem.reduce((m, c) => (c.categoria.ordem! < m.categoria.ordem! ? c : m));
    return { cargoId: melhor.id, cargoNome: melhor.nome };
  }

  const porNome = [...candidatos].sort((a, b) => a.nome.localeCompare(b.nome))[0];
  return { cargoId: porNome.id, cargoNome: porNome.nome };
}
