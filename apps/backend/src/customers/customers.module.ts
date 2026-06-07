import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PrismaModule } from '../common/prisma/prisma.module';
import { BusinessesModule } from '../businesses/businesses.module';

@Module({
  imports: [PrismaModule, BusinessesModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
