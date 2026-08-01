import { SetMetadata } from '@nestjs/common';
import { PapelUtilizador } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** RBAC grosseiro: bloqueia à entrada do controller quem não tem o papel certo. */
export const Roles = (...roles: PapelUtilizador[]) => SetMetadata(ROLES_KEY, roles);
