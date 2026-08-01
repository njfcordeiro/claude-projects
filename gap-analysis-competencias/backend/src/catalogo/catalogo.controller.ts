import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
import { CatalogoService } from './catalogo.service';

const LIMITE_FICHEIRO_BYTES = 10 * 1024 * 1024;

/**
 * Gestão de dados de catálogo (docs/01-modelo-dados.md) — ver
 * `catalogo.registry.ts` para a lista de tabelas cobertas. Leituras abertas
 * a qualquer papel autenticado (o ecrã de Candidatos, por exemplo, precisa
 * de ler `carreiras` sem ser ADMIN_RH); escritas restritas a ADMIN_RH,
 * mesmo padrão misto de `colaboradores.controller.ts`.
 */
@ApiTags('catalogo')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly service: CatalogoService) {}

  @Get('meta')
  meta() {
    return this.service.meta();
  }

  @Get(':tabela')
  listar(@Param('tabela') tabela: string) {
    return this.service.listar(tabela);
  }

  @Get(':tabela/export')
  async exportar(@Param('tabela') tabela: string, @Res() res: Response) {
    // @Res() sem passthrough de propósito: com passthrough o Nest continua a
    // fazer response.json(body) para o valor devolvido, o que serializa um
    // Buffer como {"type":"Buffer","data":[...]} em vez de bytes crus —
    // aqui respondemos nós próprios para enviar o .xlsx binário tal como é.
    const buffer = await this.service.exportar(tabela);
    res
      .set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${tabela}.xlsx"`,
      })
      .send(buffer);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Post(':tabela')
  criar(@Param('tabela') tabela: string, @Body() dados: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.criar(tabela, dados, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Patch(':tabela')
  atualizar(@Param('tabela') tabela: string, @Body() dados: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.atualizar(tabela, dados, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Delete(':tabela')
  eliminar(@Param('tabela') tabela: string, @Body() identidade: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.service.eliminar(tabela, identidade, user);
  }

  @Roles(PapelUtilizador.ADMIN_RH)
  @Post(':tabela/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LIMITE_FICHEIRO_BYTES } }))
  importar(
    @Param('tabela') tabela: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('Nenhum ficheiro enviado (campo "file").');
    }
    return this.service.importar(tabela, file.buffer, user);
  }
}
