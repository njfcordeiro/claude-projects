import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ProjetosService } from './projetos.service';
import { RegistarParticipacaoProjetoDto } from './dto/registar-participacao-projeto.dto';

/**
 * Participação em Projetos — mesmo RBAC fino de leitura/escrita da ficha
 * do colaborador (ver ColaboradoresService.obterComVerificacaoDeAcesso/
 * podeEditar): sem @Roles aqui de propósito, a restrição vive no service.
 */
@ApiTags('projetos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores/:id/projetos')
export class ProjetosController {
  constructor(private readonly service: ProjetosService) {}

  @Get()
  listar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listarParticipacoes(id, user);
  }

  @Post()
  registar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RegistarParticipacaoProjetoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.registarParticipacao(id, dto, user);
  }

  @Delete(':projetoId')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Param('projetoId', ParseIntPipe) projetoId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.eliminarParticipacao(id, projetoId, user);
  }
}

/** Vertentes de um Projeto — catálogo organizacional, não dados pessoais: qualquer utilizador autenticado pode ler (mesmo padrão de LobsController). */
@ApiTags('projetos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projetos')
export class ProjetoCatalogoController {
  constructor(private readonly service: ProjetosService) {}

  @Get(':id/vertentes')
  listarVertentes(@Param('id', ParseIntPipe) id: number) {
    return this.service.listarVertentes(id);
  }
}
