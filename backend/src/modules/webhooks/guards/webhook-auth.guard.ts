import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Guard unificado para todos los webhooks de entidades financieras.
 *
 * Verifica el header `X-Webhook-Auth` contra `WEBHOOK_SECRET` en .env.
 *
 * Equivalente de seguridad en producción:
 *   - Nequi real:       HMAC-SHA256 del body en `X-Nequi-Signature`
 *   - Bancolombia real: Bearer token rotativo en `Authorization`
 *
 * Para la simulación usamos un API Key compartido — seguro para
 * entornos de desarrollo, NO usar en producción sin reemplazar por HMAC.
 */
@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req      = ctx.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('WEBHOOK_SECRET');
    const provided  = req.headers['x-webhook-auth'];

    if (!expected) {
      throw new UnauthorizedException(
        'WEBHOOK_SECRET no está configurado en el servidor',
      );
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException(
        'Header X-Webhook-Auth inválido o ausente',
      );
    }
    return true;
  }
}
