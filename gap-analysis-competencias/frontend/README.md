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
  `Authorization`; `src/api/endpoints.ts` — chamadas tipadas por endpoint.
  Lê sempre a resposta como texto antes de fazer `JSON.parse` (só se não
  estiver vazia) — um handler do Nest que devolve `null` manda um corpo
  HTTP genuinamente vazio (`Content-Length: 0`), e `res.json()` direto
  rebenta nesse caso (apanhado durante a validação do Prompt 5: um modal
  ficava preso em "A carregar…" para sempre, com uma promise rejeitada
  sem handler).
- `src/components/layout/` — `ShellBar` (cabeçalho: logo, pesquisa global,
  perfil) e `SideNav` (menu lateral, itens filtrados por papel).
- `src/components/ui/` — sistema de design: `Card`, `Badge` (estado,
  sempre ícone+texto), `Tag` (atributo neutro, ex. "Obrigatório"),
  `DataTable` (pesquisa + ordenação client-side), `Modal`, `ProgressRing`,
  `KpiTile`, `ReadinessBarChart`, `form.tsx` (`Field`/`Input`/`Select`/`Button`).
- `src/components/gap/` — componentes partilhados entre a ficha do
  colaborador e o detalhe de LOB (`NivelPill`, `SugestoesLista`,
  `LobGapDetail`), mais os modais de escrita do Prompt 5
  (`AvaliarCompetenciaModal`, `EditarCertificacaoModal`) — ambos leem o
  estado atual do servidor ao abrir e tratam `409` (conflito de
  concorrência) mostrando o valor atual em vez de sobrescrever às cegas;
  ver `../docs/02-arquitetura-tecnica.md` secção 4.5.
- `src/pages/` — os 5 ecrãs: `DashboardPage`, `ColaboradoresListPage` +
  `ColaboradorProfilePage`, `LobsListPage` + `LobDetailPage`,
  `FormacoesPage`, `AdminPage`.
- `src/types/api.ts` — tipos espelhando as respostas do backend,
  mantidos manualmente por agora (gerar a partir do Swagger é um próximo
  passo razoável quando a API crescer).

## Visual — Fiori-like (Prompt 4)

Ver `../docs/02-arquitetura-tecnica.md` secção 5 para a justificação
completa (porquê Tailwind + tokens próprios em vez de
`@ui5/webcomponents-react`, a fonte "72" e o porquê de cair em
Arial/Segoe UI, e como as cores do gráfico do dashboard foram validadas
com a skill de dataviz antes de serem usadas). Resumo:

- `tailwind.config.js` — paleta `fiori-*` e a pilha de tipografia.
- `src/index.css` — `.fiori-table` (tabela densa) e o resto via classes
  utilitárias Tailwind diretamente nos componentes.
- Ícones: `lucide-react` (linha fina, look consistente com os ícones do
  Fiori sem depender da biblioteca de componentes oficial).

**Validado num browser real** (Playwright) para os 5 ecrãs: fluxo
completo login → dashboard → ficha do colaborador (com detalhe de LOB
expandido) → lista de colaboradores → LOBs (lista + detalhe) → formações
→ administração (lista, mudança de papel, criar utilizador) → RBAC no
frontend (EMPLOYEE redirecionado ao tentar `/admin` diretamente pelo
URL). Screenshots capturados durante essa sessão, não commitados.

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
