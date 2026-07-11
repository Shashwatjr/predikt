import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ConfigService } from '@nestjs/config';
import { parseCorsOrigins } from './config/env.validation';

const LOCAL_FALLBACK_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:8082',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:8082',
] as const;

function isAllowedLocalDevOrigin(origin: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

export function configureApp(app: INestApplication, config: ConfigService) {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const productionLike = !['development', 'test'].includes(nodeEnv);
  const configuredOrigins = parseCorsOrigins(config.get<string>('CORS_ORIGINS'));
  const allowedOrigins = configuredOrigins.length
    ? configuredOrigins
    : [...LOCAL_FALLBACK_CORS_ORIGINS];

  app.use(
    helmet({
      // API responses are consumed cross-origin by Expo Web during local development.
      crossOriginResourcePolicy: false,
    }),
  );

  const originDelegate = (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    const requestOrigin = typeof origin === 'string' ? origin : undefined;

    // Native apps, curl, health checks, and many automated tests omit the Origin header.
    if (!requestOrigin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(requestOrigin)) {
      callback(null, true);
      return;
    }

    if (!productionLike && isAllowedLocalDevOrigin(requestOrigin)) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        productionLike
          ? 'Origin is not allowed by CORS policy'
          : `Origin ${requestOrigin} is not allowed by CORS policy`,
      ),
      false,
    );
  };

  app.enableCors({
    credentials: true,
    origin: originDelegate,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
