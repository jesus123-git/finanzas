import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
