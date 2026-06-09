import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { BulkImportBizDto } from './dto/bulk-import-biz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Businesses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)   // todos los endpoints requieren estar autenticado
@Controller('businesses')
export class BusinessesController {
  constructor(private businessesService: BusinessesService) {}

  // POST /api/v1/businesses
  @Post()
  @ApiOperation({ summary: 'Crear una nueva empresa' })
  create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateBusinessDto,
  ) {
    return this.businessesService.create(user.id, dto);
  }

  // GET /api/v1/businesses
  @Get()
  @ApiOperation({ summary: 'Listar todas las empresas del usuario' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.businessesService.findAll(user.id);
  }

  // GET /api/v1/businesses/:id
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una empresa por ID' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.businessesService.findOne(user.id, id);
  }

  // POST /api/v1/businesses/:id/biz-transactions/bulk
  @Post(':id/biz-transactions/bulk')
  @ApiOperation({ summary: 'Importar lote de transacciones empresariales desde plantilla Excel' })
  bulkImportBizTransactions(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: BulkImportBizDto,
  ) {
    return this.businessesService.bulkImportBizTransactions(user.id, id, dto);
  }

  // GET /api/v1/businesses/:id/dashboard
  @Get(':id/dashboard')
  @ApiOperation({ summary: 'KPIs del mes: ingresos, gastos, utilidad, cobros pendientes' })
  getDashboard(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.businessesService.getDashboard(user.id, id);
  }

  // PATCH /api/v1/businesses/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de la empresa' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessesService.update(user.id, id, dto);
  }

  // DELETE /api/v1/businesses/:id
  @Delete(':id')
  @ApiOperation({ summary: 'Archivar empresa (no se elimina, solo se desactiva)' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.businessesService.remove(user.id, id);
  }
}
