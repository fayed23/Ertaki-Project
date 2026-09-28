import { NestFactory } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { assertProductionSecrets } from './common/production-secrets';

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  const port = Number(process.env.PORT || 43124);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'api_listen',
      url: `http://0.0.0.0:${port}/api`,
      env: process.env.NODE_ENV || 'development',
    }),
  );
}
bootstrap();
