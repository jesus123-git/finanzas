import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Payload enviado por iOS Shortcuts o MacroDroid con el texto
 * del SMS / notificación y el número de teléfono del dispositivo.
 *
 * El endpoint POST /webhooks/mobile-parser analiza `text` con
 * expresiones regulares para extraer entidad, tipo y monto,
 * y usa `devicePhone` para vincular cuentas Nequi por número de celular.
 */
export class MobileParserPayloadDto {
  @ApiProperty({
    example: 'Bancolombia: Compra en EXITO por $45.000 Cta *5678',
    description: 'Texto completo del SMS o notificación bancaria',
  })
  @IsString()
  @IsNotEmpty({ message: 'El campo text no puede estar vacío' })
  text: string;

  @ApiProperty({
    example: '3123456789',
    description:
      'Número de teléfono del dispositivo (10 dígitos). ' +
      'Se usa como externalAccountId para cuentas Nequi.',
  })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'devicePhone debe ser exactamente 10 dígitos numéricos' })
  devicePhone: string;
}
