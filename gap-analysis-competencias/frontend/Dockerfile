# Imagem de produção — ver docs/02-arquitetura-tecnica.md secção 7.
# Não é usada pelo docker-compose.yml de desenvolvimento (esse monta o
# código como volume e corre `npm run dev` diretamente).
#
# VITE_API_URL fica embebido no build estático (variáveis Vite são
# resolvidas em build-time, não em runtime) — passar sempre via --build-arg:
#   docker build --build-arg VITE_API_URL=https://api.empresa.pt -t frontend .

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
