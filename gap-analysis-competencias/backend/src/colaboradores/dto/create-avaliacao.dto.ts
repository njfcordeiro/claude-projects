import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { OrigemAvaliacao } from '@prisma/client';

/**
 * Cria uma nova avaliação de competência (append-only — nunca faz UPDATE,
 * ver docs/01-modelo-dados.md secção 5.1). `baseAssessmentId` é a peça de
 * concorrência: o id da última avaliação que o cliente viu para este
 * (colaborador, competência), ou `null` se acredita que ainda não existe
 * nenhuma. Se o estado real no servidor já não bater certo, o pedido é
 * recusado com 409 em vez de criar silenciosamente uma avaliação que
 * ignora uma alteração entretanto feita por outra pessoa.
 */
export class CreateAvaliacaoDto {
  @ApiProperty()
  @IsInt()
  competenciaId!: number;

  @ApiProperty({ minimum: 0, maximum: 5 })
  @IsInt()
  @Min(0)
  @Max(5)
  nivelId!: number;

  @ApiPropertyOptional({ description: 'Id da última avaliação vista pelo cliente, ou null se acredita que não existe nenhuma.' })
  @IsOptional()
  baseAssessmentId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dataAvaliacao?: string;

  @ApiPropertyOptional({
    enum: ['MANAGER', 'FORMAL', 'AVALIACAO_360'],
    description: 'Só relevante para ADMIN_RH — um MANAGER é sempre gravado como origem MANAGER, independentemente do que enviar.',
  })
  @IsOptional()
  @IsIn(['MANAGER', 'FORMAL', 'AVALIACAO_360'])
  origem?: OrigemAvaliacao;
}
