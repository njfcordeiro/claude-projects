import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige um JWT válido. Aplicar globalmente ou por controller/rota conforme necessário. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
