import { ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoPdi } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdatePdiItemDto {
  @ApiPropertyOptional({ enum: EstadoPdi })
  @IsOptional()
  @IsEnum(EstadoPdi)
  estado?: EstadoPdi;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}
