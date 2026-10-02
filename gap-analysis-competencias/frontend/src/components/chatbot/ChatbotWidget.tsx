import { FormEvent, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle, Send, X } from 'lucide-react';
import { endpoints } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { construirContextoDocumentacao } from '../../lib/documentacao';

interface Mensagem {
  role: 'user' | 'assistant';
  conteudo: string;
  erro?: boolean;
}

/**
 * Chatbot de ajuda (pedido do utilizador: "criar documentação dinâmica e
 * chatbot para ajudar") — flutuante, visível em qualquer ecrã autenticado
 * (montado em AppLayout). Responde com base na MESMA documentação do "Como
 * Funciona"/ajuda contextual (lib/documentacao.ts) — nunca inventa
 * conteúdo à parte: o texto é montado aqui e enviado ao backend a cada
 * pergunta, que só o encaixa no pedido à Claude API. Conversa efémera (não
 * persiste entre recarregamentos) — não há necessidade de histórico
 * guardado para um assistente de ajuda pontual.
 */
export function ChatbotWidget() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState('');
  const listaRef = useRef<HTMLDivElement>(null);

  const perguntar = useMutation({
    mutationFn: (texto: string) =>
      endpoints.chatbotPerguntar({
        pergunta: texto,
        contexto: construirContextoDocumentacao(),
        historico: mensagens.map((m) => ({ role: m.role, conteudo: m.conteudo })),
      }),
    onSuccess: (resultado) => {
      setMensagens((prev) => [...prev, { role: 'assistant', conteudo: resultado.resposta }]);
    },
    onError: (err) => {
      const texto = err instanceof ApiError ? err.message : 'Não foi possível contactar o assistente de ajuda — tenta novamente dentro de momentos.';
      setMensagens((prev) => [...prev, { role: 'assistant', conteudo: texto, erro: true }]);
    },
    onSettled: () => {
      requestAnimationFrame(() => listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: 'smooth' }));
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const texto = pergunta.trim();
    if (!texto || perguntar.isPending) return;
    setMensagens((prev) => [...prev, { role: 'user', conteudo: texto }]);
    setPergunta('');
    perguntar.mutate(texto);
  }

  return (
    <div className="no-print fixed bottom-5 right-5 z-50">
      {aberto && (
        <div className="mb-3 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-lg border border-fiori-border bg-fiori-surface shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-fiori-border bg-fiori-primary px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
              <MessageCircle size={16} /> Assistente de Ajuda
            </p>
            <button type="button" onClick={() => setAberto(false)} className="text-white/80 hover:text-white" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>

          <div ref={listaRef} className="flex-1 space-y-2.5 overflow-y-auto p-3">
            {mensagens.length === 0 && (
              <p className="text-sm text-fiori-text-secondary">
                Pergunta-me qualquer coisa sobre a aplicação — como funciona a prontidão, como gerar um PDI, quem pode editar o quê, etc.
              </p>
            )}
            {mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-fiori-primary text-white'
                      : m.erro
                        ? 'border border-fiori-error bg-fiori-error-bg text-fiori-error'
                        : 'bg-fiori-canvas text-fiori-text'
                  }`}
                >
                  {m.conteudo}
                </div>
              </div>
            ))}
            {perguntar.isPending && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-fiori-canvas px-3 py-2 text-sm text-fiori-text-secondary">A pensar…</div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-fiori-border p-2.5">
            <input
              type="text"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Escreve a tua pergunta…"
              className="flex-1 rounded border border-fiori-border bg-fiori-surface px-2.5 py-1.5 text-sm text-fiori-text placeholder:text-fiori-text-secondary focus:border-fiori-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!pergunta.trim() || perguntar.isPending}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-fiori-primary text-white hover:bg-fiori-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Enviar"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-fiori-primary text-white shadow-lg hover:bg-fiori-primary-hover"
        aria-label={aberto ? 'Fechar assistente de ajuda' : 'Abrir assistente de ajuda'}
      >
        {aberto ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
