import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  private async garantirQueExiste(id: number) {
    const existe = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException(`Utilizador ${id} não encontrado.`);
  }
}
