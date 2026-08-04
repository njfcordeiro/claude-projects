import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { encontrarTabela } from './catalogo.registry';

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

    const sheet = workbook.addWorksheet(`Opções — ${def.label}`.slice(0, 31));
    sheet.addRow(['id', 'nome']);
    for (const o of opcoes) sheet.addRow([o.id, o.nome]);
  }
}
