import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Sem 0/O/1/l/I — evita confusão ao ditar/copiar a password temporária.
const ALFABETO_SENHA = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function gerarSenhaTemporaria(tamanho = 12): string {
  let senha = '';
  for (let i = 0; i < tamanho; i++) {
    senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  }
  return senha;
}

const SELECT_RESUMO = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  colaboradorId: true,
  lastLoginAt: true,
  createdAt: true,
  colaborador: { select: { id: true, nome: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listar() {
    return this.prisma.user.findMany({ select: SELECT_RESUMO, orderBy: { email: 'asc' } });
  }

  async criar(dto: CreateUserDto, autor: AuthenticatedUser) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.prisma.runAsUser(autor.sub, (tx) =>
        tx.user.create({
          data: { email: dto.email, passwordHash, role: dto.role, colaboradorId: dto.colaboradorId },
          select: SELECT_RESUMO,
        }),
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Já existe um utilizador com este email (ou colaborador já tem conta).');
      }
      throw err;
    }
  }

  async atualizar(id: number, dto: UpdateUserDto, autor: AuthenticatedUser) {
    await this.garantirQueExiste(id);
    return this.prisma.runAsUser(autor.sub, (tx) => tx.user.update({ where: { id }, data: dto, select: SELECT_RESUMO }));
  }

  /**
   * Reinicialização de password pelo ADMIN_RH: gera uma password temporária
   * aleatória, guarda só o hash, e devolve o texto simples UMA vez na
   * resposta — não fica persistido em lado nenhum em texto simples. O
   * admin tem de a partilhar com o utilizador por um canal seguro (não há
   * envio de email configurado nesta app).
   */
  async reinicializarPassword(id: number, autor: AuthenticatedUser): Promise<{ senhaTemporaria: string }> {
    await this.garantirQueExiste(id);
    const senhaTemporaria = gerarSenhaTemporaria();
    const passwordHash = await bcrypt.hash(senhaTemporaria, 12);
    await this.prisma.runAsUser(autor.sub, (tx) => tx.user.update({ where: { id }, data: { passwordHash } }));
    return { senhaTemporaria };
  }

  private async garantirQueExiste(id: number) {
    const existe = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException(`Utilizador ${id} não encontrado.`);
  }
}
