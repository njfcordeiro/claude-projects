import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsInt, IsOptional, MinLength } from 'class-validator';
import { PapelUtilizador } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Mínimo 8 caracteres — a app não tem self-registo, só ADMIN_RH cria contas.' })
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: PapelUtilizador })
  @IsEnum(PapelUtilizador)
  role!: PapelUtilizador;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  colaboradorId?: number;
}
