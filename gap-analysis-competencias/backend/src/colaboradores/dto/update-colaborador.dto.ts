import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

/** Campos demonstrativos — os módulos seguintes (secção 7 do doc de arquitetura) alargam isto. */
export class UpdateColaboradorDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cargoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  direcaoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  nucleoId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  managerId?: number;
}
