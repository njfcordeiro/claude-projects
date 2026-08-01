import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

/**
 * Cria ou atualiza a certificação de um colaborador. `version` só é
 * necessário quando o registo já existe (locking otimista — ver
 * docs/02-arquitetura-tecnica.md secção 4.5); omitido = a criar pela
 * primeira vez.
 */
export class UpsertCertificacaoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataObtencao?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataValidade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @ApiPropertyOptional({ description: 'Obrigatório se o registo já existir — versão lida pelo cliente antes de editar.' })
  @IsOptional()
  @IsInt()
  version?: number;
}
