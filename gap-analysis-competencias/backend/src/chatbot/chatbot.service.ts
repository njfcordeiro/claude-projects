import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { PerguntarChatbotDto } from './dto/perguntar-chatbot.dto';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODELO_PADRAO = 'claude-haiku-4-5-20251001';
const MAX_TOKENS_RESPOSTA = 1024;
// Evita prompts sem limite em conversas longas — só as últimas trocas interessam para contexto de ajuda.
const MAX_MENSAGENS_HISTORICO = 12;

// Guardas de custo (pedido do utilizador) — configuráveis por env var, com
// valores por omissão razoáveis para um assistente de ajuda interno.
// Limite diário por utilizador: impede uma só pessoa de esgotar o orçamento
// sozinha. Limite diário global: corta-circuito para toda a aplicação —
// protege o orçamento mesmo que vários utilizadores usem o chatbot ao
// mesmo tempo. Ambos contam por dia UTC, nunca persistem o conteúdo da
// pergunta — só uma linha em ChatbotUso por pedido aceite.
const LIMITE_DIARIO_UTILIZADOR = Number(process.env.CHATBOT_LIMITE_DIARIO_UTILIZADOR) || 20;
const LIMITE_DIARIO_GLOBAL = Number(process.env.CHATBOT_LIMITE_DIARIO_GLOBAL) || 300;

interface RespostaAnthropic {
  content?: { type: string; text?: string }[];
}

function inicioDoDiaUtc(): Date {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()));
}

/**
 * Chatbot de ajuda (pedido do utilizador: "criar documentação dinâmica e
 * chatbot para ajudar") — responde SÓ com base na documentação já escrita
 * para "Como Funciona"/ajuda contextual (ajudaEcras.ts/documentacao.ts no
 * frontend), nunca duplicada aqui: o frontend monta o texto da
 * documentação e envia-o em `contexto` a cada pedido, este serviço só o
 * encaixa no prompt de sistema e reencaminha para a Claude API. Requer
 * `ANTHROPIC_API_KEY` configurada no ambiente do backend — sem ela, o
 * endpoint devolve 503 em vez de rebentar, para a UI poder mostrar uma
 * mensagem clara em vez de um erro genérico.
 *
 * Quem pode usar o chatbot (papel EMPLOYEE excluído) é decidido no
 * controller via @Roles — este serviço só lida com os limites diários.
 */
@Injectable()
export class ChatbotService {
  constructor(private readonly prisma: PrismaService) {}

  async perguntar(dto: PerguntarChatbotDto, user: AuthenticatedUser): Promise<{ resposta: string }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException('O assistente de ajuda não está configurado (falta ANTHROPIC_API_KEY no backend).');
    }

    const hoje = inicioDoDiaUtc();
    const [usoGlobal, usoUtilizador] = await Promise.all([
      this.prisma.chatbotUso.count({ where: { data: hoje } }),
      this.prisma.chatbotUso.count({ where: { data: hoje, userId: user.sub } }),
    ]);
    if (usoGlobal >= LIMITE_DIARIO_GLOBAL) {
      throw new ServiceUnavailableException(
        `O assistente de ajuda atingiu o limite diário de perguntas de toda a organização (${LIMITE_DIARIO_GLOBAL}) — tenta novamente amanhã.`,
      );
    }
    if (usoUtilizador >= LIMITE_DIARIO_UTILIZADOR) {
      throw new HttpException(
        `Atingiste o limite diário de ${LIMITE_DIARIO_UTILIZADOR} perguntas ao assistente de ajuda — tenta novamente amanhã.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const systemPrompt = [
      'És o assistente de ajuda da aplicação "Gap Analysis de Competências", uma ferramenta de RH para gerir competências, certificações, formações e planos de desenvolvimento individual de colaboradores.',
      'Respondes sempre em português de Portugal, de forma curta e direta (idealmente 2-4 frases), com base exclusivamente na documentação abaixo.',
      'Se a pergunta não tiver resposta na documentação, diz claramente que não sabes e sugere contactar um Admin RH — nunca inventes campos, botões ou regras que não estão descritos.',
      '',
      '--- DOCUMENTAÇÃO DA APLICAÇÃO ---',
      dto.contexto,
    ].join('\n');

    const mensagens = [
      ...(dto.historico ?? []).slice(-MAX_MENSAGENS_HISTORICO).map((m) => ({ role: m.role, content: m.conteudo })),
      { role: 'user', content: dto.pergunta },
    ];

    let resposta: Response;
    try {
      resposta = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_CHATBOT_MODEL || MODELO_PADRAO, max_tokens: MAX_TOKENS_RESPOSTA, system: systemPrompt, messages: mensagens }),
      });
    } catch {
      throw new ServiceUnavailableException('Não foi possível contactar o assistente de ajuda — tenta novamente dentro de momentos.');
    }

    if (!resposta.ok) {
      const corpo = await resposta.text();
      throw new ServiceUnavailableException(`Não foi possível contactar o assistente de ajuda (${resposta.status}): ${corpo.slice(0, 300)}`);
    }

    const dados = (await resposta.json()) as RespostaAnthropic;
    const texto = dados.content?.find((b) => b.type === 'text')?.text;
    if (!texto) {
      throw new ServiceUnavailableException('O assistente de ajuda não devolveu uma resposta.');
    }

    // Só regista o uso depois de confirmado que a chamada à Claude API teve sucesso — um pedido falhado não deve contar para o limite diário.
    await this.prisma.chatbotUso.create({ data: { userId: user.sub, data: hoje } });

    return { resposta: texto };
  }
}
