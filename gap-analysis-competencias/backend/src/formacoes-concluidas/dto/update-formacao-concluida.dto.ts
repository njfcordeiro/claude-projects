import { ApiPropertyOptional } from '@nestjs/swagger';
import { AvaliacaoFormacao } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateFormacaoConcluidaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataConclusao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  horasFormacao?: number;

  @ApiPropertyOptional({ enum: AvaliacaoFormacao })
  @IsOptional()
  @IsEnum(AvaliacaoFormacao)
  avaliacao?: AvaliacaoFormacao;
}
