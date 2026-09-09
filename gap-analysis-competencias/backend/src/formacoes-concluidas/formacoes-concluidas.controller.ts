import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { FormacoesConcluidasService } from './formacoes-concluidas.service';
import { CreateFormacaoConcluidaDto } from './dto/create-formacao-concluida.dto';
import { UpdateFormacaoConcluidaDto } from './dto/update-formacao-concluida.dto';

/** Histórico de formações concluídas — mesmo RBAC fino de leitura/escrita da ficha do colaborador (vive no service, sem @Roles aqui). */
@ApiTags('formacoes-concluidas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores/:id/formacoes-concluidas')
export class FormacoesConcluidasController {
  constructor(private readonly service: FormacoesConcluidasService) {}

  @Get()
  listar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listar(id, user);
  }

  @Post()
  criar(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateFormacaoConcluidaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.criar(id, dto, user);
  }

  @Patch(':formacaoConcluidaId')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Param('formacaoConcluidaId', ParseIntPipe) formacaoConcluidaId: number,
    @Body() dto: UpdateFormacaoConcluidaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.atualizar(id, formacaoConcluidaId, dto, user);
  }

  @Delete(':formacaoConcluidaId')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Param('formacaoConcluidaId', ParseIntPipe) formacaoConcluidaId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.eliminar(id, formacaoConcluidaId, user);
  }
}
