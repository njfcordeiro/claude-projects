import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

/** Igual a UpdateColaboradorDto, mas `id`/`nome` são obrigatórios (não há autoincrement — `id` replica o "ID Colaborador" do Excel) e sem `version` (não existe ainda). */
export class CreateColaboradorDto {
  @ApiProperty()
  @IsInt()
  id!: number;

  @ApiProperty()
  @IsString()
  nome!: string;

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
}
