import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, Search, Users, X, XCircle } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { ApiError } from '../api/client';
import { ColaboradorResumo, ResumoAtribuicao } from '../types/api';
import { Card } from '../components/ui/Card';
import { Button, Field, Select } from '../components/ui/form';

type TipoAtribuicao = 'competencia' | 'certificacao';

/**
 * Assistente de atribuição em massa (pedido do utilizador: "associar uma
 * ou várias competências/certificações a um ou vários colaboradores em
 * simultâneo"). Listas duplas: clicar num colaborador move-o de
 * "Disponíveis" para "Selecionados" — e vice-versa. ADMIN_RH only.
 */
export function AtribuicoesPage() {
  const queryClient = useQueryClient();
  const { data: colaboradores } = useQuery({ queryKey: ['colaboradores'], queryFn: endpoints.colaboradores });
  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });
  const { data: cargos } = useQuery({ queryKey: ['catalogo', 'cargos'], queryFn: () => endpoints.catalogoListar('cargos') });
  const { data: competencias } = useQuery({ queryKey: ['catalogo', 'competencias'], queryFn: () => endpoints.catalogoListar('competencias') });
  const { data: certificacoes } = useQuery({ queryKey: ['catalogo', 'certificacoes'], queryFn: () => endpoints.catalogoListar('certificacoes') });
  const { data: niveis } = useQuery({ queryKey: ['catalogo', 'niveis'], queryFn: () => endpoints.catalogoListar('niveis') });

  const [termo, setTermo] = useState('');
  const [filtroDirecao, setFiltroDirecao] = useState('');
  const [filtroArea, setFiltroArea] = useState('');
  const [filtroNucleo, setFiltroNucleo] = useState('');
  const [filtroCargo, setFiltroCargo] = useState('');
  const [selecionados, setSelecionados] = useState<Map<number, ColaboradorResumo>>(new Map());

  const [tipo, setTipo] = useState<TipoAtribuicao>('competencia');
  const [competenciaId, setCompetenciaId] = useState('');
  const [nivelId, setNivelId] = useState('');
  const [certificacaoId, setCertificacaoId] = useState('');
  const [resultado, setResultado] = useState<ResumoAtribuicao | null>(null);

  const disponiveis = useMemo(() => {
    return (colaboradores ?? []).filter((c) => {
      if (selecionados.has(c.id)) return false;
      if (termo.trim() && !c.nome.toLowerCase().includes(termo.trim().toLowerCase())) return false;
      if (filtroDirecao && String(c.direcaoId ?? '') !== filtroDirecao) return false;
      if (filtroArea && String(c.areaId ?? '') !== filtroArea) return false;
      if (filtroNucleo && String(c.nucleoId ?? '') !== filtroNucleo) return false;
      if (filtroCargo && (c.cargoId ?? '') !== filtroCargo) return false;
      return true;
    });
  }, [colaboradores, termo, filtroDirecao, filtroArea, filtroNucleo, filtroCargo, selecionados]);

  function mover(c: ColaboradorResumo) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      novo.set(c.id, c);
      return novo;
    });
  }

  function remover(id: number) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      novo.delete(id);
      return novo;
    });
  }

  const atribuir = useMutation({
    mutationFn: () => {
      const colaboradorIds = Array.from(selecionados.keys());
      return tipo === 'competencia'
        ? endpoints.atribuirCompetencia({ colaboradorIds, competenciaId: Number(competenciaId), nivelId: Number(nivelId) })
        : endpoints.atribuirCertificacao({ colaboradorIds, certificacaoId });
    },
    onSuccess: (resumo) => {
      setResultado(resumo);
      setSelecionados(new Map());
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => window.alert(err instanceof ApiError ? err.message : 'Não foi possível atribuir.'),
  });

  const podeAtribuir = selecionados.size > 0 && (tipo === 'competencia' ? competenciaId && nivelId : !!certificacaoId);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-fiori-text">Atribuição em Massa</h1>
        <p className="text-sm text-fiori-text-secondary">
          Seleciona colaboradores à esquerda e associa-lhes uma competência ou certificação de uma vez.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={`Disponíveis (${disponiveis.length})`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="flex min-w-[10rem] flex-1 items-center gap-2 rounded border border-fiori-border bg-fiori-surface px-2.5 py-1.5">
              <Search size={14} className="text-fiori-text-secondary" />
              <input
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                placeholder="Pesquisar…"
                className="w-full border-none bg-transparent text-sm outline-none"
              />
            </div>
            <Select value={filtroDirecao} onChange={(e) => setFiltroDirecao(e.target.value)} className="w-auto">
              <option value="">Direção (todas)</option>
              {(direcoes ?? []).map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {String(d.nome)}
                </option>
              ))}
            </Select>
            <Select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className="w-auto">
              <option value="">Área (todas)</option>
              {(areas ?? []).map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.nome)}
                </option>
              ))}
            </Select>
            <Select value={filtroNucleo} onChange={(e) => setFiltroNucleo(e.target.value)} className="w-auto">
              <option value="">Núcleo (todos)</option>
              {(nucleos ?? []).map((n) => (
                <option key={String(n.id)} value={String(n.id)}>
                  {String(n.nome)}
                </option>
              ))}
            </Select>
            <Select value={filtroCargo} onChange={(e) => setFiltroCargo(e.target.value)} className="w-auto">
              <option value="">Cargo (todos)</option>
              {(cargos ?? []).map((c) => (
                <option key={String(c.id)} value={String(c.id)}>
                  {String(c.nome)}
                </option>
              ))}
            </Select>
          </div>

          <div className="max-h-96 space-y-0.5 overflow-y-auto rounded border border-fiori-border">
            {disponiveis.length === 0 && <p className="p-3 text-sm text-fiori-text-secondary">Sem colaboradores para mostrar.</p>}
            {disponiveis.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => mover(c)}
                className="flex w-full items-center justify-between border-b border-fiori-border/60 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-fiori-primary-bg"
              >
                <span>
                  {c.nome} <span className="text-fiori-text-secondary">· {c.cargoNome ?? 'sem cargo'}</span>
                </span>
                <ArrowRight size={14} className="text-fiori-text-secondary" />
              </button>
            ))}
          </div>
        </Card>

        <Card
          title={`Selecionados (${selecionados.size})`}
          action={
            selecionados.size > 0 ? (
              <button type="button" onClick={() => setSelecionados(new Map())} className="text-xs text-fiori-text-secondary hover:text-fiori-error">
                Limpar tudo
              </button>
            ) : undefined
          }
        >
          <div className="mb-4 max-h-64 space-y-0.5 overflow-y-auto rounded border border-fiori-border">
            {selecionados.size === 0 && (
              <p className="flex items-center gap-2 p-3 text-sm text-fiori-text-secondary">
                <Users size={14} /> Clica num colaborador à esquerda para o adicionar.
              </p>
            )}
            {Array.from(selecionados.values()).map((c) => (
              <div key={c.id} className="flex items-center justify-between border-b border-fiori-border/60 px-3 py-2 text-sm last:border-b-0">
                <span>{c.nome}</span>
                <button type="button" onClick={() => remover(c.id)} className="text-fiori-text-secondary hover:text-fiori-error" aria-label="Remover">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-fiori-border pt-4">
            <div className="mb-3 flex gap-1">
              <button
                type="button"
                onClick={() => setTipo('competencia')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${tipo === 'competencia' ? 'bg-fiori-primary-bg text-fiori-primary' : 'text-fiori-text-secondary hover:bg-fiori-canvas'}`}
              >
                Competência
              </button>
              <button
                type="button"
                onClick={() => setTipo('certificacao')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${tipo === 'certificacao' ? 'bg-fiori-primary-bg text-fiori-primary' : 'text-fiori-text-secondary hover:bg-fiori-canvas'}`}
              >
                Certificação
              </button>
            </div>

            {tipo === 'competencia' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Competência">
                  <Select value={competenciaId} onChange={(e) => setCompetenciaId(e.target.value)}>
                    <option value="">— selecionar —</option>
                    {(competencias ?? []).map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {String(c.nome)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Nível atingido">
                  <Select value={nivelId} onChange={(e) => setNivelId(e.target.value)}>
                    <option value="">— selecionar —</option>
                    {(niveis ?? []).map((n) => (
                      <option key={String(n.id)} value={String(n.id)}>
                        {String(n.nome)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            ) : (
              <Field label="Certificação">
                <Select value={certificacaoId} onChange={(e) => setCertificacaoId(e.target.value)}>
                  <option value="">— selecionar —</option>
                  {(certificacoes ?? []).map((c) => (
                    <option key={String(c.id)} value={String(c.id)}>
                      {String(c.nome)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Button onClick={() => atribuir.mutate()} disabled={!podeAtribuir || atribuir.isPending}>
              {atribuir.isPending ? 'A atribuir…' : `Atribuir a ${selecionados.size} colaborador${selecionados.size === 1 ? '' : 'es'}`}
            </Button>
          </div>
        </Card>
      </div>

      {resultado && (
        <Card>
          <div className="flex items-start gap-2 text-sm">
            {resultado.erros.length === 0 ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-fiori-success" />
            ) : (
              <XCircle size={16} className="mt-0.5 shrink-0 text-fiori-warning" />
            )}
            <p className="text-fiori-text">
              {resultado.criados} criado{resultado.criados === 1 ? '' : 's'}, {resultado.atualizados} atualizado{resultado.atualizados === 1 ? '' : 's'} de{' '}
              {resultado.processados} processado{resultado.processados === 1 ? '' : 's'}.
              {resultado.erros.length > 0 && (
                <span className="mt-1 block text-fiori-warning">{resultado.erros.join(' | ')}</span>
              )}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
