import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsNumber, IsOptional,
  IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { TransactionType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Fila individual de la plantilla empresa ──────────────────────────────────

export class BizImportRowDto {
  @ApiProperty({ example: '2025-06-15T00:00:00.000Z', description: 'Fecha ISO 8601' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '[FAC-001] Almacenes Éxito — Venta producto A' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: 1190000, description: 'Total (con IVA)' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type: TransactionType;

  /** Datos adicionales de la plantilla empresa (se guardan en categoryLabel) */
  @ApiPropertyOptional({ example: 'Almacenes Éxito S.A.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  clienteProveedor?: string;

  @ApiPropertyOptional({ example: 'FAC-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nroFactura?: string;

  @ApiPropertyOptional({ example: 1000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotal?: number;

  @ApiPropertyOptional({ example: 190000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  iva?: number;
}

// ─── Body del endpoint /bulk ──────────────────────────────────────────────────

export class BulkImportBizDto {
  @ApiProperty({ type: [BizImportRowDto], description: 'Filas de la plantilla empresa' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BizImportRowDto)
  rows: BizImportRowDto[];
}
