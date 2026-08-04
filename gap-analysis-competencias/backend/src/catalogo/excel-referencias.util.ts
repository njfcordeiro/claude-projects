import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { encontrarTabela } from './catalogo.registry';

/** Nome da sheet de referência de uma tabela — usado tanto para a criar como para lhe apontar fórmulas, para nunca desalinhar os dois sítios. */
export function nomeFolhaDeOpcoes(label: string): string {
  return `Opções — ${label}`.slice(0, 31);
}

/**
 * Acrescenta, a um workbook de export já preenchido, uma sheet "Opções — X"
 * por cada tabela de catálogo indicada, com as colunas id/nome de todos os
 * registos existentes — pedido do utilizador: "ou então termos uma sheet
 * com as opções possíveis de usar em cada campo". Nunca toca na sheet de
 * dados principal, por isso o ficheiro de download continua a poder ser
 * reenviado tal e qual no upload (round-trip).
 */
export async function adicionarFolhasDeOpcoes(workbook: ExcelJS.Workbook, prisma: PrismaService, tabelas: string[]): Promise<void> {
  const usados = new Set<string>();
  for (const tabela of tabelas) {
    if (usados.has(tabela)) continue;
    usados.add(tabela);

    const def = encontrarTabela(tabela);
    const opcoes: { id: unknown; nome: unknown }[] = await (prisma as any)[def.delegate].findMany({
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });

    const sheet = workbook.addWorksheet(nomeFolhaDeOpcoes(def.label));
    sheet.addRow(['id', 'nome']);
    for (const o of opcoes) sheet.addRow([o.id, o.nome]);
  }
}

/**
 * Fórmula VLOOKUP que resolve o id na célula `idCelula` (ex. "C2") para o
 * nome atual na sheet de opções indicada — pedido do utilizador: as colunas
 * "— nome atual" devem atualizar-se sozinhas quando o id ao lado muda, sem
 * precisar de reexportar. IFERROR mostra vazio em vez de #N/A quando o id
 * ainda não corresponde a nenhuma opção (célula vazia ou id inválido).
 */
export function formulaNomeAtual(idCelula: string, nomeFolha: string): { formula: string } {
  return { formula: `IFERROR(VLOOKUP(${idCelula},'${nomeFolha}'!A:B,2,FALSE),"")` };
}

/** Converte um índice de coluna 1-based (1, 2, 3, ...) na letra Excel correspondente (A, B, C, ..., Z, AA, AB, ...). */
export function numParaColunaExcel(indice1Based: number): string {
  let n = indice1Based;
  let letras = '';
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}
