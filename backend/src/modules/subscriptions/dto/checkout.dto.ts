import { IsEnum } from 'class-validator';
import { PlanType } from '@prisma/client';

export class CheckoutDto {
  @IsEnum(PlanType)
  plan: PlanType;
}
