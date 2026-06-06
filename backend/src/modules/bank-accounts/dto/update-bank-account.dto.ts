import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { CreateBankAccountDto } from './create-bank-account.dto';

// PartialType convierte todos los campos de CreateBankAccountDto en opcionales
// y hereda automáticamente sus validaciones y decoradores de Swagger.
// Esto sigue el principio DRY: no repetimos validaciones.
export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {
  // balance en updates puede ser cualquier número (positivo o negativo)
  // ya que las cuentas de crédito tienen balances negativos.
  @ApiPropertyOptional({
    example: -250000,
    description: 'Nuevo saldo de la cuenta (puede ser negativo en cuentas de crédito)',
  })
  @IsOptional()
  @IsNumber()
  declare balance?: number; // sobreescribe el @Min(0) del CreateDto
}
