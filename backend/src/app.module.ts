import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { CategoriesModule } from './modules/categories/categories.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BankAccountsModule,
    CategoriesModule,
    // Próximos módulos:
    // TransactionsModule, SavingsGoalsModule, InvestmentsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
