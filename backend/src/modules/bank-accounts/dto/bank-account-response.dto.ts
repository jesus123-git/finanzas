import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType } from '@prisma/client';

// DTO de respuesta: define la "forma" del JSON que devuelve la API.
// Sirve para que Swagger genere la documentación correcta del response body.
export class BankAccountResponseDto {
  @ApiProperty({ example: 'uuid-de-la-cuenta' })
  id: string;

  @ApiProperty({ example: 'Cuenta Nómina Bancolombia' })
  name: string;

  @ApiProperty({ enum: AccountType, example: AccountType.CHECKING })
  type: AccountType;

  @ApiProperty({ example: 1500000.5 })
  balance: number;

  @ApiProperty({ example: 'COP' })
  currency: string;

  @ApiPropertyOptional({ example: 'Bancolombia' })
  provider: string | null;

  @ApiPropertyOptional({ example: '**** 4242' })
  externalAccountId: string | null;

  @ApiProperty({ example: 'uuid-del-usuario' })
  userId: string;

  @ApiProperty({ example: '2026-06-06T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-06T00:00:00.000Z' })
  updatedAt: Date;
}
