export interface ProximoCargoCandidato {
  cargoId: string;
  cargoNome: string;
}

export interface ProximoCargoResponse {
  /** Derivado ao vivo de CargoProgressao a partir do cargo atual — null se o colaborador não tem cargo, ou o cargo atual não tem progressão definida. */
  auto: ProximoCargoCandidato | null;
  /** Override manual (ColaboradorProximoCargo) — null se nunca foi definido. Uma vez definido, nunca é substituído automaticamente. */
  manual: ProximoCargoCandidato | null;
  /** manual ?? auto — o valor a mostrar/usar em qualquer ecrã ("Próximo Cargo" na ficha, geração de PDI em massa, nova tabela de PDI). */
  resolvido: (ProximoCargoCandidato & { origem: 'MANUAL' | 'AUTO' }) | null;
}
