import { Module } from '@nestjs/common';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
