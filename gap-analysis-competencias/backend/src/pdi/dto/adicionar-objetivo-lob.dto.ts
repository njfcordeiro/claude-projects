import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AdicionarObjetivoLobDto {
  @ApiProperty()
  @IsInt()
  lobId!: number;
}
