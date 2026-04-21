import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { createPrismaReadServiceFromEnv } from './prisma-read.service';
import { PRISMA_READ } from './prisma.tokens';

@Global()
@Module({
  providers: [
    PrismaService,
    {
      provide: PRISMA_READ,
      useFactory: () => createPrismaReadServiceFromEnv() ?? null,
    },
  ],
  exports: [PrismaService, PRISMA_READ],
})
export class PrismaModule {}
