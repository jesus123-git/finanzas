import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';

// ─── Módulo Personal ──────────────────────────────────────────────────────────
import { AuthModule }         from './modules/auth/auth.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { CategoriesModule }   from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { WebhooksModule }     from './modules/webhooks/webhooks.module';

// ─── Módulo Empresarial ───────────────────────────────────────────────────────
import { BusinessesModule }  from './modules/businesses/businesses.module';
import { CustomersModule }   from './modules/customers/customers.module';
import { InvoicesModule }    from './modules/invoices/invoices.module';
import { ProductsModule }    from './modules/products/products.module';
import { PriceListsModule }  from './modules/price-lists/price-lists.module';
import { QuotesModule }      from './modules/quotes/quotes.module';
import { SuppliersModule }   from './modules/suppliers/suppliers.module';
import { PurchasesModule }   from './modules/purchases/purchases.module';
import { PlanModule }             from './modules/plan/plan.module';
import { ReportsModule }          from './modules/reports/reports.module';
import { BusinessMembersModule }  from './modules/business-members/business-members.module';

// ─── Módulo Subscriptions ─────────────────────────────────────────────────────
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

// ─── Módulo Email Ingestion ───────────────────────────────────────────────────
import { EmailIngestionModule } from './modules/email-ingestion/email-ingestion.module';
import { EmailConfigModule }    from './modules/email-config/email-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Scheduler global: habilita el uso de @Cron() en todos los servicios
    ScheduleModule.forRoot(),
    // Rate limiting global: máx 100 req / 60s por IP
    // Los endpoints de auth tienen su propio límite más estricto via @Throttle()
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,

    // Personal
    AuthModule,
    BankAccountsModule,
    CategoriesModule,
    TransactionsModule,
    WebhooksModule,

    // Empresarial
    BusinessesModule,
    PlanModule,
    CustomersModule,
    InvoicesModule,
    ProductsModule,
    PriceListsModule,
    QuotesModule,
    SuppliersModule,
    PurchasesModule,
    ReportsModule,
    BusinessMembersModule,

    // Subscriptions
    SubscriptionsModule,

    // Email Ingestion Engine (cron + IMAP)
    EmailIngestionModule,
    EmailConfigModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aplica ThrottlerGuard globalmente a todos los endpoints
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
