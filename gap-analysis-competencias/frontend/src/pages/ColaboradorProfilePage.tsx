import { FormEvent, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Pencil } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { ColaboradorResumo, UpdateColaboradorInput } from '../types/api';
import { Card } from '../components/ui/Card';
import { ProgressRing } from '../components/ui/ProgressRing';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { PrintButton } from '../components/ui/PrintButton';
import { Modal } from '../components/ui/Modal';
import { Button, Field, Input, Select } from '../components/ui/form';
import { LobGapDetail } from '../components/gap/LobGapDetail';
import { PerfilRadarChart } from '../components/gap/PerfilRadarChart';
import { PdiSection } from '../components/pdi/PdiSection';
import { ObjetivosLobSection } from '../components/pdi/ObjetivosLobSection';

function formatarData(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('pt-PT') : '—';
}

const MS_POR_ANO = 1000 * 60 * 60 * 24 * 365.25;

/** Anos de experiência = anos desde a dataAdmissao até hoje, calculado dinamicamente (nunca guardado). */
function calcularAnosExperiencia(dataAdmissao: string | null): number | null {
  if (!dataAdmissao) return null;
  const anos = (Date.now() - new Date(dataAdmissao).getTime()) / MS_POR_ANO;
  return Math.round(anos * 10) / 10;
}

/** Editar a data de admissão — locking otimista pela `version` do colaborador, mesmo padrão de EditarCertificacaoModal. */
function EditarDataAdmissaoModal({ colaborador, onClose }: { colaborador: ColaboradorResumo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [dataAdmissao, setDataAdmissao] = useState(colaborador.dataAdmissao ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => endpoints.atualizarColaborador(colaborador.id, { dataAdmissao: dataAdmissao || undefined, version: colaborador.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', colaborador.id] });
      onClose();
    },
    onError: (err) =>
      setErro(
        err instanceof ApiError && err.status === 409
          ? 'Este colaborador foi alterado por outra pessoa entretanto — fecha e reabre para ver os dados atuais.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível gravar.',
      ),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    guardar.mutate();
  }

  return (
    <Modal title="Data de admissão" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Data de admissão">
          <Input type="date" value={dataAdmissao} onChange={(e) => setDataAdmissao(e.target.value)} autoFocus />
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Editar a "Próxima LOB" — opções restritas às LOBs da Área do colaborador, mesmo padrão de locking otimista. */
function EditarProximaLobModal({ colaborador, onClose }: { colaborador: ColaboradorResumo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: lobs } = useQuery({ queryKey: ['lobs'], queryFn: endpoints.lobs });
  const [proximaLobId, setProximaLobId] = useState(colaborador.proximaLobId != null ? String(colaborador.proximaLobId) : '');
  const [erro, setErro] = useState<string | null>(null);

  const lobsDaArea = (lobs ?? []).filter((l) => l.areaNome === colaborador.areaNome);

  const guardar = useMutation({
    mutationFn: () =>
      endpoints.atualizarColaborador(colaborador.id, {
        proximaLobId: proximaLobId ? Number(proximaLobId) : null,
        version: colaborador.version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', colaborador.id] });
      onClose();
    },
    onError: (err) =>
      setErro(
        err instanceof ApiError && err.status === 409
          ? 'Este colaborador foi alterado por outra pessoa entretanto — fecha e reabre para ver os dados atuais.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível gravar.',
      ),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    guardar.mutate();
  }

  return (
    <Modal title="Próxima LOB" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Próxima LOB">
          <Select value={proximaLobId} onChange={(e) => setProximaLobId(e.target.value)} autoFocus>
            <option value="">— nenhuma —</option>
            {lobsDaArea.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome}
              </option>
            ))}
          </Select>
        </Field>
        {colaborador.areaNome == null && (
          <p className="mb-3 text-xs text-fiori-text-secondary">Colaborador sem Área atribuída — sem LOBs para escolher.</p>
        )}
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Editar um campo de seleção simples (Nível de Gestão / Local de Trabalho) — opções vêm de uma tabela de catálogo, sem filtragem adicional. */
function EditarCampoSimplesModal({
  colaborador,
  titulo,
  tabela,
  campo,
  onClose,
}: {
  colaborador: ColaboradorResumo;
  titulo: string;
  tabela: 'niveis-gestao' | 'locais-trabalho';
  campo: 'nivelGestaoId' | 'localTrabalhoId';
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: opcoes } = useQuery({ queryKey: ['catalogo', tabela], queryFn: () => endpoints.catalogoListar(tabela) });
  const [valor, setValor] = useState(colaborador[campo] != null ? String(colaborador[campo]) : '');
  const [erro, setErro] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      endpoints.atualizarColaborador(colaborador.id, {
        [campo]: valor ? Number(valor) : null,
        version: colaborador.version,
      } as UpdateColaboradorInput),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', colaborador.id] });
      onClose();
    },
    onError: (err) =>
      setErro(
        err instanceof ApiError && err.status === 409
          ? 'Este colaborador foi alterado por outra pessoa entretanto — fecha e reabre para ver os dados atuais.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível gravar.',
      ),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    guardar.mutate();
  }

  return (
    <Modal title={titulo} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label={titulo}>
          <Select value={valor} onChange={(e) => setValor(e.target.value)} autoFocus>
            <option value="">— nenhum —</option>
            {(opcoes ?? []).map((o) => (
              <option key={String(o.id)} value={String(o.id)}>
                {String(o.nome)}
              </option>
            ))}
          </Select>
        </Field>
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Editar o Estado (Ativo/Inativo) — inativos são excluídos de toda a análise agregada (Dashboard, Skill Matrix, Candidatos, ...). */
function EditarAtivoModal({ colaborador, onClose }: { colaborador: ColaboradorResumo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [ativo, setAtivo] = useState(colaborador.ativo ? 'true' : 'false');
  const [erro, setErro] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => endpoints.atualizarColaborador(colaborador.id, { ativo: ativo === 'true', version: colaborador.version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador', colaborador.id] });
      queryClient.invalidateQueries({ queryKey: ['colaboradores'] });
      onClose();
    },
    onError: (err) =>
      setErro(
        err instanceof ApiError && err.status === 409
          ? 'Este colaborador foi alterado por outra pessoa entretanto — fecha e reabre para ver os dados atuais.'
          : err instanceof ApiError
            ? err.message
            : 'Não foi possível gravar.',
      ),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    guardar.mutate();
  }

  return (
    <Modal title="Estado do colaborador" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <Field label="Estado">
          <Select value={ativo} onChange={(e) => setAtivo(e.target.value)} autoFocus>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Select>
        </Field>
        {ativo === 'false' && colaborador.subordinadosAtivos > 0 && (
          <p className="mb-3 flex items-start gap-1.5 text-xs text-fiori-warning">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            Este colaborador ainda é gestor de {colaborador.subordinadosAtivos} colaborador{colaborador.subordinadosAtivos === 1 ? '' : 'es'} ativo
            {colaborador.subordinadosAtivos === 1 ? '' : 's'} — considera reatribuir a equipa.
          </p>
        )}
        {erro && <p className="mb-3 text-sm text-fiori-error">{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardar.isPending}>
            {guardar.isPending ? 'A gravar…' : 'Gravar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Ficha do colaborador: competências/certificações e % de prontidão para
 * o cargo. Organizado por LOB (não há requisitos de competência "soltos"
 * fora do contexto de uma LOB neste modelo — ver docs/01-modelo-dados.md
 * secção 2) — seleciona uma LOB para ver o detalhe completo.
 */
export function ColaboradorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const colaboradorId = Number(id);
  const { user } = useAuth();
  const [lobSelecionada, setLobSelecionada] = useState<number | null>(null);
  const [mostrarTodasLobs, setMostrarTodasLobs] = useState(false);
  const [editarDataAdmissao, setEditarDataAdmissao] = useState(false);
  const [editarProximaLob, setEditarProximaLob] = useState(false);
  const [editarNivelGestao, setEditarNivelGestao] = useState(false);
  const [editarLocalTrabalho, setEditarLocalTrabalho] = useState(false);
  const [editarAtivo, setEditarAtivo] = useState(false);

  const colaboradorQuery = useQuery({
    queryKey: ['colaborador', colaboradorId],
    queryFn: () => endpoints.colaborador(colaboradorId),
  });
  const gapQuery = useQuery({
    queryKey: ['gap-cargo', colaboradorId],
    queryFn: () => endpoints.gapCargo(colaboradorId),
  });

  if (colaboradorQuery.isLoading || gapQuery.isLoading) {
    return <p className="text-sm text-fiori-text-secondary">A carregar…</p>;
  }
  if (colaboradorQuery.error) {
    return <p className="text-sm text-fiori-error">Não foi possível carregar este colaborador (sem acesso ou não existe).</p>;
  }

  const colaborador = colaboradorQuery.data;
  const gap = gapQuery.data;
  // Colaborador sem cargo atribuído: backend devolve 400 nesse caso — mostrar isso na página em vez de rebentar.
  const semCargo = gapQuery.error !== null && !gapQuery.isLoading;

  const prontidaoMedia = gap && gap.lobs.length > 0
    ? Math.round(gap.lobs.reduce((soma, l) => soma + l.prontidaoPercentual, 0) / gap.lobs.length)
    : 0;

  // As LOBs já vêm ordenadas com as da área do colaborador primeiro (ver
  // GapAnalysisService.avaliarColaboradorCargo) — aqui só filtramos para
  // ter os dois conjuntos dos dois gráficos pedidos.
  const lobsDaArea = colaborador?.areaId != null ? (gap?.lobs.filter((l) => l.areaId === colaborador.areaId) ?? []) : [];

  return (
    <div className="space-y-6">
      <Card
        action={
          <div className="no-print">
            <PrintButton label="Imprimir ficha" />
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-6">
          {gap && <ProgressRing percentual={prontidaoMedia} label="Prontidão para o cargo" />}
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-fiori-text">
              {colaborador?.nome}
              {colaborador && !colaborador.ativo && <Badge status="neutral">Inativo</Badge>}
            </h1>
            <p className="text-sm text-fiori-text-secondary">
              {gap ? gap.cargoNome : colaborador?.cargoId ?? 'Sem cargo atribuído'}
            </p>
            {gap && (
              <p className="mt-1 text-sm">
                <span className="font-medium text-fiori-text">{gap.lobsAtingidos}</span>
                <span className="text-fiori-text-secondary"> de {gap.lobsExigidos} LOBs exigidas atingidas</span>
                {gap.gap === 0 ? <Badge status="success">Pronto</Badge> : <Badge status="warning">Gap de {gap.gap}</Badge>}
              </p>
            )}
            {colaborador && (
              <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-fiori-text-secondary">
                <span className="flex items-center gap-1.5">
                  Admissão: {formatarData(colaborador.dataAdmissao)}
                  {user?.role === 'ADMIN_RH' && (
                    <button
                      type="button"
                      onClick={() => setEditarDataAdmissao(true)}
                      className="no-print text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar data de admissão"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
                {calcularAnosExperiencia(colaborador.dataAdmissao) !== null && (
                  <span>Anos de experiência: {calcularAnosExperiencia(colaborador.dataAdmissao)}</span>
                )}
                <span className="flex items-center gap-1.5">
                  Próxima LOB: {colaborador.proximaLobNome ?? '—'}
                  {user?.role === 'ADMIN_RH' && (
                    <button
                      type="button"
                      onClick={() => setEditarProximaLob(true)}
                      className="no-print text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar próxima LOB"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  Nível de gestão: {colaborador.nivelGestaoNome ?? '—'}
                  {user?.role === 'ADMIN_RH' && (
                    <button
                      type="button"
                      onClick={() => setEditarNivelGestao(true)}
                      className="no-print text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar nível de gestão"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  Local de trabalho: {colaborador.localTrabalhoNome ?? '—'}
                  {user?.role === 'ADMIN_RH' && (
                    <button
                      type="button"
                      onClick={() => setEditarLocalTrabalho(true)}
                      className="no-print text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar local de trabalho"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  Estado: {colaborador.ativo ? 'Ativo' : 'Inativo'}
                  {user?.role === 'ADMIN_RH' && (
                    <button
                      type="button"
                      onClick={() => setEditarAtivo(true)}
                      className="no-print text-fiori-text-secondary hover:text-fiori-primary"
                      title="Editar estado"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
        {semCargo && (
          <p className="mt-3 text-sm text-fiori-text-secondary">
            Este colaborador não tem cargo atribuído — não é possível calcular a prontidão para um cargo.
          </p>
        )}
        {colaborador && !colaborador.ativo && colaborador.subordinadosAtivos > 0 && (
          <p className="mt-3 flex items-start gap-1.5 text-sm text-fiori-warning">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            Este colaborador está inativo mas continua definido como gestor de {colaborador.subordinadosAtivos} colaborador
            {colaborador.subordinadosAtivos === 1 ? '' : 'es'} ativo{colaborador.subordinadosAtivos === 1 ? '' : 's'}.
          </p>
        )}
      </Card>

      {editarDataAdmissao && colaborador && (
        <EditarDataAdmissaoModal colaborador={colaborador} onClose={() => setEditarDataAdmissao(false)} />
      )}
      {editarProximaLob && colaborador && (
        <EditarProximaLobModal colaborador={colaborador} onClose={() => setEditarProximaLob(false)} />
      )}
      {editarNivelGestao && colaborador && (
        <EditarCampoSimplesModal
          colaborador={colaborador}
          titulo="Nível de gestão"
          tabela="niveis-gestao"
          campo="nivelGestaoId"
          onClose={() => setEditarNivelGestao(false)}
        />
      )}
      {editarLocalTrabalho && colaborador && (
        <EditarCampoSimplesModal
          colaborador={colaborador}
          titulo="Local de trabalho"
          tabela="locais-trabalho"
          campo="localTrabalhoId"
          onClose={() => setEditarLocalTrabalho(false)}
        />
      )}
      {editarAtivo && colaborador && <EditarAtivoModal colaborador={colaborador} onClose={() => setEditarAtivo(false)} />}

      {gap && gap.lobs.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title={`Perfil atual vs. exigido — Área${colaborador?.areaNome ? ` (${colaborador.areaNome})` : ''}`}>
            {lobsDaArea.length >= 3 ? (
              <PerfilRadarChart lobs={lobsDaArea} />
            ) : (
              <p className="text-sm text-fiori-text-secondary">
                {colaborador?.areaId == null
                  ? 'Colaborador sem área atribuída.'
                  : 'Menos de 3 LOBs nesta área — sem dados suficientes para o gráfico.'}
              </p>
            )}
          </Card>
          <Card title="Perfil atual vs. exigido — Todas as LOBs">
            <PerfilRadarChart lobs={gap.lobs} />
          </Card>
        </div>
      )}

      {gap && gap.lobs.length > 0 && (
        (() => {
          // Pedido do utilizador: por omissão só mostra as LOBs da área do
          // colaborador (mais fácil de navegar); "Todas as LOBs" mostra o
          // resto do catálogo. Sem área definida, não há o que filtrar.
          const temArea = colaborador?.areaId != null;
          const efetivoTodas = mostrarTodasLobs || !temArea;
          const lobsExibidas = efetivoTodas ? gap.lobs : gap.lobs.filter((l) => l.areaId === colaborador?.areaId);

          return (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
              <Card
                title="LOBs"
                action={
                  temArea ? (
                    <div className="inline-flex overflow-hidden rounded border border-fiori-border text-xs no-print">
                      <button
                        type="button"
                        onClick={() => setMostrarTodasLobs(false)}
                        className={`px-2.5 py-1 ${!mostrarTodasLobs ? 'bg-fiori-primary font-medium text-white' : 'bg-fiori-surface text-fiori-text-secondary'}`}
                      >
                        Área do colaborador
                      </button>
                      <button
                        type="button"
                        onClick={() => setMostrarTodasLobs(true)}
                        className={`px-2.5 py-1 ${mostrarTodasLobs ? 'bg-fiori-primary font-medium text-white' : 'bg-fiori-surface text-fiori-text-secondary'}`}
                      >
                        Todas as LOBs
                      </button>
                    </div>
                  ) : undefined
                }
              >
                <DataTable
                  data={lobsExibidas}
                  getRowKey={(l) => l.lobId}
                  onRowClick={(l) => setLobSelecionada(l.lobId)}
                  searchPlaceholder="Pesquisar por LOB…"
                  columns={[
                    {
                      key: 'lob',
                      header: 'LOB',
                      render: (l) => (
                        <span className={lobSelecionada === l.lobId ? 'font-medium text-fiori-primary' : 'text-fiori-text'}>
                          {l.lobNome}
                        </span>
                      ),
                      sortValue: (l) => l.lobNome,
                    },
                    {
                      key: 'total',
                      header: 'Total',
                      render: (l) => (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs tabular-nums text-fiori-text-secondary">{l.prontidaoPercentual}%</span>
                          {l.atingido ? <Badge status="success">Atingida</Badge> : <Badge status="warning">Gap</Badge>}
                        </div>
                      ),
                      sortValue: (l) => (l.atingido ? 1 : 0),
                      searchValue: (l) => (l.atingido ? 'atingida' : 'gap'),
                    },
                  ]}
                />
              </Card>

              <Card title="Detalhe da LOB">
                {lobSelecionada ? (
                  <LobGapDetail colaboradorId={colaboradorId} lobId={lobSelecionada} />
                ) : (
                  <p className="text-sm text-fiori-text-secondary">Seleciona uma LOB no quadro ao lado para ver competências, certificações e sugestões.</p>
                )}
              </Card>
            </div>
          );
        })()
      )}

      <ObjetivosLobSection colaboradorId={colaboradorId} />

      <PdiSection colaboradorId={colaboradorId} />
    </div>
  );
}
