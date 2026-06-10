import { IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ScanDianDto {
  @ApiProperty({
    description: 'URL extraída del código QR de la factura electrónica DIAN',
    example: 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=abc123...',
  })
  @IsUrl({}, { message: 'Debe ser una URL válida de la factura DIAN' })
  url: string;
}
