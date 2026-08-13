import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigemAvaliacao, PapelUtilizador, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AutoCriacaoService } from '../catalogo/auto-criacao.service';
import { adicionarFolhasDeOpcoes, formulaNomeAtual, nomeFolhaDeOpcoes, numParaColunaExcel } from '../catalogo/excel-referencias.util';
import { encontrarTabela } from '../catalogo/catalogo.registry';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';
import { UpsertCertificacaoDto } from './dto/upsert-certificacao.dto';

const SELECT_RESUMO = {
  id: true,
  nome: true,
  cargoId: true,
  direcaoId: true,
  nucleoId: true,
  areaId: true,
  carreiraId: true,
  categoriaId: true,
  managerId: true,
  proximaLobId: true,
  nivelGestaoId: true,
  localTrabalhoId: true,
  dataAdmissao: true,
  ativo: true,
  version: true,
  cargo: { select: { nome: true } },
  direcao: { select: { nome: true, relevante: true } },
  area: { select: { nome: true, relevante: true } },
  nucleo: { select: { nome: true, relevante: true } },
  gestor: { select: { nome: true } },
  proximaLob: { select: { nome: true } },
  nivelGestao: { select: { nome: true } },
  localTrabalho: { select: { nome: true } },
  // Só interessa a contagem de subordinados ainda ativos — pedido do
  // utilizador: alertar quando um colaborador inativo continua definido
  // como gestor de gente ativa (ver aviso na ficha do colaborador).
  _count: { select: { subordinados: { where: { ativo: true } } } },
} satisfies Prisma.ColaboradorSelect;

type ColaboradorComRelacoes = Prisma.ColaboradorGetPayload<{ select: typeof SELECT_RESUMO }>;

/** Achata as relações (nome + relevância de Direção/Área/Núcleo, nome do gestor) para um DTO simples — nunca devolvemos a forma aninhada do Prisma ao cliente. */
function mapearResumo(c: ColaboradorComRelacoes) {
  return {
    id: c.id,
    nome: c.nome,
    cargoId: c.cargoId,
    cargoNome: c.cargo?.nome ?? null,
    direcaoId: c.direcaoId,
    direcaoNome: c.direcao?.nome ?? null,
    direcaoRelevante: c.direcao?.relevante ?? false,
    areaId: c.areaId,
    areaNome: c.area?.nome ?? null,
    areaRelevante: c.area?.relevante ?? false,
    nucleoId: c.nucleoId,
    nucleoNome: c.nucleo?.nome ?? null,
    nucleoRelevante: c.nucleo?.relevante ?? false,
    carreiraId: c.carreiraId,
    categoriaId: c.categoriaId,
    managerId: c.managerId,
    managerNome: c.gestor?.nome ?? null,
    proximaLobId: c.proximaLobId,
    proximaLobNome: c.proximaLob?.nome ?? null,
    nivelGestaoId: c.nivelGestaoId,
    nivelGestaoNome: c.nivelGestao?.nome ?? null,
    localTrabalhoId: c.localTrabalhoId,
    localTrabalhoNome: c.localTrabalho?.nome ?? null,
    dataAdmissao: c.dataAdmissao ? c.dataAdmissao.toISOString().slice(0, 10) : null,
    ativo: c.ativo,
    subordinadosAtivos: c._count.subordinados,
    version: c.version,
  };
}

/** Colunas do round-trip de Excel — ver `exportar`/`importar` mais abaixo. */
const COLUNAS_IMPORT_EXPORT = [
  'id',
  'nome',
  'cargoId',
  'direcaoId',
  'nucleoId',
  'areaId',
  'carreiraId',
  'categoriaId',
  'managerId',
  'nivelGestaoId',
  'localTrabalhoId',
  'ativo',
  'eBum',
  'dataAdmissao',
] as const;

export interface ResumoImportacaoColaboradores {
  criados: number;
  atualizados: number;
  erros: string[];
}

/** Linha da view colaborador_competencia_atual (docs/01-modelo-dados.md secção 5.1). */
interface UltimaAvaliacaoRow {
  id: number;
  nivel_id: number;
  data_avaliacao: Date;
  origem: OrigemAvaliacao;
}

@Injectable()
export class ColaboradoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autoCriacao: AutoCriacaoService,
  ) {}

  /** Lista completa — só ADMIN_RH/VIEWER chegam aqui (bloqueado pelo RolesGuard no controller). */
  async listar(skip = 0, take = 1000) {
    const linhas = await this.prisma.colaborador.findMany({ select: SELECT_RESUMO, skip, take, orderBy: { nome: 'asc' } });
    return linhas.map(mapearResumo);
  }

  /** Cria um colaborador novo — `id` é fornecido pelo cliente (replica o "ID Colaborador" do Excel, não é autoincrement). */
  async criar(dto: CreateColaboradorDto, autor: AuthenticatedUser) {
    const { dataAdmissao, ...resto } = dto;
    try {
      const criado = await this.prisma.runAsUser(autor.sub, (tx) =>
        tx.colaborador.create({
          data: { ...resto, ...(dataAdmissao ? { dataAdmissao: new Date(dataAdmissao) } : {}) },
          select: SELECT_RESUMO,
        }),
      );
      return mapearResumo(criado);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Já existe um colaborador com o id ${dto.id}.`);
      }
      throw err;
    }
  }

  /**
   * Elimina um colaborador — pedido do utilizador: tem de ser sempre
   * possível, independentemente de estar associado a outros dados. O
   * schema reflete isto no `onDelete` de cada FK que aponta para
   * Colaborador (ver comentários em schema.prisma): registos que lhe
   * pertencem (avaliações, certificações, PDI, recomendações, snapshots)
   * são apagados em cascata; referências vindas de outro lado (é gestor de
   * alguém, tem uma conta de utilizador) ficam simplesmente a null. O catch
   * de P2003 fica como rede de segurança, não deve disparar na prática.
   */
  async eliminar(id: number, autor: AuthenticatedUser) {
    try {
      await this.prisma.runAsUser(autor.sub, (tx) => tx.colaborador.delete({ where: { id } }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException(`Colaborador ${id} não encontrado.`);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException(`Não foi possível eliminar este colaborador devido a dados associados não previstos.`);
      }
      throw err;
    }
  }

  /** Exporta todos os colaboradores para .xlsx — ver round-trip de import abaixo. */
  /**
   * Ver comentário equivalente em `CatalogoService.exportar`: as colunas de
   * `COLUNAS_IMPORT_EXPORT` ficam inalteradas para o round-trip (download
   * = ficheiro de upload); as colunas "— nome atual" são só contexto e são
   * ignoradas por `importar` (não batem com nenhuma chave conhecida). As
   * sheets de referência trazem as opções válidas de cada relação.
   */
  /**
   * As colunas "— nome atual" usam fórmula VLOOKUP (não um valor estático)
   * contra a sheet "Opções — X" da tabela relacionada — pedido do
   * utilizador: mudar o id na coluna ao lado atualiza sozinho o texto, sem
   * reexportar. `managerId` é a única relação auto-referencial (Colaborador
   * → Colaborador), por isso não está no `CATALOGO_REGISTRY` — a sua sheet
   * de referência ("Opções — Colaboradores") é construída aqui a partir da
   * própria lista exportada, que já é o universo completo de colaboradores.
   */
  async exportar(): Promise<Buffer> {
    const linhas = await this.prisma.colaborador.findMany({
      select: {
        id: true,
        nome: true,
        cargoId: true,
        direcaoId: true,
        nucleoId: true,
        areaId: true,
        carreiraId: true,
        categoriaId: true,
        managerId: true,
        nivelGestaoId: true,
        localTrabalhoId: true,
        ativo: true,
        eBum: true,
        dataAdmissao: true,
      },
      orderBy: { id: 'asc' },
    });

    const FOLHA_COLABORADORES = nomeFolhaDeOpcoes('Colaboradores');
    const TABELA_RELACAO: Partial<Record<(typeof COLUNAS_IMPORT_EXPORT)[number], string>> = {
      cargoId: 'cargos',
      direcaoId: 'direcoes',
      nucleoId: 'nucleos',
      areaId: 'areas',
      carreiraId: 'carreiras',
      categoriaId: 'categorias',
      nivelGestaoId: 'niveis-gestao',
      localTrabalhoId: 'locais-trabalho',
    };
    const LABEL_CAMPO: Partial<Record<(typeof COLUNAS_IMPORT_EXPORT)[number], string>> = {
      cargoId: 'Cargo',
      direcaoId: 'Direção',
      nucleoId: 'Núcleo',
      areaId: 'Área',
      carreiraId: 'Carreira',
      categoriaId: 'Categoria',
      managerId: 'Gestor',
      nivelGestaoId: 'Nível de Gestão',
      localTrabalhoId: 'Local de Trabalho',
    };

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('colaboradores');

    const cabecalhos: string[] = [];
    const colunaPorCampo = new Map<string, string>();
    let indiceColuna = 0;
    for (const chave of COLUNAS_IMPORT_EXPORT) {
      indiceColuna++;
      cabecalhos.push(chave);
      colunaPorCampo.set(chave, numParaColunaExcel(indiceColuna));
      if (TABELA_RELACAO[chave] || chave === 'managerId') {
        indiceColuna++;
        cabecalhos.push(`${LABEL_CAMPO[chave]} — nome atual`);
      }
    }
    sheet.addRow(cabecalhos);

    let linhaExcel = 2;
    for (const l of linhas) {
      const valores: unknown[] = [];
      for (const chave of COLUNAS_IMPORT_EXPORT) {
        const valor = chave === 'dataAdmissao' ? (l.dataAdmissao ? l.dataAdmissao.toISOString().slice(0, 10) : null) : (l as any)[chave];
        valores.push(valor ?? null);

        const tabelaRelacionada = TABELA_RELACAO[chave];
        const celula = `${colunaPorCampo.get(chave)}${linhaExcel}`;
        if (tabelaRelacionada) {
          valores.push(formulaNomeAtual(celula, nomeFolhaDeOpcoes(encontrarTabela(tabelaRelacionada).label)));
        } else if (chave === 'managerId') {
          valores.push(formulaNomeAtual(celula, FOLHA_COLABORADORES));
        }
      }
      sheet.addRow(valores);
      linhaExcel++;
    }

    await adicionarFolhasDeOpcoes(workbook, this.prisma, [
      'cargos',
      'direcoes',
      'nucleos',
      'areas',
      'carreiras',
      'categorias',
      'niveis-gestao',
      'locais-trabalho',
    ]);

    const folhaColaboradores = workbook.addWorksheet(FOLHA_COLABORADORES);
    folhaColaboradores.addRow(['id', 'nome']);
    for (const l of [...linhas].sort((a, b) => a.nome.localeCompare(b.nome))) folhaColaboradores.addRow([l.id, l.nome]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * Round-trip de Excel para Colaboradores: atualiza por `id` (cria se não
   * existir). Todos os campos de relação (Direção/Área/Núcleo/Carreira/
   * Categoria/Nível de Gestão/Local de Trabalho/Cargo/Gestor) têm de já
   * existir — por id OU por nome — tal como `cargoId`/`managerId`; nada é
   * criado automaticamente. Validação em duas fases: primeiro resolve todas
   * as linhas do ficheiro sem escrever nada; se qualquer linha tiver uma
   * referência em falta, o ficheiro inteiro é rejeitado (nenhuma linha é
   * importada, nem as válidas) e `erros` lista todas as linhas problemáticas
   * de uma vez. Só se todas as linhas forem válidas é que a escrita
   * acontece, numa única transação.
   */
  async importar(buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacaoColaboradores> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('Ficheiro sem folhas.');

    const cabecalho = (sheet.getRow(1).values as unknown[]).map((v) => (v == null ? null : String(v).trim()));
    const indicePorCampo = new Map<string, number>();
    for (const chave of COLUNAS_IMPORT_EXPORT) {
      const idx = cabecalho.findIndex((h) => h === chave);
      if (idx !== -1) indicePorCampo.set(chave, idx);
    }

    const resumo: ResumoImportacaoColaboradores = { criados: 0, atualizados: 0, erros: [] };

    // Fase 1 — validação (só leitura): resolve todas as linhas contra a BD
    // sem escrever nada.
    const linhasValidas: { data: Record<string, unknown> }[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;

      try {
        const bruto: Record<string, unknown> = {};
        for (const chave of COLUNAS_IMPORT_EXPORT) {
          const idx = indicePorCampo.get(chave);
          if (idx === undefined) continue;
          const celula = linha.getCell(idx).value;
          bruto[chave] = celula && typeof celula === 'object' && 'result' in celula ? (celula as any).result : celula;
        }
        if (Object.values(bruto).every((v) => v === null || v === undefined || v === '')) continue;

        const data = await this.mapearLinhaImport(bruto);
        linhasValidas.push({ data });
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido.';
        resumo.erros.push(`Linha ${r}: ${mensagem}`);
      }
    }

    if (resumo.erros.length > 0) {
      return resumo;
    }

    // Fase 2 — escrita: tudo numa única transação, atómica ao ficheiro inteiro.
    await this.prisma.runAsUser(user.sub, async (tx) => {
      for (const { data } of linhasValidas) {
        const existe = await tx.colaborador.findUnique({ where: { id: data.id as number } });
        if (existe) {
          await tx.colaborador.update({ where: { id: data.id as number }, data: { ...data, id: undefined } });
          resumo.atualizados++;
        } else {
          await tx.colaborador.create({ data: data as Prisma.ColaboradorCreateInput });
          resumo.criados++;
        }
      }
    });

    return resumo;
  }

  private async mapearLinhaImport(bruto: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (bruto.id === undefined || bruto.id === null || bruto.id === '') {
      throw new Error('Campo obrigatório em falta: "id".');
    }
    if (bruto.nome === undefined || bruto.nome === null || bruto.nome === '') {
      throw new Error('Campo obrigatório em falta: "nome".');
    }

    const data: Record<string, unknown> = { id: Number(bruto.id), nome: String(bruto.nome).trim() };

    const relacoes: [string, string][] = [
      ['direcaoId', 'direcoes'],
      ['areaId', 'areas'],
      ['nucleoId', 'nucleos'],
      ['carreiraId', 'carreiras'],
      ['categoriaId', 'categorias'],
      ['nivelGestaoId', 'niveis-gestao'],
      ['localTrabalhoId', 'locais-trabalho'],
    ];
    for (const [campo, tabela] of relacoes) {
      const valor = bruto[campo];
      if (valor === undefined || valor === null || valor === '') continue;
      data[campo] = await this.autoCriacao.resolver(tabela, valor as string | number);
    }

    if (bruto.cargoId !== undefined && bruto.cargoId !== null && bruto.cargoId !== '') {
      data.cargoId = await this.resolverCargo(bruto.cargoId);
    }

    if (bruto.managerId !== undefined && bruto.managerId !== null && bruto.managerId !== '') {
      data.managerId = await this.resolverManager(bruto.managerId);
    }

    if (bruto.eBum !== undefined && bruto.eBum !== null && bruto.eBum !== '') {
      const texto = String(bruto.eBum).trim().toLowerCase();
      data.eBum = texto === 'true' || texto === '1' || texto === 'sim' || texto === 'x';
    }

    if (bruto.ativo !== undefined && bruto.ativo !== null && bruto.ativo !== '') {
      const texto = String(bruto.ativo).trim().toLowerCase();
      data.ativo = texto === 'true' || texto === '1' || texto === 'sim' || texto === 'x';
    }

    if (bruto.dataAdmissao !== undefined && bruto.dataAdmissao !== null && bruto.dataAdmissao !== '') {
      const data_ = bruto.dataAdmissao instanceof Date ? bruto.dataAdmissao : new Date(String(bruto.dataAdmissao));
      if (Number.isNaN(data_.getTime())) throw new Error(`Data de admissão inválida: "${bruto.dataAdmissao}".`);
      data.dataAdmissao = data_;
    }

    return data;
  }

  private async resolverCargo(valor: unknown): Promise<string> {
    const texto = String(valor).trim();
    const porId = await this.prisma.cargo.findUnique({ where: { id: texto } });
    if (porId) return porId.id;
    const porNome = await this.prisma.cargo.findFirst({ where: { nome: texto } });
    if (porNome) return porNome.id;
    throw new Error(`Cargo "${texto}" não encontrado — cria o cargo primeiro em Gestão de Dados (não é criado automaticamente).`);
  }

  private async resolverManager(valor: unknown): Promise<number> {
    const comoNumero = typeof valor === 'number' ? valor : /^-?\d+$/.test(String(valor).trim()) ? Number(valor) : null;
    if (comoNumero !== null) {
      const porId = await this.prisma.colaborador.findUnique({ where: { id: comoNumero } });
      if (porId) return porId.id;
    }
    const texto = String(valor).trim();
    const porNome = await this.prisma.colaborador.findFirst({ where: { nome: texto } });
    if (porNome) return porNome.id;
    throw new Error(`Gestor "${texto}" não encontrado — o gestor tem de já existir como colaborador.`);
  }

  async meuPerfil(user: AuthenticatedUser) {
    if (user.colaboradorId === null) {
      throw new NotFoundException('Esta conta não está associada a um colaborador.');
    }
    return this.obterComVerificacaoDeAcesso(user.colaboradorId, user);
  }

  /**
   * RBAC fino de LEITURA (docs/02-arquitetura-tecnica.md secção 4.3):
   * ADMIN_RH/VIEWER veem qualquer colaborador; MANAGER só a sua equipa
   * direta; EMPLOYEE só a si próprio.
   */
  async obterComVerificacaoDeAcesso(id: number, user: AuthenticatedUser) {
    const colaborador = await this.prisma.colaborador.findUnique({ where: { id }, select: SELECT_RESUMO });
    if (!colaborador) throw new NotFoundException(`Colaborador ${id} não encontrado.`);

    const podeVer =
      user.role === PapelUtilizador.ADMIN_RH ||
      user.role === PapelUtilizador.VIEWER ||
      (user.role === PapelUtilizador.MANAGER && colaborador.managerId === user.colaboradorId) ||
      (user.role === PapelUtilizador.EMPLOYEE && colaborador.id === user.colaboradorId);

    if (!podeVer) {
      throw new ForbiddenException('Sem acesso a este colaborador.');
    }
    return mapearResumo(colaborador);
  }

  /**
   * RBAC fino de ESCRITA (secção 4.5 do doc de arquitetura, Prompt 5):
   * ADMIN_RH edita qualquer colaborador; MANAGER só a sua equipa direta;
   * EMPLOYEE e VIEWER nunca escrevem — "Colaborador só vê os seus
   * próprios dados" é literal, não inclui autoavaliação nesta entrega.
   */
  /** Público de propósito — reutilizado pelo PdiService para o mesmo RBAC de escrita (ver docs/02-arquitetura-tecnica.md secção 4.5). */
  async podeEditar(id: number, user: AuthenticatedUser): Promise<void> {
    if (user.role === PapelUtilizador.ADMIN_RH) return;

    if (user.role === PapelUtilizador.MANAGER) {
      const colaborador = await this.prisma.colaborador.findUnique({ where: { id }, select: { managerId: true } });
      if (!colaborador) throw new NotFoundException(`Colaborador ${id} não encontrado.`);
      if (colaborador.managerId === user.colaboradorId) return;
    }

    throw new ForbiddenException('Sem permissão de escrita para este colaborador.');
  }

  /**
   * Locking otimista: o pedido tem de trazer a `version` que leu. Se já
   * não bater com a versão atual (outra escrita aconteceu entretanto),
   * devolve 409 com o estado atual em vez de sobrescrever silenciosamente.
   */
  async atualizar(id: number, dto: UpdateColaboradorDto, user: AuthenticatedUser) {
    await this.podeEditar(id, user);
    const { version, dataAdmissao, ...alteracoes } = dto;

    return this.prisma.runAsUser(user.sub, async (tx) => {
      const resultado = await tx.colaborador.updateMany({
        where: { id, version },
        data: { ...alteracoes, ...(dataAdmissao !== undefined ? { dataAdmissao: new Date(dataAdmissao) } : {}), version: { increment: 1 } },
      });

      if (resultado.count === 0) {
        await this.lancarConflitoColaborador(tx, id);
      }

      const atualizado = await tx.colaborador.findUniqueOrThrow({ where: { id }, select: SELECT_RESUMO });
      return mapearResumo(atualizado);
    });
  }

  private async lancarConflitoColaborador(tx: Prisma.TransactionClient, id: number): Promise<never> {
    const atual = await tx.colaborador.findUnique({ where: { id }, select: SELECT_RESUMO });
    if (!atual) throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    throw new ConflictException({
      message: 'Este colaborador foi alterado por outra pessoa entretanto. Revê os dados atuais e tenta novamente.',
      current: mapearResumo(atual),
    });
  }

  /**
   * Nova avaliação de competência (append-only — nunca UPDATE). Conflito
   * de concorrência detetado por `baseAssessmentId`: o id da última
   * avaliação que o cliente viu, comparado com a atual no momento da
   * escrita (dentro da mesma transação que faz o INSERT, para não deixar
   * uma janela de corrida entre o SELECT e o INSERT).
   */
  async criarAvaliacao(colaboradorId: number, dto: CreateAvaliacaoDto, user: AuthenticatedUser) {
    await this.podeEditar(colaboradorId, user);

    const origem: OrigemAvaliacao =
      user.role === PapelUtilizador.MANAGER ? OrigemAvaliacao.MANAGER : (dto.origem ?? OrigemAvaliacao.FORMAL);

    return this.prisma.runAsUser(user.sub, async (tx) => {
      // Sem lock explícito, um SELECT-depois-INSERT tem uma janela de
      // corrida real: duas transações concorrentes podem ambas ver "não
      // existe avaliação ainda" (READ COMMITTED) e ambas inserir — não há
      // nenhuma linha existente para um UPDATE...WHERE version=X bloquear
      // (ao contrário do upsertCertificacao). Um advisory lock
      // transacional serializa as tentativas para o mesmo (colaborador,
      // competência): a segunda espera a primeira committar, volta a ler,
      // e só então vê a avaliação nova — o conflito passa a ser detetado
      // corretamente em vez de as duas passarem. Libertado automaticamente
      // no fim da transação, sem unlock manual.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`avaliacao:${colaboradorId}:${dto.competenciaId}`}))`;

      const ultimas = await tx.$queryRaw<UltimaAvaliacaoRow[]>`
        SELECT id, nivel_id, data_avaliacao, origem
        FROM colaborador_competencia_atual
        WHERE colaborador_id = ${colaboradorId} AND competencia_id = ${dto.competenciaId}
      `;
      const atual = ultimas[0] ?? null;
      const baseId = dto.baseAssessmentId ?? null;

      if ((atual?.id ?? null) !== baseId) {
        throw new ConflictException({
          message: atual
            ? 'Já existe uma avaliação mais recente desta competência, feita por outra pessoa entretanto.'
            : 'O estado mudou entretanto — já existe uma avaliação que o pedido não esperava encontrar.',
          current: atual,
        });
      }

      return tx.colaboradorCompetencia.create({
        data: {
          colaboradorId,
          competenciaId: dto.competenciaId,
          nivelId: dto.nivelId,
          dataAvaliacao: dto.dataAvaliacao ? new Date(dto.dataAvaliacao) : new Date(),
          avaliadoPor: user.sub,
          origem,
        },
        include: { competencia: { select: { nome: true } }, nivel: { select: { nome: true } } },
      });
    });
  }

  /** Cria ou atualiza (com locking otimista) a certificação de um colaborador. */
  async upsertCertificacao(colaboradorId: number, certificacaoId: string, dto: UpsertCertificacaoDto, user: AuthenticatedUser) {
    await this.podeEditar(colaboradorId, user);
    const dados = {
      dataObtencao: dto.dataObtencao ? new Date(dto.dataObtencao) : undefined,
      dataValidade: dto.dataValidade ? new Date(dto.dataValidade) : undefined,
      anexoUrl: dto.anexoUrl,
    };

    return this.prisma.runAsUser(user.sub, async (tx) => {
      const existente = await tx.colaboradorCertificacao.findUnique({
        where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId } },
      });

      if (!existente) {
        return tx.colaboradorCertificacao.create({
          data: { colaboradorId, certificacaoId, ...dados },
          include: { certificacao: { select: { nome: true } } },
        });
      }

      if (dto.version === undefined || dto.version !== existente.version) {
        throw new ConflictException({
          message: 'Esta certificação foi alterada por outra pessoa entretanto. Revê os dados atuais e tenta novamente.',
          current: existente,
        });
      }

      const resultado = await tx.colaboradorCertificacao.updateMany({
        where: { colaboradorId, certificacaoId, version: dto.version },
        data: { ...dados, version: { increment: 1 } },
      });

      if (resultado.count === 0) {
        const atual = await tx.colaboradorCertificacao.findUniqueOrThrow({
          where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId } },
        });
        throw new ConflictException({
          message: 'Esta certificação foi alterada por outra pessoa entretanto. Revê os dados atuais e tenta novamente.',
          current: atual,
        });
      }

      return tx.colaboradorCertificacao.findUniqueOrThrow({
        where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId } },
        include: { certificacao: { select: { nome: true } } },
      });
    });
  }

  /**
   * Leitura "fresca" imediatamente antes de abrir um formulário de edição
   * — devolve o `id` da avaliação atual (ou `null`) para usar como
   * `baseAssessmentId`. Ler aqui em vez de reaproveitar o valor de um
   * relatório de gap já em cache no cliente reduz a janela de
   * obsolescência: o relatório pode ter sido pedido minutos antes, este
   * pedido é feito mesmo antes de o utilizador começar a editar.
   */
  async obterUltimaAvaliacao(colaboradorId: number, competenciaId: number, user: AuthenticatedUser) {
    await this.podeEditar(colaboradorId, user);
    const linhas = await this.prisma.$queryRaw<UltimaAvaliacaoRow[]>`
      SELECT id, nivel_id, data_avaliacao, origem
      FROM colaborador_competencia_atual
      WHERE colaborador_id = ${colaboradorId} AND competencia_id = ${competenciaId}
    `;
    return linhas[0] ?? null;
  }

  /** Idem para certificações — devolve o registo atual (com `version`) ou `null`. */
  async obterCertificacaoAtual(colaboradorId: number, certificacaoId: string, user: AuthenticatedUser) {
    await this.podeEditar(colaboradorId, user);
    return this.prisma.colaboradorCertificacao.findUnique({
      where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId } },
    });
  }
}
