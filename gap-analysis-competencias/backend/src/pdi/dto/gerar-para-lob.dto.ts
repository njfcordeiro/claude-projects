import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

/** "Gerar sugestões para LOB" (escolha manual) — ver PdiService.gerarParaLobEscolhida. */
export class GerarParaLobDto {
  @ApiProperty()
  @IsInt()
  lobId!: number;
}
