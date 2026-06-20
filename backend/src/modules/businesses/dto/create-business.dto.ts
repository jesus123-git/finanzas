import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// Monedas LATAM soportadas (+ USD como refugio común en la región)
export const SUPPORTED_CURRENCIES = [
  'COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'UYU', 'BOB', 'PYG', 'GTQ', 'DOP', 'USD',
] as const;

export class CreateBusinessDto {
  @ApiProperty({ example: 'Mi Empresa SAS' })
  @IsString()
  name: string;

  @ApiProperty({ example: '900123456-7', required: false })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({ example: 'COP', required: false, enum: SUPPORTED_CURRENCIES })
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES as unknown as string[], {
    message: `La moneda debe ser una de: ${SUPPORTED_CURRENCIES.join(', ')}`,
  })
  currency?: string;

  @ApiProperty({ example: 'Mi Empresa S.A.S.', required: false })
  @IsOptional()
  @IsString()
  legalName?: string;

  @ApiProperty({ example: 'Calle 123 #45-67, Bogotá', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: '+573001234567', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'contacto@miempresa.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'SIMPLE', enum: ['SIMPLE', 'ORDINARIO'], required: false })
  @IsOptional()
  @IsString()
  taxRegime?: string;
}
