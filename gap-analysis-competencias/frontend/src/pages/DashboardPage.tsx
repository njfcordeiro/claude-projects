import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lightbulb } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { Card } from '../components/ui/Card';
import { KpiTile } from '../components/ui/KpiTile';
import { ReadinessBarChart } from '../components/ui/ReadinessBarChart';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { PrintButton } from '../components/ui/PrintButton';
import { CoberturaArquitetos, DashboardResponse } from '../types/api';

const DIMENSOES: {
  chave: keyof Pick<
    DashboardResponse,
    'porDirecao' | 'porArea' | 'porNucleo' | 'porCargo' | 'porCarreira' | 'porNivelGestao' | 'porLocalTrabalho'
  >;
  label: string;
}[] = [
  { chave: 'porDirecao', label: 'Direção' },
  { chave: 'porArea', label: 'Área' },
  { chave: 'porNucleo', label: 'Núcleo' },
  { chave: 'porCargo', label: 'Cargo' },
  { chave: 'porCarreira', label: 'Carreira' },
  { chave: 'porNivelGestao', label: 'Nível de Gestão' },
  { chave: 'porLocalTrabalho', label: 'Local de Trabalho' },
];

/** Visão geral de gaps por equipa/categoria (docs Prompt 4). ADMIN_RH/VIEWER veem a organização; MANAGER só a sua equipa. */
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: endpoints.dashboard });
  const [dimensao, setDimensao] = useState<(typeof DIMENSOES)[number]['chave']>('porDirecao');

  if (isLoading) return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  if (error) return <p className="text-sm text-fiori-error">Não foi possível carregar o dashboard.</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Dashboard</h1>
          <p className="text-sm text-fiori-text-secondary">
            {user?.role === 'MANAGER' ? 'Prontidão da tua equipa direta para os respetivos cargos.' : 'Prontidão de toda a organização para os respetivos cargos.'}
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile label="Colaboradores avaliados" value={data.totalColaboradores} />
        <KpiTile
          label="Prontidão média"
          value={`${data.prontidaoMediaGeral}%`}
          tone={data.prontidaoMediaGeral >= 60 ? 'success' : 'warning'}
        />
        <KpiTile
          label="Em risco (gap > 0)"
          value={data.colaboradoresEmRisco}
          tone={data.colaboradoresEmRisco > 0 ? 'warning' : 'success'}
          hint="Colaboradores sem as LOBs exigidas pelo cargo atingidas"
        />
      </div>

      {data.insights.length > 0 && (
        <Card title="Insights automáticos">
          <ul className="space-y-2">
            {data.insights.map((texto, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-fiori-text">
                <Lightbulb size={15} className="mt-0.5 shrink-0 text-fiori-primary" />
                {texto}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.colaboradoresEmRiscoFuga.length > 0 && (
        <Card title="Risco de Fuga de Talento">
          <p className="mb-3 text-xs text-fiori-text-secondary">
            Heurística: alta prontidão, há vários anos no mesmo cargo, sem progressão de carreira definida — não é um facto medido, é um sinal para investigar.
          </p>
          <div className="space-y-2">
            {data.colaboradoresEmRiscoFuga.map((r) => (
              <button
                key={r.colaboradorId}
                type="button"
                onClick={() => navigate(`/colaboradores/${r.colaboradorId}`)}
                className="flex w-full items-start justify-between gap-3 rounded border border-fiori-warning/40 bg-fiori-warning-bg px-3 py-2 text-left"
              >
                <span className="flex items-start gap-2">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-fiori-warning" />
                  <span>
                    <span className="block text-sm font-medium text-fiori-text">
                      {r.nome} <span className="font-normal text-fiori-text-secondary">· {r.cargoNome}</span>
                    </span>
                    <span className="block text-xs text-fiori-text-secondary">{r.motivo}</span>
                  </span>
                </span>
                <Badge status="warning">{r.prontidaoMedia}%</Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={`Prontidão média por ${DIMENSOES.find((d) => d.chave === dimensao)!.label.toLowerCase()}`}
        action={
          <div className="flex flex-wrap gap-1">
            {DIMENSOES.map((d) => (
              <button
                key={d.chave}
                type="button"
                onClick={() => setDimensao(d.chave)}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  dimensao === d.chave ? 'bg-fiori-primary-bg text-fiori-primary' : 'text-fiori-text-secondary hover:bg-fiori-canvas'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        }
      >
        <ReadinessBarChart
          dados={data[dimensao].map((g) => ({
            grupo: g.grupo,
            prontidaoMedia: g.prontidaoMedia,
            totalColaboradores: g.totalColaboradores,
            percentualDoTotal: g.percentualDoTotal,
            emRisco: g.emRisco,
          }))}
        />
      </Card>

      {data.coberturaArquitetos.length > 0 && (
        <Card title="Cobertura de Arquitetos por Núcleo/Área">
          <p className="mb-3 text-xs text-fiori-text-secondary">
            1 Arquiteto por cada 10 colaboradores, mínimo de 1 por combinação Núcleo/Área com 10 ou mais colaboradores. Combinações
            com menos de 10 contam com apoio transversal (não entram em défice). Uma linha por combinação Núcleo/Área (editável em
            Gestão de Dados → "Áreas por Núcleo") — conta só colaboradores que pertencem a essa Área E a esse Núcleo em simultâneo.
            Áreas sem Núcleo associado mostram "—" e contam todos os colaboradores dessa Área — ver detalhe em "Como Funciona".
          </p>
          <DataTable
            data={data.coberturaArquitetos}
            getRowKey={(c) => `${c.nucleoNome ?? 'sem-nucleo'}::${c.areaNome}`}
            searchPlaceholder="Pesquisar por área ou núcleo…"
            emptyMessage="Sem áreas/núcleos com colaboradores atribuídos."
            columns={[
              {
                key: 'nucleo',
                header: 'Núcleo',
                render: (c: CoberturaArquitetos) => c.nucleoNome ?? '—',
                sortValue: (c) => c.nucleoNome ?? '',
                searchValue: (c) => c.nucleoNome ?? '',
              },
              { key: 'area', header: 'Área', render: (c) => c.areaNome, sortValue: (c) => c.areaNome },
              {
                key: 'colaboradores',
                header: 'Colaboradores',
                render: (c) => c.totalColaboradores,
                sortValue: (c) => c.totalColaboradores,
              },
              { key: 'arquitetos', header: 'Arquitetos', render: (c) => c.arquitetos, sortValue: (c) => c.arquitetos },
              { key: 'exigidos', header: 'Exigidos', render: (c) => c.exigidos, sortValue: (c) => c.exigidos },
              {
                key: 'estado',
                header: 'Estado',
                render: (c) =>
                  c.defice > 0 ? (
                    <Badge status="error">Défice de {c.defice}</Badge>
                  ) : c.excesso > 0 ? (
                    <Badge status="info">Excesso de {c.excesso}</Badge>
                  ) : (
                    <Badge status="success">Adequado</Badge>
                  ),
                sortValue: (c) => c.defice - c.excesso,
                searchValue: (c) => (c.defice > 0 ? 'défice' : c.excesso > 0 ? 'excesso' : 'adequado'),
              },
            ]}
          />
        </Card>
      )}

      <Card title="Colaboradores">
        <DataTable
          data={data.colaboradores}
          getRowKey={(c) => c.colaboradorId}
          onRowClick={(c) => navigate(`/colaboradores/${c.colaboradorId}`)}
          searchPlaceholder="Pesquisar por nome, direção, cargo…"
          columns={[
            { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
            {
              key: 'direcao',
              header: 'Direção',
              render: (c) => c.direcaoNome ?? '—',
              sortValue: (c) => c.direcaoNome ?? '',
              searchValue: (c) => c.direcaoNome ?? '',
            },
            { key: 'cargo', header: 'Cargo', render: (c) => c.cargoNome, sortValue: (c) => c.cargoNome },
            {
              key: 'nivelGestao',
              header: 'Nível de Gestão',
              render: (c) => c.nivelGestaoNome ?? '—',
              sortValue: (c) => c.nivelGestaoNome ?? '',
              searchValue: (c) => c.nivelGestaoNome ?? '',
            },
            {
              key: 'localTrabalho',
              header: 'Local de Trabalho',
              render: (c) => c.localTrabalhoNome ?? '—',
              sortValue: (c) => c.localTrabalhoNome ?? '',
              searchValue: (c) => c.localTrabalhoNome ?? '',
            },
            {
              key: 'prontidao',
              header: 'Prontidão',
              render: (c) => `${c.prontidaoMedia}%`,
              sortValue: (c) => c.prontidaoMedia,
            },
            {
              key: 'lobs',
              header: 'LOBs atingidas',
              render: (c) => `${c.lobsAtingidos} / ${c.lobsExigidos}`,
              sortValue: (c) => c.lobsAtingidos,
            },
            {
              key: 'estado',
              header: 'Estado',
              render: (c) =>
                c.gap === 0 ? (
                  <Badge status="success">Pronto</Badge>
                ) : (
                  <Badge status="warning">Gap de {c.gap}</Badge>
                ),
              searchValue: (c) => (c.gap === 0 ? 'pronto' : 'gap'),
            },
          ]}
        />
      </Card>
    </div>
  );
}
