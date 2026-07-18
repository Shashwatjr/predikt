import { Module } from '@nestjs/common';
import { CommentaryController } from './commentary.controller';
import { SoloCommentaryController } from './solo-commentary.controller';
import { CommentaryService } from './commentary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CommentaryController, SoloCommentaryController],
  providers: [CommentaryService],
  exports: [CommentaryService],
})
export class CommentaryModule {}
