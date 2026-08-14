import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AutoCriacaoService } from './auto-criacao.service';
import { CATALOGO_REGISTRY, CatalogoCampoDef, CatalogoTabelaDef, encontrarTabela } from './catalogo.registry';
import { adicionarFolhasDeOpcoes, formulaNomeAtual, nomeFolhaDeOpcoes, numParaColunaExcel } from './excel-referencias.util';

export interface ResumoImportacao {
  criados: number;
  atualizados: number;
  erros: string[];
}

/**
 * CRUD + export/import genérico para as tabelas de catálogo do
 * `CATALOGO_REGISTRY`. O `delegate` de cada tabela vem de uma lista
 * estática interna (nunca de input do cliente) — o acesso via
 * `(this.prisma as any)[def.delegate]` é seguro porque `:tabela` é sempre
 * resolvido primeiro contra o registo (`encontrarTabela` lança 404 para
 * qualquer chave desconhecida).
 */
@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autoCriacao: AutoCriacaoService,
  ) {}

  meta() {
    return CATALOGO_REGISTRY.map(({ delegate: _delegate, ...resto }) => resto);
  }

  async listar(tabela: string) {
    const def = encontrarTabela(tabela);
    const include = this.construirInclude(def);
    const linhas: Record<string, unknown>[] = await (this.prisma as any)[def.delegate].findMany(
      Object.keys(include).length ? { include } : undefined,
    );
    return linhas.map((linha) => this.comLabelsDeRelacao(def, linha));
  }

  async criar(tabela: string, dados: Record<string, unknown>, user: AuthenticatedUser) {
    const def = encontrarTabela(tabela);
    const data = this.validarEcoagir(def, dados, /* exigirObrigatorios */ true);

    try {
      const criado = await this.prisma.runAsUser<Record<string, unknown>>(user.sub, (tx) =>
        (tx as any)[def.delegate].create({ data }),
      );
      return this.comLabelsDeRelacao(def, criado);
    } catch (err) {
      throw this.traduzirErroPrisma(err, def);
    }
  }

  async atualizar(tabela: string, dados: Record<string, unknown>, user: AuthenticatedUser) {
    const def = encontrarTabela(tabela);
    const data = this.validarEcoagir(def, dados, /* exigirObrigatorios */ false);
    const where = this.construirWhereIdentidade(def, data);
    const { ...alteracoes } = data;
    for (const chave of def.identityFields) delete (alteracoes as Record<string, unknown>)[chave];

    try {
      const resultado = await this.prisma.runAsUser<{ count: number }>(user.sub, (tx) =>
        (tx as any)[def.delegate].updateMany({ where, data: alteracoes }),
      );
      if (resultado.count === 0) {
        throw new NotFoundException(`Registo não encontrado em "${def.label}".`);
      }
      const atual = await (this.prisma as any)[def.delegate].findFirst({ where, include: this.construirInclude(def) });
      return this.comLabelsDeRelacao(def, atual);
    } catch (err) {
      throw this.traduzirErroPrisma(err, def);
    }
  }

  async eliminar(tabela: string, identidade: Record<string, unknown>, user: AuthenticatedUser) {
    const def = encontrarTabela(tabela);
    const chave = this.extrairIdentidade(def, identidade);
    const where = this.construirWhereIdentidade(def, chave);

    try {
      const resultado = await this.prisma.runAsUser<{ count: number }>(user.sub, (tx) =>
        (tx as any)[def.delegate].deleteMany({ where }),
      );
      if (resultado.count === 0) {
        throw new NotFoundException(`Registo não encontrado em "${def.label}".`);
      }
      return { eliminado: true };
    } catch (err) {
      throw this.traduzirErroPrisma(err, def);
    }
  }

  /**
   * O ficheiro de download tem de poder ser reenviado tal e qual no upload
   * (pedido do utilizador) — por isso as colunas de dados (id/chaves de
   * relação) ficam exatamente como `importar` as lê. Para cada campo de
   * relação acrescentamos: (1) uma coluna extra "<Label> — nome atual" logo
   * a seguir, com uma fórmula VLOOKUP (não um valor estático) contra a sheet
   * "Opções — X" dessa tabela relacionada — pedido do utilizador: mudar o id
   * na coluna ao lado atualiza este texto sozinho, sem reexportar; e (2) a
   * própria sheet "Opções — X" com todos os id/nome válidos.
   */
  async exportar(tabela: string): Promise<Buffer> {
    const def = encontrarTabela(tabela);
    const select = Object.fromEntries(def.campos.map((c) => [c.key, true]));
    const linhas: Record<string, unknown>[] = await (this.prisma as any)[def.delegate].findMany({ select });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(def.tabela.slice(0, 31));

    const cabecalhos: string[] = [];
    const colunaPorCampo = new Map<string, string>();
    let indiceColuna = 0;
    for (const c of def.campos) {
      indiceColuna++;
      cabecalhos.push(c.key);
      colunaPorCampo.set(c.key, numParaColunaExcel(indiceColuna));
      if (c.tipo === 'relation' && c.relationAccessor) {
        indiceColuna++;
        cabecalhos.push(`${c.label} — nome atual`);
      }
    }
    sheet.addRow(cabecalhos);

    let linhaExcel = 2;
    for (const linha of linhas) {
      const valores: unknown[] = [];
      for (const c of def.campos) {
        valores.push(linha[c.key] ?? null);
        if (c.tipo === 'relation' && c.relationAccessor && c.relatedTable) {
          const folha = nomeFolhaDeOpcoes(encontrarTabela(c.relatedTable).label);
          valores.push(formulaNomeAtual(`${colunaPorCampo.get(c.key)}${linhaExcel}`, folha));
        }
      }
      sheet.addRow(valores);
      linhaExcel++;
    }

    const tabelasRelacionadas = [...new Set(def.campos.filter((c) => c.tipo === 'relation' && c.relatedTable).map((c) => c.relatedTable!))];
    await adicionarFolhasDeOpcoes(workbook, this.prisma, tabelasRelacionadas);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async importar(tabela: string, buffer: Buffer, user: AuthenticatedUser): Promise<ResumoImportacao> {
    const def = encontrarTabela(tabela);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Ficheiro sem folhas.');
    }

    const cabecalho = (sheet.getRow(1).values as unknown[]).map((v) => (v == null ? null : String(v).trim()));
    const indicePorCampo = new Map<string, number>();
    for (const c of def.campos) {
      const idx = cabecalho.findIndex((h) => h === c.key);
      if (idx !== -1) indicePorCampo.set(c.key, idx);
    }

    const resumo: ResumoImportacao = { criados: 0, atualizados: 0, erros: [] };

    // Fase 1 — validação (só leitura): resolve todas as linhas contra a BD
    // sem escrever nada. Uma referência em falta em qualquer linha rejeita o
    // ficheiro inteiro — não há importação parcial.
    const linhasValidas: { data: Record<string, unknown>; where: Record<string, unknown> }[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const linha = sheet.getRow(r);
      if (linha.values == null || (Array.isArray(linha.values) && linha.values.length === 0)) continue;

      try {
        const bruto: Record<string, unknown> = {};
        for (const c of def.campos) {
          const idx = indicePorCampo.get(c.key);
          if (idx === undefined) continue;
          const celula = linha.getCell(idx).value;
          bruto[c.key] = celula && typeof celula === 'object' && 'result' in celula ? (celula as any).result : celula;
        }
        if (Object.values(bruto).every((v) => v === null || v === undefined || v === '')) continue;

        const data = await this.validarEcoagirImport(def, bruto);
        const where = this.construirWhereIdentidade(def, data);
        linhasValidas.push({ data, where });
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
      for (const { data, where } of linhasValidas) {
        const existe = await (tx as any)[def.delegate].findFirst({ where });
        if (existe) {
          await (tx as any)[def.delegate].updateMany({ where, data });
          resumo.atualizados++;
        } else {
          await (tx as any)[def.delegate].create({ data });
          resumo.criados++;
        }
      }
    });

    return resumo;
  }

  // -----------------------------------------------------------------
  // Privados
  // -----------------------------------------------------------------

  private construirInclude(def: CatalogoTabelaDef): Record<string, { select: { nome: true } }> {
    const include: Record<string, { select: { nome: true } }> = {};
    for (const c of def.campos) {
      if (c.tipo === 'relation' && c.relationAccessor) {
        include[c.relationAccessor] = { select: { nome: true } };
      }
    }
    return include;
  }

  private comLabelsDeRelacao(def: CatalogoTabelaDef, linha: Record<string, unknown>): Record<string, unknown> {
    const resultado: Record<string, unknown> = {};
    for (const c of def.campos) {
      resultado[c.key] = linha[c.key];
      if (c.tipo === 'relation' && c.relationAccessor) {
        const relacionado = linha[c.relationAccessor] as { nome?: string } | null | undefined;
        resultado[`${c.key}Label`] = relacionado?.nome ?? null;
      }
    }
    return resultado;
  }

  private validarEcoagir(def: CatalogoTabelaDef, dados: Record<string, unknown>, exigirObrigatorios: boolean): Record<string, unknown> {
    const resultado: Record<string, unknown> = {};
    for (const c of def.campos) {
      const bruto = dados[c.key];
      const presente = bruto !== undefined && bruto !== null && bruto !== '';

      if (!presente) {
        if (exigirObrigatorios && c.obrigatorio) {
          throw new BadRequestException(`Campo obrigatório em falta: "${c.label}" (${c.key}).`);
        }
        continue;
      }

      resultado[c.key] = this.coagirValor(c, bruto);
    }
    return resultado;
  }

  /**
   * Como `validarEcoagir`, mas para import: campos de relação são
   * resolvidos por id OU por nome (via `AutoCriacaoService.resolver`) contra
   * registos já existentes — nunca cria nada. Uma relação em falta lança
   * erro (apanhado pelo chamador em `importar`), tal como um campo
   * obrigatório em falta.
   */
  private async validarEcoagirImport(def: CatalogoTabelaDef, dados: Record<string, unknown>): Promise<Record<string, unknown>> {
    const resultado: Record<string, unknown> = {};
    for (const c of def.campos) {
      const bruto = dados[c.key];
      const presente = bruto !== undefined && bruto !== null && bruto !== '';

      if (!presente) {
        if (c.obrigatorio) {
          throw new BadRequestException(`Campo obrigatório em falta: "${c.label}" (${c.key}).`);
        }
        continue;
      }

      if (c.tipo === 'relation' && c.relatedTable) {
        resultado[c.key] = await this.autoCriacao.resolver(c.relatedTable, bruto as string | number);
      } else {
        resultado[c.key] = this.coagirValor(c, bruto);
      }
    }
    return resultado;
  }

  private coagirValor(campo: CatalogoCampoDef, bruto: unknown): unknown {
    switch (campo.tipo) {
      case 'int': {
        if (typeof bruto === 'number') return bruto;
        return Number(String(bruto).trim());
      }
      case 'relation': {
        if (typeof bruto === 'number') return bruto;
        const texto = String(bruto).trim();
        // O tipo da FK segue o tipo do campo de identidade da tabela relacionada
        // (ex. grupoCarreiraId fica string porque GrupoCarreira.id é string,
        // mesmo que o código escolhido pelo utilizador seja só dígitos como "1").
        return this.relacaoUsaIdInt(campo) ? Number(texto) : texto;
      }
      case 'boolean': {
        if (typeof bruto === 'boolean') return bruto;
        const texto = String(bruto).trim().toLowerCase();
        return texto === 'true' || texto === '1' || texto === 'sim' || texto === 'x';
      }
      case 'enum': {
        const texto = String(bruto).trim().toUpperCase();
        const opcao = campo.opcoes?.find((o) => o.value === texto);
        if (!opcao) {
          const validos = (campo.opcoes ?? []).map((o) => o.value).join(', ');
          throw new BadRequestException(`Valor inválido para "${campo.label}": "${bruto}". Valores aceites: ${validos}.`);
        }
        return opcao.value;
      }
      case 'string':
      default:
        return String(bruto).trim();
    }
  }

  /** Verdadeiro se o campo de identidade da tabela relacionada for 'int' (ex. areaId, lobId). */
  private relacaoUsaIdInt(campo: CatalogoCampoDef): boolean {
    if (!campo.relatedTable) return false;
    const relDef = encontrarTabela(campo.relatedTable);
    const idCampo = relDef.campos.find((c) => c.key === relDef.identityFields[0]);
    return idCampo?.tipo === 'int';
  }

  private construirWhereIdentidade(def: CatalogoTabelaDef, dados: Record<string, unknown>): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    for (const chave of def.identityFields) {
      if (dados[chave] === undefined) {
        throw new BadRequestException(`Falta a identidade "${chave}" para localizar o registo em "${def.label}".`);
      }
      where[chave] = dados[chave];
    }
    return where;
  }

  private extrairIdentidade(def: CatalogoTabelaDef, dados: Record<string, unknown>): Record<string, unknown> {
    const camposIdentidade = def.campos.filter((c) => def.identityFields.includes(c.key));
    return this.validarEcoagir({ ...def, campos: camposIdentidade }, dados, true);
  }

  private traduzirErroPrisma(err: unknown, def: CatalogoTabelaDef): Error {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return new ConflictException(`Já existe um registo com esta identidade em "${def.label}".`);
      }
      if (err.code === 'P2003') {
        return new ConflictException(`Não é possível concluir: este registo está associado a outros dados em "${def.label}".`);
      }
    }
    return err as Error;
  }
}
