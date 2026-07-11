import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule, JwtModule.register({})],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminAuthGuard, JwtModule],
})
export class AdminModule {}
