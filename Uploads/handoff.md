# Handoff: App Finanças — organizador financeiro PJ + Pessoal (colaborativo)

*Data:* 2026-07-07
*Status:* Em andamento — 5 de 8 pedidos do backlog atual concluídos; falta a "camada social/notificações" (itens 5, 6, 7), aguardando OK para iniciar.

---

## 1. Objetivo

Construir um app de organização financeira para quem é **CLT + PJ ao mesmo tempo**, mantendo **finanças Pessoais e Empresariais totalmente separadas**, com visão **Consolidada**. Regra de ouro do domínio: tudo que entra/sai da empresa fica no lado **EMPRESARIAL**; a **única ponte** PJ→Pessoal é o **pró-labore** (e distribuição de lucros). O app já é **multi-membro** (casal/sócio/contador compartilham um "Espaço"). As Fases 1, 2 e 3 do roadmap estão prontas; agora estamos numa leva de bugs + features novas.

---

## 2. Contexto essencial

**Stack (jul/2026):** Vite 8 · React 19 · TypeScript 6 · **Tailwind v4** (CSS-first, tokens via `@theme` em `src/styles/globals.css`, **sem** tailwind.config) · **Zustand 5** (estado) · **Recharts 3** (gráficos) · **date-fns 4** · **@tabler/icons-react** (ícones) · **react-router-dom 7** · **Vitest 4** (testes da engine). Diretório do projeto: `D:\VIBE CODDING\CLAUDE CODE\APP FINANÇAS`.

**Backend:** **Supabase** (cloud Postgres), projeto **"App Finanças"**, ref `gkzstunjcftvqoljgvce` (org `wdutytagknebwkmwfwoy`, us-east-2). Acesso via **MCP** configurado em `.mcp.json` (gitignored — token NÃO versionar). Migrações aplicadas via MCP `apply_migration` (19 migrações + hardenings).

**Decisões tomadas (e por quê):**
- **Supabase em nuvem** em vez de local-first/Dexie (escolha do usuário) → habilita multi-dispositivo + RLS + colaboração. Mantido um `StorageAdapter` conceitual, mas hoje tudo passa por `supabase-js`.
- **Dinheiro sempre em centavos (inteiros `bigint`)**; formatação pt-BR/BRL só na borda (`src/lib/money.ts`). Datas ISO `string`.
- **Engine financeira PURA e testada** (`src/engine/`, sem React/DB) é a fonte da verdade dos cálculos. **28 testes** (Vitest). Nunca duplicar cálculo em componente.
- **Saldos e total de fatura são DERIVADOS** (calculados pela engine), não armazenados → sem drift.
- **Ponte PJ↔Pessoal = par de transações com mesmo `transfer_id`**; categorias de sistema achadas por `categories.chave` (PRO_LABORE_SAIDA/ENTRADA, DISTRIBUICAO_SAIDA/ENTRADA, IMPOSTOS), nunca por nome. No **Consolidado** a engine ignora os pares (não infla receita/despesa).
- **Provisão de imposto é DERIVADA**: `receitas PJ × Σ% envelopes ativos − impostos pagos` (categoria chave IMPOSTOS). O campo `tax_provisions.saldo_provisionado_centavos` é vestigial (não usar).
- **Multi-tenant por Espaço (workspace):** dados pertencem a um `workspace_id` (não a um user). RLS por participação via funções SECURITY DEFINER `is_member`/`has_write`(owner+editor)/`is_owner`. Papéis: **owner/editor/viewer**. Convite por **código/link** (RPC `accept_invite(token)`).
- **Design System = "AbacatePay" (TEMA CLARO)**: primária verde `#9EEA6C`, fonte **Fustat** (Google Fonts), superfícies claras. Tokens em `globals.css`. **Não usar** classes `text-slate-*` (foram migradas para `text-app-fg` / `text-app-fg2` / `text-app-muted`).
- **Ícones:** sempre importar de `@/components/icons` (wrapper que re-exporta ícones **Tabler** com nomes estilo-Lucide). Nunca de `lucide-react`.

---

## 3. O que já foi feito (cronológico)

1. **Banco (Supabase):** 10 tabelas de domínio (accounts, cards, invoices, categories, recurrences, transactions, budgets, goals, tax_provisions, profiles) + enums + índices + triggers `updated_at` + **RLS** + trigger `handle_new_user` (semeia categorias/impostos/metas por usuário). Advisors de segurança limpos.
2. **Engine pura + testes** (money, balances, invoices/parcelas, transfers/pró-labore, taxes derivadas, recurrences, reports/DRE/projeção, categorize). 28 testes passando.
3. **App Fase 1 (MVP):** auth (Supabase e-mail/senha), onboarding, shell (seletor de contexto Pessoal/Empresarial/Consolidado + seletor de mês + nav adaptável + FAB), Dashboard, Contas (com **conciliação de saldo** em 2 modos), Lançamentos, **Pró-labore 1 clique**, Cartões/Faturas, Categorias, Limites/orçamento + alertas, "a pagar/receber", Config + backup JSON + dados de exemplo.
4. **Fase 2:** provisão automática de impostos (derivada), Metas, Recorrências (gera atrasadas ao abrir), Rateio de despesa (% PJ/Pessoal).
5. **Fase 3:** Relatórios com widgets **personalizáveis** (fixar/ordenar; store `dashboardPrefs` em localStorage), DRE, export CSV, categorização automática por histórico.
6. **Multi-membro (colaboração):** migrações 11–17 (workspaces, workspace_members com role, workspace_invites, `workspace_id` em todas as tabelas + backfill, RLS por membership, `accept_invite`). Store `useWorkspace`, escopo do `useData.loadAll(workspaceId)`, `ownerCols()` nos inserts, `useCanWrite()` esconde botões para viewer, rota `/membros`. **Validado E2E** (owner vê dados; viewer convidado vê mas não escreve).
7. **Design system claro + Tabler:** reescrita de `globals.css`, Button primário verde, migração em massa de classes escuras, cores dos gráficos claras, `index.html` sem `dark`, wrapper de ícones `src/components/icons.ts`.
8. **Backlog atual — FEITO (bugs 1,2,3 + features 4,8):**
   - **Bug 1 (parcelas "na mesma fatura"):** era **percepção** — a engine já distribui certo (novo teste prova faturas de meses distintos, inclusive fechamento dia 31). Ajustes de exibição: card mostra "Em aberto (todas as faturas)"; modal de faturas mostra nº de lançamentos.
   - **Bug 2 (pagar fatura):** coluna `invoices.paid_account_id`; engine `accountBalance` desconta da conta escolhida (fallback = conta padrão do cartão); `payInvoice(id, paga, accountId)`; **PayInvoiceModal** com seletor de conta.
   - **Bug 3 (categoria no orçamento):** `CategoryFormModal` extraído para `src/features/categories/` e reusado; botão "Nova categoria" na tela de Orçamentos.
   - **Feature 4 (icon picker):** `src/domain/icons-catalog.tsx` (~70 ícones Tabler, `searchIcons` busca PT+EN, `CategoryIcon`). Categoria salva `icone`=key; ícone real renderizado em Categorias/Lançamentos/Orçamentos.
   - **Feature 8 (bancos):** `src/domain/banks.tsx` (16 bancos BR com cor de marca, `BankBadge`, `BankPicker`); colunas `accounts.banco` e `cards.banco`; picker nos forms; badge nas listas.

**Descartado/mudado:** proposta original de local-first/Dexie foi trocada por Supabase (decisão do usuário). Logos oficiais de banco em SVG foram substituídos por **badges coloridos com sigla** (licença de marca + sem download de assets) — pragmático e reconhecível pela cor.

---

## 4. Estado atual

**Funciona:** `npm run build` limpo; **28/28 testes** (`npm test`); dev server em **http://localhost:5173** (HTTP 200). App inteiro no **tema claro**, ícones Tabler, multi-membro, todos os módulos das Fases 1-3, e os 5 itens do backlog acima.

**Quebrado / atenção:** nada quebrado conhecido. Observações:
- Para **logar** é preciso ter **"Confirm email" DESLIGADO** no Supabase (Auth) — senão o signup estoura rate limit do SMTP de teste.
- Fonte Fustat vem do Google Fonts (precisa de internet; sem ela, cai pro sistema).
- Bundle grande do Recharts está isolado em chunk próprio (code-splitting).

**Faltam os itens 5, 6, 7 do backlog** (camada social/notificações) — nada iniciado.

---

## 5. Próximos passos (ordenado e acionável)

Ordem sugerida: **5 → 7 → 6**.

**Item 5 — Perfil com foto + atribuição "quem fez":**
1. Migração: `alter table profiles add column avatar_url text;`
2. Supabase **Storage**: criar bucket `avatars` (público OU signed URLs). Políticas de Storage para o usuário subir/editar o próprio avatar.
3. Tela de perfil (em `routes/Settings`): upload de foto + preview; salvar `avatar_url`.
4. Atribuição: cada `transactions.user_id` é o criador. Fazer join com `workspace_members` (que já guarda `nome`/`email`; adicionar `avatar_url` lá ou buscar do profile). Exibir "por Fulano" + avatar em `TransactionList` e nos widgets.
5. Histórico de mudanças: tabela `activity_log` (workspace_id, user_id, entity, action, entity_id, at) — gravar na app (ou triggers) em create/update/delete de transações.

**Item 7 — Notificações configuráveis:**
1. Migração: `notifications` (workspace_id, user_id destino, tipo, titulo, corpo, lida, created_at, meta jsonb) + `notification_prefs` (user_id, venc_faturas bool, venc_contas bool, orcamento_80 bool).
2. Geração (na app ao `loadAll` ou por rotina): (a) faturas/contas a vencer nos próximos N dias; (b) categorias que passaram de **80% do limite** (usar `engine.categorySpend` × budget). Deduplicar por período.
3. UI: **sino** no header com contador + inbox; toggles em Config; RLS por usuário.

**Item 6 — Reações (social):**
1. Migração: enum `reaction_emoji` (like/love/angry/sad) + tabela `transaction_reactions` (transaction_id, user_id, emoji, unique(transaction_id,user_id)). RLS por membership.
2. **Realtime** (supabase channel) para reações aparecerem ao vivo; gerar uma `notification` para o autor do lançamento quando alguém reage.
3. UI: barra de reações no lançamento (de outros membros) + contagem; integrar ao inbox do sino.

**Depois:** rodar `get_advisors` após cada migração; regenerar tipos (`generate_typescript_types`) OU editar `database.types.ts` à mão; `npm run build` + `npm test` a cada passo.

---

## 6. Perguntas em aberto

- **Avatar:** bucket público (URL simples, porém pública) vs signed URLs (mais privado, mais código)? Sugerido: **público** para simplicidade, já que é foto de perfil.
- **Notificações:** gerar **na app** (ao abrir) é suficiente, ou querem push/agendado (precisaria de Edge Function + cron)? Sugerido começar **na app**.
- **Reações realtime:** usar Supabase Realtime (channels) — confirmar que Realtime está habilitado nas tabelas no projeto.
- **Histórico "quem mudou":** registrar só criação, ou também edições/exclusões (mais custo)? 
- **Tema escuro:** o usuário pediu o tema claro AbacatePay; oferecer um **toggle claro/escuro** depois? (Fica fácil pois tudo é token.)
- **Bug 1:** confirmar com o usuário se, ao testar em **Cartões → Faturas**, as parcelas aparecem em meses distintos (a engine está provada; se ainda parecer errado, pedir print).

---

## 7. Artefatos relevantes

**Comandos:**
- `npm run dev` (porta 5173) · `npm run build` · `npm test` · `npm run typecheck`
- Dev server pode já estar rodando; checar `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`.

**Arquivos-chave:**
- `src/engine/` — cálculos puros (index reexporta tudo). Testes: `src/engine/__tests__/engine.test.ts`.
- `src/store/` — `auth.ts`, `ui.ts`, `data.ts` (CRUD + `loadAll(workspaceId)` + `ownerCols()`), `workspace.ts` (`useWorkspace`, `useCanWrite`, `useActiveRole`), `dashboardPrefs.ts`.
- `src/lib/` — `supabase.ts` (cliente tipado), `database.types.ts` (tipos do schema — editar à mão ao migrar), `money.ts`, `cn.ts`.
- `src/domain/` — `types.ts`, `enums.ts`, `palette.ts`, `icons-catalog.tsx` (ícones de categoria), `banks.tsx` (bancos).
- `src/components/icons.ts` — **wrapper Tabler** (adicionar ícone novo: `IconX as X`).
- `src/features/` — `categories/CategoryFormModal.tsx`, `transactions/`, `prolabore/`, `rateio/`, `dues/`, `reports/widgets.tsx`.
- `src/routes/` — telas (Dashboard, Transactions, Accounts, Cards, Categories, Budgets, Goals, Recurrences, Reports, Members, Settings, Onboarding, Login).
- `.mcp.json` — MCP Supabase (contém token; gitignored).
- **Memórias** (`~/.claude/projects/.../memory/`): `app-financas-supabase.md`, `app-financas-fases.md`, `app-financas-backlog.md`, `MEMORY.md`.

**Supabase:** projeto ref `gkzstunjcftvqoljgvce`. Usar MCP `apply_migration` (DDL), `execute_sql` (consultas), `get_advisors` (após DDL), `generate_typescript_types`. RLS testável com `begin; set local role authenticated; set local "request.jwt.claims" to '{"sub":"<user_id>","role":"authenticated"}'; ... rollback;`.

**Skill de design:** `ui-ux-pro-max` (instalada) — mas o design agora segue o ref AbacatePay em `Uploads/design-system-ref`.

---

## 8. Instruções pra próxima sessão

- **Tom:** direto, técnico, em **português**. O usuário curte progresso contínuo ("continua") e resumos curtos com "como testar" ao fim de cada fase. Faça, não pergunte demais — mas confirme **decisões de produto ambíguas** (papéis, semântica) e **antes de migrar dados existentes**.
- **Nível de detalhe:** construir de verdade (código + migração + build + teste), não só planejar. Sempre `npm run build` e `npm test` após mudanças; rodar `get_advisors` após DDL.
- **Armadilhas a evitar:**
  1. **Não importar de `lucide-react`** — usar `@/components/icons` (Tabler). Ícone novo → adicionar no wrapper.
  2. **Não usar `text-slate-*`** — usar `text-app-fg` / `text-app-fg2` / `text-app-muted`; superfícies `bg-app-surface` / `bg-app-surface-2`; borda `border-app-border`. Primária verde = `bg-primary text-primary-content`.
  3. **Todo insert precisa de `workspace_id` + `user_id`** → usar `ownerCols()` no data store. RLS bloqueia sem membership.
  4. **Dinheiro em centavos** sempre; formatar só na exibição.
  5. **Cálculo financeiro só na engine** (`src/engine/`), com teste. Não calcular saldo/provisão em componente.
  6. **Ao migrar schema:** aplicar via MCP, depois **atualizar `src/lib/database.types.ts`** (à mão ou regenerar) e **os fixtures de teste** (`acc()`, `card()`, `invoice()`, etc. em `engine.test.ts` exigem todos os campos do Row).
  7. **"Confirm email" precisa estar desligado** no Supabase para logar em dev.
  8. Funções SECURITY DEFINER de RLS geram WARN de advisor "executável por authenticated" — isso é **intencional** (necessário para RLS/RPC); não quebrar.
- **Onde retomar:** ler as 4 memórias do projeto e este handoff; então perguntar ao usuário se começa a **fase social/notificações (itens 5→7→6)** ou se há prioridade. Depois seguir os "Próximos passos" da seção 5.
