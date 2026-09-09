import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Atribuição em massa de uma certificação a vários colaboradores de uma vez
 * — ver AtribuicoesPage. dataObtencao é obrigatória (pedido do utilizador):
 * sem ela não há certificação a registar, é simplesmente "em falta" — nunca
 * fica uma linha "vazia" na base de dados.
 */
export class AtribuirCertificacaoDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  colaboradorIds!: number[];

  @ApiProperty()
  @IsString()
  certificacaoId!: string;

  @ApiProperty()
  @IsDateString()
  dataObtencao!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataValidade?: string;
}
