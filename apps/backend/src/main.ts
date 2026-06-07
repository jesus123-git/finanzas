import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefijo global para todas las rutas de la API
  app.setGlobalPrefix('api/v1');

  // Validación automática de DTOs con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,      // elimina propiedades no declaradas en el DTO
      forbidNonWhitelisted: true,
      transform: true,      // convierte tipos automáticamente (string → number, etc.)
    }),
  );

  // CORS — en producción restringe a tu dominio real
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  });

  // Documentación Swagger disponible en /api/docs
  const config = new DocumentBuilder()
    .setTitle('Finanzas API')
    .setDescription('API REST del proyecto Finanzas')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend corriendo en http://localhost:${port}/api/v1`);
  console.log(`Swagger en        http://localhost:${port}/api/docs`);
}

bootstrap();
