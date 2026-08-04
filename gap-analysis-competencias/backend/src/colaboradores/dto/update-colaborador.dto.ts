import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

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
  areaId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carreiraId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  managerId?: number;

  @ApiPropertyOptional({ description: 'LOB que o colaborador visa a seguir — null para limpar.' })
  @IsOptional()
  @IsInt()
  proximaLobId?: number | null;

  @ApiPropertyOptional({ description: 'Formato AAAA-MM-DD.' })
  @IsOptional()
  @IsDateString()
  dataAdmissao?: string;

  @ApiProperty({ description: 'Versão lida pelo cliente antes de editar — locking otimista, ver docs/02-arquitetura-tecnica.md secção 4.5.' })
  @IsInt()
  version!: number;
}
