import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DefinirProximoCargoDto {
  @ApiProperty()
  @IsString()
  cargoId!: string;
}
