import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.subscriptionPlan.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
