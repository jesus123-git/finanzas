import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessMembersService } from './business-members.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Invites')
@Controller('invites')
export class InvitesController {
  constructor(private service: BusinessMembersService) {}

  @Get(':token')
  validate(@Param('token') token: string) {
    return this.service.validateInviteToken(token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':token/accept')
  accept(@Param('token') token: string, @CurrentUser() user: { id: string }) {
    return this.service.acceptInvite(token, user.id);
  }
}
