export interface ObjetivoLob {
  lobId: number;
  lobNome: string;
  areaId: number;
  areaNome: string;
  /** Prontidão atual (0-100) do colaborador nesta LOB — a mesma métrica usada em toda a app, nunca recalculada de forma diferente aqui. */
  prontidaoPercentual: number;
}

export interface ObjetivosLobResponse {
  /** Até 3 LOBs da área do colaborador, ainda não atingidas, pela maior prontidão — sempre calculado ao vivo, nunca persistido. */
  auto: ObjetivoLob[];
  /** Recomendadas manualmente pelo BUD (gestor direto) ou ADMIN_RH — persistidas em ColaboradorLobRecomendacao.bud. */
  bud: ObjetivoLob[];
}
