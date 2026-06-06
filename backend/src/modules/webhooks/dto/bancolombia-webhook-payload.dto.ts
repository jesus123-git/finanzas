import { ApiProperty } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class BancolombiaWebhookPayloadDto {
  @ApiProperty({
    example: '04130100123456789',
    description:
      'Número de cuenta Bancolombia. Acepta formatos: ' +
      '11 dígitos (cuenta corriente/ahorros), ' +
      '16-18 dígitos (tarjeta crédito) o ' +
      '10 dígitos (número de celular Bancolombia a la mano).',
  })
  @IsString()
  @Matches(/^\d{10,18}$/, {
    message: 'accountNumber debe tener entre 10 y 18 dígitos numéricos',
  })
  accountNumber: string;

  @ApiProperty({ example: 200000, description: 'Monto de la operación (siempre positivo)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  amount: number;

  @ApiProperty({
    enum: ['INCOME', 'EXPENSE'],
    description: 'INCOME = abono / EXPENSE = débito',
  })
  @IsEnum(['INCOME', 'EXPENSE'], {
    message: 'type debe ser INCOME o EXPENSE',
  })
  type: Extract<TransactionType, 'INCOME' | 'EXPENSE'>;

  @ApiProperty({ example: 'Transferencia PSE - Pago nómina' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  description: string;

  @ApiProperty({ example: '2026-06-06T13:00:00Z', description: 'Fecha de la operación en ISO 8601' })
  @IsISO8601({}, { message: 'timestamp debe ser ISO 8601 válido' })
  timestamp: string;

  @ApiProperty({ example: 'BCO-TRX-20260606-001' })
  @IsString()
  @IsNotEmpty()
  transactionId: string;
}
