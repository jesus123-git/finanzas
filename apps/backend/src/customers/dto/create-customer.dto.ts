import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Empresa Cliente S.A.S.' })
  @IsString()
  name: string;

  @ApiProperty({ example: '901234567-8', required: false })
  @IsOptional()
  @IsString()
  nit?: string;

  @ApiProperty({ example: 'pagos@clienteempresa.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+573009876543', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'Carrera 10 #20-30, Medellín', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Cliente frecuente, paga a 30 días', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}
