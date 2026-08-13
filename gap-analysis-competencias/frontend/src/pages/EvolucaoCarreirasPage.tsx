import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { endpoints } from '../api/endpoints';
import { CargoEvolucao, ProgressaoCargo } from '../types/api';
import { Card } from '../components/ui/Card';
import { Field, Select } from '../components/ui/form';
import { PrintButton } from '../components/ui/PrintButton';

const LARGURA_NO = 168;
const ALTURA_NO = 56;
const LARGURA_COLUNA = 216;
const ALTURA_SUBLINHA = ALTURA_NO + 14;
const MARGEM = 24;
const ESPACO_ROTULO_RAIA = 26;

const CORES_RAIA = ['#0070F2', '#107E3E', '#E76500', '#BB0000', '#6A5ACD', '#00838F'];

interface NoPosicionado {
  cargo: CargoEvolucao;
  coluna: number;
  linha: number; // índice global da raia
  subLinha: number; // desempate quando 2 cargos caem na mesma raia+coluna
  x: number;
  y: number;
  cor: string;
}

interface Layout {
  nos: Map<string, NoPosicionado>;
  raias: { nome: string; cor: string; y: number; altura: number }[];
  largura: number;
  altura: number;
}

/**
 * Coluna = profundidade da progressão (caminho mais longo desde um cargo
 * sem predecessores), calculada sobre TODO o grafo `cargo_progressao`,
 * independentemente da Carreira — é por isso que "Associate Architect" (só
 * alcançável a partir de "Senior Consultant") fica na mesma coluna que
 * "Senior Consultant", não na primeira coluna da sua própria Carreira.
 * Raia = Carreira (relevantes primeiro, depois por nome).
 */
function calcularLayout(cargos: CargoEvolucao[], progressoes: ProgressaoCargo[]): Layout {
  const predecessores = new Map<string, string[]>();
  for (const p of progressoes) {
    if (!predecessores.has(p.proximoCargoId)) predecessores.set(p.proximoCargoId, []);
    predecessores.get(p.proximoCargoId)!.push(p.cargoId);
  }

  const memo = new Map<string, number>();
  function coluna(cargoId: string, emCurso: Set<string>): number {
    if (memo.has(cargoId)) return memo.get(cargoId)!;
    if (emCurso.has(cargoId)) return 0; // ciclo defensivo — não devia acontecer em dados reais
    emCurso.add(cargoId);
    const preds = (predecessores.get(cargoId) ?? []).filter((p) => cargos.some((c) => c.cargoId === p));
    const valor = preds.length === 0 ? 0 : 1 + Math.max(...preds.map((p) => coluna(p, emCurso)));
    emCurso.delete(cargoId);
    memo.set(cargoId, valor);
    return valor;
  }

  const carreiras = Array.from(new Map(cargos.map((c) => [c.carreiraId, c])).values())
    .sort((a, b) => (b.carreiraRelevante ? 1 : 0) - (a.carreiraRelevante ? 1 : 0) || a.carreiraNome.localeCompare(b.carreiraNome));

  const porRaia = new Map<string, CargoEvolucao[]>();
  for (const c of cargos) {
    if (!porRaia.has(c.carreiraId)) porRaia.set(c.carreiraId, []);
    porRaia.get(c.carreiraId)!.push(c);
  }

  const nos = new Map<string, NoPosicionado>();
  const raias: Layout['raias'] = [];
  let yAtual = MARGEM;
  let maxColuna = 0;

  carreiras.forEach((carreiraRef, idx) => {
    const cor = CORES_RAIA[idx % CORES_RAIA.length];
    const cargosDaRaia = porRaia.get(carreiraRef.carreiraId) ?? [];

    // Agrupar por coluna para saber quantas sub-linhas esta raia precisa.
    const porColuna = new Map<number, CargoEvolucao[]>();
    for (const c of cargosDaRaia) {
      const col = coluna(c.cargoId, new Set());
      maxColuna = Math.max(maxColuna, col);
      if (!porColuna.has(col)) porColuna.set(col, []);
      porColuna.get(col)!.push(c);
    }
    const maxSubLinhas = Math.max(1, ...Array.from(porColuna.values()).map((lista) => lista.length));
    const alturaRaia = ESPACO_ROTULO_RAIA + maxSubLinhas * ALTURA_SUBLINHA;

    for (const [col, lista] of porColuna) {
      lista.forEach((cargo, subIdx) => {
        nos.set(cargo.cargoId, {
          cargo,
          coluna: col,
          linha: idx,
          subLinha: subIdx,
          x: MARGEM + col * LARGURA_COLUNA,
          y: yAtual + ESPACO_ROTULO_RAIA + subIdx * ALTURA_SUBLINHA,
          cor,
        });
      });
    }

    raias.push({ nome: carreiraRef.carreiraNome, cor, y: yAtual, altura: alturaRaia });
    yAtual += alturaRaia + 10;
  });

  return {
    nos,
    raias,
    largura: MARGEM * 2 + (maxColuna + 1) * LARGURA_COLUNA,
    altura: yAtual + MARGEM,
  };
}

/** Mapa de progressão de cargos (pedido do utilizador: "de forma gráfica mostra a evolução das carreiras"). */
export function EvolucaoCarreirasPage() {
  const navigate = useNavigate();
  const [direcaoId, setDirecaoId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [nucleoId, setNucleoId] = useState('');

  const { data: direcoes } = useQuery({ queryKey: ['catalogo', 'direcoes'], queryFn: () => endpoints.catalogoListar('direcoes') });
  const { data: areas } = useQuery({ queryKey: ['catalogo', 'areas'], queryFn: () => endpoints.catalogoListar('areas') });
  const { data: nucleos } = useQuery({ queryKey: ['catalogo', 'nucleos'], queryFn: () => endpoints.catalogoListar('nucleos') });

  const filtros = {
    direcaoId: direcaoId ? Number(direcaoId) : undefined,
    areaId: areaId ? Number(areaId) : undefined,
    nucleoId: nucleoId ? Number(nucleoId) : undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['evolucao-carreiras', filtros],
    queryFn: () => endpoints.evolucaoCarreiras(filtros),
  });

  const layout = useMemo(() => calcularLayout(data?.cargos ?? [], data?.progressoes ?? []), [data]);

  function abrirCandidatos(cargo: CargoEvolucao) {
    navigate('/candidatos', { state: { carreiraId: cargo.carreiraId, cargoId: cargo.cargoId } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fiori-text">Evolução de Carreiras</h1>
          <p className="text-sm text-fiori-text-secondary">
            Progressão de Cargos entre Carreiras — cada seta é uma linha de "Progressão de Cargos" em Gestão de Dados.
          </p>
        </div>
        <div className="no-print">
          <PrintButton label="Imprimir" />
        </div>
      </div>

      <Card title="Filtrar colaboradores">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Direção">
            <Select value={direcaoId} onChange={(e) => setDirecaoId(e.target.value)}>
              <option value="">Todas</option>
              {(direcoes ?? []).map((d) => (
                <option key={String(d.id)} value={String(d.id)}>
                  {String(d.nome)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Área">
            <Select value={areaId} onChange={(e) => setAreaId(e.target.value)}>
              <option value="">Todas</option>
              {(areas ?? []).map((a) => (
                <option key={String(a.id)} value={String(a.id)}>
                  {String(a.nome)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Núcleo">
            <Select value={nucleoId} onChange={(e) => setNucleoId(e.target.value)}>
              <option value="">Todos</option>
              {(nucleos ?? []).map((n) => (
                <option key={String(n.id)} value={String(n.id)}>
                  {String(n.nome)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        {isLoading && <p className="text-sm text-fiori-text-secondary">A carregar…</p>}
        {error && <p className="text-sm text-fiori-error">Não foi possível carregar a evolução de carreiras.</p>}
        {data && data.cargos.length === 0 && (
          <p className="text-sm text-fiori-text-secondary">Ainda não há Cargos definidos em Gestão de Dados.</p>
        )}

        {data && data.cargos.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <svg
                viewBox={`0 0 ${layout.largura} ${layout.altura}`}
                role="img"
                aria-label="Mapa de progressão de cargos entre carreiras, com o número de colaboradores e a prontidão média de cada cargo."
                className="text-fiori-text-secondary"
                style={{ width: '100%', height: 'auto', minWidth: Math.min(layout.largura, 900) }}
              >
                <defs>
                  <marker id="arrowEvolucao" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
                  </marker>
                </defs>

                {layout.raias.map((raia) => (
                  <g key={raia.nome}>
                    <rect x={0} y={raia.y} width={layout.largura} height={raia.altura} fill={raia.cor} opacity={0.05} />
                    <text x={MARGEM} y={raia.y + 17} fontSize={11} fontWeight={700} fill={raia.cor}>
                      {raia.nome.toUpperCase()}
                    </text>
                  </g>
                ))}

                <g stroke="currentColor" strokeWidth={1.4} opacity={0.6} fill="none" markerEnd="url(#arrowEvolucao)">
                  {(data.progressoes ?? []).map((p) => {
                    const origem = layout.nos.get(p.cargoId);
                    const destino = layout.nos.get(p.proximoCargoId);
                    if (!origem || !destino) return null;
                    const x1 = origem.x + LARGURA_NO;
                    const y1 = origem.y + ALTURA_NO / 2;
                    const x2 = destino.x;
                    const y2 = destino.y + ALTURA_NO / 2;
                    if (origem.linha === destino.linha) {
                      return <line key={`${p.cargoId}->${p.proximoCargoId}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
                    }
                    return <path key={`${p.cargoId}->${p.proximoCargoId}`} d={`M ${x1} ${y1} L ${x2} ${y2}`} />;
                  })}
                </g>

                {Array.from(layout.nos.values()).map((no) => (
                  <g
                    key={no.cargo.cargoId}
                    transform={`translate(${no.x}, ${no.y})`}
                    onClick={() => abrirCandidatos(no.cargo)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect width={LARGURA_NO} height={ALTURA_NO} rx={6} fill="#FFFFFF" stroke={no.cor} strokeWidth={1.5} />
                    <text x={LARGURA_NO / 2} y={22} fontSize={12} fontWeight={600} textAnchor="middle" fill="currentColor" className="text-fiori-text">
                      {no.cargo.cargoNome}
                    </text>
                    <text x={LARGURA_NO / 2} y={40} fontSize={10.5} textAnchor="middle" fill="currentColor" className="text-fiori-text-secondary">
                      {no.cargo.totalColaboradores} colab. · prontidão {no.cargo.prontidaoMedia}%
                    </text>
                  </g>
                ))}
              </svg>
            </div>
            <p className="mt-3 text-xs text-fiori-text-secondary">
              Clicar num Cargo abre "Candidatos" já filtrado para a sua Carreira. Coluna = profundidade da progressão a partir de um Cargo de
              entrada (sem predecessores) — não é a Categoria, por isso um Cargo pode ficar numa coluna diferente da sua Carreira quando só é
              alcançável a partir de outra.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
