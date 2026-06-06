import { ApiProperty } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({ example: 'uuid-de-la-categoria' })
  id: string;

  @ApiProperty({ example: 'Alimentación' })
  name: string;

  @ApiProperty({ example: 'uuid-del-usuario' })
  userId: string;
}
