import { DynamicModule, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';
import { BULLMQ_QUEUE_NAMES } from './queue.constants';
import {
  bullMqConnectionFromEnv,
  isBullMqEnabled,
  queueDefaultJobOptions,
  queuePrefix,
} from './queue.config';

@Module({})
export class QueueModule {
  static register(options?: { includeController?: boolean }): DynamicModule {
    const enabled = isBullMqEnabled();
    const includeController = options?.includeController ?? true;
    const imports = enabled
      ? [
          BullModule.forRoot({
            connection: bullMqConnectionFromEnv(),
            prefix: queuePrefix(),
            defaultJobOptions: queueDefaultJobOptions(),
          }),
          BullModule.registerQueue(
            ...BULLMQ_QUEUE_NAMES.map((name) => ({
              name,
            })),
          ),
        ]
      : [];

    return {
      module: QueueModule,
      imports,
      controllers: includeController ? [QueueController] : [],
      providers: [QueueService],
      exports: [QueueService, ...(enabled ? [BullModule] : [])],
      global: true,
    };
  }
}
