# Gap Analysis de Competências

Aplicação para RH analisar o desvio (gap) entre as competências/certificações
exigidas por cada função e as competências reais dos colaboradores.

## Estado atual

Modelo de dados e arquitetura técnica especificados e implementados:

- [`docs/01-modelo-dados.md`](docs/01-modelo-dados.md) — esquema
  relacional + ERD, lógica de pontuação por LOB, plano de
  auditoria/histórico, validado contra o Excel de origem (sem problemas
  de qualidade de dados por resolver).
- [`docs/02-arquitetura-tecnica.md`](docs/02-arquitetura-tecnica.md) —
  backend (NestJS + Prisma), autenticação/autorização (JWT + RBAC),
  frontend (React), execução local (Docker Compose) e deploy.
- [`backend/`](backend/) — API NestJS funcional: login, RBAC (grosseiro
  por papel + fino por linha), integração do trigger de auditoria com o
  utilizador autenticado, schema Prisma completo, migração SQL, script de
  importação do Excel.
- [`frontend/`](frontend/) — SPA React: login, rotas protegidas por
  autenticação/papel, consumo da API.

Validado de ponta a ponta (login → RBAC → escrita → auditoria, no
backend; login → dashboard → navegação condicionada por papel → logout,
no frontend, num browser real). Não validado: `docker-compose.yml` e os
`Dockerfile` — o ambiente onde isto foi construído não tinha Docker
disponível (ver nota em `docs/02-arquitetura-tecnica.md` secção 6).

## Como correr localmente

```bash
cp .env.example .env   # ajusta JWT_SECRET e ADMIN_PASSWORD
docker compose up
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000 (Swagger em `/api/docs`)

Sem Docker, ver `backend/README.md` e `frontend/README.md`.

**Nota**: o ficheiro Excel com dados reais de colaboradores nunca é
commitado neste repositório — só o schema e o código de importação.
