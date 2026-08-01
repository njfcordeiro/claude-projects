import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ColaboradoresService } from './colaboradores.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { CreateAvaliacaoDto } from './dto/create-avaliacao.dto';
import { UpsertCertificacaoDto } from './dto/upsert-certificacao.dto';

const LIMITE_FICHEIRO_BYTES = 10 * 1024 * 1024;

@ApiTags('colaboradores')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly service: ColaboradoresService) {}

  @Get('me')
  meuPerfil(@CurrentUser() user: AuthenticatedUser) {
    return this.service.meuPerfil(user);
  }

  @Roles(PapelUtilizador.ADMIN_RH, PapelUtilizador.VIEWER)
  @Get()
  listar(@Query('skip') skip?: string, @Query('take') take?: string) {
    return this.service.listar(skip ? Number(skip) : undefined, take ? Number(take) : undefined);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Post()
  criar(@Body() dto: CreateColaboradorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.criar(dto, user);
  }

  // Declaradas antes de ":id" de propósito — senão o router tentava
  // interpretar "export"/"import" como um id numérico.
  @Roles(PapelUtilizador.ADMIN_RH, PapelUtilizador.VIEWER)
  @Get('export')
  async exportar(@Res() res: Response) {
    const buffer = await this.service.exportar();
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="colaboradores.xlsx"',
      })
      .send(buffer);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importar(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Nenhum ficheiro enviado (campo "file").');
    return this.service.importar(file.buffer, user);
  }

  // Sem @Roles aqui de propósito — a restrição fina (gestor só vê a sua
  // equipa, colaborador só se vê a si) vive no service, não no guard.
  @Get(':id')
  obter(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.obterComVerificacaoDeAcesso(id, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Patch(':id')
  atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColaboradorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.atualizar(id, dto, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.eliminar(id, user);
  }

  // Sem @Roles aqui de propósito, igual ao GET :id — ADMIN_RH edita
  // qualquer um, MANAGER só a sua equipa; a distinção vive no service
  // (podeEditar), EMPLOYEE/VIEWER acabam sempre em 403 lá dentro.
  @Post(':id/competencias')
  criarAvaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAvaliacaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.criarAvaliacao(id, dto, user);
  }

  @Put(':id/certificacoes/:certificacaoId')
  upsertCertificacao(
    @Param('id', ParseIntPipe) id: number,
    @Param('certificacaoId') certificacaoId: string,
    @Body() dto: UpsertCertificacaoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.upsertCertificacao(id, certificacaoId, dto, user);
  }

  /** Leitura fresca imediatamente antes de abrir o formulário "avaliar competência" — ver comentário no service. */
  @Get(':id/competencias/:competenciaId/ultima-avaliacao')
  obterUltimaAvaliacao(
    @Param('id', ParseIntPipe) id: number,
    @Param('competenciaId', ParseIntPipe) competenciaId: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.obterUltimaAvaliacao(id, competenciaId, user);
  }

  @Get(':id/certificacoes/:certificacaoId')
  obterCertificacaoAtual(
    @Param('id', ParseIntPipe) id: number,
    @Param('certificacaoId') certificacaoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.obterCertificacaoAtual(id, certificacaoId, user);
  }
}
