import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

/** Adição manual de um item de PDI — exatamente uma de competenciaId/certificacaoId (validado no service, não dá para expressar "XOR" com decorators simples). */
export class CreatePdiItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  competenciaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  certificacaoId?: string;
}
