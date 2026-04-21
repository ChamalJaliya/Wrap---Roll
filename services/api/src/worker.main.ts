import './load-env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { QueueService } from './app/queue/queue.service';
import { WorkerModule } from './app/worker.module';

async function bootstrapWorker() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const logger = new Logger('WorkerBootstrap');
  const queueService = app.get(QueueService);
  queueService.logBootstrapContext('worker');
  logger.log('Worker runtime initialized. Waiting for jobs...');

  const shutdown = async (signal: NodeJS.Signals) => {
    logger.warn(`Received ${signal}; closing worker context...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrapWorker().catch((error) => {
  Logger.error(error instanceof Error ? error.message : String(error), 'WorkerBootstrap');
  process.exit(1);
});
