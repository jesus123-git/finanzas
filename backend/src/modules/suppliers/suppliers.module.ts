import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { BusinessesModule } from '../businesses/businesses.module';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [BusinessesModule, PlanModule],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
