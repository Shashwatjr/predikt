import { Module } from '@nestjs/common';
import { CommentaryController } from './commentary.controller';
import { CommentaryService } from './commentary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CommentaryController],
  providers: [CommentaryService],
  exports: [CommentaryService],
})
export class CommentaryModule {}
