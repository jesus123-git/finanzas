import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { MemberRole } from '@prisma/client';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(MemberRole)
  role: MemberRole;

  @IsOptional()
  @IsString()
  title?: string;
}
