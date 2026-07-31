# Frontend — Gap Analysis de Competências

React + Vite + TypeScript, implementando a arquitetura descrita em
[`../docs/02-arquitetura-tecnica.md`](../docs/02-arquitetura-tecnica.md)
secção 5.

## Setup

```bash
npm install
cp .env.example .env   # ajusta VITE_API_URL se o backend não estiver em localhost:3000
npm run dev             # http://localhost:5173
```

Requer o backend a correr (ver `../backend/README.md`) e pelo menos um
utilizador criado (`npm run seed:admin` no backend).

## Estrutura

- `src/auth/` — `AuthContext` (guarda o JWT em `localStorage`, expõe
  `login`/`logout`/`user`), `ProtectedRoute` (bloqueia por autenticação e,
  opcionalmente, por papel — espelha o RBAC do backend).
- `src/api/client.ts` — wrapper fino sobre `fetch`, injeta o JWT no header
  `Authorization`.
- `src/pages/` — `LoginPage` (funcional), `DashboardPage` e
  `ColaboradoresPage` (placeholders — ver comentários nos ficheiros para o
  que falta).
- `src/types/api.ts` — tipos espelhando as respostas do backend,
  mantidos manualmente por agora (gerar a partir do Swagger é um próximo
  passo razoável quando a API crescer).

## Scripts

- `npm run dev` — servidor de desenvolvimento (hot reload).
- `npm run build` — `tsc --noEmit` + build de produção para `dist/`.
- `npm run typecheck` — só verificação de tipos, sem build.

## Dependências conhecidas (não resolvidas nesta entrega)

`npm audit` acusa duas vulnerabilidades por agora aceites conscientemente:

- **`esbuild` (via `vite`), moderada, só em `npm run dev`**: um site
  malicioso aberto no browser ao mesmo tempo que o dev server local podia
  ler respostas dele. Não afeta o build de produção (`npm run build`);
  corrigir exige subir para `vite@8` (breaking change, não validado nesta
  entrega).
- **`react-router`, alta, mas específica do modo RSC (React Server
  Components)**: este projeto usa `BrowserRouter` normal, não RSC — a
  vulnerabilidade não se aplica ao uso real daqui. `npm audit fix --force`
  sugeria *downgrade* para uma versão que reintroduz um redirect aberto
  (esse sim relevante ao `<Link>`/`useNavigate` que usamos) — por isso
  mantém-se a versão atual (`^7.18.2`, já corrigida para o redirect
  aberto) em vez de aplicar o fix sugerido.
