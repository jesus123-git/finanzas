import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/customers')  // anidado bajo businesses
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  // POST /api/v1/businesses/:businessId/customers
  @Post()
  @ApiOperation({ summary: 'Crear cliente para una empresa' })
  create(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(user.id, businessId, dto);
  }

  // GET /api/v1/businesses/:businessId/customers
  @Get()
  @ApiOperation({ summary: 'Listar clientes de una empresa' })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
  ) {
    return this.customersService.findAll(user.id, businessId);
  }

  // GET /api/v1/businesses/:businessId/customers/:id
  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cliente con sus últimas facturas' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.findOne(user.id, businessId, id);
  }

  // GET /api/v1/businesses/:businessId/customers/:id/statement
  @Get(':id/statement')
  @ApiOperation({ summary: 'Estado de cuenta: total facturado, pagado y pendiente' })
  getStatement(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.getStatement(user.id, businessId, id);
  }

  // PATCH /api/v1/businesses/:businessId/customers/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos del cliente' })
  update(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.id, businessId, id, dto);
  }

  // DELETE /api/v1/businesses/:businessId/customers/:id
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.customersService.remove(user.id, businessId, id);
  }
}
