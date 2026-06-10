import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { EmailIngestionService } from './email-ingestion.service';

@Module({
  imports: [
    ScheduleModule,
    WebhooksModule,      // exporta WebhooksService (motor parseText + parseAmount)
    TransactionsModule,  // exporta TransactionsService para crear transacciones
  ],
  providers: [EmailIngestionService],
})
export class EmailIngestionModule {}
