import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  Compass,
  GraduationCap,
  Layers,
  ListChecks,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PrintButton } from '../components/ui/PrintButton';
import { endpoints } from '../api/endpoints';
import { PesosProntidao } from '../types/api';
import { AJUDA_ECRAS, AjudaEcra } from '../lib/ajudaEcras';
import { CONCEITOS_DOC, RBAC_DOC } from '../lib/documentacao';

const PESOS_PADRAO: PesosProntidao = { pesoCompetencias: 40, pesoCertificacoes: 40, pesoPontos: 20 };

// --- Glossário: os conceitos principais, em linguagem simples --------------
// Texto vem de lib/documentacao.ts (fonte única, partilhada com o chatbot de
// ajuda) — aqui só se associa um ícone a cada conceito pela `chave`.

const ICONE_POR_CHAVE: Record<string, typeof Target> = {
  competencia: Sparkles,
  certificacao: Award,
  formacao: GraduationCap,
  lob: Layers,
  prontidao: Target,
  'cargo-carreira': Compass,
  'proximo-cargo': TrendingUp,
  pdi: ListChecks,
  projetos: Briefcase,
};

const CONCEITOS = CONCEITOS_DOC.map((c) => ({ ...c, icone: ICONE_POR_CHAVE[c.chave] ?? Sparkles }));

/** Texto simples (título + todos os parágrafos) usado pela pesquisa — case-insensitive, sem acentuar-sensibilidade (mesma regra simples do DataTable). */
function corresponde(titulo: string, paragrafos: string[], pesquisa: string): boolean {
  if (!pesquisa) return true;
  const alvo = pesquisa.toLowerCase();
  return titulo.toLowerCase().includes(alvo) || paragrafos.some((p) => p.toLowerCase().includes(alvo));
}

function GlossarioConceitos({ pesquisa }: { pesquisa: string }) {
  const conceitos = CONCEITOS.filter((c) => corresponde(c.titulo, c.paragrafos, pesquisa));
  if (conceitos.length === 0) {
    return <p className="text-sm text-fiori-text-secondary">Nenhum conceito corresponde a "{pesquisa}".</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {conceitos.map((c) => {
        const Icone = c.icone;
        return (
          <div key={c.titulo} className="rounded-md border border-fiori-border p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Icone size={16} className="text-fiori-primary" />
              <p className="text-sm font-semibold text-fiori-text">{c.titulo}</p>
            </div>
            {c.paragrafos.map((p, i) => (
              <p key={i} className="mb-1.5 text-sm text-fiori-text-secondary last:mb-0">
                {p}
              </p>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// --- Ecrã a ecrã (reaproveita o mesmo conteúdo dos ícones de ajuda) --------

function EcraAEcra({ pesquisa }: { pesquisa: string }) {
  const ecras = AJUDA_ECRAS.filter((a: AjudaEcra) => corresponde(a.titulo, a.paragrafos, pesquisa));
  if (ecras.length === 0) {
    return <p className="text-sm text-fiori-text-secondary">Nenhum ecrã corresponde a "{pesquisa}".</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {ecras.map((a) => (
        <div key={a.id} className="rounded-md border border-fiori-border p-3">
          <p className="mb-1.5 text-sm font-semibold text-fiori-text">{a.titulo}</p>
          {a.paragrafos.map((p, i) => (
            <p key={i} className="mb-1.5 text-sm text-fiori-text-secondary last:mb-0">
              {p}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// --- Simulador do motor de gap — experimenta o cálculo de prontidão --------

interface RequisitoSimulado {
  nome: string;
  obrigatorio: boolean;
  pontos: number;
  nivelExigido: number;
  nivelAtual: number;
}

const REQUISITOS_INICIAIS: RequisitoSimulado[] = [
  { nome: 'SAP ABAP', obrigatorio: true, pontos: 3, nivelExigido: 3, nivelAtual: 2 },
  { nome: 'Modelação de Dados', obrigatorio: false, pontos: 2, nivelExigido: 2, nivelAtual: 3 },
  { nome: 'Gestão de Projeto', obrigatorio: true, pontos: 3, nivelExigido: 2, nivelAtual: 2 },
];

function SimuladorMotorGap({ pesos }: { pesos: PesosProntidao }) {
  const [pontosMinimos, setPontosMinimos] = useState(6);
  const [requisitos, setRequisitos] = useState(REQUISITOS_INICIAIS);
  const [certPossui, setCertPossui] = useState(true);
  const [certValida, setCertValida] = useState(true);

  function atualizarNivel(idx: number, valor: number) {
    setRequisitos((prev) => prev.map((r, i) => (i === idx ? { ...r, nivelAtual: valor } : r)));
  }

  const resultado = useMemo(() => {
    const competencias = requisitos.map((r) => {
      const cumprido = r.nivelAtual >= r.nivelExigido;
      return { ...r, cumprido, pontosObtidos: cumprido ? r.pontos : 0 };
    });
    const pontosObtidos = competencias.reduce((soma, c) => soma + c.pontosObtidos, 0);
    const certCumprida = certPossui && certValida;

    const obrigComp = competencias.filter((c) => c.obrigatorio);
    const ratioComp = obrigComp.length === 0 ? 1 : obrigComp.filter((c) => c.cumprido).length / obrigComp.length;
    const ratioCert = certCumprida ? 1 : 0;
    const ratioPontos = pontosMinimos > 0 ? Math.min(1, pontosObtidos / pontosMinimos) : 1;

    const obrigatoriosEmFalta = obrigComp.filter((c) => !c.cumprido).length + (certCumprida ? 0 : 1);
    const atingido = pontosObtidos >= pontosMinimos && obrigatoriosEmFalta === 0;
    const prontidao = Math.round(pesos.pesoCompetencias * ratioComp + pesos.pesoCertificacoes * ratioCert + pesos.pesoPontos * ratioPontos);

    return { competencias, pontosObtidos, obrigatoriosEmFalta, atingido, prontidao, ratioComp, ratioCert, ratioPontos };
  }, [requisitos, certPossui, certValida, pontosMinimos, pesos]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-fiori-text-secondary">
        Esta é uma LOB de exemplo. Mexe nos "níveis atuais" e no botão da certificação — o resultado (prontidão, atingiu ou não) recalcula-se
        logo, exatamente como aconteceria na aplicação a sério, usando os pesos atualmente configurados ({pesos.pesoCompetencias}% /{' '}
        {pesos.pesoCertificacoes}% / {pesos.pesoPontos}%).
      </p>

      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-fiori-text-secondary" htmlFor="pontos-minimos">
          Pontos mínimos da LOB
        </label>
        <input
          id="pontos-minimos"
          type="number"
          min={1}
          value={pontosMinimos}
          onChange={(e) => setPontosMinimos(Math.max(1, Number(e.target.value)))}
          className="w-16 rounded border border-fiori-border px-2 py-1 text-sm"
        />
      </div>

      {requisitos.map((r, idx) => {
        const cumprido = r.nivelAtual >= r.nivelExigido;
        return (
          <div key={r.nome} className="flex flex-col gap-2 rounded border border-fiori-border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-fiori-text">
                {r.nome}{' '}
                {r.obrigatorio && (
                  <span className="ml-1 rounded bg-fiori-error-bg px-1.5 py-0.5 text-[10px] font-semibold text-fiori-error">OBRIGATÓRIA</span>
                )}
              </p>
              <p className="text-xs text-fiori-text-secondary">
                Nível exigido: {r.nivelExigido} · vale {r.pontos} pontos {cumprido ? '(cumprida)' : '(0 pontos — ainda não chegou ao nível exigido)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-fiori-text-secondary">Nível atual</span>
              <input
                type="range"
                min={0}
                max={5}
                value={r.nivelAtual}
                onChange={(e) => atualizarNivel(idx, Number(e.target.value))}
                className="w-32 accent-fiori-primary"
              />
              <span className={`w-5 text-center text-sm font-semibold ${cumprido ? 'text-fiori-success' : 'text-fiori-error'}`}>{r.nivelAtual}</span>
            </div>
          </div>
        );
      })}

      <div className="flex flex-col gap-2 rounded border border-fiori-border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-fiori-text">
            Certificação X <span className="ml-1 rounded bg-fiori-error-bg px-1.5 py-0.5 text-[10px] font-semibold text-fiori-error">OBRIGATÓRIA</span>
          </p>
          <p className="text-xs text-fiori-text-secondary">Não vale pontos — só bloqueia a LOB se estiver em falta ou expirada.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={certPossui} onChange={(e) => setCertPossui(e.target.checked)} className="h-4 w-4 accent-fiori-primary" />
            Possui
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={certValida}
              onChange={(e) => setCertValida(e.target.checked)}
              className="h-4 w-4 accent-fiori-primary"
              disabled={!certPossui}
            />
            Dentro da validade
          </label>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-fiori-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">Como se chegou a este resultado</p>
        {(
          [
            { label: `Competências obrigatórias (${pesos.pesoCompetencias}%)`, ratio: resultado.ratioComp, peso: pesos.pesoCompetencias, cor: 'bg-fiori-primary' },
            { label: `Certificações obrigatórias (${pesos.pesoCertificacoes}%)`, ratio: resultado.ratioCert, peso: pesos.pesoCertificacoes, cor: 'bg-fiori-warning' },
            { label: `Pontos mínimos (${pesos.pesoPontos}%)`, ratio: resultado.ratioPontos, peso: pesos.pesoPontos, cor: 'bg-fiori-success' },
          ] as const
        ).map((linha) => (
          <div key={linha.label} className="flex items-center gap-2">
            <span className="w-56 shrink-0 text-xs text-fiori-text-secondary">{linha.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-fiori-surface">
              <div className={`h-full rounded-full ${linha.cor}`} style={{ width: `${Math.round(linha.ratio * 100)}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-medium text-fiori-text">{Math.round(linha.ratio * 100)}%</span>
          </div>
        ))}
      </div>

      <div className={`rounded-md border p-3 ${resultado.atingido ? 'border-fiori-success bg-fiori-success-bg' : 'border-fiori-error bg-fiori-error-bg'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${resultado.atingido ? 'text-fiori-success' : 'text-fiori-error'}`}>
            {resultado.atingido ? 'LOB atingida ✓' : 'LOB ainda não atingida'}
          </p>
          <p className="text-xs text-fiori-text-secondary">
            {resultado.pontosObtidos} / {pontosMinimos} pontos · {resultado.obrigatoriosEmFalta} obrigatório
            {resultado.obrigatoriosEmFalta === 1 ? '' : 's'} em falta
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-fiori-surface">
          <div
            className={`h-full rounded-full transition-all ${resultado.atingido ? 'bg-fiori-success' : 'bg-fiori-primary'}`}
            style={{ width: `${resultado.prontidao}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-fiori-text-secondary">Prontidão: {resultado.prontidao}%</p>
      </div>
    </div>
  );
}

// --- Pesos de Prontidão -------------------------------------------------------

const CRITERIOS_PESO: { chave: keyof PesosProntidao; label: string; explicacao: string }[] = [
  { chave: 'pesoCompetencias', label: 'Competências obrigatórias', explicacao: 'quantas das obrigatórias já estão cumpridas' },
  { chave: 'pesoCertificacoes', label: 'Certificações obrigatórias', explicacao: 'quantas das obrigatórias já são válidas' },
  { chave: 'pesoPontos', label: 'Pontos mínimos', explicacao: 'quantos pontos já foram somados, até ao mínimo exigido' },
];

/** Documentação viva (sem edição — os pesos só mudam em Gestão de Dados) — mostra os pesos atuais em uso. */
function SecaoPesosProntidao({ pesos }: { pesos: PesosProntidao }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-fiori-text-secondary">
        A prontidão de uma LOB junta 3 critérios, cada um com um peso — a soma dos 3 pesos é sempre 100%. É uma configuração única para toda
        a organização (não varia por LOB), e só um Admin RH a pode mudar, em Gestão de Dados.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {CRITERIOS_PESO.map((c) => (
          <div key={c.chave} className="rounded-md border border-fiori-border p-3 text-center">
            <p className="text-2xl font-bold text-fiori-primary">{pesos[c.chave]}%</p>
            <p className="text-sm font-medium text-fiori-text">{c.label}</p>
            <p className="mt-1 text-xs text-fiori-text-secondary">{c.explicacao}</p>
          </div>
        ))}
      </div>
      <p className="text-xs italic text-fiori-text-secondary">
        Se uma LOB não tiver nenhuma competência (ou certificação) obrigatória, esse critério conta automaticamente como cumprido — não há
        nada nesse aspeto a bloquear a LOB.
      </p>
    </div>
  );
}

// --- Quem vê o quê -------------------------------------------------------------
// Texto vem de lib/documentacao.ts (RBAC_DOC) — fonte única, partilhada com o chatbot de ajuda.

function TabelaRbac() {
  return (
    <div className="space-y-2">
      {RBAC_DOC.map((r) => (
        <div key={r.papel} className="flex flex-col gap-1 rounded-md border border-fiori-border p-3 sm:flex-row sm:items-baseline sm:gap-3">
          <span className="shrink-0 rounded bg-fiori-primary-bg px-2 py-0.5 text-xs font-semibold text-fiori-primary sm:w-28">{r.label}</span>
          <p className="text-sm text-fiori-text-secondary">{r.descricao}</p>
        </div>
      ))}
    </div>
  );
}

// --- Página -------------------------------------------------------------------

/**
 * Guia de utilização, escrito para quem usa a aplicação no dia a dia — não
 * é documentação técnica. Pedido do utilizador: "está muito confusa. Refaz
 * para que seja intuitivo... como se fosse para dummies." Acessível a
 * todos os papéis autenticados.
 */
export function ComoFuncionaPage() {
  const { data: pesos } = useQuery({ queryKey: ['configuracao-prontidao'], queryFn: endpoints.configuracaoProntidao });
  const [pesquisa, setPesquisa] = useState('');

  const totalResultados = useMemo(() => {
    if (!pesquisa) return null;
    const nosConceitos = CONCEITOS.filter((c) => corresponde(c.titulo, c.paragrafos, pesquisa)).length;
    const nosEcras = AJUDA_ECRAS.filter((a) => corresponde(a.titulo, a.paragrafos, pesquisa)).length;
    return nosConceitos + nosEcras;
  }, [pesquisa]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Como Funciona</h1>
          <p className="text-sm text-fiori-text-secondary">
            Um guia simples da aplicação: o que cada ecrã faz, e como os conceitos principais se encaixam.
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <div className="no-print">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fiori-text-secondary" />
          <input
            type="text"
            value={pesquisa}
            onChange={(e) => setPesquisa(e.target.value)}
            placeholder="Pesquisar nos conceitos e nos ecrãs — ex. 'certificação', 'nível', 'próximo cargo'…"
            className="w-full rounded border border-fiori-border bg-fiori-surface py-2 pl-8 pr-3 text-sm text-fiori-text placeholder:text-fiori-text-secondary focus:border-fiori-primary focus:outline-none"
          />
        </div>
        {totalResultados !== null && (
          <p className="mt-1.5 text-xs text-fiori-text-secondary">
            {totalResultados} resultado{totalResultados === 1 ? '' : 's'} para "{pesquisa}".
          </p>
        )}
      </div>

      <Card title="Os conceitos principais">
        <GlossarioConceitos pesquisa={pesquisa} />
      </Card>

      <Card title="Ecrã a ecrã">
        <EcraAEcra pesquisa={pesquisa} />
      </Card>

      <Card title="Experimenta: como se calcula a prontidão de uma LOB">
        <SimuladorMotorGap pesos={pesos ?? PESOS_PADRAO} />
      </Card>

      <Card title="Os pesos usados no cálculo">
        <SecaoPesosProntidao pesos={pesos ?? PESOS_PADRAO} />
      </Card>

      <Card title="Quem vê o quê">
        <TabelaRbac />
      </Card>
    </div>
  );
}
