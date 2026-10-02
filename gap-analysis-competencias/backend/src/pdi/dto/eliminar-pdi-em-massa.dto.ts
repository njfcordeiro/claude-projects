import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class EliminarPdiEmMassaDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  colaboradorIds!: number[];
}
