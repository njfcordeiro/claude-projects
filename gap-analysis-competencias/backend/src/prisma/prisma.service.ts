import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * O trigger de auditoria genérico (docs/01-modelo-dados.md secção 5.3,
 * migração em prisma/migrations) só preenche `audit_log.changed_by` se a
 * GUC de sessão Postgres `app.current_user_id` estiver definida na MESMA
 * ligação/transação que executa a escrita.
 *
 * O pool de ligações do Prisma não garante que duas queries sequenciais
 * usem a mesma ligação — por isso não basta fazer `set_config` numa query
 * e confiar que a escrita seguinte "vê" essa sessão. A forma correta é
 * `runAsUser`: um `$transaction` que fixa uma única ligação para o
 * `set_config` e para a escrita que se segue.
 *
 * Usar sempre `runAsUser` (não `prisma.<model>.update/create/delete`
 * diretamente) nos services para qualquer escrita que deva ficar atribuída
 * ao utilizador autenticado.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async runAsUser<T>(
    userId: number | null,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      if (userId !== null) {
        await tx.$executeRaw`SELECT set_config('app.current_user_id', ${String(userId)}, true)`;
      }
      return fn(tx);
    });
  }
}
