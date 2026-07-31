import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FormacoesService } from './formacoes.service';

@ApiTags('formacoes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('formacoes')
export class FormacoesController {
  constructor(private readonly service: FormacoesService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number) {
    return this.service.obterDetalhe(id);
  }
}
