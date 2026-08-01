import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { AutoCriacaoService } from './auto-criacao.service';
import { CATALOGO_REGISTRY, CatalogoCampoDef, CatalogoTabelaDef, encontrarTabela } from './catalogo.registry';

export interface ResumoImportacao {
  criados: number;
  atualizados: number;
  /** Auto-criação de registos relacionados em falta (LOB/Formação/Competência/...) — ver AutoCriacaoService. Nunca bloqueia a linha. */
  avisos: string[];
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

  async exportar(tabela: string): Promise<Buffer> {
    const def = encontrarTabela(tabela);
    const select = Object.fromEntries(def.campos.map((c) => [c.key, true]));
    const linhas: Record<string, unknown>[] = await (this.prisma as any)[def.delegate].findMany({ select });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(def.tabela.slice(0, 31));
    sheet.addRow(def.campos.map((c) => c.key));
    for (const linha of linhas) {
      sheet.addRow(def.campos.map((c) => linha[c.key] ?? null));
    }
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

    const resumo: ResumoImportacao = { criados: 0, atualizados: 0, avisos: [], erros: [] };

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

        const data = await this.validarEcoagirImport(def, bruto, user, resumo.avisos);
        const where = this.construirWhereIdentidade(def, data);

        const existe = await (this.prisma as any)[def.delegate].findFirst({ where });
        await this.prisma.runAsUser(user.sub, (tx) =>
          existe ? (tx as any)[def.delegate].updateMany({ where, data }) : (tx as any)[def.delegate].create({ data }),
        );
        if (existe) resumo.atualizados++;
        else resumo.criados++;
      } catch (err) {
        const mensagem = err instanceof Error ? err.message : 'Erro desconhecido.';
        resumo.erros.push(`Linha ${r}: ${mensagem}`);
      }
    }

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
   * resolvidos por id OU por nome (via `AutoCriacaoService`), criando o
   * registo relacionado automaticamente quando ainda não existe — ver
   * REGRA DE DEPENDÊNCIAS AUTOMÁTICA pedida pelo utilizador. Nunca bloqueia
   * a linha por uma relação em falta quando a tabela relacionada suporta
   * criação automática.
   */
  private async validarEcoagirImport(
    def: CatalogoTabelaDef,
    dados: Record<string, unknown>,
    user: AuthenticatedUser,
    avisos: string[],
  ): Promise<Record<string, unknown>> {
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
        resultado[c.key] = await this.autoCriacao.resolver(c.relatedTable, bruto as string | number, user, avisos);
      } else {
        resultado[c.key] = this.coagirValor(c, bruto);
      }
    }
    return resultado;
  }

  private coagirValor(campo: CatalogoCampoDef, bruto: unknown): unknown {
    switch (campo.tipo) {
      case 'int':
      case 'relation': {
        // Campos de relação com FK string (ex. carreiraId) ficam como string; os com FK int passam por Number.
        if (typeof bruto === 'number') return bruto;
        const texto = String(bruto).trim();
        if (/^-?\d+$/.test(texto)) return Number(texto);
        return texto;
      }
      case 'boolean': {
        if (typeof bruto === 'boolean') return bruto;
        const texto = String(bruto).trim().toLowerCase();
        return texto === 'true' || texto === '1' || texto === 'sim' || texto === 'x';
      }
      case 'string':
      default:
        return String(bruto).trim();
    }
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
