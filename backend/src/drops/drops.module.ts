import { Module } from '@nestjs/common';
import { DropsController } from './drops.controller';
import { DropsService } from './drops.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DropsController],
  providers: [DropsService],
})
export class DropsModule {}
