import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Building2,
  Compass,
  GraduationCap,
  Layers,
  Lock,
  Sparkles,
  Star,
  Target,
  UserCircle,
} from 'lucide-react';
import { Card } from '../components/ui/Card';
import { PrintButton } from '../components/ui/PrintButton';

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

function SimuladorMotorGap() {
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
    const obrigatoriosEmFalta = competencias.filter((c) => c.obrigatorio && !c.cumprido).length + (certCumprida ? 0 : 1);
    const atingido = pontosObtidos >= pontosMinimos && obrigatoriosEmFalta === 0;
    const prontidao = pontosMinimos > 0 ? Math.min(100, Math.round((pontosObtidos / pontosMinimos) * 100)) : 100;
    return { competencias, pontosObtidos, obrigatoriosEmFalta, atingido, prontidao, certCumprida };
  }, [requisitos, certPossui, certValida, pontosMinimos]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-fiori-text-secondary">
        Ajusta os "níveis atuais" e o botão da certificação — o resultado (prontidão, atingido?) recalcula-se em tempo real, exatamente
        com a fórmula do backend (<code className="rounded bg-fiori-canvas px-1 font-mono text-xs">gap-analysis.logic.ts</code>).
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
        <p className="mt-1 text-xs text-fiori-text-secondary">Prontidão: {resultado.prontidao}%</p>
      </div>
    </div>
  );
}

// --- Cartões de regras -------------------------------------------------------

const REGRAS = [
  {
    icone: Compass,
    titulo: 'Candidatos a carreira',
    texto:
      'Os LOBs não estão ligados a um cargo específico — "lobsAtingidos" é calculado uma vez sobre TODAS as LOBs da organização e não depende do cargo-alvo. "Quão perto está alguém de uma carreira" reduz-se a comparar isso com o cargo de entrada mais acessível dessa carreira (o de menor limiar).',
    formula: 'gap = max(0, menor(lobsExigidos entre cargos da carreira) − lobsAtingidos)',
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
    icone: Building2,
    titulo: 'Cobertura de Arquitetos por Área/Núcleo',
    texto:
      'Regra de dimensionamento pedida para o quadro "Cobertura de Arquitetos" no Dashboard: cada Área/Núcleo precisa de Arquitetos proporcionalmente à sua dimensão. Áreas/Núcleos pequenos não entram em défice — assume-se que são cobertos por Arquitetos de outras áreas ("apoio transversal"). O total de colaboradores de um Núcleo cruza a tabela "Áreas por Núcleo" com a de Colaboradores: é a soma dos colaboradores de todas as Áreas associadas a esse Núcleo (um Núcleo sem nenhuma Área associada não aparece no quadro). Quando uma Área/Núcleo está em défice, os seus colaboradores passam à frente na lista de Candidatos à carreira de Arquiteto, antes do critério de gap/prontidão.',
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

/** Documentação viva do modelo de dados e das regras de negócio — sem chamadas à API, acessível a todos os papéis autenticados. */
export function ComoFuncionaPage() {
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
        <SimuladorMotorGap />
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
