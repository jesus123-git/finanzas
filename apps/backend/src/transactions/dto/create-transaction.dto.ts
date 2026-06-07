import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType, example: 'INCOME' })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1500000 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ example: 'Venta de producto' })
  @IsString()
  description: string;

  @ApiProperty({ example: '2026-06-07' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: 'Ventas', required: false })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'Notas adicionales', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
