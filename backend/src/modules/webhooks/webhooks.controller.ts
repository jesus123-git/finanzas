import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WebhooksService } from './webhooks.service';
import { NequiWebhookPayloadDto } from './dto/nequi-webhook-payload.dto';
import { BancolombiaWebhookPayloadDto } from './dto/bancolombia-webhook-payload.dto';
import { MobileParserPayloadDto } from './dto/mobile-parser-payload.dto';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';

// ─── Decorator compartido para la cabecera de autenticación ──────────────────
// Evita repetir @ApiHeader en cada endpoint protegido.
const WebhookAuthHeader = () =>
  ApiHeader({
    name:        'X-Webhook-Auth',
    description: 'API Key secreta (WEBHOOK_SECRET en el .env)',
    required:    true,
  });

// ─── Controller ───────────────────────────────────────────────────────────────
//
// El guard NO se aplica a nivel de clase porque GET /ping debe ser público
// (el frontend lo llama sin credenciales para el polling de eventos).
// Cada endpoint protegido lleva su propio @UseGuards(WebhookAuthGuard).

@ApiTags('Webhooks — Open Banking')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  // ── GET /ping — público (sin autenticación) ───────────────────────────────
  //
  // Devuelve el timestamp del último webhook procesado con éxito.
  // El hook useWebhookPoll() del frontend hace polling aquí cada 5s
  // para detectar nuevas transacciones y ejecutar un refetch automático.

  @Get('ping')
  @ApiOperation({
    summary: 'Timestamp del último evento procesado',
    description:
      'Endpoint público sin autenticación. Devuelve `lastEventAt` como ISO 8601. ' +
      'El frontend compara este valor en cada poll para detectar cambios y hacer refetch.',
  })
  @ApiOkResponse({
    schema: {
      example: { lastEventAt: '2026-06-07T15:32:01.000Z' },
    },
  })
  ping() {
    return this.webhooks.getLastEventAt();
  }

  // ── POST /nequi ───────────────────────────────────────────────────────────

  @Post('nequi')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookAuthGuard)
  @WebhookAuthHeader()
  @ApiUnauthorizedResponse({ description: 'X-Webhook-Auth inválido o ausente' })
  @ApiOperation({
    summary: 'Webhook Nequi (simulador)',
    description:
      'Registra una transacción en la cuenta Nequi identificada por `phoneNumber`. ' +
      'Actualiza el balance de forma atómica y emite evento de refresco al frontend.',
  })
  @ApiOkResponse({ description: 'Transacción registrada y balance actualizado' })
  handleNequi(@Body() payload: NequiWebhookPayloadDto) {
    return this.webhooks.handleNequi(payload);
  }

  // ── POST /bancolombia ─────────────────────────────────────────────────────

  @Post('bancolombia')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookAuthGuard)
  @WebhookAuthHeader()
  @ApiUnauthorizedResponse({ description: 'X-Webhook-Auth inválido o ausente' })
  @ApiOperation({
    summary: 'Webhook Bancolombia (simulador)',
    description:
      'Registra un abono o débito en la cuenta Bancolombia identificada por `accountNumber`. ' +
      'Actualiza el balance de forma atómica y emite evento de refresco al frontend.',
  })
  @ApiOkResponse({ description: 'Transacción registrada y balance actualizado' })
  handleBancolombia(@Body() payload: BancolombiaWebhookPayloadDto) {
    return this.webhooks.handleBancolombia(payload);
  }

  // ── POST /mobile-parser ───────────────────────────────────────────────────
  //
  // Endpoint para iOS Shortcuts y MacroDroid. Recibe el texto crudo del SMS
  // o notificación bancaria y lo procesa automáticamente con regex.
  //
  // Configuración en el dispositivo móvil:
  //   URL:     POST https://<ngrok-url>/api/v1/webhooks/mobile-parser
  //   Headers: X-Webhook-Auth: nequi_bancolombia_secret_2026
  //            Content-Type: application/json
  //   Body:    { "text": "<texto del SMS>", "devicePhone": "<número celular>" }

  @Post('mobile-parser')
  @HttpCode(HttpStatus.OK)
  @UseGuards(WebhookAuthGuard)
  @WebhookAuthHeader()
  @ApiUnauthorizedResponse({ description: 'X-Webhook-Auth inválido o ausente' })
  @ApiOperation({
    summary: 'Parser inteligente de SMS/notificaciones bancarias (móvil)',
    description: `
Recibe el texto crudo de un SMS o notificación push de Nequi o Bancolombia
y lo procesa automáticamente sin configuración previa.

**Motor de parsing (tolerante a fallos):**
- **Proveedor**: detecta "Bancolombia", "Nequi" o "¡Plata!" en el texto
- **Tipo**: EXPENSE si contiene compra/retiro/pago/pagaste/enviaste/débito;
             INCOME si contiene recibió/abono/consignación/te enviaron/¡Plata! Recibiste
- **Monto**: extrae el valor después de '$', limpia separadores colombianos
             ($45.000 → 45000, $1.234.567 → 1234567)
- **Bancolombia**: busca cuenta por últimos 4 dígitos ("Cta *5678")
- **Nequi**: busca cuenta por devicePhone

Si no encuentra la cuenta o no puede parsear el texto, retorna \`ok: false\`
con un mensaje descriptivo — **nunca lanza error 500**.
    `,
  })
  @ApiOkResponse({
    schema: {
      example: {
        ok:          true,
        message:     'Transacción procesada y balance actualizado',
        accountName: 'Mi Nequi Principal',
        provider:    'NEQUI',
        type:        'INCOME',
        amount:      50000,
      },
    },
  })
  handleMobileParser(@Body() payload: MobileParserPayloadDto) {
    return this.webhooks.handleMobileParser(payload);
  }
}
