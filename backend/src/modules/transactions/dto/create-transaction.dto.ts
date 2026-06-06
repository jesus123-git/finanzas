import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateTransactionDto {
  // ─── Campos comunes a todos los tipos ───────────────────────────────────

  @ApiProperty({
    example: 45000,
    description: 'Monto de la transacción. Siempre positivo; el tipo determina la dirección del flujo.',
  })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto debe ser un número con máximo 2 decimales' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  amount: number;

  @ApiProperty({ example: 'Mercado semanal', description: 'Descripción breve de la transacción' })
  @IsString()
  @IsNotEmpty({ message: 'La descripción no puede estar vacía' })
  @MaxLength(200)
  description: string;

  @ApiProperty({
    enum: TransactionType,
    example: TransactionType.EXPENSE,
    description:
      'INCOME → suma al balance. EXPENSE → resta al balance. ' +
      'TRANSFER → resta en la cuenta origen y suma en la de destino.',
  })
  @IsEnum(TransactionType, {
    message: `El tipo debe ser: ${Object.values(TransactionType).join(', ')}`,
  })
  type: TransactionType;

  @ApiProperty({
    example: 'uuid-de-la-cuenta',
    description: 'Cuenta bancaria origen (debe pertenecer al usuario autenticado)',
  })
  @IsUUID('4', { message: 'bankAccountId debe ser un UUID v4 válido' })
  bankAccountId: string;

  @ApiProperty({
    example: 'uuid-de-la-categoria',
    description: 'Categoría (debe pertenecer al usuario autenticado)',
  })
  @IsUUID('4', { message: 'categoryId debe ser un UUID v4 válido' })
  categoryId: string;

  @ApiPropertyOptional({
    example: '2026-06-06T12:00:00.000Z',
    description: 'Fecha de la transacción en ISO 8601 (por defecto: ahora)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La fecha debe estar en formato ISO 8601' })
  date?: string;

  // ─── Solo requerido cuando type === TRANSFER ─────────────────────────────

  @ApiPropertyOptional({
    example: 'uuid-de-la-cuenta-destino',
    description:
      '[Solo para TRANSFER] Cuenta bancaria destino. ' +
      'Debe pertenecer al usuario autenticado y ser distinta a bankAccountId.',
  })
  // ValidateIf → el decorador solo corre si type es TRANSFER.
  // Sin esto, el campo sería requerido siempre o ignorado siempre.
  @ValidateIf((o: CreateTransactionDto) => o.type === TransactionType.TRANSFER)
  @IsUUID('4', { message: 'destinationBankAccountId debe ser un UUID v4 válido' })
  @IsNotEmpty({ message: 'destinationBankAccountId es obligatorio para transferencias' })
  destinationBankAccountId?: string;
}
