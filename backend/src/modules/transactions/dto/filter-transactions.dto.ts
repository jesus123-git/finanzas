import { ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsUUID,
  Min,
} from 'class-validator';

export class FilterTransactionsDto {
  @ApiPropertyOptional({ example: 'uuid-de-la-cuenta', description: 'Filtrar por cuenta bancaria' })
  @IsOptional()
  @IsUUID('4')
  bankAccountId?: string;

  @ApiPropertyOptional({ example: 'uuid-de-la-categoria', description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ enum: TransactionType, description: 'Filtrar por tipo de transacción' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Fecha de inicio del rango (ISO 8601 o YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Fecha de fin del rango (ISO 8601 o YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({ example: 1, description: 'Página (paginación, por defecto 1)', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Resultados por página (máx 100, por defecto 20)', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @IsPositive()
  limit?: number = 20;
}
