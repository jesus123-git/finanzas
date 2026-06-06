import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '@prisma/client';

class AccountSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() currency: string;
}

class CategorySummaryDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

export class TransactionResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() amount: number;
  @ApiProperty() description: string;
  @ApiProperty({ enum: TransactionType }) type: TransactionType;
  @ApiProperty() date: Date;
  @ApiProperty({ type: AccountSummaryDto }) bankAccount: AccountSummaryDto;
  @ApiProperty({ type: CategorySummaryDto }) category: CategorySummaryDto;
  @ApiProperty() userId: string;
  @ApiProperty() createdAt: Date;
}

export class PaginatedTransactionsDto {
  @ApiProperty({ type: [TransactionResponseDto] }) data: TransactionResponseDto[];
  @ApiProperty({ example: 150 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 8 }) totalPages: number;
  @ApiPropertyOptional({ example: 3500000, description: 'Suma de INCOME en el filtro actual' }) totalIncome: number;
  @ApiPropertyOptional({ example: 1200000, description: 'Suma de EXPENSE en el filtro actual' }) totalExpense: number;
}
