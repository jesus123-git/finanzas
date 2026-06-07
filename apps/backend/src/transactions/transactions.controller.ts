import {
  Controller, Get, Post, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transactions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/transactions')
export class TransactionsController {
  constructor(private transactionsService: TransactionsService) {}

  // POST /api/v1/businesses/:businessId/transactions
  @Post()
  @ApiOperation({ summary: 'Registrar ingreso o gasto empresarial' })
  create(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(user.id, businessId, dto);
  }

  // GET /api/v1/businesses/:businessId/transactions
  @Get()
  @ApiOperation({ summary: 'Listar transacciones (filtro por type: INCOME | EXPENSE)' })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.findAll(user.id, businessId, type);
  }

  // GET /api/v1/businesses/:businessId/transactions/summary
  @Get('summary')
  @ApiOperation({ summary: 'Resumen del mes actual: ingresos, gastos y utilidad' })
  getSummary(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
  ) {
    return this.transactionsService.getSummary(user.id, businessId);
  }

  // DELETE /api/v1/businesses/:businessId/transactions/:id
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una transacción' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.remove(user.id, businessId, id);
  }
}
