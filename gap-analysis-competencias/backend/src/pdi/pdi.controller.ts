import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PdiService } from './pdi.service';
import { CreatePdiItemDto } from './dto/create-pdi-item.dto';
import { UpdatePdiItemDto } from './dto/update-pdi-item.dto';
import { GerarParaLobDto } from './dto/gerar-para-lob.dto';
import { GerarParaProximoCargoDto } from './dto/gerar-para-proximo-cargo.dto';

/**
 * Plano de Desenvolvimento Individual — mesmo RBAC fino de leitura/escrita
 * da ficha do colaborador (ver ColaboradoresService.obterComVerificacaoDeAcesso/podeEditar):
 * sem @Roles aqui de propósito, a restrição vive no service.
 */
@ApiTags('pdi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores/:id/pdi')
export class PdiController {
  constructor(private readonly service: PdiService) {}

  @Get()
  listar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listar(id, user);
  }

  @Post('gerar')
  gerar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.gerar(id, user);
  }

  /** Escolha manual da LOB-alvo — ver PdiService.gerarParaLobEscolhida (só LOBs da área do colaborador). */
  @Post('gerar-para-lob')
  gerarParaLob(@Param('id', ParseIntPipe) id: number, @Body() dto: GerarParaLobDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.gerarParaLobEscolhida(id, dto, user);
  }

  /** Ver PdiService.gerarParaCargoAtual — LOBs (técnicas e comportamentais) associadas ao Cargo atual em "LOBs por Cargo". */
  @Post('gerar-para-cargo-atual')
  gerarParaCargoAtual(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.gerarParaCargoAtual(id, user);
  }

  /** Ver PdiService.gerarParaProximoCargo — resolve o Próximo Cargo via Progressão de Cargos. */
  @Post('gerar-para-proximo-cargo')
  gerarParaProximoCargo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GerarParaProximoCargoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.gerarParaProximoCargo(id, dto, user);
  }

  @Post()
  criar(@Param('id', ParseIntPipe) id: number, @Body() dto: CreatePdiItemDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.criar(id, dto, user);
  }

  /**
   * Elimina de uma vez todos os itens sugeridos (origem AUTOMATICO) — ver
   * PdiService.eliminarSugestoes. Tem de estar ANTES de `:itemId` para o
   * Nest não tentar interpretar "sugestoes" como um id numérico.
   */
  @Delete('sugestoes')
  eliminarSugestoes(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.eliminarSugestoes(id, user);
  }

  @Patch(':itemId')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdatePdiItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.atualizar(id, itemId, dto, user);
  }

  @Delete(':itemId')
  eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.eliminar(id, itemId, user);
  }
}
