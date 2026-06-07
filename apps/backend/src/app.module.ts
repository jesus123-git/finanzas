import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';

@Module({
  imports: [
    // Carga variables de entorno desde .env y las hace disponibles en toda la app
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    // Aquí irás importando los módulos de negocio:
    // AuthModule, UsersModule, TransactionsModule, etc.
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
