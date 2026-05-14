"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const contracts_1 = require("@wrap-roll/contracts");
const notification_service_1 = require("./notification.service");
const prisma_service_1 = require("../prisma/prisma.service");
describe('NotificationService', () => {
    let service;
    let smsProvider;
    let prisma;
    beforeEach(async () => {
        smsProvider = { send: jest.fn().mockResolvedValue(undefined) };
        prisma = {
            order: { findUnique: jest.fn() },
            customer: { findUnique: jest.fn() },
            notificationDelivery: { create: jest.fn().mockResolvedValue({}) },
            opsActivityEvent: { create: jest.fn().mockResolvedValue({}) },
        };
        const module = await testing_1.Test.createTestingModule({
            providers: [
                notification_service_1.NotificationService,
                { provide: 'SMS_PROVIDER', useValue: smsProvider },
                { provide: prisma_service_1.PrismaService, useValue: prisma },
            ],
        }).compile();
        service = module.get(notification_service_1.NotificationService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    it('should route order.paid event and call SMS provider', async () => {
        prisma.order.findUnique = jest.fn().mockResolvedValue({
            id: 'order-1',
            customerId: null,
            customerPhone: '+94771234567',
        });
        await service.processQueueJob(contracts_1.NOTIFICATION_JOB.orderPaid, {
            outboxId: 'ob-1',
            eventType: contracts_1.NOTIFICATION_JOB.orderPaid,
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
        prisma.order.findUnique = jest.fn().mockResolvedValue({
            id: 'order-2',
            customerId: null,
            customerPhone: '+94771234567',
        });
        await service.processQueueJob(contracts_1.NOTIFICATION_JOB.orderReady, {
            outboxId: 'ob-2',
            eventType: contracts_1.NOTIFICATION_JOB.orderReady,
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
        prisma.order.findUnique = jest.fn().mockResolvedValue({
            id: 'order-3',
            customerId: null,
            customerPhone: '+94771234567',
        });
        await service.processQueueJob(contracts_1.NOTIFICATION_JOB.orderInTransit, {
            outboxId: 'ob-3',
            eventType: contracts_1.NOTIFICATION_JOB.orderInTransit,
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
        prisma.order.findUnique = jest.fn().mockResolvedValue({
            id: 'order-4',
            customerId: 'cust-1',
            customerPhone: null,
        });
        const customer = prisma.customer;
        customer.findUnique.mockResolvedValue({ phone: '+94772223333' });
        await service.processQueueJob(contracts_1.NOTIFICATION_JOB.orderPaid, {
            outboxId: 'ob-4',
            eventType: contracts_1.NOTIFICATION_JOB.orderPaid,
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
        prisma.order.findUnique = jest.fn().mockResolvedValue({
            id: 'order-5',
            customerId: 'cust-2',
            customerPhone: null,
        });
        const customer = prisma.customer;
        customer.findUnique.mockResolvedValue(null);
        await service.processQueueJob(contracts_1.NOTIFICATION_JOB.orderPaid, {
            outboxId: 'ob-5',
            eventType: contracts_1.NOTIFICATION_JOB.orderPaid,
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
//# sourceMappingURL=notification.service.spec.js.map