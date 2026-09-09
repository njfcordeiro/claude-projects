import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, ValidateIf } from 'class-validator';

/**
 * Cria ou atualiza a certificação de um colaborador. `version` só é
 * necessário quando o registo já existe (locking otimista — ver
 * docs/02-arquitetura-tecnica.md secção 4.5); omitido = a criar pela
 * primeira vez.
 *
 * `dataObtencao`/`dataValidade`: omitido = não alterar; `null` = limpar o
 * campo (ex.: reverter uma certificação assinalada por engano); string =
 * nova data. Distinguir "omitido" de "null" é o que permite apagar a data
 * sem forçar o cliente a reenviar tudo.
 */
export class UpsertCertificacaoDto {
  @ApiPropertyOptional({ nullable: true, description: 'null para apagar a data já registada.' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dataObtencao?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'null para apagar a data já registada.' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dataValidade?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anexoUrl?: string;

  @ApiPropertyOptional({ description: 'Obrigatório se o registo já existir — versão lida pelo cliente antes de editar.' })
  @IsOptional()
  @IsInt()
  version?: number;
}
