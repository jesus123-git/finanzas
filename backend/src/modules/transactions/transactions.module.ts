import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';

// PrismaModule es @Global() → no hace falta importarlo.
// JwtAuthGuard y CurrentUser se importan directamente desde sus archivos.
@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
