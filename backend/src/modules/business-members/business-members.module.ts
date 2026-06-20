import { Module } from '@nestjs/common';
import { BusinessMembersService } from './business-members.service';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [PlanModule],
  providers: [BusinessMembersService],
  exports: [BusinessMembersService],
})
export class BusinessMembersModule {}
