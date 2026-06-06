import {
  Body,
  Controller,
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
import { WebhookAuthGuard } from './guards/webhook-auth.guard';

// El guard se aplica a nivel de controlador → ambos endpoints lo heredan.
// Ninguno requiere JWT de sesión — simulan llamadas entrantes de las entidades.
@ApiTags('Webhooks — Open Banking')
@Controller('webhooks')
@UseGuards(WebhookAuthGuard)
@ApiHeader({
  name: 'X-Webhook-Auth',
  description: 'API Key secreta (WEBHOOK_SECRET en el .env)',
  required: true,
})
@ApiUnauthorizedResponse({ description: 'X-Webhook-Auth inválido o ausente' })
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  // ── Nequi ──────────────────────────────────────────────────────────────────

  @Post('nequi')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook Nequi',
    description:
      'Registra una transacción en la cuenta Nequi identificada por el número ' +
      'de teléfono (10 dígitos). Actualiza el balance de forma atómica.',
  })
  @ApiOkResponse({ description: 'Transacción registrada y balance actualizado' })
  handleNequi(@Body() payload: NequiWebhookPayloadDto) {
    return this.webhooks.handleNequi(payload);
  }

  // ── Bancolombia ────────────────────────────────────────────────────────────

  @Post('bancolombia')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook Bancolombia',
    description:
      'Registra un abono o débito en la cuenta Bancolombia identificada por el ' +
      'número de cuenta (10-18 dígitos). Actualiza el balance de forma atómica.',
  })
  @ApiOkResponse({ description: 'Transacción registrada y balance actualizado' })
  handleBancolombia(@Body() payload: BancolombiaWebhookPayloadDto) {
    return this.webhooks.handleBancolombia(payload);
  }
}
