// Entrypoint serverless para o Vercel (Node runtime). A app "real" (dist/src/main.ts)
// arranca com app.listen() para desenvolvimento local/Docker — aqui reaproveitamos o
// mesmo AppModule compilado, mas envolvido num handler (req, res) sem listen(), porque
// é assim que o Vercel espera uma função Node clássica.
//
// bootstrap() só corre uma vez por instância "quente" (cachedApp fica no module scope,
// sobrevive entre invocações enquanto o container não for reciclado) — evita recriar
// o Nest/Express a cada pedido.
require('reflect-metadata');
const express = require('express');
const { NestFactory } = require('@nestjs/core');
const { ExpressAdapter } = require('@nestjs/platform-express');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module');

let cachedApp;

async function bootstrap() {
  const expressApp = express();
  const adapter = new ExpressAdapter(expressApp);
  const nestApp = await NestFactory.create(AppModule, adapter, { logger: ['error', 'warn'] });

  nestApp.enableCors({
    origin: (process.env.FRONTEND_ORIGIN || '').split(',').filter(Boolean),
    credentials: true,
  });

  nestApp.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await nestApp.init();
  return expressApp;
}

module.exports = async (req, res) => {
  if (!cachedApp) {
    cachedApp = await bootstrap();
  }
  return cachedApp(req, res);
};
