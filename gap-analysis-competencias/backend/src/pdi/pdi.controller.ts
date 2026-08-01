import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PdiService } from './pdi.service';
import { UpdatePdiItemDto } from './dto/update-pdi-item.dto';

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
