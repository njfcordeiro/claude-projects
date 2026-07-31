import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({ description: 'Versão lida pelo cliente antes de editar — locking otimista, ver docs/02-arquitetura-tecnica.md secção 4.5.' })
  @IsInt()
  version!: number;
}
