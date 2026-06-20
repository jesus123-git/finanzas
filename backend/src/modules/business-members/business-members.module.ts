import { Module } from '@nestjs/common';
import { BusinessMembersService } from './business-members.service';
import { BusinessMembersController } from './business-members.controller';
import { InvitesController } from './invites.controller';
import { PlanModule } from '../plan/plan.module';

@Module({
  imports: [PlanModule],
  controllers: [BusinessMembersController, InvitesController],
  providers: [BusinessMembersService],
  exports: [BusinessMembersService],
})
export class BusinessMembersModule {}
