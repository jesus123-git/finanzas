import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessMembersService } from './business-members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Business Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:id/members')
export class BusinessMembersController {
  constructor(private service: BusinessMembersService) {}

  @Get()
  list(@CurrentUser() user: { id: string }, @Param('id') businessId: string) {
    return this.service.listMembers(user.id, businessId);
  }

  @Post('invite')
  invite(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Body() dto: InviteMemberDto) {
    return this.service.invite(user.id, businessId, dto);
  }

  @Patch(':memberId')
  update(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
    return this.service.updateMember(user.id, businessId, memberId, dto);
  }

  @Delete('invites/:inviteId')
  cancelInvite(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('inviteId') inviteId: string) {
    return this.service.cancelInvite(user.id, businessId, inviteId);
  }

  @Delete(':memberId')
  remove(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Param('memberId') memberId: string) {
    return this.service.removeMember(user.id, businessId, memberId);
  }

  @Post('transfer')
  transfer(@CurrentUser() user: { id: string }, @Param('id') businessId: string, @Body() body: { memberId: string }) {
    return this.service.transferOwnership(user.id, businessId, body.memberId);
  }
}
