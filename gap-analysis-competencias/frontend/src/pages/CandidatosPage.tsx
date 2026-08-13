import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endpoints } from '../api/endpoints';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Select } from '../components/ui/form';
import { CandidatoCarreira, CatalogoRegisto } from '../types/api';

const TODOS_OS_CARGOS = '';

type Visao = 'carreira' | 'colaborador';
type AgrupamentoCandidatos = 'nenhum' | 'direcao' | 'area' | 'nucleo';

function textoElegibilidade(c: CandidatoCarreira): string {
  if (c.apto) return 'Apto';
  const motivos: string[] = [];
  if (!c.aptoAntiguidade) motivos.push('Antiguidade insuficiente');
  if (!c.aptoLobs) motivos.push('LOBs insuficientes');
  return motivos.join(' · ');
}

/** Opções de filtro derivadas dos próprios dados (só o que existe realmente aparece), ordenadas por nome. */
function opcoesDistintas(pares: [id: number | string | null, nome: string | null][]): { id: string; nome: string }[] {
  const mapa = new Map<string, string>();
  for (const [id, nome] of pares) {
    if (id != null && nome != null) mapa.set(String(id), nome);
  }
  return Array.from(mapa.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

/**
 * Agrupa linhas contíguas do mesmo colaborador — assume que `linhas` já vem
 * ordenada de forma a que todas as possibilidades de uma pessoa fiquem
 * seguidas (é o que o backend garante em `sugerirCandidatosPorColaborador`,
 * e o que os filtros/agrupamento abaixo preservam).
 */
function agruparLinhasContiguas(linhas: CandidatoCarreira[]): CandidatoCarreira[][] {
  const grupos: CandidatoCarreira[][] = [];
  for (const linha of linhas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo[0].colaboradorId === linha.colaboradorId) ultimo.push(linha);
    else grupos.push([linha]);
  }
  return grupos;
}

/**
 * Candidatos a uma carreira (ex. Arquiteto): para cada Cargo-alvo (ou todos
 * os Cargos da carreira), os colaboradores cujo Cargo atual é um
 * predecessor direto desse Cargo em "Progressão de Cargos" — ver
 * GapAnalysisService.sugerirCandidatosCarreira no backend.
 */
export function CandidatosPage() {
  const navigate = useNavigate();
  const [visao, setVisao] = useState<Visao>('carreira');

  const { data: carreiras } = useQuery({ queryKey: ['catalogo', 'carreiras'], queryFn: () => endpoints.catalogoListar('carreiras') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const [carreiraId, setCarreiraId] = useState<string | null>(null);
  const [cargoId, setCargoId] = useState<string>(TODOS_OS_CARGOS);

  useEffect(() => {
    if (carreiraId || !carreiras || carreiras.length === 0) return;
    const arquiteto = carreiras.find((c) => /arquitet|architect/i.test(String(c.nome ?? '')));
    setCarreiraId(String((arquiteto ?? carreiras[0]).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carreiras]);

  const cargosDaCarreira = useMemo(
    () => (cargos ?? []).filter((c) => String(c.carreiraId ?? '') === carreiraId),
    [cargos, carreiraId],
  );

  function handleCarreiraChange(novoId: string) {
    setCarreiraId(novoId);
    setCargoId(TODOS_OS_CARGOS);
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['candidatos', carreiraId, cargoId],
    queryFn: () => endpoints.candidatos(carreiraId!, cargoId || undefined),
    enabled: visao === 'carreira' && !!carreiraId,
  });

  // --- Visão "Por colaborador" -------------------------------------------
  const {
    data: porColaborador,
    isLoading: isLoadingPorColaborador,
    error: errorPorColaborador,
  } = useQuery({
    queryKey: ['candidatos-por-colaborador'],
    queryFn: () => endpoints.candidatosPorColaborador(),
    enabled: visao === 'colaborador',
  });

  const [agrupamento, setAgrupamento] = useState<AgrupamentoCandidatos>('nenhum');
  const [filtroDirecaoId, setFiltroDirecaoId] = useState('');
  const [filtroAreaId, setFiltroAreaId] = useState('');
  const [filtroNucleoId, setFiltroNucleoId] = useState('');
  const [pesquisa, setPesquisa] = useState('');

  const candidatosBase = useMemo(() => porColaborador?.candidatos ?? [], [porColaborador]);
  const opcoesDirecao = useMemo(() => opcoesDistintas(candidatosBase.map((c) => [c.direcaoId, c.direcaoNome])), [candidatosBase]);
  const opcoesArea = useMemo(() => opcoesDistintas(candidatosBase.map((c) => [c.areaId, c.areaNome])), [candidatosBase]);
  const opcoesNucleo = useMemo(() => opcoesDistintas(candidatosBase.map((c) => [c.nucleoId, c.nucleoNome])), [candidatosBase]);

  const candidatosFiltrados = useMemo(() => {
    let base = candidatosBase;
    if (filtroDirecaoId) base = base.filter((c) => String(c.direcaoId) === filtroDirecaoId);
    if (filtroAreaId) base = base.filter((c) => String(c.areaId) === filtroAreaId);
    if (filtroNucleoId) base = base.filter((c) => String(c.nucleoId) === filtroNucleoId);

    if (pesquisa.trim()) {
      const termo = pesquisa.trim().toLowerCase();
      // Pesquisa ao nível da pessoa: se alguma das suas linhas bater, mantém
      // TODAS as linhas dessa pessoa (não faz sentido partir o agrupamento).
      const idsCorrespondentes = new Set(
        base
          .filter((c) =>
            [c.nome, c.direcaoNome, c.areaNome, c.nucleoNome, c.cargoAtualNome, c.proximoCargoNome, c.proximoCargoCarreiraNome].some(
              (v) => (v ?? '').toLowerCase().includes(termo),
            ),
          )
          .map((c) => c.colaboradorId),
      );
      base = base.filter((c) => idsCorrespondentes.has(c.colaboradorId));
    }

    return base;
  }, [candidatosBase, filtroDirecaoId, filtroAreaId, filtroNucleoId, pesquisa]);

  const grupos = useMemo(() => {
    if (agrupamento === 'nenhum') return null;
    const chaveDe = (c: CandidatoCarreira) =>
      agrupamento === 'direcao' ? c.direcaoNome : agrupamento === 'area' ? c.areaNome : c.nucleoNome;
    const semLabel = agrupamento === 'direcao' ? 'Sem direção' : agrupamento === 'area' ? 'Sem área' : 'Sem núcleo';

    const mapa = new Map<string, CandidatoCarreira[]>();
    for (const c of candidatosFiltrados) {
      const chave = chaveDe(c) ?? semLabel;
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(c);
    }
    return Array.from(mapa.entries()).sort(([a], [b]) => {
      if (a === semLabel) return 1;
      if (b === semLabel) return -1;
      return a.localeCompare(b);
    });
  }, [candidatosFiltrados, agrupamento]);

  function contarPessoas(linhas: CandidatoCarreira[]): number {
    return new Set(linhas.map((l) => l.colaboradorId)).size;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Candidatos a carreira</h1>
          <p className="text-sm text-fiori-text-secondary">
            {visao === 'carreira'
              ? 'Colaboradores cujo Cargo atual é um predecessor direto (Progressão de Cargos) do Cargo escolhido.'
              : 'Todas as progressões de cargo possíveis para cada colaborador, em todas as carreiras — uma linha por possibilidade.'}
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <div className="no-print inline-flex gap-1 rounded-lg bg-fiori-canvas p-1">
        {([
          ['carreira', 'Por carreira'],
          ['colaborador', 'Por colaborador'],
        ] as [Visao, string][]).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setVisao(valor)}
            className={`rounded px-3.5 py-1.5 text-sm font-medium transition-colors ${
              visao === valor ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visao === 'carreira' ? (
        <>
          <Card>
            <div className="flex flex-wrap gap-4">
              <label className="block max-w-xs text-sm">
                <span className="mb-1 block font-medium text-fiori-text">Carreira</span>
                <Select value={carreiraId ?? ''} onChange={(e) => handleCarreiraChange(e.target.value)}>
                  {(carreiras ?? []).map((c: CatalogoRegisto) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.nome)}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block max-w-xs text-sm">
                <span className="mb-1 block font-medium text-fiori-text">Cargo</span>
                <Select value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
                  <option value={TODOS_OS_CARGOS}>Todos os cargos</option>
                  {cargosDaCarreira.map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.nome)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </Card>

          {isLoading && <p className="text-sm text-fiori-text-secondary">A calcular…</p>}
          {error && <p className="text-sm text-fiori-error">Não foi possível carregar os candidatos.</p>}

          {data && (
            <Card title={`Candidatos a ${data.carreiraNome}`}>
              <DataTable
                data={data.candidatos}
                getRowKey={(c) => `${c.colaboradorId}::${c.proximoCargoId}`}
                onRowClick={(c) => navigate(`/colaboradores/${c.colaboradorId}`)}
                searchPlaceholder="Pesquisar por nome, direção, cargo atual…"
                emptyMessage="Sem candidatos para este cargo/carreira."
                columns={[
                  { key: 'nome', header: 'Nome', render: (c) => c.nome, sortValue: (c) => c.nome },
                  {
                    key: 'direcao',
                    header: 'Direção',
                    render: (c) => c.direcaoNome ?? '—',
                    sortValue: (c) => c.direcaoNome ?? '',
                    searchValue: (c) => c.direcaoNome ?? '',
                  },
                  { key: 'cargoAtual', header: 'Cargo atual', render: (c) => c.cargoAtualNome, sortValue: (c) => c.cargoAtualNome },
                  {
                    key: 'proximoCargo',
                    header: 'Próximo cargo',
                    render: (c) => c.proximoCargoNome,
                    sortValue: (c) => c.proximoCargoNome,
                  },
                  {
                    key: 'prontidao',
                    header: 'Prontidão',
                    render: (c) => (c.prontidao !== null ? `${c.prontidao}%` : '—'),
                    sortValue: (c) => c.prontidao ?? -1,
                  },
                  {
                    key: 'lobs',
                    header: 'LOBs atingidas',
                    render: (c) => `${c.lobsAtingidos} / ${c.lobsExigidos}`,
                    sortValue: (c) => c.lobsAtingidos,
                  },
                  { key: 'gap', header: 'Gap', render: (c) => c.gap, sortValue: (c) => c.gap },
                  {
                    key: 'antiguidade',
                    header: 'Antiguidade',
                    render: (c) => (c.anosExperiencia !== null ? `${c.anosExperiencia} anos` : '—'),
                    sortValue: (c) => c.anosExperiencia ?? -1,
                  },
                  {
                    key: 'elegibilidade',
                    header: 'Elegibilidade',
                    render: (c) =>
                      c.apto ? <Badge status="success">Apto</Badge> : <Badge status="warning">{textoElegibilidade(c)}</Badge>,
                    sortValue: (c) => (c.apto ? 1 : 0),
                    searchValue: (c) => textoElegibilidade(c).toLowerCase(),
                  },
                ]}
              />
            </Card>
          )}
        </>
      ) : (
        <>
          <Card>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Agrupar por</p>
                <div className="flex gap-1 rounded bg-fiori-canvas p-0.5">
                  {([
                    ['nenhum', 'Nenhum'],
                    ['direcao', 'Direção'],
                    ['area', 'Área'],
                    ['nucleo', 'Núcleo'],
                  ] as [AgrupamentoCandidatos, string][]).map(([valor, label]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setAgrupamento(valor)}
                      className={`rounded px-2.5 py-1 text-xs font-medium ${
                        agrupamento === valor ? 'bg-fiori-surface text-fiori-primary shadow-fiori' : 'text-fiori-text-secondary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Direção</p>
                <Select value={filtroDirecaoId} onChange={(e) => setFiltroDirecaoId(e.target.value)} className="w-auto">
                  <option value="">Todas</option>
                  {opcoesDirecao.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Área</p>
                <Select value={filtroAreaId} onChange={(e) => setFiltroAreaId(e.target.value)} className="w-auto">
                  <option value="">Todas</option>
                  {opcoesArea.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Núcleo</p>
                <Select value={filtroNucleoId} onChange={(e) => setFiltroNucleoId(e.target.value)} className="w-auto">
                  <option value="">Todos</option>
                  {opcoesNucleo.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-fiori-text-secondary">Pesquisar</p>
                <div className="flex items-center gap-2 rounded border border-fiori-border bg-fiori-surface px-3 py-1.5">
                  <Search size={16} className="text-fiori-text-secondary" aria-hidden="true" />
                  <input
                    type="text"
                    value={pesquisa}
                    onChange={(e) => setPesquisa(e.target.value)}
                    placeholder="Nome, cargo, próximo cargo, carreira…"
                    className="w-full border-none bg-transparent text-sm text-fiori-text outline-none placeholder:text-fiori-text-secondary"
                  />
                </div>
              </div>
            </div>
          </Card>

          {isLoadingPorColaborador && <p className="text-sm text-fiori-text-secondary">A calcular…</p>}
          {errorPorColaborador && <p className="text-sm text-fiori-error">Não foi possível carregar os candidatos.</p>}

          {porColaborador &&
            (grupos ? (
              <div className="space-y-4">
                {grupos.map(([nomeGrupo, linhasGrupo]) => (
                  <Card key={nomeGrupo} title={`${nomeGrupo} (${contarPessoas(linhasGrupo)})`}>
                    <TabelaCandidatosPorColaborador linhas={linhasGrupo} onRowClick={(id) => navigate(`/colaboradores/${id}`)} />
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <TabelaCandidatosPorColaborador linhas={candidatosFiltrados} onRowClick={(id) => navigate(`/colaboradores/${id}`)} />
              </Card>
            ))}
        </>
      )}
    </div>
  );
}

/**
 * Tabela da vista "Por colaborador": Nome/Direção/Cargo atual/Antiguidade
 * (factos da pessoa) aparecem uma vez por colaborador, numa célula alta
 * (rowspan); Próximo cargo/Carreira/Prontidão/LOBs/Gap/Elegibilidade
 * (factos da combinação) variam linha a linha. Sem ordenação por coluna
 * (partiria o agrupamento) — a pesquisa/filtros/agrupamento fazem-se acima,
 * ao nível da página.
 */
function TabelaCandidatosPorColaborador({
  linhas,
  onRowClick,
}: {
  linhas: CandidatoCarreira[];
  onRowClick: (colaboradorId: number) => void;
}) {
  const grupos = useMemo(() => agruparLinhasContiguas(linhas), [linhas]);
  const totalPessoas = grupos.length;

  if (grupos.length === 0) {
    return <p className="py-6 text-center text-sm text-fiori-text-secondary">Sem candidatos.</p>;
  }

  return (
    <div>
      <div className="hidden overflow-x-auto rounded border border-fiori-border bg-fiori-surface md:block">
        <table className="fiori-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Direção</th>
              <th>Cargo atual</th>
              <th>Antiguidade</th>
              <th>Próximo cargo</th>
              <th>Carreira</th>
              <th>Prontidão</th>
              <th>LOBs atingidas</th>
              <th>Gap</th>
              <th>Elegibilidade</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((grupo) => {
              const pessoa = grupo[0];
              return grupo.map((c, i) => (
                <tr
                  key={`${c.colaboradorId}::${c.proximoCargoId}`}
                  onClick={() => onRowClick(c.colaboradorId)}
                  className="cursor-pointer"
                >
                  {i === 0 && (
                    <>
                      <td rowSpan={grupo.length} className="bg-fiori-canvas/40 font-medium">
                        {pessoa.nome}
                      </td>
                      <td rowSpan={grupo.length} className="bg-fiori-canvas/40">
                        {pessoa.direcaoNome ?? '—'}
                      </td>
                      <td rowSpan={grupo.length} className="bg-fiori-canvas/40">
                        {pessoa.cargoAtualNome}
                      </td>
                      <td rowSpan={grupo.length} className="bg-fiori-canvas/40">
                        {pessoa.anosExperiencia !== null ? `${pessoa.anosExperiencia} anos` : '—'}
                      </td>
                    </>
                  )}
                  <td>{c.proximoCargoNome}</td>
                  <td>
                    <span className="rounded border border-fiori-border bg-fiori-canvas px-1.5 py-0.5 text-xs text-fiori-text-secondary">
                      {c.proximoCargoCarreiraNome ?? '—'}
                    </span>
                  </td>
                  <td>{c.prontidao !== null ? `${c.prontidao}%` : '—'}</td>
                  <td>
                    {c.lobsAtingidos} / {c.lobsExigidos}
                  </td>
                  <td>{c.gap}</td>
                  <td>{c.apto ? <Badge status="success">Apto</Badge> : <Badge status="warning">{textoElegibilidade(c)}</Badge>}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {grupos.map((grupo) => {
          const pessoa = grupo[0];
          return (
            <div
              key={pessoa.colaboradorId}
              onClick={() => onRowClick(pessoa.colaboradorId)}
              className="cursor-pointer rounded border border-fiori-border bg-fiori-surface p-3 active:bg-fiori-canvas"
            >
              <p className="font-medium text-fiori-text">{pessoa.nome}</p>
              <p className="mb-2 text-xs text-fiori-text-secondary">
                {pessoa.direcaoNome ?? '—'} · {pessoa.cargoAtualNome} ·{' '}
                {pessoa.anosExperiencia !== null ? `${pessoa.anosExperiencia} anos` : '—'}
              </p>
              <div className="space-y-2 border-t border-fiori-border/70 pt-2">
                {grupo.map((c) => (
                  <div key={c.proximoCargoId} className="text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-fiori-text">{c.proximoCargoNome}</span>
                      {c.apto ? <Badge status="success">Apto</Badge> : <Badge status="warning">{textoElegibilidade(c)}</Badge>}
                    </div>
                    <p className="text-xs text-fiori-text-secondary">
                      {c.proximoCargoCarreiraNome ?? '—'} · Prontidão {c.prontidao !== null ? `${c.prontidao}%` : '—'} · LOBs{' '}
                      {c.lobsAtingidos}/{c.lobsExigidos} · Gap {c.gap}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-xs text-fiori-text-secondary">
        {totalPessoas} colaborador{totalPessoas === 1 ? '' : 'es'} · {linhas.length} possibilidade{linhas.length === 1 ? '' : 's'}
      </p>
    </div>
  );
}
