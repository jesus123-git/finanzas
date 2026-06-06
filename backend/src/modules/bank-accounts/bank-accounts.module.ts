import { Module } from '@nestjs/common';
import { BankAccountsService } from './bank-accounts.service';
import { BankAccountsController } from './bank-accounts.controller';

// PrismaModule ya es @Global(), no hace falta importarlo aquí.
// AuthModule tampoco: JwtAuthGuard y CurrentUser se importan directamente
// desde sus archivos — los guards/decorators no requieren que el módulo
// del que provienen esté importado, solo que esté registrado en algún lugar
// del árbol de módulos (AppModule lo hace a través de AuthModule).
@Module({
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService], // exportamos por si otros módulos necesitan el servicio
})
export class BankAccountsModule {}
