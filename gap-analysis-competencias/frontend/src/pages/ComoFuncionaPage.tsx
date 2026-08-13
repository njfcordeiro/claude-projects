import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  Compass,
  Grid3x3,
  GraduationCap,
  Layers,
  Lock,
  Puzzle,
  Scale,
  Sparkles,
  Star,
  Target,
  Trash2,
  UserCircle,
  UserX,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PrintButton } from '../components/ui/PrintButton';
import { Button, Field, Input } from '../components/ui/form';
import { useAuth } from '../auth/useAuth';
import { endpoints } from '../api/endpoints';
import { PesosProntidao } from '../types/api';

const PESOS_PADRAO: PesosProntidao = { pesoCompetencias: 40, pesoCertificacoes: 40, pesoPontos: 20 };

// --- Modelo de dados: diagrama ---------------------------------------------

type ClusterId = 'organizacao' | 'catalogo' | 'pessoas';

interface NoModelo {
  id: string;
  cluster: ClusterId;
  nome: string;
  icone: typeof Building2;
  campos: string[];
  relacao: string;
}

const NOS: NoModelo[] = [
  { id: 'direcao', cluster: 'organizacao', nome: 'Direção', icone: Building2, campos: ['id', 'nome', 'relevante'], relacao: 'Nível organizacional mais alto. Um Colaborador pertence a uma Direção (opcional).' },
  { id: 'area', cluster: 'organizacao', nome: 'Área', icone: Building2, campos: ['id', 'nome', 'relevante'], relacao: 'Agrupa Competências, LOBs e Formações — e também Colaboradores diretamente.' },
  { id: 'nucleo', cluster: 'organizacao', nome: 'Núcleo', icone: Building2, campos: ['id', 'nome', 'relevante'], relacao: 'Sem ligação a Direção no modelo (confirmado com o utilizador) — é um agrupamento independente.' },
  { id: 'carreira', cluster: 'organizacao', nome: 'Carreira', icone: Compass, campos: ['id (código)', 'nome', 'relevante'], relacao: 'Um percurso (ex. "Arquiteto"), com vários Cargos possíveis ao longo do caminho.' },
  { id: 'cargo', cluster: 'organizacao', nome: 'Cargo', icone: Target, campos: ['id (código)', 'nome', 'carreiraId', 'categoriaId', 'lobsExigidos'], relacao: '"lobsExigidos" é só um número-limiar — não aponta para LOBs específicas.' },
  { id: 'categoria', cluster: 'organizacao', nome: 'Categoria', icone: Layers, campos: ['id (código)', 'nome'], relacao: 'Classificação transversal do Cargo (ex. nível hierárquico).' },

  { id: 'competencia', cluster: 'catalogo', nome: 'Competência', icone: Sparkles, campos: ['id', 'nome', 'areaId'], relacao: 'Avaliada por Colaborador numa escala única de proficiência, 0 a 5 (Nível).' },
  { id: 'certificacao', cluster: 'catalogo', nome: 'Certificação', icone: Award, campos: ['id (código)', 'nome'], relacao: 'Pode validar Competências específicas e tem data de validade por Colaborador.' },
  { id: 'formacao', cluster: 'catalogo', nome: 'Formação', icone: GraduationCap, campos: ['id', 'nome', 'areaId', 'duracaoHoras'], relacao: 'Sugerida automaticamente para colmatar lacunas de Competência.' },
  { id: 'lob', cluster: 'catalogo', nome: 'LOB', icone: Layers, campos: ['id', 'nome', 'areaId', 'pontosMinimos'], relacao: 'O motor de gap real — exige pontos de Competências e posse de Certificações.' },

  { id: 'colaborador', cluster: 'pessoas', nome: 'Colaborador', icone: UserCircle, campos: ['id', 'nome', 'cargoId', 'managerId', 'version'], relacao: 'Entidade central — liga-se a toda a Organização e ao seu próprio histórico.' },
  { id: 'avaliacao', cluster: 'pessoas', nome: 'Avaliação (histórico)', icone: Sparkles, campos: ['colaboradorId', 'competenciaId', 'nivelId', 'origem'], relacao: 'Append-only — o "nível atual" é sempre a mais recente, nunca um UPDATE.' },
  { id: 'certificacao-colab', cluster: 'pessoas', nome: 'Certificação do colaborador', icone: Award, campos: ['certificacaoId', 'dataValidade', 'version'], relacao: 'Tem locking otimista próprio, tal como o Colaborador.' },
  { id: 'pdi', cluster: 'pessoas', nome: 'PDI', icone: BookOpen, campos: ['descricao', 'estado', 'origem'], relacao: 'Gerado a partir das lacunas do motor de gap; acompanhado manualmente depois.' },
];

const CLUSTERS: { id: ClusterId; label: string; nota: string; corBorda: string; corTexto: string }[] = [
  { id: 'organizacao', label: 'Organização', nota: '→ atribuída a cada Colaborador', corBorda: 'border-t-fiori-primary', corTexto: 'text-fiori-primary' },
  { id: 'catalogo', label: 'Catálogo', nota: '→ compõe os requisitos das LOBs', corBorda: 'border-t-fiori-success', corTexto: 'text-fiori-success' },
  { id: 'pessoas', label: 'Pessoas', nota: '→ onde Organização + Catálogo se encontram', corBorda: 'border-t-fiori-warning', corTexto: 'text-fiori-warning' },
];

function DiagramaModelo() {
  const [selecionado, setSelecionado] = useState('colaborador');
  const no = NOS.find((n) => n.id === selecionado)!;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CLUSTERS.map((cluster) => (
          <div key={cluster.id} className={`rounded-md border border-fiori-border border-t-4 bg-fiori-canvas p-3 ${cluster.corBorda}`}>
            <p className={`text-sm font-semibold ${cluster.corTexto}`}>{cluster.label}</p>
            <p className="mb-2 text-xs text-fiori-text-secondary">{cluster.nota}</p>
            <div className="flex flex-wrap gap-1.5">
              {NOS.filter((n) => n.cluster === cluster.id).map((n) => {
                const Icone = n.icone;
                const ativo = n.id === selecionado;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setSelecionado(n.id)}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      ativo
                        ? 'border-fiori-primary bg-fiori-primary text-white'
                        : 'border-fiori-border bg-fiori-surface text-fiori-text hover:border-fiori-primary'
                    }`}
                  >
                    <Icone size={12} /> {n.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-fiori-border bg-fiori-primary-bg p-3">
        <div className="mb-1 flex items-center gap-2">
          <no.icone size={16} className="text-fiori-primary" />
          <p className="text-sm font-semibold text-fiori-text">{no.nome}</p>
        </div>
        <p className="mb-2 text-sm text-fiori-text-secondary">{no.relacao}</p>
        <div className="flex flex-wrap gap-1.5">
          {no.campos.map((campo) => (
            <span key={campo} className="rounded bg-fiori-surface px-1.5 py-0.5 font-mono text-[11px] text-fiori-text-secondary shadow-fiori">
              {campo}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Simulador do motor de gap ---------------------------------------------

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
    // Sem crédito parcial (mesmo princípio de calcularGapCompetencia) — uma competência
    // obrigatória conta 1 (cumprida) ou 0. LOB sem obrigatórias desse tipo conta como 1.
    const ratioComp = obrigComp.length === 0 ? 1 : obrigComp.filter((c) => c.cumprido).length / obrigComp.length;
    // A certificação do simulador é sempre obrigatória (badge fixa) — 1 obrigatória, ratio binário.
    const ratioCert = certCumprida ? 1 : 0;
    const ratioPontos = pontosMinimos > 0 ? Math.min(1, pontosObtidos / pontosMinimos) : 1;

    const obrigatoriosEmFalta = obrigComp.filter((c) => !c.cumprido).length + (certCumprida ? 0 : 1);
    const atingido = pontosObtidos >= pontosMinimos && obrigatoriosEmFalta === 0;
    const prontidao = Math.round(pesos.pesoCompetencias * ratioComp + pesos.pesoCertificacoes * ratioCert + pesos.pesoPontos * ratioPontos);

    return { competencias, pontosObtidos, obrigatoriosEmFalta, atingido, prontidao, certCumprida, ratioComp, ratioCert, ratioPontos };
  }, [requisitos, certPossui, certValida, pontosMinimos, pesos]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-fiori-text-secondary">
        Ajusta os "níveis atuais" e o botão da certificação — o resultado (prontidão, atingido?) recalcula-se em tempo real, exatamente
        com a fórmula do backend (<code className="rounded bg-fiori-canvas px-1 font-mono text-xs">gap-analysis.logic.ts</code>), usando
        os pesos atualmente configurados ({pesos.pesoCompetencias}% / {pesos.pesoCertificacoes}% / {pesos.pesoPontos}%).
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
                Nível exigido: {r.nivelExigido} · vale {r.pontos} pontos {cumprido ? '(sem crédito parcial)' : '(0 pontos — abaixo do nível exigido)'}
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
          <p className="text-xs text-fiori-text-secondary">Não vale pontos — só bloqueia se estiver em falta ou expirada.</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={certPossui} onChange={(e) => setCertPossui(e.target.checked)} className="h-4 w-4 accent-fiori-primary" />
            Possui
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={certValida} onChange={(e) => setCertValida(e.target.checked)} className="h-4 w-4 accent-fiori-primary" disabled={!certPossui} />
            Dentro da validade
          </label>
        </div>
      </div>

      <div className="space-y-2 rounded-md border border-fiori-border p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-fiori-text-secondary">Repartição por critério</p>
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
            <span className="w-24 shrink-0 text-right text-xs font-medium text-fiori-text">
              {Math.round(linha.ratio * 100)}% × {linha.peso}% = {Math.round(linha.ratio * linha.peso)}pp
            </span>
          </div>
        ))}
      </div>

      <div className={`rounded-md border p-3 ${resultado.atingido ? 'border-fiori-success bg-fiori-success-bg' : 'border-fiori-error bg-fiori-error-bg'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-semibold ${resultado.atingido ? 'text-fiori-success' : 'text-fiori-error'}`}>
            {resultado.atingido ? 'LOB atingida ✓' : 'LOB não atingida'}
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
        <p className="mt-1 text-xs text-fiori-text-secondary">
          Prontidão: {resultado.prontidao}% {resultado.atingido ? '' : resultado.prontidao === 100 ? '(nunca acontece — atingido implica sempre 100%)' : ''}
        </p>
      </div>
    </div>
  );
}

// --- Cartões de regras -------------------------------------------------------

const REGRAS = [
  {
    icone: Scale,
    titulo: 'Fórmula de Prontidão',
    texto:
      'A prontidão de uma LOB é a média ponderada de 3 critérios, cada um um rácio entre 0 e 1: Competências obrigatórias (nº cumpridas ÷ nº obrigatórias totais dessa LOB — sem crédito parcial, mesmo princípio de "cumprido"/"não cumprido" usado no resto do motor), Certificações obrigatórias (nº válidas ÷ nº obrigatórias totais) e Pontos (pontos obtidos ÷ pontos mínimos, capado a 100%). Uma LOB sem nenhuma competência (ou certificação) obrigatória conta esse critério como cumprido por vacuidade (rácio 1) — não há nada a bloquear nesse eixo. Os pesos são globais (uma única configuração para toda a organização, não por LOB) e editáveis em Gestão de Dados por ADMIN_RH, sempre a somar 100 pontos percentuais — ver secção "Pesos de Prontidão" acima. Esta fórmula garante que 100% de prontidão implica sempre LOB atingida, e vice-versa: já não é possível mostrar 100% com um obrigatório em falta.',
    formula:
      'prontidão = pesoCompetências × ratioCompetências + pesoCertificações × ratioCertificações + pesoPontos × ratioPontos · ratioPontos = mín(1, pontosObtidos ÷ pontosMínimos) · atingido ⇔ prontidão = 100%',
  },
  {
    icone: Compass,
    titulo: 'Candidatos a carreira',
    texto:
      'Escolhe-se uma Carreira e, opcionalmente, um Cargo dessa carreira (ou "Todos os cargos"). Para cada Cargo-alvo, os candidatos são os colaboradores cujo Cargo ATUAL é um predecessor direto desse Cargo na tabela Progressão de Cargos — não interessa a Carreira atual do colaborador, só essa ligação. Por isso alguém já dentro da carreira, num cargo anterior, também aparece como candidato ao próximo cargo. Um mesmo colaborador pode aparecer em mais que uma linha se o seu cargo atual progride para mais do que um Cargo-alvo. A Elegibilidade ("Apto") exige DUAS condições em relação ao Cargo-alvo dessa linha — antiguidade e LOBs — e falha se qualquer uma não se verificar, listando qual(is). A Prontidão mostrada é sempre a da "Próxima LOB" do colaborador (editável na ficha, entre as LOBs da sua Área) — nunca a média geral.',
    formula:
      'apto = aptoAntiguidade E aptoLOBs · aptoAntiguidade = anosExperienciaMinimo do cargo-alvo = 0 OU antiguidade ≥ esse mínimo · aptoLOBs = lobsAtingidas ≥ lobsExigidas do cargo-alvo',
  },
  {
    icone: Target,
    titulo: 'Objetivos de LOB',
    texto:
      'Cada colaborador tem até 3 LOBs sugeridas automaticamente pelo sistema — da sua própria Área, ainda não atingidas, pela maior % de prontidão (as mais próximas de serem alcançadas entram primeiro) — sempre calculadas ao vivo na ficha, nunca guardadas, por isso nunca ficam desatualizadas. A qualquer uma delas soma-se as LOBs recomendadas manualmente pelo BUD (o gestor direto do colaborador, ou ADMIN_RH — mesma permissão de escrita do resto da ficha): sem limite de quantidade, e sem obrigação de pertencerem à Área do colaborador. Todas em conjunto formam os "objetivos de LOB" desse colaborador.',
    formula: 'auto = até 3 LOBs da Área, não atingidas, ordenadas por prontidão desc · bud = recomendações do gestor/ADMIN_RH (sem restrição de Área)',
  },
  {
    icone: Layers,
    titulo: 'Quadro de LOBs — filtro por Área',
    texto:
      'Na ficha do colaborador, o quadro de LOBs mostra, por omissão, só as LOBs da Área do colaborador — um seletor "Área do colaborador" / "Todas as LOBs" alterna para ver o catálogo completo. Sem Área definida, mostra sempre todas. O quadro fica lado a lado com o Detalhe da LOB selecionada, num ecrã largo o suficiente.',
    formula: 'lobsExibidas = todasAsLobs SE mostrarTodas OU colaborador sem área, senão lobs.filter(lob.areaId === colaborador.areaId)',
  },
  {
    icone: Sparkles,
    titulo: 'PDI — sugestões automáticas',
    texto:
      '"Gerar sugestões" já não visa uma única LOB: percorre TODOS os objetivos de LOB ativos do colaborador (sistema + BUD, ver "Objetivos de LOB" acima) e sugere o que estiver em falta em cada uma, sem duplicar entre elas. No PDI, os itens aparecem separados em 3 grupos, por esta ordem: "Recomendadas pelo BUD", "Sugeridas pelo sistema" e "Outras competências" (itens manuais, ou cuja LOB de origem já não é um objetivo atual); dentro de "Recomendadas pelo BUD" e "Sugeridas pelo sistema", os itens aparecem ainda sub-agrupados pela LOB de origem. Se uma LOB for, ao mesmo tempo, sugestão do sistema e recomendação do BUD, os seus itens contam para o grupo BUD. Qualquer item — gerado ou adicionado manualmente — pode ser eliminado, e "Gerar sugestões" pode ser chamado de novo a qualquer momento (não duplica o que já existe).',
    formula: 'itens sugeridos = ⋃ᴸᴼᴮ∈objetivos { competências/certificações em falta nessa LOB }, sem duplicados · grupo do item = BUD, senão Sistema, senão Outras · sub-agrupado por LOB dentro de BUD/Sistema',
  },
  {
    icone: Puzzle,
    titulo: 'Projetos — subir de nível por participação',
    texto:
      'Via alternativa a Formação/Certificação para o colaborador subir de nível numa competência. Um Projeto (catálogo, gerido em Gestão de Dados) tem uma ou mais Vertentes, cada uma ligada a UMA competência. Ao registar a participação de um colaborador num projeto, escolhe-se em quais vertentes participou (no mínimo uma, pode ser mais do que uma) — é assim que se indica quais competências vão ser desenvolvidas por essa participação. Cada vertente escolhida sobe sempre +1 nível na sua competência (nunca leva a um nível fixo, ao contrário de Formação/Certificação), capado ao nível máximo da escala (0-5). Um colaborador só participa num dado projeto uma única vez — depois de registada a participação, esse projeto deixa de ser sugerido. As vertentes disponíveis aparecem como sugestão junto de cada competência em falta na Ficha do Colaborador (Detalhe da LOB), ao lado de Formações e Certificações.',
    formula: 'nível novo = mín(nível atual + 1, nível máximo da escala) por cada vertente escolhida · 1 participação por colaborador+projeto',
  },
  {
    icone: AlertTriangle,
    titulo: 'Risco de fuga de talento',
    texto:
      'Heurística explícita, não um facto medido (não há dados de rotatividade no modelo): identifica quem está pronto há tempo, sem próximo passo de carreira visível.',
    formula: 'prontidão ≥ 85% E ≥ 2 anos no cargo atual E cargo sem entrada em cargo_progressao',
  },
  {
    icone: Star,
    titulo: 'Relevância',
    texto:
      'Direção, Área e Núcleo têm um campo "relevante", editável em Gestão de Dados. Um colaborador é considerado "relevante" no ecrã de Colaboradores se pertencer a QUALQUER uma das três marcada como tal.',
    formula: 'relevante(colaborador) = direção.relevante OU área.relevante OU núcleo.relevante',
  },
  {
    icone: Lock,
    titulo: 'Locking otimista',
    texto:
      'Colaborador e a Certificação do colaborador têm um campo "version", incrementado a cada escrita. Um pedido de atualização tem de enviar a versão que leu — se já não bater certo, o backend rejeita em vez de sobrescrever silenciosamente a alteração de outra pessoa.',
    formula: 'PATCH devolve 409 Conflict se version enviada ≠ version atual na base de dados',
  },
  {
    icone: UserCircle,
    titulo: 'Nível de Gestão e Local de Trabalho',
    texto:
      'Dois atributos adicionais do colaborador, editáveis na ficha (secção ADMIN_RH): "Nível de Gestão" (ex. BUD, BUM, Team Leader) e "Local de Trabalho". As opções vêm de duas tabelas de catálogo geridas em Gestão de Dados ("Níveis de Gestão" e "Locais de Trabalho") — não são texto livre. Ambos aparecem como colunas na lista de Colaboradores e no Dashboard, e podem ser usados como dimensão de agrupamento no Dashboard e na Skill Matrix.',
    formula: 'colaborador.nivelGestaoId → niveis_gestao · colaborador.localTrabalhoId → locais_trabalho',
  },
  {
    icone: UserX,
    titulo: 'Colaboradores inativos',
    texto:
      'O campo "Estado" (Ativo/Inativo) na ficha do colaborador — pedido do utilizador: colaboradores inativos são excluídos de toda a análise agregada: Dashboard (KPIs, gráfico de prontidão, tabela de colaboradores), Skill Matrix e Candidatos a carreira. Continuam visíveis e geríveis no ecrã de Colaboradores (com filtro "Estado: Todos/Ativos/Inativos"), e a ficha individual de um colaborador inativo continua acessível. Se um colaborador for desativado sem lhe reatribuir a equipa primeiro, um alerta aparece nos Insights automáticos do Dashboard e na própria ficha desse colaborador.',
    formula: 'calcularResumos/obterSkillMatrix filtram sempre ativo = true, independentemente dos restantes filtros',
  },
  {
    icone: Trash2,
    titulo: 'Eliminar um colaborador',
    texto:
      'Pedido do utilizador: eliminar um colaborador tem de ser sempre possível, independentemente de estar associado a outros dados. Registos que lhe pertencem (avaliações, certificações, recomendações de LOB, PDI) são eliminados em cascata junto com ele. Referências vindas de outro lado ficam a null em vez de bloquear a eliminação: colaboradores que o tinham como gestor ficam sem gestor definido, e a conta de utilizador associada perde a ligação (a conta em si não é eliminada).',
    formula: 'onDelete: Cascade nos dados do próprio colaborador · onDelete: SetNull nas referências de outros para ele (managerId, users.colaboradorId)',
  },
  {
    icone: Grid3x3,
    titulo: 'Skill Matrix — edição e importação em massa de níveis',
    texto:
      'No separador "Por Competência", clicar numa célula abre o mesmo formulário de avaliação da ficha do colaborador (locking otimista incluído) — disponível para ADMIN_RH e MANAGER (dentro da sua equipa). "Download níveis" exporta exatamente as colunas visíveis (respeitando os filtros ativos) num ficheiro com o id e o nome associado lado a lado (colaboradorId/Colaborador, competenciaId/Competência, nivelId/Nível); reenviar esse mesmo ficheiro em "Upload níveis" só grava uma nova avaliação (histórico append-only) para as linhas cujo nível pedido é diferente do nível atual — reenviar sem alterações não cria ruído no histórico. Os colaboradores podem ainda ser agrupados em blocos por Direção, Área, Núcleo ou Núcleo+Área, tal como as LOBs (separador "Por LOB") são agrupadas visualmente por Área.',
    formula: 'grava nova avaliação apenas se nivelId do ficheiro ≠ nível atual do colaborador nessa competência',
  },
  {
    icone: Building2,
    titulo: 'Cobertura de Arquitetos por Área/Núcleo',
    texto:
      'Regra de dimensionamento pedida para o quadro "Cobertura de Arquitetos" no Dashboard: cada combinação Núcleo/Área precisa de Arquitetos proporcionalmente à sua dimensão. Combinações pequenas não entram em défice — assume-se que são cobertas por Arquitetos de outras áreas ("apoio transversal"). Uma linha por combinação Núcleo/Área (tabela "Áreas por Núcleo"), contando só colaboradores cuja Área E Núcleo próprios batem certo com essa combinação — não só a Área. Áreas sem nenhum Núcleo associado mostram uma linha própria com o total da Área inteira. Quando uma combinação está em défice, os seus colaboradores passam à frente na lista de Candidatos à carreira de Arquiteto, logo a seguir à elegibilidade por antiguidade e antes do critério de gap/prontidão.',
    formula:
      'exigidos = 0 se colaboradores < 10, senão max(1, arredondar para cima de colaboradores/10) · défice = max(0, exigidos − arquitetos)',
  },
];

function CartoesRegras() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {REGRAS.map((r) => {
        const Icone = r.icone;
        return (
          <div key={r.titulo} className="rounded-md border border-fiori-border p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <Icone size={16} className="text-fiori-primary" />
              <p className="text-sm font-semibold text-fiori-text">{r.titulo}</p>
            </div>
            <p className="mb-2 text-sm text-fiori-text-secondary">{r.texto}</p>
            <code className="block rounded bg-fiori-canvas px-2 py-1 font-mono text-[11px] text-fiori-text">{r.formula}</code>
          </div>
        );
      })}
    </div>
  );
}

// --- Pesos de Prontidão -------------------------------------------------------

const CRITERIOS_PESO: { chave: keyof PesosProntidao; label: string; calculo: string }[] = [
  { chave: 'pesoCompetencias', label: 'Competências obrigatórias', calculo: 'nº obrigatórias cumpridas ÷ nº obrigatórias totais' },
  { chave: 'pesoCertificacoes', label: 'Certificações obrigatórias', calculo: 'nº obrigatórias válidas ÷ nº obrigatórias totais' },
  { chave: 'pesoPontos', label: 'Pontos mínimos', calculo: 'mín(1, pontos obtidos ÷ pontos mínimos)' },
];

/** Leitura para todos os papéis; edição só para ADMIN_RH (mesmo RBAC do backend, ver ConfiguracaoProntidaoController). */
function SecaoPesosProntidao({ pesos, podeEditar }: { pesos: PesosProntidao; podeEditar: boolean }) {
  const queryClient = useQueryClient();
  const [aEditar, setAEditar] = useState(false);
  const [rascunho, setRascunho] = useState<PesosProntidao>(pesos);

  const soma = rascunho.pesoCompetencias + rascunho.pesoCertificacoes + rascunho.pesoPontos;
  const somaValida = soma === 100;

  const atualizar = useMutation({
    mutationFn: () => endpoints.atualizarConfiguracaoProntidao(rascunho),
    onSuccess: (novo) => {
      queryClient.setQueryData(['configuracao-prontidao'], novo);
      setAEditar(false);
    },
  });

  function iniciarEdicao() {
    setRascunho(pesos);
    atualizar.reset();
    setAEditar(true);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-fiori-text-secondary">
        Os pesos que o motor de gap usa para calcular a prontidão de uma LOB (ver "Fórmula de Prontidão" nas regras de negócio abaixo) —
        configuração global, aplicada a toda a organização, não por LOB.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-fiori-border text-xs uppercase tracking-wide text-fiori-text-secondary">
              <th className="py-2 pr-3">Critério</th>
              <th className="py-2 pr-3">Peso</th>
              <th className="py-2">Cálculo dentro do critério</th>
            </tr>
          </thead>
          <tbody>
            {CRITERIOS_PESO.map((c) => (
              <tr key={c.chave} className="border-b border-fiori-border last:border-0">
                <td className="py-2 pr-3 font-medium text-fiori-text">{c.label}</td>
                <td className="py-2 pr-3">
                  {aEditar ? (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={rascunho[c.chave]}
                      onChange={(e) => setRascunho((prev) => ({ ...prev, [c.chave]: Math.max(0, Math.min(100, Number(e.target.value))) }))}
                      className="w-20"
                    />
                  ) : (
                    <span className="font-semibold text-fiori-primary">{pesos[c.chave]}%</span>
                  )}
                </td>
                <td className="py-2 font-mono text-xs text-fiori-text-secondary">{c.calculo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {aEditar && (
        <p className={`text-xs font-medium ${somaValida ? 'text-fiori-success' : 'text-fiori-error'}`}>
          Soma: {soma}% {somaValida ? '✓' : '— os três pesos têm de somar exatamente 100%'}
        </p>
      )}

      {atualizar.isError && <p className="text-xs text-fiori-error">Não foi possível guardar. Tenta novamente.</p>}

      {podeEditar && (
        <div className="flex gap-2">
          {aEditar ? (
            <>
              <Button onClick={() => atualizar.mutate()} disabled={!somaValida || atualizar.isPending}>
                {atualizar.isPending ? 'A guardar…' : 'Guardar pesos'}
              </Button>
              <Button variant="secondary" onClick={() => setAEditar(false)} disabled={atualizar.isPending}>
                Cancelar
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={iniciarEdicao}>
              Editar pesos
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Tabela RBAC --------------------------------------------------------------

const RBAC: { papel: string; dashboard: boolean; colaboradores: boolean; candidatosSkill: boolean; fichaPessoal: string; gestaoDados: boolean }[] = [
  { papel: 'ADMIN_RH', dashboard: true, colaboradores: true, candidatosSkill: true, fichaPessoal: 'Todas', gestaoDados: true },
  { papel: 'MANAGER', dashboard: true, colaboradores: false, candidatosSkill: true, fichaPessoal: 'A sua equipa direta', gestaoDados: false },
  { papel: 'EMPLOYEE', dashboard: false, colaboradores: false, candidatosSkill: false, fichaPessoal: 'Só a própria', gestaoDados: false },
  { papel: 'VIEWER', dashboard: true, colaboradores: true, candidatosSkill: true, fichaPessoal: 'Todas (leitura)', gestaoDados: false },
];

function Marca({ v }: { v: boolean }) {
  return <span className={v ? 'text-fiori-success' : 'text-fiori-text-secondary'}>{v ? '✓' : '—'}</span>;
}

function TabelaRbac() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-fiori-border text-xs uppercase tracking-wide text-fiori-text-secondary">
            <th className="py-2 pr-3">Papel</th>
            <th className="py-2 pr-3">Dashboard / Insights</th>
            <th className="py-2 pr-3">Lista de Colaboradores</th>
            <th className="py-2 pr-3">Candidatos / Skill Matrix</th>
            <th className="py-2 pr-3">Ficha pessoal</th>
            <th className="py-2">Gestão de Dados / Admin</th>
          </tr>
        </thead>
        <tbody>
          {RBAC.map((r) => (
            <tr key={r.papel} className="border-b border-fiori-border last:border-0">
              <td className="py-2 pr-3 font-medium text-fiori-text">{r.papel}</td>
              <td className="py-2 pr-3">
                <Marca v={r.dashboard} />
              </td>
              <td className="py-2 pr-3">
                <Marca v={r.colaboradores} />
              </td>
              <td className="py-2 pr-3">
                <Marca v={r.candidatosSkill} />
              </td>
              <td className="py-2 pr-3 text-fiori-text-secondary">{r.fichaPessoal}</td>
              <td className="py-2">
                <Marca v={r.gestaoDados} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Página -------------------------------------------------------------------

/** Documentação viva do modelo de dados e das regras de negócio, acessível a todos os papéis autenticados — a única chamada à API é a leitura/edição dos pesos de prontidão. */
export function ComoFuncionaPage() {
  const { user } = useAuth();
  const { data: pesos } = useQuery({ queryKey: ['configuracao-prontidao'], queryFn: endpoints.configuracaoProntidao });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Como Funciona</h1>
          <p className="text-sm text-fiori-text-secondary">O modelo de dados e as regras de negócio por trás de cada número que vês na app.</p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card title="Modelo de dados">
        <DiagramaModelo />
      </Card>

      <Card title="Motor de gap — experimenta">
        <SimuladorMotorGap pesos={pesos ?? PESOS_PADRAO} />
      </Card>

      <Card title="Pesos de Prontidão">
        <SecaoPesosProntidao pesos={pesos ?? PESOS_PADRAO} podeEditar={user?.role === 'ADMIN_RH'} />
      </Card>

      <Card title="Regras de negócio">
        <CartoesRegras />
      </Card>

      <Card title="Quem vê o quê (RBAC)">
        <TabelaRbac />
      </Card>
    </div>
  );
}
