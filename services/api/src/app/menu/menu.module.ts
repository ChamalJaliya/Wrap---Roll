import { Module } from '@nestjs/common';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuReviewModule } from '../menu-review/menu-review.module';
import { CustomerModule } from '../customer/customer.module';

@Module({
  imports: [MenuReviewModule, CustomerModule],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
