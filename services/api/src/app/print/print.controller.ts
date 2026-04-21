import {
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrintService } from './print.service';
import { Roles, RolesGuard, SupabaseAuthGuard } from '../../auth';

@Controller('print')
@ApiTags('print')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@Roles('ADMIN', 'CASHIER', 'KITCHEN')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  /**
   * Always rebuild cashier receipt bytes from DB (thermal / download).
   */
  @Get('receipt/:orderId/regenerate')
  async regenerateReceipt(@Param('orderId') orderId: string) {
    const payload = await this.printService.regenerateCashierReceiptBase64(orderId);
    if (!payload) {
      throw new NotFoundException(`Could not build receipt for order: ${orderId}`);
    }
    return { payload };
  }

  /**
   * In-memory cache from order.paid events, else regenerate from DB.
   */
  @Get('receipt/:orderId')
  async getReceipt(@Param('orderId') orderId: string) {
    let payload = this.printService.getReceipt(orderId);
    if (!payload) {
      payload = await this.printService.regenerateCashierReceiptBase64(orderId);
    }
    if (!payload) {
      throw new NotFoundException(`Receipt payload not found for order: ${orderId}`);
    }
    return { payload };
  }

  @Get('kitchen/:orderId')
  getKitchenTicket(@Param('orderId') orderId: string) {
    const payload = this.printService.getKitchenTicket(orderId);
    if (!payload) {
      throw new NotFoundException(`Kitchen ticket payload not found for order: ${orderId}`);
    }
    return { payload };
  }
}
