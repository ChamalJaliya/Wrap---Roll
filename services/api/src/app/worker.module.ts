import { Module } from '@nestjs/common';
import { QueueModule } from './queue/queue.module';
import { OutboxModule } from './outbox/outbox.module';
import { OutboxRelayService } from './outbox/outbox-relay.service';
import { WorkerProcessorsModule } from './worker-processors.module';

@Module({
  imports: [QueueModule.register({ includeController: false }), OutboxModule, WorkerProcessorsModule],
  providers: [OutboxRelayService],
})
export class WorkerModule {}
