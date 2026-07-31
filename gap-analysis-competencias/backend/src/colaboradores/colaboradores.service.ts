import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PapelUtilizador } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';

const SELECT_RESUMO = {
  id: true,
  nome: true,
  cargoId: true,
  direcaoId: true,
  nucleoId: true,
  areaId: true,
  managerId: true,
} as const;

@Injectable()
export class ColaboradoresService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lista completa — só ADMIN_RH/VIEWER chegam aqui (bloqueado pelo RolesGuard no controller). */
  async listar(skip = 0, take = 50) {
    return this.prisma.colaborador.findMany({ select: SELECT_RESUMO, skip, take, orderBy: { nome: 'asc' } });
  }

  async meuPerfil(user: AuthenticatedUser) {
    if (user.colaboradorId === null) {
      throw new NotFoundException('Esta conta não está associada a um colaborador.');
    }
    return this.obterComVerificacaoDeAcesso(user.colaboradorId, user);
  }

  /**
   * RBAC fino (docs/02-arquitetura-tecnica.md secção 4.3):
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

  /** Só ADMIN_RH (bloqueado pelo RolesGuard). Demonstra o padrão runAsUser para o audit_log. */
  async atualizar(id: number, dto: UpdateColaboradorDto, user: AuthenticatedUser) {
    return this.prisma.runAsUser(user.sub, (tx) =>
      tx.colaborador.update({ where: { id }, data: dto, select: SELECT_RESUMO }),
    );
  }
}
