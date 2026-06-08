import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

// ─── Fila individual ──────────────────────────────────────────────────────────

export class BulkItemDto {
  @ApiProperty({ example: '2026-06-01T00:00:00.000Z', description: 'Fecha en ISO 8601' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Mercado semanal', description: 'Descripción (máx 200 chars)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: 45000, description: 'Monto positivo' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @ApiProperty({ enum: ['INCOME', 'EXPENSE'], description: 'Solo INCOME o EXPENSE' })
  @IsEnum([TransactionType.INCOME, TransactionType.EXPENSE], {
    message: 'Solo se permiten tipos INCOME o EXPENSE en importación masiva',
  })
  type: TransactionType;
}

// ─── Payload completo ─────────────────────────────────────────────────────────

export class BulkImportDto {
  @ApiProperty({ example: 'uuid-de-la-cuenta', description: 'Cuenta bancaria destino' })
  @IsUUID('4')
  bankAccountId: string;

  @ApiProperty({ example: 'uuid-de-la-categoria', description: 'Categoría para todas las filas' })
  @IsUUID('4')
  categoryId: string;

  @ApiProperty({
    type:  [BulkItemDto],
    description: 'Entre 1 y 1000 transacciones',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  rows: BulkItemDto[];
}
