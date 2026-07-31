import { PapelUtilizador } from '@prisma/client';

export interface JwtPayload {
  sub: number; // users.id
  colaboradorId: number | null;
  role: PapelUtilizador;
}

/** Anexado a `request.user` pelo JwtStrategy após validar o token. */
export type AuthenticatedUser = JwtPayload;
