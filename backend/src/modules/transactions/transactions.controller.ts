import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FilterTransactionsDto } from './dto/filter-transactions.dto';
import { CalendarQueryDto } from './dto/calendar-query.dto';
import { BulkImportDto } from './dto/bulk-import.dto';
import { PaginatedTransactionsDto, TransactionResponseDto } from './dto/transaction-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  // ─── POST /api/v1/transactions ────────────────────────────────────────────

  @Post()
  @ApiOperation({
    summary: 'Crear una transacción y actualizar el balance de la cuenta',
    description:
      '**INCOME** → suma `amount` al balance.\n\n' +
      '**EXPENSE** → resta `amount` al balance.\n\n' +
      '**TRANSFER** → requiere `destinationBankAccountId`; ' +
      'resta en origen y suma en destino. ' +
      'Todo ocurre en una transacción atómica de BD (`prisma.$transaction`).',
  })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  @ApiForbiddenResponse({ description: 'La cuenta o categoría pertenece a otro usuario' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTransactionDto,
  ): Promise<TransactionResponseDto> {
    return this.transactionsService.create(user.id, dto);
  }

  // ─── GET /api/v1/transactions ─────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Listar transacciones del usuario con filtros y paginación',
    description:
      'Todos los filtros son opcionales y se combinan con AND. ' +
      'La respuesta incluye `totalIncome` y `totalExpense` calculados sobre el filtro activo.',
  })
  @ApiOkResponse({ type: PaginatedTransactionsDto })
  // Documentamos cada query param explícitamente para Swagger
  @ApiQuery({ name: 'bankAccountId', required: false, type: String })
  @ApiQuery({ name: 'categoryId',   required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: TransactionType })
  @ApiQuery({ name: 'start', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'end',   required: false, type: String, example: '2026-12-31' })
  @ApiQuery({ name: 'page',  required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  findAll(
    @CurrentUser() user: { id: string },
    // @Query() + el DTO hace que ValidationPipe transforme y valide
    // los query params exactamente igual que hace con el body.
    @Query() filters: FilterTransactionsDto,
  ): Promise<PaginatedTransactionsDto> {
    return this.transactionsService.findAll(user.id, filters);
  }

  // ─── GET /api/v1/transactions/calendar?year=2026&month=6 ─────────────────

  @Get('calendar')
  @ApiOperation({
    summary: 'Totales diarios de ingresos y gastos para un mes completo',
    description:
      'Devuelve un mapa `{ days: { "1": { income, expense, count }, … } }` ' +
      'con los agregados de cada día del mes en hora Colombia (UTC-5).',
  })
  @ApiQuery({ name: 'year',  required: true, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 6 })
  calendar(
    @CurrentUser() user: { id: string },
    @Query() query: CalendarQueryDto,
  ) {
    return this.transactionsService.getCalendar(user.id, query.year, query.month);
  }

  // ─── POST /api/v1/transactions/bulk ──────────────────────────────────────

  @Post('bulk')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Importar lote de transacciones (desde Excel)',
    description:
      'Inserta hasta 1000 transacciones en una sola operación atómica. ' +
      'Actualiza el balance de la cuenta automáticamente. ' +
      'Solo se permiten tipos INCOME y EXPENSE.',
  })
  @ApiCreatedResponse({
    schema: { example: { inserted: 120, accountName: 'Nequi Personal' } },
  })
  bulkImport(
    @CurrentUser() user: { id: string },
    @Body() dto: BulkImportDto,
  ) {
    return this.transactionsService.bulkImport(user.id, dto);
  }

  // ─── GET /api/v1/transactions/summary/categories?year=2026&month=6 ───────

  @Get('summary/categories')
  @ApiOperation({
    summary: 'Gastos del mes agrupados por categoría (para gráfica de dona)',
    description:
      'Devuelve `{ items: [{ categoryId, categoryName, total, count, percentage }], total }`. ' +
      'Solo incluye transacciones de tipo EXPENSE.',
  })
  @ApiQuery({ name: 'year',  required: true, type: Number, example: 2026 })
  @ApiQuery({ name: 'month', required: true, type: Number, example: 6 })
  categoryStats(
    @CurrentUser() user: { id: string },
    @Query() query: CalendarQueryDto,
  ) {
    return this.transactionsService.getCategoryStats(user.id, query.year, query.month);
  }

  // ─── DELETE /api/v1/transactions/:id ─────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar una transacción y revertir su impacto en el balance',
    description:
      'Atomicidad garantizada: si la reversión del balance falla, ' +
      'la transacción tampoco se elimina.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        message: "Transacción 'uuid' eliminada y balance de 'Cuenta Nómina' revertido",
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Transacción no encontrada' })
  @ApiForbiddenResponse({ description: 'La transacción pertenece a otro usuario' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.transactionsService.remove(user.id, id);
  }
}
