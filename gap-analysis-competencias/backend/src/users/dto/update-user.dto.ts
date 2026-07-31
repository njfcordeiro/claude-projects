import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PapelUtilizador } from '@prisma/client';

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: PapelUtilizador })
  @IsOptional()
  @IsEnum(PapelUtilizador)
  role?: PapelUtilizador;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
