import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PapelUtilizador } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { ChatbotService } from './chatbot.service';
import { PerguntarChatbotDto } from './dto/perguntar-chatbot.dto';

/**
 * Chatbot de ajuda — pedido do utilizador: restringir a quem gere pessoas
 * (ADMIN_RH/MANAGER) e a quem só consulta (VIEWER), excluindo EMPLOYEE —
 * guarda de custo adicional, menos utilizadores com acesso a um recurso
 * que custa dinheiro por pedido. O frontend esconde o widget para quem não
 * tem acesso (ver ChatbotWidget.tsx), mas a restrição real vive aqui.
 */
@ApiTags('chatbot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(PapelUtilizador.ADMIN_RH, PapelUtilizador.MANAGER, PapelUtilizador.VIEWER)
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly service: ChatbotService) {}

  @Post('perguntar')
  perguntar(@Body() dto: PerguntarChatbotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.perguntar(dto, user);
  }
}
