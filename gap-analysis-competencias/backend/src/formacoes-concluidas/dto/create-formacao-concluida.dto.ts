import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvaliacaoFormacao } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

/**
 * Regista uma participação numa Formação. `horasFormacao` é opcional — se
 * omitido, o serviço propõe por omissão o `duracaoHoras` do catálogo de
 * Formações (pedido do utilizador); indicado aqui, prevalece o valor
 * manual.
 */
export class CreateFormacaoConcluidaDto {
  @ApiProperty()
  @IsInt()
  formacaoId!: number;

  @ApiProperty()
  @IsDateString()
  dataConclusao!: string;

  @ApiPropertyOptional({ description: 'Se omitido, usa por omissão a duração (horas) definida na Formação.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  horasFormacao?: number;

  @ApiProperty({ enum: AvaliacaoFormacao })
  @IsEnum(AvaliacaoFormacao)
  avaliacao!: AvaliacaoFormacao;
}
