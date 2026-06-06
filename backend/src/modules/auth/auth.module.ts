import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    CategoriesModule,

    // JwtModule.registerAsync lee el secreto desde ConfigService
    // en lugar de hardcodearlo — imprescindible para producción.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy, // Passport necesita que la estrategia esté registrada como provider
  ],
  // Exportamos JwtAuthGuard implícitamente al exportar los módulos necesarios
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
