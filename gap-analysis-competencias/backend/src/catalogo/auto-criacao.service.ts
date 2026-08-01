import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { encontrarTabela } from './catalogo.registry';

/**
 * Tabelas de catálogo para as quais é seguro criar um registo novo só a
 * partir de um nome (sem mais nenhum dado obrigatório fora do nosso
 * controlo) — ver pedido do utilizador: "não deve bloquear o upload, deve
 * criar automaticamente". `cargos`/`nucleos`... na verdade `nucleos` e
 * `direcoes` só precisam de `nome` (seguro); `cargos` fica de fora porque
 * exige `carreiraId`+`categoriaId`, que não temos como adivinhar a partir
 * de uma célula com um nome.
 */
const TABELAS_AUTO_CRIAVEIS = new Set([
  'direcoes',
  'areas',
  'nucleos',
  'carreiras',
  'categorias',
  'niveis',
  'competencias',
  'certificacoes',
  'formacoes',
  'lobs',
]);

const NOME_AREA_FALLBACK = 'Não classificada';

function gerarCodigo(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
  return base || 'ITEM';
}

/**
 * Resolve o valor de uma célula de importação (id existente OU nome) para
 * o id do registo relacionado — criando-o automaticamente quando não
 * existe e a tabela relacionada suporta criação automática, em vez de
 * bloquear a linha inteira. Ver `CatalogoService.importar` e
 * `ColaboradoresService.importar`.
 */
@Injectable()
export class AutoCriacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(
    relatedTable: string,
    valorBruto: string | number,
    user: AuthenticatedUser,
    avisos: string[],
  ): Promise<string | number> {
    const def = encontrarTabela(relatedTable);
    const delegate = (this.prisma as any)[def.delegate];
    const pkCampo = def.campos.find((c) => c.key === def.identityFields[0]);

    if (pkCampo?.tipo === 'int') {
      const comoNumero =
        typeof valorBruto === 'number'
          ? valorBruto
          : /^-?\d+$/.test(String(valorBruto).trim())
            ? Number(valorBruto)
            : null;
      if (comoNumero !== null) {
        const existente = await delegate.findUnique({ where: { id: comoNumero } });
        if (existente) return comoNumero;
      }
    } else {
      const comoTexto = String(valorBruto).trim();
      const existentePorId = await delegate.findUnique({ where: { id: comoTexto } });
      if (existentePorId) return comoTexto;
    }

    const nome = String(valorBruto).trim();
    const existentePorNome = await delegate.findFirst({ where: { nome } });
    if (existentePorNome) return existentePorNome.id;

    if (!TABELAS_AUTO_CRIAVEIS.has(relatedTable)) {
      throw new Error(
        `"${nome}" não encontrado em "${def.label}" — criação automática não é suportada para esta tabela, cria o registo primeiro em Gestão de Dados.`,
      );
    }

    const novoId = await this.criar(relatedTable, nome, user);
    avisos.push(`${def.label.replace(/s$/, '')} "${nome}" não existia e foi criada automaticamente — revê os restantes campos em Gestão de Dados.`);
    return novoId;
  }

  private async proximoIdInt(delegate: any): Promise<number> {
    const max = await delegate.aggregate({ _max: { id: true } });
    return (max._max.id ?? 0) + 1;
  }

  private async codigoUnico(delegate: any, nome: string): Promise<string> {
    const base = gerarCodigo(nome);
    let candidato = base;
    let sufixo = 2;
    // eslint-disable-next-line no-await-in-loop
    while (await delegate.findUnique({ where: { id: candidato } })) {
      candidato = `${base}_${sufixo++}`;
    }
    return candidato;
  }

  /** Área "Não classificada" — find-or-create, usada como FK obrigatória de fallback para competências/formações/LOBs criadas automaticamente sem contexto de área. */
  private async areaFallback(user: AuthenticatedUser): Promise<number> {
    const existente = await this.prisma.area.findFirst({ where: { nome: NOME_AREA_FALLBACK } });
    if (existente) return existente.id;
    const novoId = await this.proximoIdInt(this.prisma.area);
    const criado = await this.prisma.runAsUser<{ id: number }>(user.sub, (tx) =>
      tx.area.create({ data: { id: novoId, nome: NOME_AREA_FALLBACK } }),
    );
    return criado.id;
  }

  private async criar(relatedTable: string, nome: string, user: AuthenticatedUser): Promise<string | number> {
    const def = encontrarTabela(relatedTable);
    const delegate = (this.prisma as any)[def.delegate];

    let data: Record<string, unknown>;
    switch (relatedTable) {
      case 'direcoes':
        data = { id: await this.proximoIdInt(delegate), nome, relevante: false };
        break;
      case 'areas':
        data = { id: await this.proximoIdInt(delegate), nome };
        break;
      case 'nucleos':
        data = { id: await this.proximoIdInt(delegate), nome };
        break;
      case 'niveis':
        data = { id: await this.proximoIdInt(delegate), nome, descricao: nome };
        break;
      case 'competencias':
        data = { id: await this.proximoIdInt(delegate), nome, areaId: await this.areaFallback(user) };
        break;
      case 'formacoes':
        data = { id: await this.proximoIdInt(delegate), nome, areaId: await this.areaFallback(user) };
        break;
      case 'lobs':
        data = { id: await this.proximoIdInt(delegate), nome, areaId: await this.areaFallback(user), pontosMinimos: 0 };
        break;
      case 'carreiras':
        data = { id: await this.codigoUnico(delegate, nome), nome, relevante: false };
        break;
      case 'categorias':
        data = { id: await this.codigoUnico(delegate, nome), nome };
        break;
      case 'certificacoes':
        data = { id: await this.codigoUnico(delegate, nome), nome };
        break;
      default:
        throw new Error(`Criação automática não implementada para "${relatedTable}".`);
    }

    const criado = await this.prisma.runAsUser<{ id: string | number }>(user.sub, (tx) =>
      (tx as any)[def.delegate].create({ data }),
    );
    return criado.id;
  }
}
