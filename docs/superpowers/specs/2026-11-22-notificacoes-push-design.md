# Notificações push e no app — Empar

**Data:** 22/11/2026 · **Branch:** `feat/notificacoes-push` · **Status:** design aprovado pelo usuário no brainstorming

## Contexto e diagnóstico

O usuário relatou que nada notifica — nem push no celular, nem no sininho do app — para lançamentos de outro membro, contas perto de vencer, novos desejos etc. A investigação mostrou:

1. **Push nunca foi implementado**: não há pedido de permissão, inscrição do aparelho, chaves VAPID, envio pelo servidor nem tratamento de `push` no service worker (a leva 4 deixou push fora do escopo).
2. **"Novo lançamento de outro membro" e "novo desejo" não existem** como avisos. Hoje só há: reação (`reaction`), vencimento de fatura/conta (`venc_fatura`/`venc_conta`, janela de 5 dias), orçamento (`orcamento_80`), MEI (`mei`) e queda de preço (`wishlist`, Edge Function diária).
3. **Vencimentos e orçamento são calculados só no navegador de quem abre o app**, e gravados só para ele (`useNotifications.generate`). A Edge Function `check-notifications` é um stub morto sem agendamento.
4. A tabela `notifications` está vazia em produção (o espaço real não tinha nada na janela de 5 dias).

Padrões do projeto mantidos: dados por workspace com RLS `is_member`/`has_write`; dinheiro em centavos; engine pura testada; `scripts/supabase/sbq.sh` para SQL e `scripts/supabase/deploy-functions.sh` para Edge Functions; segredos no Vault/secrets do Supabase, nunca no repositório; código compartilhado app×Edge em `supabase/functions/_shared/` (padrão do `product-parser`).

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Ações de outros membros | Avisar **criação, edição e exclusão** de lançamentos e de itens da lista de desejos, e reação. Quem fez a ação não recebe |
| Agrupamento | Compra parcelada / ação sobre um grupo de parcelas = **1 aviso** |
| Vencimentos | **3 dias antes, 1 dia antes e no dia**, às **9h (Brasília)**, gerados no servidor |
| O que vence | **Faturas de cartão, contas pendentes, próximas recorrências (despesa) e parcelas de dívidas** |
| Vencida | **Sem** aviso de "venceu e não foi paga" |
| Abordagem | Web Push padrão (VAPID) enviado pelo Supabase (Edge Function), sem terceiros |

## 1. Caminho único: tudo é uma linha em `notifications`

Toda origem (app, função do banco, Edge Function) só grava em `public.notifications`. O banco filtra, deduplica e dispara o push.

**Migração 33** (`supabase/migrations/20261122000200_33_push_notifications.sql`):

- `notification_prefs` ganha (todas `boolean not null default true`): `venc_recorrencias`, `venc_dividas`, `membros_lancamentos`, `membros_desejos`, `reacoes`.
- `notifications` ganha `dedupe_key text generated always as (meta->>'dedupe_key') stored` e `unique (user_id, dedupe_key)` (nulos não colidem).
- Tabela `push_subscriptions`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `endpoint text not null unique`, `p256dh text not null`, `auth text not null`, `user_agent text`, `created_at timestamptz default now()`, `last_used_at timestamptz`. RLS: o usuário só seleciona/insere/atualiza/apaga as próprias linhas (`user_id = auth.uid()`); GRANT para `authenticated`.
- Função `public.notification_pref_column(tipo text) returns text` (imutável) com o mapa da §5.
- Gatilho **BEFORE INSERT** em `notifications` (`SECURITY DEFINER`, `search_path=public`): descarta a linha (`return null`) se (a) existe `notification_prefs` do destinatário com a coluna do tipo = `false`, ou (b) já existe notificação do mesmo `user_id` com o mesmo `dedupe_key` não nulo. Tipo `teste` nunca é filtrado por preferência.
- Gatilho **AFTER INSERT** em `notifications` (`SECURITY DEFINER`): `net.http_post` para `https://gkzstunjcftvqoljgvce.supabase.co/functions/v1/send-push` com header `x-push-secret` (lido de `vault.decrypted_secrets` nome `push_webhook_secret`) e corpo `{"notification_id": <id>}`, `timeout_milliseconds := 10000`. Falha do `pg_net` nunca impede o INSERT.
- Funções novas com `EXECUTE` revogado de `public, anon, authenticated` (exceto o que o app chama por RPC, se houver).
- O segredo `push_webhook_secret` é criado no Vault por SQL fora do arquivo de migração (valor aleatório; nunca versionado), e o mesmo valor vira secret `PUSH_WEBHOOK_SECRET` da Edge Function.

## 2. Origens dos avisos

### 2.1 Ações de outros membros (gravadas pelo app)

Módulo `src/store/notify.ts`:

- `notifyMembers(evt: MemberEvent): Promise<void>` — destinatários = membros do espaço ativo (`useWorkspace.members`) exceto o usuário atual; uma linha por destinatário; falha só vai para `console.error` (nunca quebra a ação do usuário).
- Builders puros em `src/engine/member-notifications.ts` (testados): `buildMemberNotification(evt, autorNome)` → `{ tipo, titulo, corpo, meta }`.

Formatos (`autorNome` = nome do membro; fallback "Alguém"):

| Evento | `tipo` | Título | Corpo |
|---|---|---|---|
| lançamento criado | `membro_lancamento` | `Gabriela lançou: Mercado` | `Despesa de R$ 150,00 · 22/11` |
| parcelado criado | `membro_lancamento` | `Gabriela lançou: TV (12x)` | `Despesa de R$ 2.400,00 em 12 parcelas` |
| lançamento editado | `membro_lancamento` | `Gabriela editou: Mercado` | `Despesa de R$ 160,00 · 22/11` |
| grupo editado | `membro_lancamento` | `Gabriela editou: TV (12x)` | `Alteração em N parcelas` |
| lançamento excluído | `membro_lancamento` | `Gabriela excluiu: Mercado` | `Despesa de R$ 150,00 · 22/11` |
| grupo excluído | `membro_lancamento` | `Gabriela excluiu: TV (12x)` | `N parcelas removidas` |
| desejo criado | `membro_desejo` | `Gabriela adicionou um desejo: Fone X` | `R$ 299,90` (ou `Sem preço`) |
| desejo editado / excluído | `membro_desejo` | `Gabriela editou um desejo: Fone X` / `Gabriela excluiu um desejo: Fone X` | idem |

Descrição vazia → nome da categoria; receita usa "Receita de". `meta` leva `{ acao, entity_id }` (sem `dedupe_key`).

**Onde é chamado** (uma vez por ação da interface): ações do store usadas pela UI — criar (`addTransaction`, `addCardPurchase`, rateio, pró-labore/distribuição, lançamento da diferença na conciliação de saldo), editar (`updateTransaction`, `updateTransactionGroup`, `togglePago`), excluir (`deleteTransaction`, `deleteTransactionGroup`) e as equivalentes da lista de desejos (`src/store/wishlist.ts`). Ações que gravam um par ou várias linhas de uma vez (pró-labore, rateio, parcelado, edição/exclusão de grupo) geram **1 aviso**. As funções internas recebem `{ silent: true }` quando chamadas por outra ação que já notifica ou por rotina automática. **Não notificam:** ocorrências geradas por `runDueRecurrences`, `resyncInvoices`, "dados de exemplo", reset e atualizações automáticas de preço da lista de desejos.

Reação: `src/store/reactions.ts` continua gravando o aviso `reaction` ao dono do lançamento (agora também vira push).

### 2.2 Vencimentos (gerados no servidor)

Função `public.generate_due_notifications(_today date default (now() at time zone 'America/Sao_Paulo')::date) returns integer` (`SECURITY DEFINER`, retorna quantas linhas inseriu). Para **cada membro** de cada espaço (`workspace_members`), e para cada item do espaço com `dias = data_alvo − _today ∈ {3, 1, 0}`:

| Item | Condição | `tipo` | `dedupe_key` | Data alvo |
|---|---|---|---|---|
| Fatura | `not paga` e total (Σ transações da fatura) > 0 | `venc_fatura` | `venc_fatura:<invoice_id>:<dias>` | `data_vencimento` |
| Conta a pagar | `tipo='DESPESA'`, `not pago`, `card_id is null` | `venc_conta` | `venc_conta:<transaction_id>:<dias>` | `coalesce(data_vencimento, data)` |
| Recorrência | `ativo`, `template->>'tipo'='DESPESA'` | `venc_recorrencia` | `venc_recorrencia:<recurrence_id>:<proxima_data>:<dias>` | `proxima_data` |
| Parcela de dívida | `not pago` | `venc_divida` | `venc_divida:<installment_id>:<dias>` | `vencimento` |

Textos: título `<Sujeito> vence em 3 dias` / `vence amanhã` / `vence hoje`; sujeito = `Fatura do <cartão>`, descrição da conta (ou "Conta"), descrição da recorrência, `Parcela <n> de <nome da dívida>`. Corpo: `R$ 150,00 · vencimento 25/11` (recorrência: `R$ 39,90 · recorrência <frequência>`).

Insere com `on conflict (user_id, dedupe_key) do nothing` (e o gatilho BEFORE já filtra preferências). **Agendamento:** `cron.schedule('notificacoes-vencimento-diario', '0 12 * * *', 'select public.generate_due_notifications()')` (12h UTC = 9h Brasília, sem horário de verão).

O app deixa de gerar `venc_fatura`/`venc_conta` (remoção dessas regras de `computeNotifications` e do `generate`).

### 2.3 Orçamento e MEI (app, para todos os membros)

`useNotifications.generate()` passa a: calcular só `orcamento_80` e `mei` (engine atual), gravar uma linha **para cada membro do espaço** (mesmo `dedupe_key` por membro; o gatilho filtra preferências e duplicatas) e rodar **após `loadAll` e após cada criação/edição/exclusão de lançamento** (com debounce de ~2 s). Dívidas continuam fora de saldo/relatórios; só ganham o lembrete de §2.2.

### 2.4 Queda de preço e teste

- `wishlist-price-check` não muda (já grava `wishlist`; agora vira push).
- **Enviar teste:** o app grava `{ tipo: 'teste', titulo: 'Notificações ativadas', corpo: 'Este é um teste do Empar.' }` para o próprio usuário.
- A Edge Function morta `supabase/functions/check-notifications` é removida.

## 3. Envio: Edge Function `send-push`

`supabase/functions/send-push/index.ts` (Deno; `verify_jwt = false` em `supabase/config.toml`; acesso só com `x-push-secret` == `PUSH_WEBHOOK_SECRET`, senão 401):

1. Lê a notificação por `notification_id` (service role) e as `push_subscriptions` do `user_id`.
2. Monta o payload com `buildPushPayload(notification)` de `supabase/functions/_shared/notification-routes.ts`: `{ title, body, url, tag: tipo, notification_id, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png' }`.
3. Envia com biblioteca Web Push compatível com Deno (VAPID; secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT = https://empar-pink.vercel.app`), TTL 24 h.
4. Inscrição que responder 404/410 é apagada; sucesso atualiza `last_used_at`. Responde `{ sent, removed }`.

Chaves VAPID geradas uma vez (ex.: `npx web-push generate-vapid-keys`); a **pública** fica no código (`src/lib/push-config.ts`, é pública por definição); a privada só nos secrets da função.

## 4. No aparelho

**Service worker:** mantém `generateSW` do `vite-plugin-pwa` e adiciona `workbox.importScripts: ['push-sw.js']`. `public/push-sw.js` trata `push` (`showNotification(title, { body, icon, badge, tag, data: { url } })`) e `notificationclick` (fecha, foca uma janela do app e navega para `data.url`, ou abre uma nova). Ícone `public/icons/badge-72.png` (símbolo branco em fundo transparente) gerado pelo `scripts/generate-pwa-icons.py`.

**Inscrição** (`src/lib/push.ts` + `src/store/push.ts`):

- `pushSupport(): 'ok' | 'ios-install' | 'unsupported'` — iPhone/iPad (inclui iPadOS "Macintosh" com toque) fora do modo instalado → `ios-install`; sem `serviceWorker`/`PushManager`/`Notification` → `unsupported`.
- `enablePush()`: `Notification.requestPermission()` (só a partir de toque no botão) → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` → upsert em `push_subscriptions` por `endpoint`. Permissão negada → estado `bloqueado` com instrução de liberar nas configurações do navegador.
- `disablePush()`: `subscription.unsubscribe()` + apaga a linha.
- Ao abrir o app com permissão concedida, re-sincroniza a inscrição existente (endpoint pode mudar).

**Configurações → "Notificações"** (substitui a seção atual de preferências):

- Estado do aparelho: `Ativas neste aparelho` / `Desativadas` / `Bloqueadas no navegador` / `No iPhone, instale o app na tela inicial para receber notificações` / `Este navegador não suporta notificações`.
- Botões **Ativar notificações** / **Desativar neste aparelho** e **Enviar teste** (este só com push ativo).
- Chaves por tipo, agrupadas: *Ações de outros membros* (lançamentos, desejos, reações) · *Vencimentos* (faturas, contas a pagar, recorrências, parcelas de dívidas) · *Alertas* (orçamento 80%, MEI, queda de preço).

**Sininho:** tocar num aviso marca como lido e navega para a rota do tipo (mesmo mapa da §5).

## 5. Mapa de tipos

| `tipo` | Preferência | Rota |
|---|---|---|
| `membro_lancamento` | `membros_lancamentos` | `/lancamentos` |
| `membro_desejo` | `membros_desejos` | `/desejos` |
| `reaction` | `reacoes` | `/lancamentos` |
| `venc_fatura` | `venc_faturas` | `/cartoes` |
| `venc_conta` | `venc_contas` | `/lancamentos` |
| `venc_recorrencia` | `venc_recorrencias` | `/recorrencias` |
| `venc_divida` | `venc_dividas` | `/dividas` |
| `orcamento_80` | `orcamento_80` | `/orcamentos` |
| `mei` | `mei_alertas` | `/` |
| `wishlist` | `wishlist_precos` | `/desejos` |
| `teste` | (sempre) | `/config` |

O mapa vive em `supabase/functions/_shared/notification-routes.ts` (`notificationRoute(tipo)`, `buildPushPayload`) e é importado pelo app e pela Edge Function; o mapa tipo→preferência vive no SQL (`notification_pref_column`) e é espelhado em teste.

## Testes e validação

- **Vitest:** `buildMemberNotification` (todos os formatos da tabela, parcelado, receita, descrição vazia); `notifyMembers` (exclui o autor, uma linha por membro, falha não lança); ações do store notificam uma vez e as rotas automáticas (`runDueRecurrences`, `resyncInvoices`, dados de exemplo) não notificam; `generate` grava orçamento/MEI para todos os membros e não gera mais vencimentos; `notificationRoute`/`buildPushPayload`; `pushSupport` (iPhone instalado/não instalado, iPadOS, desktop sem suporte).
- **SQL (transação desfeita):** `generate_due_notifications('<data>')` cria os 4 tipos nos dias 3/1/0 e nada nos dias 2/4; segunda execução não duplica; preferência desligada não grava para aquele membro; o gatilho BEFORE descarta duplicata e respeita `teste`.
- `npm test`, `npm run typecheck`, `npm run build` verdes.
- **Real:** deploy da `send-push` + secrets; inscrição real criada no navegador do agent-browser (preview de produção) → notificação `teste` inserida → função responde `sent ≥ 1` e o serviço de push aceita (201); inscrição falsa/expirada é removida. Cron agendado e execução manual de `generate_due_notifications()` sem erro. Recebimento físico no celular é verificado pelo usuário com **Enviar teste** (iPhone exige o app instalado na tela inicial, iOS 16.4+).
- Relatório em `docs/superpowers/e2e/2026-11-22-notificacoes-push.md`.

## Fora do escopo

- Aviso de "vencida e não paga" no dia seguinte.
- Horário de silêncio, resumo diário agrupado, e-mail/SMS.
- Avisos de outras entidades (contas, cartões, metas, investimentos, dívidas criadas/editadas por membros).
- Push com o app no navegador desktop é suportado pelo mesmo código, mas não é foco de validação.
