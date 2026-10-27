import { Controller, Get } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { configureApp } from './app.bootstrap';

@Controller('health')
class PreviewHealthController { @Get() health() { return { status: 'ok' }; } }

describe('preview API strict CORS boundary', () => {
  it('allows only the configured preview origin in production-like mode', async () => {
    const module = await Test.createTestingModule({ controllers: [PreviewHealthController] }).compile();
    const app = module.createNestApplication();
    const origin = 'https://phase1-preview.example.test';
    const values: Record<string, string> = { NODE_ENV: 'staging', CORS_ORIGINS: origin };
    configureApp(app, { get: (key: string) => values[key] } as ConfigService);
    app.useLogger(false);
    await app.init();
    try {
      await request(app.getHttpServer()).options('/health').set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST').expect(204)
        .expect('Access-Control-Allow-Origin', origin).expect('Access-Control-Allow-Credentials', 'true');
      const denied = await request(app.getHttpServer()).options('/health').set('Origin', 'https://other.example.test')
        .set('Access-Control-Request-Method', 'POST');
      expect(denied.status).toBeGreaterThanOrEqual(400);
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
      await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
    } finally { await app.close(); }
  });
});
