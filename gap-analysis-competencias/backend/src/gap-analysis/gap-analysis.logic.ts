/**
 * Motor de comparação — funções puras, sem Prisma/NestJS, implementando a
 * fórmula de docs/01-modelo-dados.md secção 2:
 *
 *   pontos_obtidos(colaborador, lob) = Σ pontos das competências cumpridas
 *     (nível abaixo do mínimo → 0 pontos, sem crédito parcial)
 *   LOB atingida ⇔ pontos_obtidos >= pontos_minimos
 *                 E todas as competências obrigatórias cumpridas
 *                 E todas as certificações obrigatórias na posse do
 *                   colaborador e dentro da validade
 *
 * Mantido sem dependências externas de propósito — é a parte do sistema
 * com mais regras de negócio, por isso é a mais valiosa a testar
 * exaustivamente sem precisar de uma base de dados (ver
 * gap-analysis.logic.spec.ts).
 */
import {
  CertificacaoCandidata,
  CertificacaoColaboradorInput,
  FormacaoCandidata,
  GapCertificacao,
  GapCompetencia,
  RequisitoCertificacaoInput,
  RequisitoCompetenciaInput,
  ResultadoGapLob,
} from './gap-analysis.types';

export function calcularGapCompetencia(
  requisito: RequisitoCompetenciaInput,
  nivelAtual: number,
): GapCompetencia {
  const cumprido = nivelAtual >= requisito.nivelMinimo;
  return {
    competenciaId: requisito.competenciaId,
    competenciaNome: requisito.competenciaNome,
    obrigatorio: requisito.obrigatorio,
    nivelExigido: requisito.nivelMinimo,
    nivelAtual,
    pontosPossiveis: requisito.pontos,
    pontosObtidos: cumprido ? requisito.pontos : 0, // sem crédito parcial
    cumprido,
  };
}

export function calcularGapCertificacao(
  requisito: RequisitoCertificacaoInput,
  registo: CertificacaoColaboradorInput | undefined,
  hoje: Date,
): GapCertificacao {
  const possui = registo !== undefined;
  const valida = possui && (registo!.dataValidade === null || registo!.dataValidade >= hoje);
  return {
    certificacaoId: requisito.certificacaoId,
    certificacaoNome: requisito.certificacaoNome,
    obrigatorio: requisito.obrigatorio,
    possui,
    valida,
    dataValidade: registo?.dataValidade ?? null,
    cumprido: valida,
  };
}

export function calcularGapLob(
  lob: { id: number; nome: string; pontosMinimos: number },
  requisitosCompetencia: RequisitoCompetenciaInput[],
  requisitosCertificacao: RequisitoCertificacaoInput[],
  niveisAtuais: Map<number, number>, // competenciaId -> nivel
  certificacoesColaborador: Map<string, CertificacaoColaboradorInput>,
  hoje: Date = new Date(),
): ResultadoGapLob {
  const competencias = requisitosCompetencia.map((r) =>
    calcularGapCompetencia(r, niveisAtuais.get(r.competenciaId) ?? 0),
  );
  const certificacoes = requisitosCertificacao.map((r) =>
    calcularGapCertificacao(r, certificacoesColaborador.get(r.certificacaoId), hoje),
  );

  const pontosObtidos = competencias.reduce((soma, c) => soma + c.pontosObtidos, 0);
  const obrigatoriosEmFalta =
    competencias.filter((c) => c.obrigatorio && !c.cumprido).length +
    certificacoes.filter((c) => c.obrigatorio && !c.cumprido).length;

  const atingido = pontosObtidos >= lob.pontosMinimos && obrigatoriosEmFalta === 0;
  const prontidaoPercentual =
    lob.pontosMinimos > 0 ? Math.min(100, Math.round((pontosObtidos / lob.pontosMinimos) * 100)) : 100;

  return {
    lobId: lob.id,
    lobNome: lob.nome,
    pontosObtidos,
    pontosMinimos: lob.pontosMinimos,
    prontidaoPercentual,
    atingido,
    obrigatoriosEmFalta,
    competencias,
    certificacoes,
  };
}

/**
 * Ordenação partilhada por candidatos de formação/certificação a sugerir
 * para uma lacuna de competência:
 *   1. Candidatos que cobrem a lacuna (nível oferecido >= necessário) vêm
 *      sempre antes dos que não cobrem.
 *   2. Entre os que cobrem: o mais próximo do necessário primeiro (não
 *      sugerir uma formação de nível 5 para fechar uma lacuna de nível 2
 *      se houver uma de nível 2 disponível).
 *   3. Entre os que não cobrem: o de nível mais alto primeiro (maior
 *      progresso).
 *   4. Desempate (ex.: duração) só decide dentro do mesmo grupo/nível.
 */
function compararCandidatos<T extends { nivelOferecido: number }>(
  a: T,
  b: T,
  nivelNecessario: number,
  desempate: (a: T, b: T) => number,
): number {
  const aCobre = a.nivelOferecido >= nivelNecessario;
  const bCobre = b.nivelOferecido >= nivelNecessario;

  if (aCobre !== bCobre) return aCobre ? -1 : 1;
  if (a.nivelOferecido !== b.nivelOferecido) {
    return aCobre ? a.nivelOferecido - b.nivelOferecido : b.nivelOferecido - a.nivelOferecido;
  }
  return desempate(a, b);
}

/** Só faz sentido sugerir algo que representa progresso face ao nível atual do colaborador. */
function representaProgresso<T extends { nivelOferecido: number }>(candidatos: T[], nivelAtual: number): T[] {
  return candidatos.filter((c) => c.nivelOferecido > nivelAtual);
}

export function ordenarFormacoes(
  candidatos: FormacaoCandidata[],
  nivelAtual: number,
  nivelNecessario: number,
): FormacaoCandidata[] {
  return representaProgresso(candidatos, nivelAtual).sort((a, b) =>
    compararCandidatos(a, b, nivelNecessario, (x, y) => {
      if (x.duracaoHoras === null && y.duracaoHoras === null) return 0;
      if (x.duracaoHoras === null) return 1; // duração desconhecida fica no fim
      if (y.duracaoHoras === null) return -1;
      return x.duracaoHoras - y.duracaoHoras; // mais curta primeiro
    }),
  );
}

export function ordenarCertificacoes(
  candidatos: CertificacaoCandidata[],
  nivelAtual: number,
  nivelNecessario: number,
): CertificacaoCandidata[] {
  return representaProgresso(candidatos, nivelAtual).sort((a, b) =>
    compararCandidatos(a, b, nivelNecessario, (x, y) => x.certificacaoNome.localeCompare(y.certificacaoNome)),
  );
}
