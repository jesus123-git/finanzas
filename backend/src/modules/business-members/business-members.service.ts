import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PlanService } from '../plan/plan.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class BusinessMembersService {
  private resend: Resend | null;

  constructor(
    private prisma: PrismaService,
    private planService: PlanService,
    private config: ConfigService,
  ) {
    const key = this.config.get<string>('RESEND_API_KEY');
    this.resend = key ? new Resend(key) : null;
  }

  private async assertOwner(userId: string, businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true, name: true },
    });
    if (!business) throw new NotFoundException('Empresa no encontrada');
    if (business.userId !== userId) throw new ForbiddenException('Solo el propietario puede gestionar el equipo');
    return business;
  }

  async listMembers(userId: string, businessId: string) {
    await this.planService.assertBusinessAccess(userId, businessId);
    const [business, members, invites] = await Promise.all([
      this.prisma.business.findUnique({ where: { id: businessId }, select: { userId: true } }),
      this.prisma.businessMember.findMany({
        where: { businessId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { invitedAt: 'asc' },
      }),
      this.prisma.businessInvite.findMany({
        where: { businessId, usedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { ownerUserId: business!.userId, members, pendingInvites: invites };
  }

  async invite(userId: string, businessId: string, dto: InviteMemberDto) {
    const business = await this.assertOwner(userId, businessId);
    await this.planService.assertCanAddMember(userId, businessId);

    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, name: true },
    });

    if (existingUser) {
      const alreadyMember = await this.prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId, userId: existingUser.id } },
      });
      if (alreadyMember) throw new BadRequestException('Este usuario ya es miembro de la empresa');
      if (existingUser.id === userId) throw new BadRequestException('No puedes invitarte a ti mismo');

      const member = await this.prisma.businessMember.create({
        data: { businessId, userId: existingUser.id, role: dto.role, title: dto.title },
        include: { user: { select: { id: true, email: true, name: true } } },
      });

      if (this.resend) {
        await this.resend.emails.send({
          from: 'Nomi <noreply@nomi.co>',
          to: existingUser.email,
          subject: `Te han añadido a ${business.name} en Nomi`,
          html: `<p>Hola ${existingUser.name ?? ''},</p><p>Ahora tienes acceso a <strong>${business.name}</strong> en Nomi como <strong>${dto.role === 'EDITOR' ? 'Editor' : 'Visualizador'}</strong>.</p><p><a href="${frontendUrl}/empresas">Ver mis empresas</a></p>`,
        });
      }
      return member;
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await this.prisma.businessInvite.deleteMany({
      where: { businessId, email: dto.email, usedAt: null },
    });

    await this.prisma.businessInvite.create({
      data: { businessId, email: dto.email, role: dto.role, title: dto.title, token, expiresAt },
    });

    if (this.resend) {
      const inviteUrl = `${frontendUrl}/invites/${token}`;
      await this.resend.emails.send({
        from: 'Nomi <noreply@nomi.co>',
        to: dto.email,
        subject: `Invitación a ${business.name} en Nomi`,
        html: `<p>Te han invitado a gestionar <strong>${business.name}</strong> en Nomi.</p><p><a href="${inviteUrl}">Aceptar invitación</a></p><p>Este enlace expira en 72 horas.</p>`,
      });
    }

    return { invited: true, email: dto.email, expiresAt };
  }

  async updateMember(userId: string, businessId: string, memberId: string, dto: UpdateMemberDto) {
    await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');
    return this.prisma.businessMember.update({
      where: { id: memberId },
      data: dto,
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(userId: string, businessId: string, memberId: string) {
    await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: memberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');
    return this.prisma.businessMember.delete({ where: { id: memberId } });
  }

  async cancelInvite(userId: string, businessId: string, inviteId: string) {
    await this.assertOwner(userId, businessId);
    const invite = await this.prisma.businessInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.businessId !== businessId) throw new NotFoundException('Invitación no encontrada');
    return this.prisma.businessInvite.delete({ where: { id: inviteId } });
  }

  async transferOwnership(userId: string, businessId: string, newOwnerMemberId: string) {
    await this.assertOwner(userId, businessId);
    const member = await this.prisma.businessMember.findUnique({ where: { id: newOwnerMemberId } });
    if (!member || member.businessId !== businessId) throw new NotFoundException('Miembro no encontrado');

    await this.prisma.$transaction([
      this.prisma.business.update({ where: { id: businessId }, data: { userId: member.userId } }),
      this.prisma.businessMember.delete({ where: { id: newOwnerMemberId } }),
      this.prisma.businessMember.create({ data: { businessId, userId, role: 'EDITOR', title: 'Propietario anterior' } }),
    ]);

    return { transferred: true, newOwnerUserId: member.userId };
  }

  async validateInviteToken(token: string) {
    const invite = await this.prisma.businessInvite.findUnique({
      where: { token },
      include: { business: { select: { name: true } } },
    });
    if (!invite) throw new NotFoundException('Invitación no encontrada');
    if (invite.usedAt) throw new BadRequestException('Esta invitación ya fue usada');
    if (invite.expiresAt < new Date()) throw new BadRequestException('Esta invitación ha expirado');
    return invite;
  }

  async acceptInvite(token: string, userId: string) {
    const invite = await this.validateInviteToken(token);

    const alreadyMember = await this.prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: invite.businessId, userId } },
    });
    if (alreadyMember) throw new BadRequestException('Ya eres miembro de esta empresa');

    await this.prisma.$transaction([
      this.prisma.businessMember.create({
        data: { businessId: invite.businessId, userId, role: invite.role, title: invite.title },
      }),
      this.prisma.businessInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } }),
    ]);

    return { accepted: true, businessId: invite.businessId };
  }
}
