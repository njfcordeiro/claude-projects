import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class MensagemHistoricoChatbot {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  conteudo!: string;
}

export class PerguntarChatbotDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  pergunta!: string;

  /** Documentação (conceitos + ecrã-a-ecrã) montada pelo frontend a partir de ajudaEcras.ts/documentacao.ts — fonte única, nunca duplicada no backend. */
  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  contexto!: string;

  @ApiPropertyOptional({ type: [MensagemHistoricoChatbot] })
  @IsOptional()
  @IsArray()
  historico?: MensagemHistoricoChatbot[];
}
