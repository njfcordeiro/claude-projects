import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { LobObjetivosService } from './lob-objetivos.service';
import { AdicionarObjetivoLobDto } from './dto/adicionar-objetivo-lob.dto';

/**
 * Objetivos de LOB (sugestões automáticas + recomendações do BUD) — mesmo
 * RBAC fino de leitura/escrita da ficha do colaborador (ver
 * ColaboradoresService.obterComVerificacaoDeAcesso/podeEditar): sem @Roles
 * aqui de propósito, a restrição vive no service.
 */
@ApiTags('pdi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores/:id/objetivos-lob')
export class LobObjetivosController {
  constructor(private readonly service: LobObjetivosService) {}

  @Get()
  listar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listar(id, user);
  }

  @Post()
  adicionar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdicionarObjetivoLobDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.adicionar(id, dto.lobId, user);
  }

  @Delete(':lobId')
  remover(
    @Param('id', ParseIntPipe) id: number,
    @Param('lobId', ParseIntPipe) lobId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.remover(id, lobId, user);
  }
}
