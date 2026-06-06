import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService],
  // Exportamos el servicio para que AuthModule (o cualquier otro módulo)
  // pueda llamar a seedDefaults() al registrar un usuario nuevo.
  exports: [CategoriesService],
})
export class CategoriesModule {}
