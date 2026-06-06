import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../common/prisma/prisma.service';

// El "payload" es lo que guardamos DENTRO del token JWT al firmarlo.
// Solo incluimos datos no sensibles: nunca el passwordHash.
export interface JwtPayload {
  sub: string;   // "subject" → id del usuario (convención JWT)
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      // Extrae el token del header: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Si el token expiró, rechaza la petición automáticamente
      ignoreExpiration: false,
      // El operador ! asegura a TS que JWT_SECRET siempre existe en runtime.
      // Si no, NestJS lanzará un error al arrancar antes de aceptar peticiones.
      secretOrKey: configService.get<string>('JWT_SECRET')!,
    });
  }

  // Este método se llama automáticamente después de verificar la firma del JWT.
  // Lo que retornes aquí se inyecta en `req.user` en cada ruta protegida.
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      // El token es válido criptográficamente pero el usuario fue eliminado
      throw new UnauthorizedException('Usuario no encontrado');
    }

    return user; // → disponible como @CurrentUser() en los controllers
  }
}
