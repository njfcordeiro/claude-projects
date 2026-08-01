import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrigemAvaliacao, PapelUtilizador, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
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
  version: true,
} as const;

/** Linha da view colaborador_competencia_atual (docs/01-modelo-dados.md secção 5.1). */
interface UltimaAvaliacaoRow {
  id: number;
  nivel_id: number;
  data_avaliacao: Date;
  origem: OrigemAvaliacao;
}

@Injectable()
export class ColaboradoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista completa — só ADMIN_RH/VIEWER chegam aqui (bloqueado pelo RolesGuard no controller). */
  async listar(skip = 0, take = 1000) {
    return this.prisma.colaborador.findMany({ select: SELECT_RESUMO, skip, take, orderBy: { nome: 'asc' } });
  }

  /** Cria um colaborador novo — `id` é fornecido pelo cliente (replica o "ID Colaborador" do Excel, não é autoincrement). */
  async criar(dto: CreateColaboradorDto, autor: AuthenticatedUser) {
    try {
      return await this.prisma.runAsUser(autor.sub, (tx) => tx.colaborador.create({ data: dto, select: SELECT_RESUMO }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Já existe um colaborador com o id ${dto.id}.`);
      }
      throw err;
    }
  }

  /**
   * Elimina um colaborador. O schema não define `onDelete: Cascade` nas FKs
   * para Colaborador, por isso o Postgres já rejeita (RESTRICT) eliminar
   * alguém com subordinados/avaliações/certificações/conta associada —
   * aqui só traduzimos esse erro para uma mensagem percetível.
   */
  async eliminar(id: number, autor: AuthenticatedUser) {
    try {
      await this.prisma.runAsUser(autor.sub, (tx) => tx.colaborador.delete({ where: { id } }));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException(`Colaborador ${id} não encontrado.`);
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException(
          `Este colaborador tem dados associados (avaliações, subordinados, conta, etc.) — não pode ser eliminado.`,
        );
      }
      throw err;
    }
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
    return colaborador;
  }

  /**
   * RBAC fino de ESCRITA (secção 4.5 do doc de arquitetura, Prompt 5):
   * ADMIN_RH edita qualquer colaborador; MANAGER só a sua equipa direta;
   * EMPLOYEE e VIEWER nunca escrevem — "Colaborador só vê os seus
   * próprios dados" é literal, não inclui autoavaliação nesta entrega.
   */
  private async podeEditar(id: number, user: AuthenticatedUser): Promise<void> {
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
    const { version, ...alteracoes } = dto;

    return this.prisma.runAsUser(user.sub, async (tx) => {
      const resultado = await tx.colaborador.updateMany({
        where: { id, version },
        data: { ...alteracoes, version: { increment: 1 } },
      });

      if (resultado.count === 0) {
        await this.lancarConflitoColaborador(tx, id);
      }

      return tx.colaborador.findUniqueOrThrow({ where: { id }, select: SELECT_RESUMO });
    });
  }

  private async lancarConflitoColaborador(tx: Prisma.TransactionClient, id: number): Promise<never> {
    const atual = await tx.colaborador.findUnique({ where: { id }, select: SELECT_RESUMO });
    if (!atual) throw new NotFoundException(`Colaborador ${id} não encontrado.`);
    throw new ConflictException({
      message: 'Este colaborador foi alterado por outra pessoa entretanto. Revê os dados atuais e tenta novamente.',
      current: atual,
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
