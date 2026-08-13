import {
  calcularGapCertificacao,
  calcularGapCompetencia,
  calcularGapLob,
  ordenarCertificacoes,
  ordenarFormacoes,
} from './gap-analysis.logic';
import {
  CertificacaoCandidata,
  CertificacaoColaboradorInput,
  FormacaoCandidata,
  PesosProntidao,
  RequisitoCertificacaoInput,
  RequisitoCompetenciaInput,
} from './gap-analysis.types';

const HOJE = new Date('2026-07-31');
const PESOS_PADRAO: PesosProntidao = { pesoCompetencias: 40, pesoCertificacoes: 40, pesoPontos: 20 };

function requisitoCompetencia(overrides: Partial<RequisitoCompetenciaInput> = {}): RequisitoCompetenciaInput {
  return {
    competenciaId: 1,
    competenciaNome: 'SuccessFactors Employee Central',
    obrigatorio: true,
    pontos: 20,
    nivelMinimo: 2,
    ...overrides,
  };
}

function requisitoCertificacao(overrides: Partial<RequisitoCertificacaoInput> = {}): RequisitoCertificacaoInput {
  return {
    certificacaoId: 'C_THR81',
    certificacaoNome: 'SAP SuccessFactors Employee Central Core and Position Management',
    obrigatorio: true,
    ...overrides,
  };
}

describe('calcularGapCompetencia', () => {
  it('cumpre quando o nível atual é exatamente o exigido', () => {
    const r = calcularGapCompetencia(requisitoCompetencia({ nivelMinimo: 2, pontos: 20 }), 2);
    expect(r.cumprido).toBe(true);
    expect(r.pontosObtidos).toBe(20);
  });

  it('cumpre quando o nível atual é superior ao exigido', () => {
    const r = calcularGapCompetencia(requisitoCompetencia({ nivelMinimo: 2 }), 5);
    expect(r.cumprido).toBe(true);
  });

  it('não cumpre e não dá crédito parcial quando o nível está abaixo do exigido', () => {
    const r = calcularGapCompetencia(requisitoCompetencia({ nivelMinimo: 3, pontos: 30 }), 2);
    expect(r.cumprido).toBe(false);
    expect(r.pontosObtidos).toBe(0); // não 20 nem qualquer fração de 30
  });

  it('trata competência nunca avaliada como nível 0 (Inexistente)', () => {
    const r = calcularGapCompetencia(requisitoCompetencia({ nivelMinimo: 1 }), 0);
    expect(r.cumprido).toBe(false);
    expect(r.nivelAtual).toBe(0);
  });
});

describe('calcularGapCertificacao', () => {
  it('não cumpre se o colaborador nunca teve a certificação', () => {
    const r = calcularGapCertificacao(requisitoCertificacao(), undefined, HOJE);
    expect(r.possui).toBe(false);
    expect(r.cumprido).toBe(false);
  });

  it('cumpre se a certificação não tem data de validade (não expira)', () => {
    const registo: CertificacaoColaboradorInput = { dataValidade: null, dataObtencao: new Date('2020-01-01') };
    const r = calcularGapCertificacao(requisitoCertificacao(), registo, HOJE);
    expect(r.possui).toBe(true);
    expect(r.cumprido).toBe(true);
  });

  it('cumpre se a validade é hoje ou no futuro', () => {
    const registo: CertificacaoColaboradorInput = { dataValidade: new Date('2026-08-01'), dataObtencao: null };
    const r = calcularGapCertificacao(requisitoCertificacao(), registo, HOJE);
    expect(r.cumprido).toBe(true);
  });

  it('NÃO cumpre se a certificação está expirada, mesmo possuindo-a', () => {
    const registo: CertificacaoColaboradorInput = { dataValidade: new Date('2026-01-01'), dataObtencao: null };
    const r = calcularGapCertificacao(requisitoCertificacao(), registo, HOJE);
    expect(r.possui).toBe(true);
    expect(r.valida).toBe(false);
    expect(r.cumprido).toBe(false);
  });
});

describe('calcularGapLob', () => {
  const lob = { id: 1, nome: 'Payroll', pontosMinimos: 50 };

  it('atinge a LOB quando os pontos chegam ao mínimo e não há obrigatórios em falta', () => {
    const requisitos = [
      requisitoCompetencia({ competenciaId: 1, pontos: 30, nivelMinimo: 2, obrigatorio: true }),
      requisitoCompetencia({ competenciaId: 2, pontos: 20, nivelMinimo: 1, obrigatorio: false }),
    ];
    const niveis = new Map([
      [1, 2],
      [2, 1],
    ]);
    const r = calcularGapLob(lob, requisitos, [], niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBe(50);
    expect(r.atingido).toBe(true);
    expect(r.obrigatoriosEmFalta).toBe(0);
    expect(r.prontidaoPercentual).toBe(100);
  });

  it('NÃO atinge a LOB se falta uma competência obrigatória, mesmo com pontos suficientes — e a prontidão fica abaixo de 100%', () => {
    // Um requisito não-obrigatório de 60 pontos cobre sozinho o mínimo de 50,
    // mas o obrigatório de nível 3 fica por cumprir.
    const requisitos = [
      requisitoCompetencia({ competenciaId: 1, pontos: 60, nivelMinimo: 1, obrigatorio: false }),
      requisitoCompetencia({ competenciaId: 2, pontos: 10, nivelMinimo: 3, obrigatorio: true }),
    ];
    const niveis = new Map([
      [1, 5],
      [2, 1], // abaixo do nível 3 exigido
    ]);
    const r = calcularGapLob(lob, requisitos, [], niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBe(60);
    expect(r.pontosObtidos).toBeGreaterThanOrEqual(lob.pontosMinimos);
    expect(r.obrigatoriosEmFalta).toBe(1);
    expect(r.atingido).toBe(false); // bloqueado apesar dos pontos
    // 40% competências (0/1 obrigatória cumprida) + 40% certificações (sem obrigatórias, vacuamente 1) + 20% pontos (100%)
    expect(r.prontidaoPercentual).toBe(60);
    expect(r.prontidaoPercentual).toBeLessThan(100); // a inconsistência do bug antigo (100% sem estar atingida) já não acontece
  });

  it('NÃO atinge a LOB se falta uma certificação obrigatória, mesmo com todas as competências cumpridas — e a prontidão fica abaixo de 100%', () => {
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 60, nivelMinimo: 1, obrigatorio: true })];
    const niveis = new Map([[1, 5]]);
    const requisitosCert = [requisitoCertificacao({ obrigatorio: true })];
    const r = calcularGapLob(lob, requisitos, requisitosCert, niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBeGreaterThanOrEqual(lob.pontosMinimos);
    expect(r.competencias.every((c) => c.cumprido)).toBe(true);
    expect(r.obrigatoriosEmFalta).toBe(1);
    expect(r.atingido).toBe(false);
    // 40% competências (100%) + 40% certificações (0/1 obrigatória cumprida) + 20% pontos (100%)
    expect(r.prontidaoPercentual).toBe(60);
  });

  it('NÃO atinge a LOB se a certificação obrigatória está expirada', () => {
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 60, nivelMinimo: 1, obrigatorio: true })];
    const niveis = new Map([[1, 5]]);
    const requisitosCert = [requisitoCertificacao({ certificacaoId: 'C_X', obrigatorio: true })];
    const certs = new Map([['C_X', { dataValidade: new Date('2020-01-01'), dataObtencao: null }]]);
    const r = calcularGapLob(lob, requisitos, requisitosCert, niveis, certs, PESOS_PADRAO, HOJE);
    expect(r.atingido).toBe(false);
    expect(r.certificacoes[0].cumprido).toBe(false);
    expect(r.prontidaoPercentual).toBeLessThan(100);
  });

  it('não atinge a LOB se os pontos ficam abaixo do mínimo, mesmo sem obrigatórios em falta', () => {
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 10, nivelMinimo: 1, obrigatorio: false })];
    const niveis = new Map([[1, 1]]);
    const r = calcularGapLob(lob, requisitos, [], niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBe(10);
    expect(r.obrigatoriosEmFalta).toBe(0);
    expect(r.atingido).toBe(false);
    // Sem nenhuma competência/certificação obrigatória nesta LOB, esses dois critérios
    // contam como cumpridos por vacuidade (40%+40%); só os 20% de pontos refletem o
    // progresso real (10/50 = 20% desse critério, ou seja 20%×20%=4 pontos percentuais).
    expect(r.prontidaoPercentual).toBe(84);
    expect(r.prontidaoPercentual).toBeLessThan(100);
  });

  it('capa a prontidão em 100% mesmo que os pontos obtidos excedam o mínimo', () => {
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 200, nivelMinimo: 1, obrigatorio: false })];
    const niveis = new Map([[1, 1]]);
    const r = calcularGapLob(lob, requisitos, [], niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBe(200);
    expect(r.prontidaoPercentual).toBe(100);
  });

  it('CORRIGE o bug: pontosMinimos=0 já não dá 100% de prontidão se houver um obrigatório em falta', () => {
    const lobSemMinimo = { id: 2, nome: 'LOB vazia', pontosMinimos: 0 };
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 0, nivelMinimo: 3, obrigatorio: true })];
    const niveis = new Map<number, number>();
    const r = calcularGapLob(lobSemMinimo, requisitos, [], niveis, new Map(), PESOS_PADRAO, HOJE);
    expect(r.atingido).toBe(false); // obrigatório de competência ainda em falta
    // 40% competências (0/1 obrigatória cumprida) + 40% certificações (vacuamente 1) + 20% pontos (pontosMinimos=0 → vacuamente 1)
    expect(r.prontidaoPercentual).toBe(60);
    expect(r.prontidaoPercentual).toBeLessThan(100); // já não diverge de `atingido` como antes
  });

  it('funciona com listas de requisitos vazias (LOB sem requisitos definidos)', () => {
    const r = calcularGapLob({ id: 3, nome: 'LOB nova', pontosMinimos: 0 }, [], [], new Map(), new Map(), PESOS_PADRAO, HOJE);
    expect(r.pontosObtidos).toBe(0);
    expect(r.obrigatoriosEmFalta).toBe(0);
    expect(r.atingido).toBe(true);
    expect(r.prontidaoPercentual).toBe(100); // atingido ⟺ prontidão 100%
    expect(r.competencias).toHaveLength(0);
    expect(r.certificacoes).toHaveLength(0);
  });

  it('prontidaoPercentual === 100 sempre que atingido === true, e nunca ao contrário (a garantia central da fórmula ponderada)', () => {
    const requisitos = [
      requisitoCompetencia({ competenciaId: 1, pontos: 30, nivelMinimo: 2, obrigatorio: true }),
      requisitoCompetencia({ competenciaId: 2, pontos: 20, nivelMinimo: 1, obrigatorio: false }),
    ];
    const requisitosCert = [requisitoCertificacao({ obrigatorio: true })];
    const certsCumprida = new Map([['C_THR81', { dataValidade: null, dataObtencao: new Date('2020-01-01') }]]);

    const completo = calcularGapLob(
      lob,
      requisitos,
      requisitosCert,
      new Map([
        [1, 2],
        [2, 1],
      ]),
      certsCumprida,
      PESOS_PADRAO,
      HOJE,
    );
    expect(completo.atingido).toBe(true);
    expect(completo.prontidaoPercentual).toBe(100);

    const semCertificacao = calcularGapLob(
      lob,
      requisitos,
      requisitosCert,
      new Map([
        [1, 2],
        [2, 1],
      ]),
      new Map(), // certificação obrigatória em falta
      PESOS_PADRAO,
      HOJE,
    );
    expect(semCertificacao.atingido).toBe(false);
    expect(semCertificacao.prontidaoPercentual).toBeLessThan(100);
  });

  it('respeita pesos diferentes de 40/40/20 (configuração global editável)', () => {
    // Só o critério de pontos por cumprir (60%); competências e certificações
    // obrigatórias 100% cumpridas — com pesos 10/10/80, o resultado deve
    // refletir sobretudo o critério de pontos, não os 40/40/20 por omissão.
    const requisitos = [requisitoCompetencia({ competenciaId: 1, pontos: 30, nivelMinimo: 1, obrigatorio: true })];
    const niveis = new Map([[1, 1]]);
    const pesosPontosDominantes: PesosProntidao = { pesoCompetencias: 10, pesoCertificacoes: 10, pesoPontos: 80 };
    const r = calcularGapLob(lob, requisitos, [], niveis, new Map(), pesosPontosDominantes, HOJE);
    // ratioCompetencias=1 (obrigatória cumprida), ratioCertificacoes=1 (vacuidade), ratioPontos=30/50=0.6
    // 10%×1 + 10%×1 + 80%×0.6 = 10+10+48 = 68
    expect(r.prontidaoPercentual).toBe(68);
  });
});

describe('ordenarFormacoes', () => {
  function formacao(overrides: Partial<FormacaoCandidata> = {}): FormacaoCandidata {
    return { formacaoId: 1, formacaoNome: 'Formação', nivelOferecido: 2, duracaoHoras: 10, ...overrides };
  }

  it('filtra formações que não representam progresso face ao nível atual', () => {
    const candidatos = [formacao({ formacaoId: 1, nivelOferecido: 1 }), formacao({ formacaoId: 2, nivelOferecido: 3 })];
    const r = ordenarFormacoes(candidatos, /* nivelAtual */ 2, /* nivelNecessario */ 3);
    expect(r.map((f) => f.formacaoId)).toEqual([2]);
  });

  it('põe sempre as formações que cobrem a lacuna antes das que não cobrem', () => {
    const candidatos = [
      formacao({ formacaoId: 1, nivelOferecido: 2 }), // não cobre (necessário=3)
      formacao({ formacaoId: 2, nivelOferecido: 4 }), // cobre
    ];
    const r = ordenarFormacoes(candidatos, 0, 3);
    expect(r.map((f) => f.formacaoId)).toEqual([2, 1]);
  });

  it('entre as que cobrem, prefere a mais próxima do nível necessário (não sobre-qualificar)', () => {
    const candidatos = [
      formacao({ formacaoId: 1, nivelOferecido: 5 }),
      formacao({ formacaoId: 2, nivelOferecido: 3 }), // exatamente o necessário
      formacao({ formacaoId: 3, nivelOferecido: 4 }),
    ];
    const r = ordenarFormacoes(candidatos, 0, 3);
    expect(r.map((f) => f.formacaoId)).toEqual([2, 3, 1]);
  });

  it('entre as que não cobrem, prefere a de maior progresso', () => {
    const candidatos = [
      formacao({ formacaoId: 1, nivelOferecido: 1 }),
      formacao({ formacaoId: 2, nivelOferecido: 2 }),
    ];
    const r = ordenarFormacoes(candidatos, 0, 5); // nenhuma cobre nível 5
    expect(r.map((f) => f.formacaoId)).toEqual([2, 1]);
  });

  it('desempata por duração mais curta dentro do mesmo nível oferecido', () => {
    const candidatos = [
      formacao({ formacaoId: 1, nivelOferecido: 3, duracaoHoras: 40 }),
      formacao({ formacaoId: 2, nivelOferecido: 3, duracaoHoras: 8 }),
    ];
    const r = ordenarFormacoes(candidatos, 0, 3);
    expect(r.map((f) => f.formacaoId)).toEqual([2, 1]);
  });

  it('formações com duração desconhecida ficam depois das que têm duração conhecida, no mesmo nível', () => {
    const candidatos = [
      formacao({ formacaoId: 1, nivelOferecido: 3, duracaoHoras: null }),
      formacao({ formacaoId: 2, nivelOferecido: 3, duracaoHoras: 8 }),
    ];
    const r = ordenarFormacoes(candidatos, 0, 3);
    expect(r.map((f) => f.formacaoId)).toEqual([2, 1]);
  });
});

describe('ordenarCertificacoes', () => {
  function certificacao(overrides: Partial<CertificacaoCandidata> = {}): CertificacaoCandidata {
    return { certificacaoId: 'C_1', certificacaoNome: 'B', nivelOferecido: 2, jaPossui: false, ...overrides };
  }

  it('segue a mesma regra de cobertura-antes-de-progresso-parcial que as formações', () => {
    const candidatos = [
      certificacao({ certificacaoId: 'C_1', nivelOferecido: 2 }),
      certificacao({ certificacaoId: 'C_2', nivelOferecido: 4 }),
    ];
    const r = ordenarCertificacoes(candidatos, 0, 3);
    expect(r.map((c) => c.certificacaoId)).toEqual(['C_2', 'C_1']);
  });

  it('desempata por nome (sem conceito de duração para certificações)', () => {
    const candidatos = [
      certificacao({ certificacaoId: 'C_1', certificacaoNome: 'Zeta', nivelOferecido: 3 }),
      certificacao({ certificacaoId: 'C_2', certificacaoNome: 'Alfa', nivelOferecido: 3 }),
    ];
    const r = ordenarCertificacoes(candidatos, 0, 3);
    expect(r.map((c) => c.certificacaoNome)).toEqual(['Alfa', 'Zeta']);
  });
});
