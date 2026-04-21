import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class ProcessPaymentDto {
  @IsUUID()
  orderId: string;

  @IsNumber()
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
