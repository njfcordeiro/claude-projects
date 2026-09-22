import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  Compass,
  GraduationCap,
  Layers,
  ListChecks,
  Sparkles,
  Target,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PrintButton } from '../components/ui/PrintButton';
import { endpoints } from '../api/endpoints';
import { PesosProntidao } from '../types/api';
import { AJUDA_ECRAS } from '../lib/ajudaEcras';

const PESOS_PADRAO: PesosProntidao = { pesoCompetencias: 40, pesoCertificacoes: 40, pesoPontos: 20 };

// --- Glossário: os conceitos principais, em linguagem simples --------------

interface Conceito {
  icone: typeof Target;
  titulo: string;
  paragrafos: string[];
}

const CONCEITOS: Conceito[] = [
  {
    icone: Sparkles,
    titulo: 'Competência',
    paragrafos: [
      'Uma capacidade que uma pessoa tem — por exemplo "SAP ABAP" ou "Liderança". Cada colaborador tem um nível nessa competência, de 0 (não tem) a 5 (é uma referência).',
      'Há dois tipos: Técnica (conhecimento de uma ferramenta, tecnologia ou área de trabalho) e Comportamental (uma soft skill, como comunicação ou liderança). O histórico de competências técnicas fica sempre guardado — não podem ser apagadas, só reavaliadas para um nível diferente. As comportamentais podem ser removidas, porque são atribuídas manualmente.',
    ],
  },
  {
    icone: Award,
    titulo: 'Certificação',
    paragrafos: [
      'Um certificado externo (de um fornecedor como a SAP, por exemplo) que uma pessoa obteve. Regista-se a data em que foi obtida e, se aplicável, até quando é válida.',
      'Se a data de validade passar, a certificação deixa de contar como "válida" — mesmo continuando registada. E se apagares a data de obtenção por engano, a certificação volta a ficar "em falta" (nunca fica uma linha vazia guardada).',
    ],
  },
  {
    icone: GraduationCap,
    titulo: 'Formação',
    paragrafos: [
      'Um curso ou ação de formação do catálogo. Cada vez que um colaborador conclui uma, fica registada no seu histórico com a data, as horas e se foi Aprovado, Reprovado ou se Faltou — e a mesma formação pode repetir-se (ex. reprovar e voltar a fazer).',
      'Concluir uma formação com Aprovado pode subir automaticamente o nível de uma competência, se essa formação estiver associada a ela — mas nunca desce um nível já alcançado.',
    ],
  },
  {
    icone: Layers,
    titulo: 'LOB',
    paragrafos: [
      'Uma LOB é um conjunto de exigências que define um objetivo a atingir — pensa nela como um crachá que se ganha ao reunir um conjunto de competências (a um certo nível) e, por vezes, certificações.',
      'Cada colaborador tem uma "próxima LOB" sugerida automaticamente, e pode ainda ter LOBs recomendadas pelo seu gestor direto.',
    ],
  },
  {
    icone: Target,
    titulo: 'Prontidão',
    paragrafos: [
      'Uma percentagem que resume o quanto falta a uma pessoa para atingir uma LOB. 100% significa que está tudo cumprido; abaixo disso, falta pelo menos uma coisa (uma competência, uma certificação, ou pontos suficientes).',
      'É sempre uma combinação de 3 partes — competências obrigatórias, certificações obrigatórias e pontos — cada uma com um peso configurável. Experimenta o simulador mais abaixo para veres isto em ação.',
    ],
  },
  {
    icone: Compass,
    titulo: 'Cargo e Carreira',
    paragrafos: [
      'Um Cargo é uma posição concreta (ex. "Arquiteto Sénior"). Uma Carreira é o caminho — a sequência de Cargos por onde uma pessoa pode ir progredindo.',
      'A app sabe de que Cargo se pode progredir para que outro (ver "Evolução de Carreiras"), e usa isso para sugerir quem já pode avançar (ver "Candidatos").',
    ],
  },
  {
    icone: ListChecks,
    titulo: 'PDI — Plano de Desenvolvimento Individual',
    paragrafos: [
      'A lista de "próximos passos" de cada pessoa. Pode ser gerada automaticamente (com base no que falta para as suas LOBs, ou para o cargo atual/seguinte) ou criada à mão.',
      'Cada item pode ser marcado como Pendente, Em Curso ou Concluído — e concluir um item de Certificação ou Formação pode subir automaticamente o nível de competência associado.',
    ],
  },
  {
    icone: Briefcase,
    titulo: 'Projetos',
    paragrafos: [
      'Uma forma alternativa de subir de nível numa competência, para além de Formações e Certificações: ao participar numa vertente de um projeto, a competência ligada a essa vertente sobe 1 nível (até ao máximo da escala). Cada pessoa só conta a participação num dado projeto uma vez.',
    ],
  },
];

function GlossarioConceitos() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {CONCEITOS.map((c) => {
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

function EcraAEcra() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {AJUDA_ECRAS.map((a) => (
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

const RBAC: { papel: string; label: string; descricao: string }[] = [
  { papel: 'ADMIN_RH', label: 'Admin RH', descricao: 'Vê e edita tudo — todos os colaboradores, Gestão de Dados, administração de utilizadores.' },
  { papel: 'MANAGER', label: 'Gestor', descricao: 'Vê o Dashboard, Candidatos e Skill Matrix da organização, mas só edita a ficha da sua própria equipa direta.' },
  { papel: 'EMPLOYEE', label: 'Colaborador', descricao: 'Só vê a sua própria ficha — sem acesso ao Dashboard, à lista de Colaboradores ou à Skill Matrix.' },
  { papel: 'VIEWER', label: 'Leitura', descricao: 'Vê tudo (Dashboard, Colaboradores, Candidatos, Skill Matrix, todas as fichas) mas não pode editar nada.' },
];

function TabelaRbac() {
  return (
    <div className="space-y-2">
      {RBAC.map((r) => (
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

      <Card title="Os conceitos principais">
        <GlossarioConceitos />
      </Card>

      <Card title="Ecrã a ecrã">
        <EcraAEcra />
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
