import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class RegistarParticipacaoProjetoDto {
  @ApiProperty()
  @IsInt()
  projetoId!: number;

  @ApiProperty({ type: [Number], description: 'Vertentes do projeto em que o colaborador participou (mínimo 1).' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  vertenteIds!: number[];
}
