# Gap Analysis de Competências

Aplicação para RH analisar o desvio (gap) entre as competências/certificações
exigidas por cada função e as competências reais dos colaboradores.

## Estado atual

Modelo de dados, arquitetura técnica, motor de comparação e interface
especificados e implementados:

- [`docs/01-modelo-dados.md`](docs/01-modelo-dados.md) — esquema
  relacional + ERD, lógica de pontuação por LOB, plano de
  auditoria/histórico, validado contra o Excel de origem.
- [`docs/02-arquitetura-tecnica.md`](docs/02-arquitetura-tecnica.md) —
  backend (NestJS + Prisma), autenticação/autorização (JWT + RBAC),
  frontend (React + Tailwind, visual Fiori-like), execução local (Docker
  Compose) e deploy.
- [`backend/`](backend/) — API NestJS: autenticação/RBAC, motor de gap
  (`gap-analysis/`, com 24 testes Jest na lógica pura), catálogo (LOBs,
  formações), administração de utilizadores, dashboard agregado por
  equipa/direção, schema Prisma completo, migrações SQL, importação do
  Excel.
- [`frontend/`](frontend/) — SPA React com 5 ecrãs: Dashboard, Ficha do
  Colaborador, Gestão de LOBs, Catálogo de Formações, Administração.

Validado de ponta a ponta: backend (login → RBAC → motor de gap →
auditoria, contra Postgres real, incluindo casos de certificação
expirada e o rollup por cargo/dashboard sem N+1) e frontend (todos os 5
ecrãs, incluindo RBAC no cliente, num browser real via Playwright). Não
validado: `docker-compose.yml` e os `Dockerfile` — o ambiente onde isto
foi construído não tinha Docker disponível (ver nota em
`docs/02-arquitetura-tecnica.md` secção 6).

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
