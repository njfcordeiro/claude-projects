import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Adição manual de um item de PDI — exatamente uma de competenciaId/certificacaoId
 * (validado no service, não dá para expressar "XOR" com decorators simples).
 * nivelAlvoId é obrigatório com competenciaId (sem alvo não há como perceber
 * se o item foi cumprido) e não se aplica a certificacaoId (validado no service).
 */
export class CreatePdiItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  competenciaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificacaoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  nivelAlvoId?: number;
}
