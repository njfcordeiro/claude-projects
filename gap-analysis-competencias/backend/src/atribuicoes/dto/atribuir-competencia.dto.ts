import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsInt, IsOptional } from 'class-validator';

/** Atribuição em massa de uma competência (com o nível atingido) a vários colaboradores de uma vez — ver AtribuicoesPage. */
export class AtribuirCompetenciaDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  colaboradorIds!: number[];

  @ApiProperty()
  @IsInt()
  competenciaId!: number;

  @ApiProperty()
  @IsInt()
  nivelId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataAvaliacao?: string;
}
