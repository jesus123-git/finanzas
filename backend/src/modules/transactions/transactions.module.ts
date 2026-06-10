import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { DianScraperService } from './dian-scraper.service';

@Module({
  controllers: [TransactionsController],
  providers: [TransactionsService, DianScraperService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
