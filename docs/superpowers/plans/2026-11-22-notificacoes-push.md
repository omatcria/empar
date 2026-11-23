# Notificações push e no app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisos de ações de outros membros, vencimentos (3/1/0 dias, 9h), orçamento, MEI, queda de preço e reação chegando no sininho e como push no celular (PWA Empar), com geração de vencimentos no servidor.

**Architecture:** Toda origem grava em `notifications`; um gatilho BEFORE filtra preferência e duplicata, um gatilho AFTER chama a Edge Function `send-push` via `pg_net`, que envia Web Push (VAPID) a todas as inscrições do destinatário. Vencimentos vêm de uma função SQL agendada no `pg_cron`; ações de membros, orçamento e MEI vêm do app. O service worker gerado ganha `importScripts('push-sw.js')`.

**Tech Stack:** Supabase (Postgres, RLS, pg_cron, pg_net, Vault, Edge Functions Deno), Vite 8 + vite-plugin-pwa 2 (generateSW), React 19, Zustand 5, Vitest 4, Pillow, agent-browser 0.38.

**Spec:** `docs/superpowers/specs/2026-11-22-notificacoes-push-design.md`

## Global Constraints

- Dinheiro em centavos; texto monetário no formato `R$ 1.234,56`; datas `YYYY-MM-DD`, rótulo curto `dd/mm`.
- Textos pt-BR exatamente como na spec (§2.1 formatos, §2.2 textos, §4 estados/botões).
- Tipos e mapa tipo→preferência→rota exatamente como a spec §5.
- Segredos (`VAPID_PRIVATE_KEY`, `PUSH_WEBHOOK_SECRET`, token do `.mcp.json`) nunca impressos, registrados nem commitados; a chave VAPID **pública** vive em `src/lib/push-config.ts`.
- `VAPID_SUBJECT = https://empar-pink.vercel.app` (nunca e-mail pessoal).
- Banco só via `scripts/supabase/sbq.sh`/`gen-types.sh`; Edge Functions via `scripts/supabase/deploy-functions.sh` (token do `.mcp.json` exportado como `SUPABASE_ACCESS_TOKEN` sem eco).
- Ícones só de `@/components/icons`; classes `text-app-*`, `bg-app-surface*`, `border-app-border`, `rounded-xl`; inputs ≥16px no mobile (padrão atual).
- Falha ao gravar/enviar aviso nunca quebra a ação do usuário (só `console.error`).
- Tarefas paralelas: só os arquivos listados na tarefa; `git add <caminhos>` explícitos; commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; sem agent-browser nas Tasks 1–6.

## Review Focus

1. Ação feita logo ao abrir o app, antes de `useWorkspace.members` carregar → `notifyMembers` busca os membros no banco e ainda avisa os outros. Teste na Task 3.
2. Destinatário sem linha em `notification_prefs` → aviso é gravado (padrão ligado). Teste SQL na Task 1.
3. Inscrição expirada (push service responde 404/410) → removida; outros erros mantêm a inscrição. Teste na Task 2 (`shouldRemoveSubscription`) + caminho na Task 4.
4. Permissão negada ou iPhone fora do app instalado → estado claro (`blocked` / `ios-install`), sem exceção. Teste na Task 5.
5. Usuário com dois aparelhos → os dois recebem. Verificação na Task 4 (laço sobre todas as inscrições) e na Task 7.

## Ondas e posse de arquivos

| Onda | Tarefa | Arquivos exclusivos |
|---|---|---|
| 0 | T0 controlador | segredos no Supabase/Vault; `src/lib/push-config.ts` |
| 1 | T1 Banco | `supabase/migrations/20261122000200_33_push_notifications.sql`, `supabase/tests/push_notifications.sql`, `src/lib/database.types.ts`, `src/domain/types.ts` |
| 1 | T2 Mapa de tipos | `supabase/functions/_shared/notification-routes.ts`, `src/engine/notification-routes.ts`, `src/engine/__tests__/notification-routes.test.ts` |
| 1 | T3 Avisos do app | `src/engine/member-notifications.ts`, `src/engine/__tests__/member-notifications.test.ts`, `src/store/notify.ts`, `src/store/__tests__/notify.test.ts`, `src/store/data.ts`, `src/store/wishlist.ts`, `src/store/notifications.ts`, `src/engine/notifications.ts`, `src/engine/__tests__/engine.test.ts` (só o bloco de `computeNotifications`), `src/store/__tests__/data-notify.test.ts` |
| 2 | T4 send-push | `supabase/functions/send-push/index.ts`, `supabase/config.toml`, `scripts/supabase/deploy-functions.sh`, `supabase/functions/check-notifications/` (remoção) |
| 2 | T5 Push no aparelho | `src/lib/push.ts`, `src/lib/__tests__/push.test.ts`, `src/store/push.ts`, `src/store/__tests__/push.test.ts`, `public/push-sw.js`, `vite.config.ts`, `scripts/generate-pwa-icons.py`, `public/icons/badge-72.png`, `src/App.tsx` |
| 3 | T6 Telas | `src/features/notifications/NotificationSettings.tsx`, `src/features/notifications/__tests__/NotificationSettings.test.tsx`, `src/routes/Settings/Settings.tsx`, `src/components/layout/NotificationsDropdown.tsx` |
| 4 | T7 Validação e publicação | `docs/superpowers/e2e/2026-11-22-notificacoes-push.md` + deploy/merge |

---

### Task 0: Segredos e chave pública (controlador, antes da onda 1)

- [ ] Gerar `push_webhook_secret` aleatório (32 bytes hex) e as chaves VAPID (`npx --yes web-push generate-vapid-keys --json`) num arquivo temporário do scratchpad, sem imprimir.
- [ ] `select vault.create_secret('<webhook>', 'push_webhook_secret')` via `sbq.sh`; secrets da Edge Function via `POST /v1/projects/gkzstunjcftvqoljgvce/secrets`: `PUSH_WEBHOOK_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT=https://empar-pink.vercel.app`.
- [ ] Criar `src/lib/push-config.ts` com `export const VAPID_PUBLIC_KEY = '<chave pública base64url>'`; apagar o arquivo temporário; conferir `GET .../secrets` lista os 4 nomes e o Vault tem o segredo. Commit `chore(push): chave pública VAPID`.

### Task 1: Banco — migração 33, testes SQL e tipos

**Files:** Create `supabase/migrations/20261122000200_33_push_notifications.sql`, `supabase/tests/push_notifications.sql`; Modify `src/lib/database.types.ts` (gerado), `src/domain/types.ts`.

**Interfaces:**
- Produces (SQL): colunas novas de `notification_prefs` (`venc_recorrencias`, `venc_dividas`, `membros_lancamentos`, `membros_desejos`, `reacoes`); `notifications.dedupe_key` (gerada) + `unique (user_id, dedupe_key)`; tabela `push_subscriptions`; `notification_pref_column(text)`; gatilhos `trg_notifications_filter` (BEFORE) e `trg_notifications_push` (AFTER); `fmt_brl(bigint) returns text`; `generate_due_notifications(_today date default (now() at time zone 'America/Sao_Paulo')::date) returns integer`; job `notificacoes-vencimento-diario` (`0 12 * * *`).
- Produces (TS, `src/domain/types.ts`): `PushSubscriptionRow`, `PushSubscriptionInsert`.

- [ ] **Step 1: SQL test** `push_notifications.sql` — `begin;` … `rollback;`, padrão de usuário/claims de `supabase/tests/debt_regeneration.sql`; marcador de sucesso visível no retorno do `sbq.sh` (bloco `do` que termina com `raise exception 'PUSH_SQL_OK'`; qualquer falha levanta outra mensagem). Fixture: espaço com 2 membros (A dono, B editor; apagar a linha de `notification_prefs` de B, criada automaticamente pelo gatilho de novo usuário, para provar o padrão "sem preferência = permitido"), cartão "Nubank" com fatura não paga vencendo em `D+3` e uma compra de `15000`; despesa pendente "Aluguel" de `150000` com `data = D+1`; recorrência ativa de despesa "Internet" `9990`, `proxima_data = D`; dívida "Empréstimo" com parcela 2 de `50000` vencendo em `D+3`; uma fatura em `D+2` (não deve gerar). Asserções com `D = '2026-11-22'`:
  - `generate_due_notifications('2026-11-22')` retorna `8` (4 itens × 2 membros); títulos exatos: `Fatura do Nubank vence em 3 dias`, `Aluguel vence amanhã`, `Internet vence hoje`, `Parcela 2 de Empréstimo vence em 3 dias`; corpo da fatura `R$ 150,00 · vencimento 25/11`; corpo da recorrência `R$ 99,90 · recorrência mensal`.
  - segunda execução no mesmo dia retorna `0`.
  - com `venc_faturas = false` para A, nova fatura em `D+3` gera só para B.
  - `fmt_brl(123456)` = `R$ 1.234,56`.
  - com todas as preferências de A desligadas, uma inserção `tipo='teste'` para A é aceita; inserção de outra linha com o mesmo `user_id` e `dedupe_key` é descartada sem erro.
- [ ] **Step 2: Run** `scripts/supabase/sbq.sh -f supabase/tests/push_notifications.sql` → falha (função inexistente).
- [ ] **Step 3: Migração** conforme spec §1 e §2.2 (mapa de §5 em `notification_pref_column`; `teste` → `null` = nunca filtra; preferências ausentes = permitido). Gatilho AFTER usa `net.http_post` com `x-push-secret` do Vault e corpo `{"notification_id": id}`, protegido por `begin … exception when others then null` para nunca impedir o INSERT. Funções `SECURITY DEFINER`, `set search_path = public`, `EXECUTE` revogado de `public, anon, authenticated`. RLS de `push_subscriptions` por comando com `user_id = auth.uid()` + GRANT a `authenticated`. Aplicar com `sbq.sh -f` e registrar em `supabase_migrations.schema_migrations` (`'20261122000200'`, `'33_push_notifications'`).
- [ ] **Step 4: Run** o teste SQL → `PUSH_SQL_OK`; `select jobname, schedule from cron.job` mostra o job; advisors de segurança sem ERROR novo.
- [ ] **Step 5:** `scripts/supabase/gen-types.sh`; aliases em `src/domain/types.ts`; `npm run typecheck` sem erro nos seus arquivos.
- [ ] **Step 6: Commit** `feat(db): migração 33 — push, preferências, vencimentos no servidor`.

### Task 2: Mapa de tipos compartilhado

**Files:** Create `supabase/functions/_shared/notification-routes.ts`, `src/engine/notification-routes.ts` (`export * from '../../supabase/functions/_shared/notification-routes'`), `src/engine/__tests__/notification-routes.test.ts`.

**Interfaces (Produces):**
- `type NotificationTipo = 'membro_lancamento' | 'membro_desejo' | 'reaction' | 'venc_fatura' | 'venc_conta' | 'venc_recorrencia' | 'venc_divida' | 'orcamento_80' | 'mei' | 'wishlist' | 'teste'`
- `NOTIFICATION_PREF_BY_TIPO: Record<NotificationTipo, string | null>` (espelho do SQL; `teste: null`)
- `notificationRoute(tipo: string): string` (desconhecido → `/`)
- `interface PushPayload { title: string; body: string; url: string; tag: string; notification_id: string; icon: string; badge: string }`
- `buildPushPayload(n: { id: string; tipo: string; titulo: string; corpo: string | null }): PushPayload` (`icon '/icons/icon-192.png'`, `badge '/icons/badge-72.png'`, `tag = tipo`, corpo nulo → `''`)
- `shouldRemoveSubscription(status: number): boolean` (`404`/`410` → true)

- [ ] **Step 1: Failing test** — rotas dos 11 tipos da tabela §5 + `'xyz' → '/'`; `NOTIFICATION_PREF_BY_TIPO.venc_divida === 'venc_dividas'`, `.teste === null`; `buildPushPayload({id:'n1',tipo:'venc_fatura',titulo:'T',corpo:null})` → `{ title:'T', body:'', url:'/cartoes', tag:'venc_fatura', notification_id:'n1', icon:'/icons/icon-192.png', badge:'/icons/badge-72.png' }`; `shouldRemoveSubscription` true para 404/410, false para 400/403/500/201.
- [ ] **Step 2: Run** `npx vitest run src/engine/__tests__/notification-routes.test.ts` → FAIL.
- [ ] **Step 3: Implement** (TS puro, sem imports de Deno/Node, compatível com os dois lados).
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(notificacoes): mapa de tipos, rotas e payload de push compartilhados`.

### Task 3: Avisos de ações de membros e geração no app

**Files:** Create `src/engine/member-notifications.ts`, `src/engine/__tests__/member-notifications.test.ts`, `src/store/notify.ts`, `src/store/__tests__/notify.test.ts`, `src/store/__tests__/data-notify.test.ts`; Modify `src/store/data.ts`, `src/store/wishlist.ts`, `src/store/notifications.ts`, `src/engine/notifications.ts`, `src/engine/__tests__/engine.test.ts`.

**Interfaces:**
- Produces (engine):
  - `type MemberAction = 'criou' | 'editou' | 'excluiu'`
  - `type MemberEvent = { kind: 'lancamento'; acao: MemberAction; entityId: string; descricao: string; tipo: 'RECEITA' | 'DESPESA'; valorCentavos: Cents; data: string; parcelas?: number; afetadas?: number } | { kind: 'desejo'; acao: MemberAction; entityId: string; titulo: string; precoCentavos: Cents | null }`
  - `buildMemberNotification(evt: MemberEvent, autorNome: string): { tipo: 'membro_lancamento' | 'membro_desejo'; titulo: string; corpo: string; meta: { acao: MemberAction; entity_id: string } }`
- Produces (store): `notifyMembers(evt: MemberEvent): Promise<void>` em `src/store/notify.ts`; `useNotifications.getState().scheduleGenerate(): void` (debounce 2000 ms).
- Produces (assinaturas do `useData`, usadas pela Task 6): `addTransaction(input, opts?: { silent?: boolean })`, `addTransactions(inputs, opts?)`, `updateTransaction(id, patch, opts?)`, `updateTransactionGroup(id, patch, mode, opts?)`, `deleteTransaction(id, opts?)`, `deleteTransactionGroup(id, mode, opts?)`, `togglePago(id, opts?)`; `CardPurchaseParams.silent?: boolean`. `useWishlist`: `addItem(input, opts?)`, `updateItem(id, patch, opts?)`, `deleteItem(id, opts?)`.

Regras do builder (spec §2.1): base da descrição remove sufixo ` (n/m)`; vazia → `Lançamento`; `Despesa de`/`Receita de`; `criou` com `parcelas > 1` → título `… (Nx)`, corpo `… de R$ total em N parcelas`; `editou`/`excluiu` com `afetadas > 1` → título `<base> (<parcelas>x)`, corpo `Alteração em N parcelas` / `N parcelas removidas`; desejo `adicionou um desejo:` / `editou um desejo:` / `excluiu um desejo:`, corpo `R$ x` ou `Sem preço`.

Onde notifica (uma vez, na ação mais externa; internas com `{ silent: true }`): `addTransaction`; `addTransactions` (1 aviso usando a 1ª linha — pró-labore, rateio); `addCardPurchase` (1 aviso; parcelado com `parcelas` e valor total); `updateTransaction`/`togglePago`; `updateTransactionGroup` (`THIS` ou sem grupo → aviso simples; senão `afetadas`); `deleteTransaction`; `deleteTransactionGroup` (`ALL` → `afetadas`); `addItem`/`updateItem`/`deleteItem`. Silenciosos: `runDueRecurrences` → `addTransactions(..., { silent: true })`; `refreshPrice` → `updateItem(..., { silent: true })`. Descrição vazia → nome da categoria do lançamento. Toda mutação de lançamento (silenciosa ou não) chama `scheduleGenerate()`.

`notifications.ts`/`engine/notifications.ts`: `computeNotifications` deixa de gerar `venc_fatura`/`venc_conta` (remover blocos e testes correspondentes; manter orçamento e MEI); `generate()` calcula com todas as preferências ligadas e grava cada aviso para **cada membro** do espaço (mesmo `dedupe_key`), sem consultar `notification_prefs` dos outros (o gatilho filtra); ignora erro de duplicata.

- [ ] **Step 1: Failing tests.**
  - `member-notifications.test.ts`: cada linha da tabela §2.1 com `autor 'Gabriela'` — ex.: `criou` `{descricao:'Mercado',tipo:'DESPESA',valorCentavos:15000,data:'2026-11-22'}` → `{ tipo:'membro_lancamento', titulo:'Gabriela lançou: Mercado', corpo:'Despesa de R$ 150,00 · 22/11' }`; parcelado `{descricao:'TV',valorCentavos:240000,parcelas:12}` → `'Gabriela lançou: TV (12x)'`, `'Despesa de R$ 2.400,00 em 12 parcelas'`; `excluiu` `{descricao:'TV (3/12)',parcelas:12,afetadas:12}` → `'Gabriela excluiu: TV (12x)'`, `'12 parcelas removidas'`; receita `'Receita de R$ …'`; desejo sem preço → `'Sem preço'`; descrição vazia → `'Lançamento'`.
  - `notify.test.ts` (mock de `@/lib/supabase`, `@/store/auth`, `@/store/workspace`): 3 membros (eu + 2) → `insert` com 2 linhas, nenhuma com o meu `user_id`; `members` vazio → busca `workspace_members` do espaço e avisa os outros (Review Focus 1); `insert` rejeita → resolve sem lançar.
  - `data-notify.test.ts` (padrão de `src/store/__tests__/recurrences.test.ts`): `addCardPurchase` 12x → `notifyMembers` chamado 1 vez com `parcelas: 12`; `updateTransactionGroup(...,'ALL')` em grupo de 3 → 1 vez com `afetadas: 3`; `runDueRecurrences` gerando ocorrências → 0 vezes; `addTransaction(..., { silent: true })` → 0 vezes.
  - `engine.test.ts`: `computeNotifications` não retorna mais `venc_fatura`/`venc_conta` (fatura vencendo amanhã → nenhum aviso desses tipos); orçamento/MEI inalterados.
  - teste de `generate` (em `notify.test.ts` ou arquivo próprio do store): 2 membros + orçamento a 85% → `insert` com 2 linhas `orcamento_80` (uma por membro) e mesmo `meta.dedupe_key`.
- [ ] **Step 2: Run** os arquivos novos/alterados → FAIL.
- [ ] **Step 3: Implement** builder, `notify.ts` (autor = `nome` do membro atual em `members`, senão `Alguém`; `workspace_id` ativo), fiação no `data.ts`/`wishlist.ts`, `scheduleGenerate` e o novo `generate`.
- [ ] **Step 4: Run** testes focados + `npx vitest run src/engine src/store` + `npm run typecheck` (seus arquivos verdes).
- [ ] **Step 5: Commit** `feat(notificacoes): avisos de ações de membros e alertas para todo o espaço`.

### Task 4: Edge Function `send-push`

**Files:** Create `supabase/functions/send-push/index.ts`; Modify `supabase/config.toml` (`[functions.send-push] verify_jwt = false`), `scripts/supabase/deploy-functions.sh` (linha de deploy da `send-push` com `--no-verify-jwt`); Delete `supabase/functions/check-notifications/`.

**Interfaces:** Consumes `buildPushPayload`, `shouldRemoveSubscription` (Task 2, via import relativo `../_shared/notification-routes.ts`); tabela `push_subscriptions` e secrets (Tasks 0–1).

- [ ] **Step 1:** Implementar conforme spec §3: `POST` com `x-push-secret` ≠ `PUSH_WEBHOOK_SECRET` → `401`; lê notificação (service role) e inscrições do `user_id`; envia a **cada** inscrição (Review Focus 5) com biblioteca Web Push compatível com Deno — preferir `npm:web-push@3.6.7` (`setVapidDetails`, `sendNotification`, TTL 86400); se não rodar no runtime do Supabase, usar `jsr:@negrel/webpush`; `shouldRemoveSubscription(status)` → apaga; sucesso → `last_used_at = now()`; responde `{ sent, removed, failed }`. Notificação inexistente → `404 { error }`.
- [ ] **Step 2: Deploy** com `deploy-functions.sh` (ou só a função nova) e verificar se `check-notifications` está publicada (`GET /v1/projects/.../functions`); se estiver, apagar (`DELETE /v1/projects/.../functions/check-notifications`).
- [ ] **Step 3: Verify (curl, sem imprimir segredos):** sem header → `401`; com segredo e `notification_id` de uma notificação `teste` de um usuário sem inscrições → `200 {"sent":0,"removed":0,"failed":0}`; com uma inscrição falsa inserida por SQL (endpoint `https://fcm.googleapis.com/fcm/send/invalido`, chaves de exemplo válidas em base64url) → resposta registra `failed` ou `removed` sem `500`; remover os dados de teste por SQL.
- [ ] **Step 4: Verify trigger:** inserir por SQL uma notificação `teste` real → `select status_code from net._http_response order by created desc limit 1` = `200`.
- [ ] **Step 5: Commit** `feat(push): Edge Function send-push e remoção do stub check-notifications`.

### Task 5: Push no aparelho (inscrição, service worker, ícone)

**Files:** Create `src/lib/push.ts`, `src/lib/__tests__/push.test.ts`, `src/store/push.ts`, `src/store/__tests__/push.test.ts`, `public/push-sw.js`, `public/icons/badge-72.png`; Modify `vite.config.ts`, `scripts/generate-pwa-icons.py`, `src/App.tsx`.

**Interfaces:**
- Consumes: `VAPID_PUBLIC_KEY` (`src/lib/push-config.ts`, Task 0); `PushSubscriptionInsert` (Task 1).
- Produces:
  - `type PushEnv = { userAgent: string; maxTouchPoints: number; standalone: boolean; hasServiceWorker: boolean; hasPushManager: boolean; hasNotification: boolean }`
  - `pushSupport(env: PushEnv): 'ok' | 'ios-install' | 'unsupported'`, `currentPushEnv(): PushEnv`, `urlBase64ToUint8Array(s: string): Uint8Array`
  - `usePush` (Zustand): `{ status: 'checking' | 'unsupported' | 'ios-install' | 'off' | 'on' | 'blocked' | 'error'; error: string | null; refresh(): Promise<void>; enable(): Promise<void>; disable(): Promise<void>; sendTest(): Promise<void> }`

- [ ] **Step 1: Failing tests.**
  - `push.test.ts`: iPhone UA + `standalone:false` → `'ios-install'`; iPhone UA + `standalone:true` + APIs presentes → `'ok'`; `Macintosh` + `maxTouchPoints:5` + `standalone:false` → `'ios-install'`; Android com APIs → `'ok'`; sem `PushManager` → `'unsupported'`; `urlBase64ToUint8Array('AQID')` → `[1,2,3]`.
  - `store/push.test.ts` (mocks de `Notification`, `navigator.serviceWorker.ready.pushManager`, `@/lib/supabase`, auth/workspace): `enable()` com permissão `'denied'` → `status 'blocked'` sem lançar (Review Focus 4); `'granted'` → `subscribe({ userVisibleOnly: true, applicationServerKey })` e `upsert` em `push_subscriptions` com `{ user_id, endpoint, p256dh, auth }` e `onConflict: 'endpoint'` → `'on'`; `disable()` → `unsubscribe()` + `delete().eq('endpoint', …)` → `'off'`; `sendTest()` → `insert` em `notifications` com `tipo 'teste'`, `titulo 'Notificações ativadas'`, `corpo 'Este é um teste do Empar.'` para o próprio usuário; `refresh()` com permissão concedida e inscrição existente → re-`upsert` e `'on'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `push.ts`, `store/push.ts`; `App.tsx` chama `usePush.getState().refresh()` quando há sessão e espaço ativo.
- [ ] **Step 4: Service worker e ícone.** `public/push-sw.js` (JS puro): `push` → `event.waitUntil(self.registration.showNotification(title, { body, icon, badge, tag, data: { url } }))` com fallback de título `Empar`; `notificationclick` → fecha, procura cliente do mesmo origin (`clients.matchAll({ type: 'window', includeUncontrolled: true })`), foca e `navigate(url)`, senão `clients.openWindow(url)`. `vite.config.ts`: `workbox.importScripts: ['push-sw.js']` e `push-sw.js` no `includeAssets`. `generate-pwa-icons.py` gera `badge-72.png` (silhueta branca do símbolo, fundo transparente, 72×72) — rodar o script.
- [ ] **Step 5: Run** testes focados, `npm run build` → `dist/sw.js` contém `importScripts("push-sw.js")` e `dist/push-sw.js` existe.
- [ ] **Step 6: Commit** `feat(push): inscrição do aparelho, service worker de push e ícone de badge`.

### Task 6: Tela de notificações, sininho e dados de exemplo silenciosos

**Files:** Create `src/features/notifications/NotificationSettings.tsx`, `src/features/notifications/__tests__/NotificationSettings.test.tsx`; Modify `src/routes/Settings/Settings.tsx`, `src/components/layout/NotificationsDropdown.tsx`.

**Interfaces:** Consumes `usePush` (Task 5), `notificationRoute` (Task 2), prefs novas (Task 1), `opts.silent`/`CardPurchaseParams.silent` (Task 3).

- [ ] **Step 1: Failing test** (mocks de `usePush`, `useNotifications`): `checking` → sem botões de ação; `error` → mostra `error` em `role="alert"` e o botão `Ativar notificações`; demais estados → textos exatos da spec §4 (`Ativas neste aparelho`, `Desativadas`, `Bloqueadas no navegador`, `No iPhone, instale o app na tela inicial para receber notificações`, `Este navegador não suporta notificações`); botão `Ativar notificações` chama `enable`; com `status 'on'` aparecem `Desativar neste aparelho` e `Enviar teste`; as 10 chaves agrupadas em *Ações de outros membros* (Lançamentos, Desejos, Reações), *Vencimentos* (Faturas, Contas a pagar, Recorrências, Parcelas de dívidas), *Alertas* (Orçamento 80%, Limite do MEI, Queda de preço) e alternar uma chama `updatePrefs({ <coluna>: false })`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** o componente (no lugar do bloco "Notificações" atual de `Settings.tsx`); sininho: clique marca lido, fecha e navega com `useNavigate()` para `notificationRoute(n.tipo)`; em `SeedExampleButton` passar `{ silent: true }` em todas as chamadas `addTransaction`/`addTransactions` e `silent: true` no `addCardPurchase`.
- [ ] **Step 4: Run** teste + `npm test` + `npm run typecheck` + `npm run build` verdes.
- [ ] **Step 5: Commit** `feat(notificacoes): tela de notificações, navegação no sininho e exemplo silencioso`.

### Task 7: Validação real, revisão final e publicação (controlador)

- [ ] `npm test`, `npm run typecheck`, `npm run build` verdes.
- [ ] E2E (agent-browser, `vite preview` do build, conta descartável — Ruling R6 da leva 4; a sessão `financas-e2e` fica deslogada): Configurações → **Ativar notificações** (conceder permissão via CDP/flag do navegador se necessário) → linha em `push_subscriptions`; **Enviar teste** → `net._http_response` 200 e resposta da função `sent ≥ 1`; segundo usuário descartável no mesmo espaço (convite) lança um gasto → linha `membro_lancamento` para o primeiro; sininho mostra o aviso e navega para `/lancamentos`; `generate_due_notifications()` manual sem erro.
- [ ] Limpeza: contas descartáveis, espaços, inscrições e notificações de teste apagados por SQL; contagem zero.
- [ ] Relatório `docs/superpowers/e2e/2026-11-22-notificacoes-push.md` (inclui como o usuário testa no celular: instalar o app, Configurações → Ativar → Enviar teste).
- [ ] Revisão final do branch (opus), uma onda de correção se necessário, merge `--no-ff` em `main`, `git push origin main` (autor omatcria), checagem de produção (`/push-sw.js` 200, `sw.js` com `importScripts`), memória do projeto atualizada.
