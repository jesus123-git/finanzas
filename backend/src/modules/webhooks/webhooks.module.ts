import { Module } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { TransactionsModule } from '../transactions/transactions.module';

// PrismaModule es @Global() → no hace falta importarlo.
@Module({
  imports: [TransactionsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookAuthGuard],
})
export class WebhooksModule {}
