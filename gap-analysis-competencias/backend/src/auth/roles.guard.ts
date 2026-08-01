import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PapelUtilizador } from '@prisma/client';
import { ROLES_KEY } from './roles.decorator';
import { AuthenticatedUser } from './jwt-payload.interface';

/**
 * RBAC grosseiro (ver docs/02-arquitetura-tecnica.md secção 4.3). Corre
 * depois do JwtAuthGuard — assume `request.user` já preenchido.
 * Sem `@Roles(...)` no handler, deixa passar qualquer utilizador
 * autenticado (a restrição fina fica ao critério do service).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<PapelUtilizador[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const user: AuthenticatedUser = context.switchToHttp().getRequest().user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Requer um dos papéis: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
