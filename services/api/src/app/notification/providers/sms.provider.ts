import { Injectable, Logger } from '@nestjs/common';

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

@Injectable()
export class LogSmsProvider implements SmsProvider {
  private readonly logger = new Logger(LogSmsProvider.name);
  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS-LOG] To: ${phone} - Msg: ${message}`);
  }
}

@Injectable()
export class SupabaseEdgeSmsProvider implements SmsProvider {
  private readonly logger = new Logger(SupabaseEdgeSmsProvider.name);
  async send(phone: string, message: string): Promise<void> {
    // MOCKED for production as per prompt
    this.logger.log(`[MOCK-SUPABASE-SMS] Dispatching to ${phone}: ${message}`);
  }
}
