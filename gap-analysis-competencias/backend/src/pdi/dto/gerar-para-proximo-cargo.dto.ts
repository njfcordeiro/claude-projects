import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * "Gerar para o Próximo Cargo" — só é obrigatório indicar `proximoCargoId`
 * quando há mais que um Próximo Cargo possível a partir do cargo atual do
 * colaborador (ver PdiService.gerarParaProximoCargo); com um único cargo
 * seguinte possível, o backend escolhe-o sozinho.
 */
export class GerarParaProximoCargoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proximoCargoId?: string;
}
