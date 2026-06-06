import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Alimentación',
    description:
      'Nombre de la categoría. Debe ser único por usuario (la BD lo garantiza con @@unique([name, userId])).',
  })
  @IsString({ message: 'El nombre debe ser una cadena de texto' })
  @Length(1, 50, { message: 'El nombre debe tener entre 1 y 50 caracteres' })
  name: string;
}
