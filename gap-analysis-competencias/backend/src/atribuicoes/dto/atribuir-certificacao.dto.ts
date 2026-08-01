import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

/** Atribuição em massa de uma certificação a vários colaboradores de uma vez — ver AtribuicoesPage. */
export class AtribuirCertificacaoDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  colaboradorIds!: number[];

  @ApiProperty()
  @IsString()
  certificacaoId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataObtencao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataValidade?: string;
}
