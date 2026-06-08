import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PriceListsService } from './price-lists.service';
import { CreatePriceListDto, PriceListItemDto } from './dto/create-price-list.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class UpsertItemsDto {
  @ApiProperty({ type: [PriceListItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceListItemDto)
  items: PriceListItemDto[];
}

class ToggleDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

@ApiTags('Price Lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/price-lists')
export class PriceListsController {
  constructor(private priceListsService: PriceListsService) {}

  // PATCH /businesses/:id/price-lists/toggle — activa o desactiva la función
  @Patch('toggle')
  @ApiOperation({ summary: 'Activar o desactivar listas de precios para la empresa' })
  toggle(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Body() dto: ToggleDto,
  ) {
    return this.priceListsService.togglePriceLists(user.id, businessId, dto.enabled);
  }

  @Post()
  @ApiOperation({ summary: 'Crear lista de precios (Mayorista, Minorista, Especial...)' })
  create(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Body() dto: CreatePriceListDto,
  ) {
    return this.priceListsService.create(user.id, businessId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las listas de precios' })
  findAll(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
  ) {
    return this.priceListsService.findAll(user.id, businessId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una lista de precios con sus productos' })
  findOne(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.priceListsService.findOne(user.id, businessId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renombrar lista o cambiar default' })
  update(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePriceListDto>,
  ) {
    return this.priceListsService.update(user.id, businessId, id, dto);
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Agregar o actualizar precios de productos en la lista' })
  upsertItems(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body() dto: UpsertItemsDto,
  ) {
    return this.priceListsService.upsertItems(user.id, businessId, id, dto.items);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar lista de precios' })
  remove(
    @CurrentUser() user: { id: string },
    @Param('businessId') businessId: string,
    @Param('id') id: string,
  ) {
    return this.priceListsService.remove(user.id, businessId, id);
  }
}
