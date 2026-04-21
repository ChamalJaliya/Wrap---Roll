import { Test, TestingModule } from '@nestjs/testing';
import { NOTIFICATION_JOB } from '@wrap-roll/contracts';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let smsProvider: { send: jest.Mock };
  let prisma: Record<string, unknown>;

  beforeEach(async () => {
    smsProvider = { send: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      order: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
      notificationDelivery: { create: jest.fn().mockResolvedValue({}) },
      opsActivityEvent: { create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: 'SMS_PROVIDER', useValue: smsProvider },
        { provide: PrismaService, useValue: prisma as unknown as PrismaService },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should route order.paid event and call SMS provider', async () => {
    (prisma.order as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
      id: 'order-1',
      customerId: null,
      customerPhone: '+94771234567',
    });
    await service.processQueueJob(NOTIFICATION_JOB.orderPaid, {
      outboxId: 'ob-1',
      eventType: NOTIFICATION_JOB.orderPaid,
      eventVersion: 1,
      entityType: 'order',
      entityId: 'order-1',
      correlationId: null,
      payload: { orderId: 'order-1' },
      createdAt: new Date().toISOString(),
    });
    expect(smsProvider.send).toHaveBeenCalledWith('+94771234567', expect.stringContaining('confirmed'));
  });

  it('should route order.ready event and call SMS provider', async () => {
    (prisma.order as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
      id: 'order-2',
      customerId: null,
      customerPhone: '+94771234567',
    });
    await service.processQueueJob(NOTIFICATION_JOB.orderReady, {
      outboxId: 'ob-2',
      eventType: NOTIFICATION_JOB.orderReady,
      eventVersion: 1,
      entityType: 'order',
      entityId: 'order-2',
      correlationId: null,
      payload: { orderId: 'order-2' },
      createdAt: new Date().toISOString(),
    });
    expect(smsProvider.send).toHaveBeenCalledWith('+94771234567', expect.stringContaining('ready'));
  });

  it('should route order.in_transit event and call SMS provider', async () => {
    (prisma.order as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
      id: 'order-3',
      customerId: null,
      customerPhone: '+94771234567',
    });
    await service.processQueueJob(NOTIFICATION_JOB.orderInTransit, {
      outboxId: 'ob-3',
      eventType: NOTIFICATION_JOB.orderInTransit,
      eventVersion: 1,
      entityType: 'order',
      entityId: 'order-3',
      correlationId: null,
      payload: { orderId: 'order-3' },
      createdAt: new Date().toISOString(),
    });
    expect(smsProvider.send).toHaveBeenCalledWith('+94771234567', expect.stringContaining('way'));
  });

  it('should fetch phone from database if missing from order payload', async () => {
    (prisma.order as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
      id: 'order-4',
      customerId: 'cust-1',
      customerPhone: null,
    });
    const customer = prisma.customer as { findUnique: jest.Mock };
    customer.findUnique.mockResolvedValue({ phone: '+94772223333' });

    await service.processQueueJob(NOTIFICATION_JOB.orderPaid, {
      outboxId: 'ob-4',
      eventType: NOTIFICATION_JOB.orderPaid,
      eventVersion: 1,
      entityType: 'order',
      entityId: 'order-4',
      correlationId: null,
      payload: { orderId: 'order-4' },
      createdAt: new Date().toISOString(),
    });

    expect(customer.findUnique).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      select: { phone: true },
    });
    expect(smsProvider.send).toHaveBeenCalledWith('+94772223333', expect.any(String));
  });

  it('should skip notification if phone number is missing everywhere', async () => {
    (prisma.order as { findUnique: jest.Mock }).findUnique = jest.fn().mockResolvedValue({
      id: 'order-5',
      customerId: 'cust-2',
      customerPhone: null,
    });
    const customer = prisma.customer as { findUnique: jest.Mock };
    customer.findUnique.mockResolvedValue(null);
    
    await service.processQueueJob(NOTIFICATION_JOB.orderPaid, {
      outboxId: 'ob-5',
      eventType: NOTIFICATION_JOB.orderPaid,
      eventVersion: 1,
      entityType: 'order',
      entityId: 'order-5',
      correlationId: null,
      payload: { orderId: 'order-5' },
      createdAt: new Date().toISOString(),
    });
    expect(smsProvider.send).not.toHaveBeenCalled();
  });
});
