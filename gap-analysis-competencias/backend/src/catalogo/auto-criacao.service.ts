import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { encontrarTabela } from './catalogo.registry';

/**
 * Resolve o valor de uma célula de importação (id existente OU nome) para o
 * id do registo relacionado. Nunca cria nada — se não existir nem por id nem
 * por nome, lança erro (mesma regra para todos os campos de relação, ver
 * `ColaboradoresService.importar`/`CatalogoService.importar`: um ficheiro
 * com uma referência em falta é rejeitado por inteiro, nada é escrito).
 */
@Injectable()
export class AutoCriacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolver(relatedTable: string, valorBruto: string | number): Promise<string | number> {
    const def = encontrarTabela(relatedTable);
    const delegate = (this.prisma as any)[def.delegate];
    const pkCampo = def.campos.find((c) => c.key === def.identityFields[0]);

    if (pkCampo?.tipo === 'int') {
      const comoNumero =
        typeof valorBruto === 'number'
          ? valorBruto
          : /^-?\d+$/.test(String(valorBruto).trim())
            ? Number(valorBruto)
            : null;
      if (comoNumero !== null) {
        const existente = await delegate.findUnique({ where: { id: comoNumero } });
        if (existente) return comoNumero;
      }
    } else {
      const comoTexto = String(valorBruto).trim();
      const existentePorId = await delegate.findUnique({ where: { id: comoTexto } });
      if (existentePorId) return comoTexto;
    }

    const nome = String(valorBruto).trim();
    const existentePorNome = await delegate.findFirst({ where: { nome } });
    if (existentePorNome) return existentePorNome.id;

    throw new Error(`"${nome}" não encontrado em "${def.label}" — cria o registo em Gestão de Dados → ${def.label} primeiro.`);
  }
}
