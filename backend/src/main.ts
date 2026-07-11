import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.bootstrap';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  configureApp(app, config);

  const port = config.get<string>('PORT') ?? '3000';
  await app.listen(port);
  console.log(`PREDIKT API running on port ${port}`);
}

bootstrap();
