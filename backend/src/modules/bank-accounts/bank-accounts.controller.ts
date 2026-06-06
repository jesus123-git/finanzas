import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { BankAccountsService } from './bank-accounts.service';
import { CreateBankAccountDto } from './dto/create-bank-account.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { BankAccountResponseDto } from './dto/bank-account-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

// Aplicamos el guard a nivel de controller: TODAS las rutas quedan protegidas.
// Si solo queremos proteger algunas, lo pondríamos método a método.
@ApiTags('Bank Accounts')
@ApiBearerAuth()           // Indica en Swagger que este controller requiere JWT
@UseGuards(JwtAuthGuard)   // ← Protege todas las rutas del controller
@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  // ─── POST /api/v1/bank-accounts ───────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cuenta bancaria' })
  @ApiCreatedResponse({ type: BankAccountResponseDto })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    return this.bankAccountsService.create(user.id, dto);
  }

  // ─── GET /api/v1/bank-accounts ────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'Listar todas las cuentas del usuario autenticado' })
  @ApiOkResponse({ type: [BankAccountResponseDto] })
  findAll(
    @CurrentUser() user: { id: string },
  ): Promise<BankAccountResponseDto[]> {
    return this.bankAccountsService.findAll(user.id);
  }

  // ─── GET /api/v1/bank-accounts/summary ────────────────────────────────────

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen de saldo total agrupado por moneda',
    description: 'Suma los balances de todas las cuentas. Útil para el dashboard.',
  })
  @ApiOkResponse({
    schema: {
      example: { totalByCurrency: { COP: 3500000, USD: 1200 }, accountCount: 3 },
    },
  })
  getBalanceSummary(@CurrentUser() user: { id: string }) {
    return this.bankAccountsService.getBalanceSummary(user.id);
  }

  // ─── GET /api/v1/bank-accounts/:id ───────────────────────────────────────

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una cuenta bancaria por ID' })
  @ApiOkResponse({ type: BankAccountResponseDto })
  @ApiNotFoundResponse({ description: 'Cuenta no encontrada' })
  @ApiForbiddenResponse({ description: 'La cuenta pertenece a otro usuario' })
  findOne(
    @CurrentUser() user: { id: string },
    // ParseUUIDPipe valida que ':id' sea un UUID válido antes de llegar al servicio.
    // Si no lo es, devuelve 400 Bad Request automáticamente.
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BankAccountResponseDto> {
    return this.bankAccountsService.findOne(user.id, id);
  }

  // ─── PATCH /api/v1/bank-accounts/:id ─────────────────────────────────────

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una cuenta bancaria' })
  @ApiOkResponse({ type: BankAccountResponseDto })
  @ApiNotFoundResponse({ description: 'Cuenta no encontrada' })
  @ApiForbiddenResponse({ description: 'La cuenta pertenece a otro usuario' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBankAccountDto,
  ): Promise<BankAccountResponseDto> {
    return this.bankAccountsService.update(user.id, id, dto);
  }

  // ─── DELETE /api/v1/bank-accounts/:id ────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una cuenta bancaria',
    description:
      'Eliminación en cascada: también borra las transacciones asociadas (definido en el schema de Prisma con onDelete: Cascade).',
  })
  @ApiOkResponse({ schema: { example: { message: 'Cuenta eliminada correctamente' } } })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'Cuenta no encontrada' })
  @ApiForbiddenResponse({ description: 'La cuenta pertenece a otro usuario' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bankAccountsService.remove(user.id, id);
  }
}
