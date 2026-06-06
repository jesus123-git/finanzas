import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { AccountType } from '@prisma/client';

export class CreateBankAccountDto {
  @ApiProperty({
    example: 'Cuenta Nómina Bancolombia',
    description: 'Nombre descriptivo de la cuenta',
  })
  @IsString()
  @Length(1, 100, { message: 'El nombre debe tener entre 1 y 100 caracteres' })
  name: string;

  @ApiProperty({
    enum: AccountType,
    example: AccountType.CHECKING,
    description: 'Tipo de cuenta bancaria',
  })
  @IsEnum(AccountType, {
    message: `El tipo debe ser uno de: ${Object.values(AccountType).join(', ')}`,
  })
  type: AccountType;

  @ApiPropertyOptional({
    example: 1500000.5,
    description: 'Saldo inicial de la cuenta (por defecto 0)',
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'El balance debe ser un número' })
  @Min(0, { message: 'El balance inicial no puede ser negativo' })
  balance?: number;

  @ApiPropertyOptional({
    example: 'COP',
    description: 'Código ISO 4217 de la moneda (por defecto COP)',
    default: 'COP',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'La moneda debe ser un código de 3 letras (ej: COP, USD)' })
  currency?: string;

  @ApiPropertyOptional({
    example: 'Bancolombia',
    description: 'Nombre del banco o entidad financiera',
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  provider?: string;

  @ApiPropertyOptional({
    example: '**** **** **** 4242',
    description: 'Identificador externo enmascarado (últimos 4 dígitos, etc.)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  externalAccountId?: string;
}
