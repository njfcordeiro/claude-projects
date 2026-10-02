import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ChatbotService } from './chatbot.service';
import { PerguntarChatbotDto } from './dto/perguntar-chatbot.dto';

/** Chatbot de ajuda — disponível a qualquer papel autenticado (sem @Roles), tal como o resto da ajuda contextual. */
@ApiTags('chatbot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Post('perguntar')
  perguntar(@Body() dto: PerguntarChatbotDto) {
    return this.service.perguntar(dto);
  }
}
