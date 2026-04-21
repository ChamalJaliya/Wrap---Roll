import './load-env';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { createBullBoard } from '@bull-board/api';
import { ExpressAdapter } from '@bull-board/express';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { SupabaseService } from './auth';
import { AppModule } from './app/app.module';
import { QueueService } from './app/queue/queue.service';
import { isBullMqEnabled } from './app/queue/queue.config';

const isProd = process.env.NODE_ENV === 'production';

/**
 * Browser origins for CORS (`credentials` + `Authorization`).
 * Production: required comma-separated list (no localhost fallback).
 */
function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (raw) {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (isProd) {
    throw new Error(
      'CORS_ORIGINS is required in production (e.g. https://app.example.com,https://admin.example.com)',
    );
  }
  const locals: string[] = [];
  for (const host of ['localhost', '127.0.0.1']) {
    for (let p = 3000; p <= 3004; p++) {
      locals.push(`http://${host}:${p}`);
    }
  }
  locals.push('http://localhost:4200', 'http://127.0.0.1:4200');
  return locals;
}

function setupSwagger(app: NestExpressApplication) {
  const enable =
    process.env.ENABLE_SWAGGER === 'true' ||
    (!isProd && process.env.ENABLE_SWAGGER !== 'false');
  if (!enable) return;

  const config = new DocumentBuilder()
    .setTitle('Wrap & Roll API')
    .setDescription('Core backend API for the Wrap & Roll restaurant ecosystem.')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
  SwaggerModule.setup('docs', app, document);
  Logger.log('Swagger UI: /docs');
}

async function setupBullBoard(app: NestExpressApplication) {
  const enabledRaw = process.env.BULL_BOARD_ENABLED;
  const enabled = enabledRaw == null ? !isProd : enabledRaw === '1' || enabledRaw.toLowerCase() === 'true';
  if (!enabled || !isBullMqEnabled()) return;

  const basePath = '/api/queues';
  const queueService = app.get(QueueService);
  const supabaseService = app.get(SupabaseService);
  const adapters = queueService
    .queueRefs()
    .filter((queue) => queue.ref)
    .map((queue) => new BullMQAdapter(queue.ref!));

  if (adapters.length === 0) {
    Logger.warn('Bull Board enabled but no queues are registered.');
    return;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);
  createBullBoard({
    queues: adapters,
    serverAdapter,
  });

  app.use(basePath, async (req: Request, res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing bearer token' });
      return;
    }
    const token = auth.slice('Bearer '.length).trim();
    const user = await supabaseService.verifyToken(token);
    if (!user) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
    const userMeta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
    const roleSource =
      userMeta.role ??
      appMeta.role ??
      (typeof appMeta.staff_role === 'string' ? appMeta.staff_role : undefined) ??
      'CLIENT';
    const role = String(roleSource).toUpperCase();
    if (role !== 'ADMIN') {
      res.status(403).json({ message: 'Admin role required' });
      return;
    }
    next();
  });
  app.use(basePath, serverAdapter.getRouter());
  Logger.log(`Bull Board UI: ${basePath}`);
}

async function bootstrap() {
  let origins: string[];
  try {
    origins = corsOrigins();
  } catch (e) {
    Logger.error((e as Error).message);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
    Logger.log('Trust proxy: enabled (first hop)');
  }

  const swaggerOn =
    process.env.ENABLE_SWAGGER === 'true' ||
    (!isProd && process.env.ENABLE_SWAGGER !== 'false');

  app.use(
    helmet({
      contentSecurityPolicy: swaggerOn ? false : undefined,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);

  Logger.log(`CORS allow-list: ${origins.length} origin(s)`);

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Cookie',
      'X-Requested-With',
      'Accept',
      'Accept-Language',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
      'X-Request-Id',
      'X-Correlation-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  setupSwagger(app);
  await setupBullBoard(app);

  const port = Number(process.env.PORT) || 4000;
  app.get(QueueService).logBootstrapContext('api');
  await app.listen(port, '0.0.0.0');
  Logger.log(`Application listening on 0.0.0.0:${port}/${globalPrefix}`);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
