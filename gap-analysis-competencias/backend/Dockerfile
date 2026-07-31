# Imagem de produção — ver docs/02-arquitetura-tecnica.md secção 7.
# Não é usada pelo docker-compose.yml de desenvolvimento (esse monta o
# código como volume e corre `npm run start:dev` diretamente).

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
EXPOSE 3000

# `prisma migrate deploy` aplica migrações pendentes a cada arranque —
# seguro em produção (nunca gera migrações novas, só aplica as já
# commitadas em prisma/migrations/). Criar o primeiro utilizador ADMIN_RH
# é um passo manual/CI separado (`npm run seed:admin`), não corre aqui.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
