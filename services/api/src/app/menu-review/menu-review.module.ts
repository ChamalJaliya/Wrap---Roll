import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MenuReviewService } from './menu-review.service';

@Module({
  imports: [PrismaModule],
  providers: [MenuReviewService],
  exports: [MenuReviewService],
})
export class MenuReviewModule {}
