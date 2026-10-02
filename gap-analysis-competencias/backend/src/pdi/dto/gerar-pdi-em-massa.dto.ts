import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsInt } from 'class-validator';

export class GerarPdiEmMassaDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  colaboradorIds!: number[];

  @ApiProperty({ enum: ['CARGO_ATUAL', 'PROXIMO_CARGO'] })
  @IsIn(['CARGO_ATUAL', 'PROXIMO_CARGO'])
  alvo!: 'CARGO_ATUAL' | 'PROXIMO_CARGO';
}
