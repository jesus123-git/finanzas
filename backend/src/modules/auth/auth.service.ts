import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

// Número de rondas de sal para bcrypt.
// 10 es el estándar: suficientemente seguro y no bloquea el event loop.
// En producción podrías subir a 12, pero el hash tardaría ~250ms.
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly categoriesService: CategoriesService,
  ) {}

  // ─── Registro ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // 1. Verificar que el email no esté en uso
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      // 409 Conflict — no revelamos si es un email válido (seguridad)
      throw new ConflictException('El email ya está registrado');
    }

    // 2. Hashear la contraseña — NUNCA guardamos texto plano
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // 3. Crear el usuario en la BD
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
      },
      // select evita que el passwordHash salga en la respuesta
      select: { id: true, email: true, name: true },
    });

    // 4. Crear las categorías por defecto en background.
    //    No usamos await para no bloquear la respuesta al cliente:
    //    si el seed fallara (situación muy improbable), el usuario
    //    ya fue creado correctamente y puede crear sus propias categorías.
    void this.categoriesService.seedDefaults(user.id);

    // 5. Emitir token inmediatamente (el usuario queda logueado al registrarse)
    return this.buildTokenResponse(user);
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    // 1. Buscar al usuario (incluimos passwordHash solo aquí, en el servicio)
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // 2. Verificar contraseña con tiempo constante (bcrypt.compare evita timing attacks)
    const passwordValid =
      user !== null && (await bcrypt.compare(dto.password, user.passwordHash));

    if (!passwordValid) {
      // Mensaje genérico: no indicamos si el email existe o no
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return this.buildTokenResponse({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  // ─── Actualizar perfil ────────────────────────────────────────────────────

  async updateProfile(userId: string, dto: { name?: string; email?: string }) {
    // Si cambia el email verificamos que no esté en uso
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('El email ya está en uso');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.email && { email: dto.email }) },
      select: { id: true, email: true, name: true },
    });

    return updated;
  }

  // ─── Cambiar contraseña ───────────────────────────────────────────────────

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('La contraseña actual es incorrecta');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return { message: 'Contraseña actualizada correctamente' };
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private buildTokenResponse(user: { id: string; email: string; name: string | null }) {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: this.jwtService.sign(payload),
      user,
    };
  }
}
