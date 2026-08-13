import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

/** Os três pesos têm de somar 100 — validado em GapAnalysisService.atualizarConfiguracaoProntidao (não aqui, é uma regra entre campos). */
export class UpdateConfiguracaoProntidaoDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  pesoCompetencias!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  pesoCertificacoes!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  pesoPontos!: number;
}
