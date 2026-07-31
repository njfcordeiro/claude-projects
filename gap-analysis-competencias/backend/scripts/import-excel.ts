/**
 * Importa o Excel de origem (Tabelas_criação_programa.xlsx) para a base de
 * dados via Prisma Client, seguindo a ordem de dependências documentada em
 * docs/01-modelo-dados.md (secção 3).
 *
 * Uso:
 *   EXCEL_SOURCE_PATH=/caminho/para/o/ficheiro.xlsx npm run import:excel
 *
 * O ficheiro Excel NUNCA é commitado neste repositório (contém dados
 * pessoais de colaboradores) — passa sempre o caminho via variável de
 * ambiente ou --file.
 */
import 'dotenv/config';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { PrismaClient, OrigemAvaliacao } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------
// Helpers de leitura de células
// ---------------------------------------------------------------------

/**
 * Este workbook usa Tabelas do Excel com colunas derivadas por fórmula em
 * quase todas as folhas (ex.: "ID Cargo" = concatenação de Carreira+
 * Categoria; a maioria dos nomes são VLOOKUP a partir do ID). O exceljs
 * devolve essas células como `{ formula, result }`, não como o valor
 * simples — por isso todo o acesso a células passa por este resolvedor,
 * que desembrulha fórmulas (recursivamente, para o caso raro de um
 * `result` também vir embrulhado) e trata células de erro (`#N/A`, etc.)
 * como ausência de valor, tal como o resto do script já trata "#N/A" como
 * texto.
 */
function resolveValue(v: unknown): string | number | boolean | Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if ('result' in (v as any)) return resolveValue((v as any).result);
    if ('error' in (v as any)) return null;
    if ('richText' in (v as any)) return (v as any).richText.map((r: any) => r.text).join('');
    if ('text' in (v as any)) return (v as any).text;
    return null;
  }
  return v as string | number | boolean;
}

function cellRaw(ws: ExcelJS.Worksheet, row: number, col: number): string | number | boolean | Date | null {
  return resolveValue(ws.getRow(row).getCell(col).value);
}

/** String limpa, ou null para vazio / "#N/A" (usado em todo o Excel como marcador de ausência). */
function str(ws: ExcelJS.Worksheet, row: number, col: number): string | null {
  const v = cellRaw(ws, row, col);
  if (v === null) return null;
  const s = String(v).trim();
  if (s === '' || s === '#N/A') return null;
  return s;
}

function num(ws: ExcelJS.Worksheet, row: number, col: number): number | null {
  const s = str(ws, row, col);
  if (s === null) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function flagX(ws: ExcelJS.Worksheet, row: number, col: number): boolean {
  return str(ws, row, col) === 'X';
}

function flagSimNao(ws: ExcelJS.Worksheet, row: number, col: number): boolean {
  return str(ws, row, col) === 'Sim';
}

/** Datas nativas do Excel (Colaboradores."Data de Admissão") chegam como JS Date. */
function excelDate(ws: ExcelJS.Worksheet, row: number, col: number): Date | null {
  const v = cellRaw(ws, row, col);
  return v instanceof Date ? v : null;
}

/** Datas em texto "dd.mm.yyyy" (Colaboradores&Certificações). */
function dotDate(ws: ExcelJS.Worksheet, row: number, col: number): Date | null {
  const s = str(ws, row, col);
  if (s === null) return null;
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) {
    console.warn(`  aviso: data em formato inesperado ignorada: "${s}" (linha ${row}, col ${col})`);
    return null;
  }
  const [, d, mo, y] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
}

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  const filePath = process.env.EXCEL_SOURCE_PATH;
  if (!filePath) {
    throw new Error('Define EXCEL_SOURCE_PATH (.env ou variável de ambiente) com o caminho para o ficheiro Excel.');
  }
  const resolved = path.resolve(process.cwd(), filePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolved);
  console.log(`Ficheiro carregado: ${resolved}`);
  return wb;
}

// ---------------------------------------------------------------------
// Fase 1 — Organização (Direção&Área&Núcleo, sem FK entre si — confirmado
// com o utilizador, docs/01-modelo-dados.md secção 6.6)
// ---------------------------------------------------------------------

async function importOrganizacao(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Direção&Área&Núcleo')!;
  let direcoes = 0, areas = 0, nucleos = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const direcaoId = num(ws, r, 1);
    if (direcaoId !== null) {
      await prisma.direcao.upsert({
        where: { id: direcaoId },
        create: { id: direcaoId, nome: str(ws, r, 2)!, relevante: flagX(ws, r, 3) },
        update: { nome: str(ws, r, 2)!, relevante: flagX(ws, r, 3) },
      });
      direcoes++;
    }

    const areaId = num(ws, r, 5);
    if (areaId !== null) {
      await prisma.area.upsert({
        where: { id: areaId },
        create: { id: areaId, nome: str(ws, r, 6)! },
        update: { nome: str(ws, r, 6)! },
      });
      areas++;
    }

    const nucleoId = num(ws, r, 8);
    if (nucleoId !== null) {
      await prisma.nucleo.upsert({
        where: { id: nucleoId },
        create: { id: nucleoId, nome: str(ws, r, 9)! },
        update: { nome: str(ws, r, 9)! },
      });
      nucleos++;
    }
  }
  console.log(`Organização: ${direcoes} direções, ${areas} áreas, ${nucleos} núcleos.`);
}

// ---------------------------------------------------------------------
// Fase 2 — Carreira&Categoria&Cargo
// ---------------------------------------------------------------------

async function importCarreiraCategoriaCargo(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Carreira&Categoria&Cargo')!;

  // 2a. Carreiras e Categorias primeiro (Cargo depende de ambas)
  for (let r = 2; r <= ws.rowCount; r++) {
    const carreiraId = str(ws, r, 1);
    if (carreiraId !== null) {
      await prisma.carreira.upsert({
        where: { id: carreiraId },
        create: { id: carreiraId, nome: str(ws, r, 2)!, relevante: flagX(ws, r, 3) },
        update: { nome: str(ws, r, 2)!, relevante: flagX(ws, r, 3) },
      });
    }
    const categoriaId = str(ws, r, 5);
    if (categoriaId !== null) {
      await prisma.categoria.upsert({
        where: { id: categoriaId },
        create: { id: categoriaId, nome: str(ws, r, 6)! },
        update: { nome: str(ws, r, 6)! },
      });
    }
  }

  // 2b. Cargos
  const proximoCargoRaw: { cargoId: string; proximos: string[] }[] = [];
  let cargos = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const cargoId = str(ws, r, 8);
    if (cargoId === null) continue;
    await prisma.cargo.upsert({
      where: { id: cargoId },
      create: {
        id: cargoId,
        nome: str(ws, r, 9)!,
        carreiraId: str(ws, r, 10)!,
        categoriaId: str(ws, r, 12)!,
        anosExperienciaMinimo: num(ws, r, 15),
        lobsExigidos: num(ws, r, 16),
        relevante: flagX(ws, r, 17),
        relevanteCarreira: flagX(ws, r, 18),
      },
      update: {
        nome: str(ws, r, 9)!,
        carreiraId: str(ws, r, 10)!,
        categoriaId: str(ws, r, 12)!,
        anosExperienciaMinimo: num(ws, r, 15),
        lobsExigidos: num(ws, r, 16),
        relevante: flagX(ws, r, 17),
        relevanteCarreira: flagX(ws, r, 18),
      },
    });
    cargos++;

    // "Próximo Cargo" pode ter vários códigos separados por "|"
    const proximoRaw = str(ws, r, 14);
    if (proximoRaw !== null) {
      proximoCargoRaw.push({ cargoId, proximos: proximoRaw.split('|').map((s) => s.trim()).filter(Boolean) });
    }
  }

  // 2c. cargo_progressao — só depois de todos os cargos existirem
  await prisma.cargoProgressao.deleteMany({});
  let progressoes = 0;
  for (const { cargoId, proximos } of proximoCargoRaw) {
    for (const proximoCargoId of proximos) {
      await prisma.cargoProgressao.create({ data: { cargoId, proximoCargoId } });
      progressoes++;
    }
  }
  console.log(`Carreiras/Categorias/Cargos: ${cargos} cargos, ${progressoes} ligações de progressão.`);
}

// ---------------------------------------------------------------------
// Fase 3 — Níveis (escala única 0-5)
// ---------------------------------------------------------------------

async function importNiveis(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Níveis')!;
  let count = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = num(ws, r, 1);
    if (id === null) continue;
    await prisma.nivel.upsert({
      where: { id },
      create: { id, nome: str(ws, r, 2)!, descricao: str(ws, r, 3) ?? '' },
      update: { nome: str(ws, r, 2)!, descricao: str(ws, r, 3) ?? '' },
    });
    count++;
  }
  console.log(`Níveis: ${count}.`);
}

// ---------------------------------------------------------------------
// Fase 4 — Competências
// ---------------------------------------------------------------------

async function importCompetencias(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Competências')!;
  let count = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = num(ws, r, 1);
    if (id === null) continue;
    await prisma.competencia.upsert({
      where: { id },
      create: { id, nome: str(ws, r, 2)!, areaId: num(ws, r, 3)! },
      update: { nome: str(ws, r, 2)!, areaId: num(ws, r, 3)! },
    });
    count++;
  }
  console.log(`Competências: ${count}.`);
}

// ---------------------------------------------------------------------
// Fase 5 — Certificações
//
// *** Nota de qualidade de dados (nova, encontrada ao escrever este script) ***
// A folha tem duas cópias da lista de certificações: colunas A/B (estável,
// 47 valores únicos) e colunas D/E (deveriam ser a mesma lista, mas estão
// desalinhadas por um deslizamento de linha a partir da linha 14 — 35 das
// 47 linhas não correspondem a A/B). As linhas de requisito
// (certificação → competência → nível) usam a coluna D para identificar a
// certificação, o que atribuiria o requisito à certificação ERRADA em 7 dos
// 8 casos preenchidos se seguíssemos D literalmente.
//
// Este script usa a coluna A (a lista estável) como identidade da
// certificação em TODOS os casos, incluindo nas linhas de requisito — ou
// seja, ignora deliberadamente a coluna D para a ligação e usa a
// competência/nível da mesma linha, assumindo que o requisito pertence à
// certificação da coluna A dessa linha. Por favor confirma esta leitura
// antes de considerar os dados de `certificacao_requisito_competencia`
// definitivos — ver resumo entregue ao utilizador.
// ---------------------------------------------------------------------

async function importCertificacoes(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Certificações')!;
  let certs = 0;
  const requisitos: { certificacaoId: string; competenciaId: number; nivelId: number }[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const id = str(ws, r, 1); // coluna A — identidade estável, ver nota acima
    if (id === null) continue;
    await prisma.certificacao.upsert({
      where: { id },
      create: { id, nome: str(ws, r, 2)! },
      update: { nome: str(ws, r, 2)! },
    });
    certs++;

    const competenciaId = num(ws, r, 7); // col G — Id Competência
    const nivelId = num(ws, r, 9); // col I — Id Nível
    if (competenciaId !== null && nivelId !== null) {
      requisitos.push({ certificacaoId: id, competenciaId, nivelId });
    }
  }

  await prisma.certificacaoRequisitoCompetencia.deleteMany({});
  for (const req of requisitos) {
    await prisma.certificacaoRequisitoCompetencia.create({ data: req });
  }
  console.log(`Certificações: ${certs}, ${requisitos.length} requisitos de competência.`);
}

// ---------------------------------------------------------------------
// Fase 6 — Formações
// ---------------------------------------------------------------------

async function importFormacoes(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Formações')!;
  let formacoes = 0;
  const requisitos: { formacaoId: number; competenciaId: number; nivelId: number }[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const id = num(ws, r, 1);
    if (id === null) continue;
    await prisma.formacao.upsert({
      where: { id },
      create: { id, nome: str(ws, r, 2)!, areaId: num(ws, r, 3)! },
      update: { nome: str(ws, r, 2)!, areaId: num(ws, r, 3)! },
    });
    formacoes++;

    const competenciaId = num(ws, r, 9); // col I — Id Competência
    const nivelId = num(ws, r, 11); // col K — Id Nível
    if (competenciaId !== null && nivelId !== null) {
      requisitos.push({ formacaoId: id, competenciaId, nivelId });
    }
  }

  await prisma.formacaoRequisitoCompetencia.deleteMany({});
  for (const req of requisitos) {
    await prisma.formacaoRequisitoCompetencia.create({ data: req });
  }
  console.log(`Formações: ${formacoes}, ${requisitos.length} requisitos de competência.`);
}

// ---------------------------------------------------------------------
// Fase 7 — LOBS (motor de gap)
// ---------------------------------------------------------------------

async function importLobs(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('LOBS')!;

  // 7a. LOB master (bloco 1: cols A-E)
  let lobs = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const id = num(ws, r, 1);
    if (id === null) continue;
    await prisma.lob.upsert({
      where: { id },
      create: { id, nome: str(ws, r, 2)!, areaId: num(ws, r, 3)!, pontosMinimos: num(ws, r, 5)! },
      update: { nome: str(ws, r, 2)!, areaId: num(ws, r, 3)!, pontosMinimos: num(ws, r, 5)! },
    });
    lobs++;
  }

  // 7b. LOB x Competência (bloco 2: cols G-N)
  //
  // *** Nota de qualidade de dados (nova) ***
  // Boa parte destas linhas identifica a competência como relevante para a
  // LOB mas ainda não tem `Pontos`/`Nível` preenchidos — não dá para
  // aplicar a fórmula de pontuação (docs/01-modelo-dados.md secção 2) sem
  // esses dois valores. Estas linhas são propositadamente ignoradas aqui
  // (fica reportado quantas) em vez de se assumir um valor por omissão que
  // inventaria uma regra de negócio inexistente.
  await prisma.lobRequisitoCompetencia.deleteMany({});
  let reqCompetencia = 0;
  let reqCompetenciaIncompleta = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const lobId = num(ws, r, 7);
    const competenciaId = num(ws, r, 9);
    if (lobId === null || competenciaId === null) continue;
    const pontos = num(ws, r, 12);
    const nivelMinimoId = num(ws, r, 13);
    if (pontos === null || nivelMinimoId === null) {
      reqCompetenciaIncompleta++;
      continue;
    }
    await prisma.lobRequisitoCompetencia.create({
      data: { lobId, competenciaId, obrigatorio: flagSimNao(ws, r, 11), pontos, nivelMinimoId },
    });
    reqCompetencia++;
  }
  if (reqCompetenciaIncompleta > 0) {
    console.warn(`  aviso: ${reqCompetenciaIncompleta} linhas de LOB x Competência ignoradas por falta de Pontos/Nível na origem.`);
  }

  // 7c. LOB x Certificação (bloco 3: cols P-T)
  await prisma.lobRequisitoCertificacao.deleteMany({});
  let reqCertificacao = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const lobId = num(ws, r, 16);
    const certificacaoId = str(ws, r, 18);
    if (lobId === null || certificacaoId === null) continue;
    await prisma.lobRequisitoCertificacao.create({
      data: { lobId, certificacaoId, obrigatorio: flagSimNao(ws, r, 20) },
    });
    reqCertificacao++;
  }

  console.log(`LOBs: ${lobs}, ${reqCompetencia} requisitos de competência, ${reqCertificacao} requisitos de certificação.`);
}

// ---------------------------------------------------------------------
// Fase 8 — Colaboradores (duas passagens: 1) dados base, 2) manager_id,
// porque um gestor é sempre outro colaborador da mesma lista)
// ---------------------------------------------------------------------

async function importColaboradores(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Colaboradores')!;
  const managerByColaborador: { colaboradorId: number; managerId: number | null }[] = [];
  let count = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const id = num(ws, r, 1);
    if (id === null) continue;

    const data = {
      nome: str(ws, r, 2)!,
      carreiraId: str(ws, r, 3),
      categoriaId: str(ws, r, 5),
      cargoId: str(ws, r, 7),
      direcaoId: num(ws, r, 9),
      nucleoId: num(ws, r, 11),
      areaId: num(ws, r, 13),
      eBum: flagX(ws, r, 17),
      dataAdmissao: excelDate(ws, r, 18),
    };
    await prisma.colaborador.upsert({
      where: { id },
      create: { id, ...data },
      update: data,
    });
    count++;

    managerByColaborador.push({ colaboradorId: id, managerId: num(ws, r, 15) });
  }

  for (const { colaboradorId, managerId } of managerByColaborador) {
    if (managerId !== null) {
      await prisma.colaborador.update({ where: { id: colaboradorId }, data: { managerId } });
    }
  }
  console.log(`Colaboradores: ${count}.`);
}

// ---------------------------------------------------------------------
// Fase 9 — Colaboradores&Competências
//
// O Excel só guarda o estado ATUAL (sem data nem avaliador — ver
// docs/01-modelo-dados.md secção 5). Ao importar para a tabela append-only
// `colaborador_competencia`, usamos a data de execução deste import como
// `data_avaliacao` (é o único facto verdadeiro disponível: "nesta data,
// sabíamos que o nível era X") e um valor de origem dedicado
// `IMPORTADO_EXCEL`, para não fingir que sabemos se foi autoavaliação,
// avaliação do gestor, etc.
// ---------------------------------------------------------------------

async function importColaboradorCompetencias(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Colaboradores&Competências')!;
  const importDate = new Date();
  const rows: { colaboradorId: number; competenciaId: number; nivelId: number; dataAvaliacao: Date; origem: OrigemAvaliacao }[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const colaboradorId = num(ws, r, 1);
    const competenciaId = num(ws, r, 3);
    const nivelId = num(ws, r, 5);
    if (colaboradorId === null || competenciaId === null || nivelId === null) continue;
    rows.push({ colaboradorId, competenciaId, nivelId, dataAvaliacao: importDate, origem: 'IMPORTADO_EXCEL' as OrigemAvaliacao });
  }

  await prisma.colaboradorCompetencia.createMany({ data: rows });
  console.log(`Colaborador x Competência: ${rows.length} avaliações importadas (origem=IMPORTADO_EXCEL, data=${importDate.toISOString().slice(0, 10)}).`);
}

// ---------------------------------------------------------------------
// Fase 10 — Colaboradores&Certificações
// ---------------------------------------------------------------------

async function importColaboradorCertificacoes(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Colaboradores&Certificações')!;
  let count = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const colaboradorId = num(ws, r, 1);
    const certificacaoId = str(ws, r, 3);
    if (colaboradorId === null || certificacaoId === null) continue;

    await prisma.colaboradorCertificacao.upsert({
      where: { colaboradorId_certificacaoId: { colaboradorId, certificacaoId } },
      create: {
        colaboradorId,
        certificacaoId,
        dataObtencao: dotDate(ws, r, 5),
        dataValidade: dotDate(ws, r, 6),
      },
      update: {
        dataObtencao: dotDate(ws, r, 5),
        dataValidade: dotDate(ws, r, 6),
      },
    });
    count++;
  }
  console.log(`Colaborador x Certificação: ${count}.`);
}

// ---------------------------------------------------------------------
// Fase 11 — Colaboradores&Lob recomendação
// ---------------------------------------------------------------------

async function importColaboradorLobRecomendacoes(wb: ExcelJS.Workbook) {
  const ws = wb.getWorksheet('Colaboradores&Lob recomendação')!;
  let count = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const colaboradorId = num(ws, r, 1);
    const lobId = num(ws, r, 3);
    if (colaboradorId === null || lobId === null) continue;

    await prisma.colaboradorLobRecomendacao.upsert({
      where: { colaboradorId_lobId: { colaboradorId, lobId } },
      create: {
        colaboradorId,
        lobId,
        proprio: flagX(ws, r, 5),
        bud: flagX(ws, r, 6),
        auto: flagX(ws, r, 7),
      },
      update: {
        proprio: flagX(ws, r, 5),
        bud: flagX(ws, r, 6),
        auto: flagX(ws, r, 7),
      },
    });
    count++;
  }
  console.log(`Colaborador x LOB recomendação: ${count}.`);
}

// ---------------------------------------------------------------------

async function main() {
  const wb = await loadWorkbook();

  await importOrganizacao(wb);
  await importCarreiraCategoriaCargo(wb);
  await importNiveis(wb);
  await importCompetencias(wb);
  await importCertificacoes(wb);
  await importFormacoes(wb);
  await importLobs(wb);
  await importColaboradores(wb);
  await importColaboradorCompetencias(wb);
  await importColaboradorCertificacoes(wb);
  await importColaboradorLobRecomendacoes(wb);

  console.log('Importação concluída.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
