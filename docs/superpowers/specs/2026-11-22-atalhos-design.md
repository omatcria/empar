# Atalhos e lançamento rápido — Empar

**Data:** 22/11/2026 · **Branch:** `feat/atalhos` (a partir da `main` com as notificações push) · **Status:** design aprovado pelo usuário; execução autônoma autorizada

## Objetivo

Lançar despesa ou receita mais rápido no iPhone e no Android:

1. **Abrir o pop-up direto** de novo lançamento por link e, no Android, pelos atalhos do ícone.
2. **Lançar sem abrir o app** por automação (app Atalhos do iPhone — Siri, Toque Traseiro, botão de Ação, widget; no Android, HTTP Shortcuts/Tasker), perguntando **valor, descrição, conta/cartão e categoria**.

Limitações de plataforma assumidas: PWA no iPhone não tem atalhos no ícone e um link aberto pelo app Atalhos abre no Safari (login separado do app instalado).

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Escopo | Os dois: link que abre o pop-up **e** lançamento sem abrir o app |
| Perguntas do atalho | Valor, descrição, conta/cartão e categoria |
| Padrões (assumidos e aprovados) | Data = hoje; cartão = compra à vista (1x); contexto vem da conta/cartão escolhido; uma chave vale para um espaço |

## 1. Abrir o pop-up por link

- Parâmetro `novo` na URL do app: `/?novo=despesa`, `/?novo=receita`, `/?novo=cartao`.
- `useUI` ganha `quickAddPreset: { tipo: 'DESPESA' | 'RECEITA'; meio: 'conta' | 'cartao' } | null`; `openQuickAdd('tx', preset?)` guarda o preset; `closeQuickAdd` limpa.
- `src/lib/quick-link.ts`: `parseQuickLink(search: string): { tipo, meio } | null` (`despesa` → DESPESA/conta; `receita` → RECEITA/conta; `cartao` → DESPESA/cartao; outro valor → `null`).
- `AppShell` (dentro do router), ao montar e a cada mudança de `location.search`: se `parseQuickLink` devolve preset e o usuário pode escrever, abre o modal com o preset e remove `novo` da URL (`navigate(pathname + resto da query, { replace: true })`). Usuário só-leitura: ignora.
- `TransactionModal` aceita `preset?: { tipo; meio }`; ao abrir um novo lançamento usa o preset no lugar dos padrões atuais (`DESPESA`/`conta`).
- **Manifesto** (`vite.config.ts`, `manifest.shortcuts`): `Nova despesa` (`short_name: 'Despesa'`, `/?novo=despesa`), `Nova receita` (`Receita`, `/?novo=receita`), `Compra no cartão` (`Cartão`, `/?novo=cartao`), cada um com ícone 96×96 próprio (`public/icons/shortcut-despesa-96.png`, `shortcut-receita-96.png`, `shortcut-cartao-96.png`, gerados pelo `scripts/generate-pwa-icons.py`: círculo na cor do tipo — despesa `#b83131`, receita `#578546`, cartão `#7c3aed` — com sinal branco `−`, `+` e um retângulo de cartão).

## 2. Lançamento rápido sem abrir o app

### 2.1 Chave pessoal

**Migração 35** (`supabase/migrations/20261122000400_35_quick_tokens.sql`):

- Tabela `api_tokens`: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `workspace_id uuid not null references workspaces on delete cascade`, `nome text not null check (length(nome) between 1 and 60)`, `token_hash text not null unique`, `prefixo text not null` (primeiros 8 caracteres, para identificar na lista), `created_at timestamptz default now()`, `last_used_at timestamptz`, `revoked_at timestamptz`.
- RLS: `select` só `user_id = auth.uid()`; sem `insert/update/delete` direto (só pelas RPCs). GRANT `select` para `authenticated`.
- RPC `create_quick_token(_workspace uuid, _nome text) returns text` (`SECURITY DEFINER`, `search_path=public`): exige `has_write(_workspace)`; gera `'emp_' || encode(gen_random_bytes(24), 'hex')`; grava `sha256` em hex (`encode(digest(token, 'sha256'), 'hex')`) e o prefixo; devolve o token em claro **uma única vez**. Máximo de 10 chaves ativas por usuário/espaço (senão `raise exception 'Limite de 10 chaves ativas'`).
- RPC `revoke_quick_token(_id uuid) returns void`: só o dono; marca `revoked_at = now()`.
- EXECUTE das RPCs só para `authenticated`.

### 2.2 Função `lancamento-rapido`

`supabase/functions/lancamento-rapido/index.ts` (Deno, `verify_jwt = false`; autenticação própria por `Authorization: Bearer emp_…`). URL: `https://gkzstunjcftvqoljgvce.supabase.co/functions/v1/lancamento-rapido`.

Autenticação: hash `sha256` do token → `api_tokens` ativo (`revoked_at is null`) → `user_id`, `workspace_id`; exige que o usuário ainda seja membro com papel `owner` ou `editor`; atualiza `last_used_at`. Falha → `401 { ok: false, mensagem: 'Chave inválida ou revogada. Gere outra em Configurações › Atalhos.' }`; sem escrita → `403 { ok: false, mensagem: 'Sua conta não tem permissão para lançar neste espaço.' }`.

**GET `?tipo=despesa|receita`** → `200 { "meios": { "<rótulo>": "<valor>" } }`, um dicionário rótulo→valor (formato que o app Atalhos usa em "Escolher da Lista"):
- contas não arquivadas: rótulo `Conta · <nome> (<Pessoal|Empresarial>)`, valor `conta:<uuid>`;
- só para despesa, cartões de crédito não arquivados: `Cartão · <nome> (<contexto>)`, valor `cartao:<uuid>`.

**GET `?tipo=…&meio=conta:<uuid>|cartao:<uuid>`** → `200 { "categorias": { "<rótulo>": "<uuid>" } }` com as categorias do tipo no contexto do meio, sem categorias de sistema de pró-labore/distribuição; subcategoria com rótulo `Mãe › Sub`; ordenadas alfabeticamente.

**POST** JSON `{ tipo, valor, descricao, meio, categoria }`:
- `valor`: texto ou número; aceita `45,90`, `45.90`, `1.234,56`, `R$ 45,90`, `45` → centavos > 0; senão `400 'Valor inválido. Use, por exemplo, 45,90.'`.
- `descricao`: texto até 120 caracteres (vazio permitido → descrição da categoria).
- `meio`/`categoria` precisam existir no espaço, não arquivados e com contexto/tipo compatíveis; receita não aceita cartão → `400` com mensagem clara (`'Escolha uma conta válida.'`, `'Categoria não combina com o tipo ou a conta.'`).
- Conta: insere `transactions` com `account_id`, `pago = true`, `data = hoje (America/Sao_Paulo)`. Cartão: resolve o ciclo com `resolveInvoiceCycle` (mesma regra do app), cria/reaproveita a fatura do mês de referência e insere com `card_id` + `invoice_id`, `pago = true`.
- Também grava `activity_log` (`entity 'transaction'`, `action 'create'`) e um aviso `membro_lancamento` para **cada outro membro** (mesmo builder do app; autor = nome do membro dono da chave).
- Resposta `201 { ok: true, mensagem: 'Despesa de R$ 45,90 lançada: Mercado', id }` (receita: `Receita de …`).

**Código compartilhado** (TS puro, importado pelo app e pela função):
- `supabase/functions/_shared/quick-add.ts`: `parseValorToCents(v: unknown): number | null`, `parseMeio(v: string): { kind: 'conta' | 'cartao'; id: string } | null`, `quickAddMessage(tipo, centavos, descricao): string`, `meioLabel(...)`, `categoriaLabel(...)`.
- `resolveInvoiceCycle`/`cycleFromClosing` passam para `supabase/functions/_shared/invoice-cycle.ts`; `src/engine/invoices.ts` re-exporta (testes atuais continuam).
- `buildMemberNotification` passa para `supabase/functions/_shared/member-notifications.ts`; `src/engine/member-notifications.ts` re-exporta.

## 3. Tela "Atalhos" em Configurações

`src/features/shortcuts/ShortcutsSettings.tsx` (seção abaixo de Notificações; só para quem pode escrever):

- **Abrir o pop-up:** os 3 links completos (`https://empar-pink.vercel.app/?novo=…`) com botão **Copiar**; nota: "No Android, segure o ícone do Empar para ver estes atalhos."
- **Chaves pessoais:** lista (nome, prefixo `emp_xxxx…`, criada em, último uso, botão **Revogar** com confirmação); botão **Gerar chave** → nome (padrão "Meu celular") → mostra a chave **uma vez** num campo somente leitura com **Copiar** e aviso "Guarde agora: ela não será mostrada de novo." Erros em `role="alert"`.
- **Passo a passo iPhone (app Atalhos)**, numerado, com a URL da função e onde colar a chave:
  1. Atalhos › **+** › Adicionar Ação.
  2. **Escolher do Menu** com "Despesa" e "Receita"; em cada opção, **Texto** `despesa`/`receita` → variável *tipo*.
  3. **Obter Conteúdo do URL**: `…/lancamento-rapido?tipo=[tipo]`, Cabeçalho `Authorization` = `Bearer [sua chave]`.
  4. **Obter Valor do Dicionário** `meios` → **Escolher da Lista** → **Obter Valor do Dicionário** (item escolhido) → variável *meio*.
  5. **Obter Conteúdo do URL**: `…?tipo=[tipo]&meio=[meio]` (mesmo cabeçalho) → **Obter Valor do Dicionário** `categorias` → **Escolher da Lista** → valor → variável *categoria*.
  6. **Pedir Entrada** (Número) "Valor" e **Pedir Entrada** (Texto) "Descrição".
  7. **Obter Conteúdo do URL** método **POST**, Corpo JSON `tipo`, `valor`, `descricao`, `meio`, `categoria`, mesmo cabeçalho.
  8. **Obter Valor do Dicionário** `mensagem` → **Falar Texto** (ou Mostrar Resultado).
  9. Nomeie "Lançar no Empar". Siri: "E aí Siri, Lançar no Empar". Toque Traseiro: Ajustes › Acessibilidade › Toque › Toque Traseiro. Também dá para pôr no botão de Ação ou como widget.
- **Android:** atalhos do ícone (abrir o pop-up); para lançar sem abrir, os mesmos 3 pedidos (GET meios, GET categorias, POST) no app **HTTP Shortcuts** ou no **Tasker**, com o cabeçalho `Authorization: Bearer [sua chave]` — a tela mostra os endereços e o corpo JSON de exemplo.
- Aviso de segurança: "Quem tiver a chave consegue lançar no seu espaço. Revogue se perder o celular."

## Testes e validação

- **Vitest:** `parseQuickLink`; `parseValorToCents` (`'45,90'`→4590, `'45.90'`→4590, `'1.234,56'`→123456, `'R$ 45,90'`→4590, `45`→4500, `'abc'`/`0`/`-5`→null); `parseMeio`; `quickAddMessage`; rótulos; `TransactionModal` abre com preset (Receita / Cartão de crédito selecionados); `AppShell` com `?novo=receita` abre o modal e limpa a URL; `ShortcutsSettings` (gerar mostra a chave uma vez, revogar chama a RPC, copiar).
- **SQL (transação desfeita):** `create_quick_token` devolve `emp_…`, grava só o hash; outro usuário não vê a chave; viewer não gera; revogada não é aceita (consulta da função); limite de 10.
- **Real/E2E:** deploy da função; conta descartável gera a chave pela tela; `curl` GET meios → GET categorias → POST cria o lançamento na conta e no cartão (fatura certa), devolve a mensagem; segundo membro recebe `membro_lancamento`; chave revogada → 401; link `/?novo=receita` abre o modal no tipo Receita; manifesto publicado tem os 3 `shortcuts`. Montagem do atalho no iPhone físico fica com o usuário (passo a passo da tela).
- Relatório em `docs/superpowers/e2e/2026-11-22-atalhos.md`.

## Fora do escopo

- Escolher data, parcelas ou situação pelo atalho.
- Arquivo `.shortcut` pronto para importar (exige assinatura num aparelho Apple).
- Web Share Target, widgets nativos, Siri sem o app Atalhos.
