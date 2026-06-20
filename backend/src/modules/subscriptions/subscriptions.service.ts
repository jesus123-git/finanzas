import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanType } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private config: ConfigService) {}

  async createCheckoutSession(userId: string, plan: PlanType): Promise<{ status: string; url?: string }> {
    const privateKey = this.config.get<string>('WOMPI_PRIVATE_KEY');
    if (!privateKey) {
      return { status: 'GATEWAY_PENDING' };
    }

    // TODO: Implement real Wompi payment link when WOMPI_PRIVATE_KEY is configured
    return { status: 'GATEWAY_PENDING' };
  }
}
