import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LobsService } from './lobs.service';

/** Catálogo organizacional, não dados pessoais — qualquer utilizador autenticado pode ler. */
@ApiTags('lobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lobs')
export class LobsController {
  constructor(private readonly service: LobsService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.service.obterDetalhe(id);
  }
}
