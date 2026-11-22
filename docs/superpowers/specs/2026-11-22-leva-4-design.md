# Leva 4 — Recorrência no cartão, busca de categoria, orçamentos, dívidas, saldo previsto e PWA Empar

**Data:** 22/11/2026 · **Branch:** `feat/leva-4` · **Status:** aprovado pelo usuário no brainstorming; execução autônoma autorizada (sem novas perguntas), entrega validada, testada e publicada.

## Contexto

App Empar (antigo "App Finanças"): Vite 8 + React 19 + TS 6 + Tailwind v4 + Zustand 5 + Supabase (ref `gkzstunjcftvqoljgvce`). Padrões que esta leva segue:

- Engine PURA em `src/engine/` (sem React/DB), testada com Vitest. Componentes não duplicam cálculo.
- Dados por workspace, RLS `is_member`/`has_write`, inserts com `ownerCols()`.
- Dinheiro em centavos, datas ISO `YYYY-MM-DD`. "Hoje" é parâmetro das funções da engine (nunca `new Date()` dentro delas).
- Ícones só via `@/components/icons`. Tema claro; tokens em `src/styles/globals.css`.
- Deploy: repositório `omatcria/empar` integrado ao Vercel (`https://empar-pink.vercel.app`) — push na `main` publica.
- Banco: migrações aplicadas pela Supabase Management API (token em `.mcp.json`) e versionadas em `supabase/migrations/`.

## Decisões do usuário

| Tema | Decisão |
|---|---|
| Saldo previsto | Saldo real + receitas a receber − despesas a pagar − faturas não pagas que vencem até o fim do mês selecionado. Saldos reais contam só o que está pago **e** com data ≤ hoje. Data futura no lançamento → "pendente" automático |
| Botão "Repetir" no lançamento | Em **cartão e conta** (receita e despesa); oculto em compra parcelada e na edição |
| Dívida | Campo "Credor" vira **"Nome"**; obrigatórios só **Nome** e **Valor original** |
| PWA | Nome **Empar**; identidade visual em `Uploads/empar identidade visual/` |
| E2E | agent-browser na conta principal do usuário; itens com prefixo `[E2E]` apagados ao final |
| Publicação | Migração no Supabase de produção + merge na `main` + push (Vercel publica) |

---

## 1. Recorrências no cartão

**Modelo** — `recurrences.template` (jsonb) ganha `card_id?: string`; `account_id` passa a ser opcional. Exatamente um dos dois é preenchido. Sem migração.

```ts
interface RecurrenceTemplate {
  tipo: 'RECEITA' | 'DESPESA'
  account_id?: string | null
  card_id?: string | null   // só DESPESA
  category_id: string
  valor_centavos: number
  descricao: string
  pago?: boolean
}
```

**Engine (`src/engine/recurrences.ts`)** — função pura `recurrenceTxBase(tpl, contexto, data, recurrenceId)` que devolve a base do insert (`contexto, tipo, category_id, valor_centavos, data, descricao, recorrencia_id` + `account_id`/`pago` para conta, ou `card_id` + `pago: true` para cartão) e `isCard`. Retorna `null` se o molde for inválido (sem categoria, ou sem conta e sem cartão).

**Store (`runDueRecurrences`)** — para cada data devida: se o molde é de cartão, encontra o cartão (pula se não existir ou estiver arquivado), resolve o ciclo com `resolveInvoiceCycle(card.dia_fechamento, card.dia_vencimento, data)`, chama `ensureInvoice` e insere com `invoice_id`. Molde de conta mantém o comportamento atual. Depois avança `proxima_data`.

**Aba Recorrências** — no modal, quando `tipo = DESPESA`, aparece "Pagar com: Conta | Cartão de crédito". Cartão: select com os cartões de crédito não arquivados do contexto. Receita força conta. A linha da lista mostra o nome da conta ou do cartão: `Nubank · Mensal · próx. 05 de dez`.

**Novo lançamento (`TransactionModal`)** — switch "Repetir" + select de frequência (Mensal padrão, Semanal, Anual). Visível quando: não é edição **e** (meio = conta **ou** parcelas = 1). Ao salvar com "Repetir" ligado:

1. Cria a recorrência com `proxima_data = advanceDate(data, freq, dia)` e `dia = dia da data`, molde igual ao lançamento (conta ou cartão).
2. Cria o lançamento (conta: `addTransaction`; cartão: `addCardPurchase`) com `recorrencia_id` = id da recorrência. `CardPurchaseParams` ganha `recorrencia_id?: string` (só usado quando `parcelas = 1`).
3. Se o passo 2 falhar, apaga a recorrência criada e mostra o erro.

Como `addRecurrence` já roda `runDueRecurrences`, um lançamento com data antiga gera as ocorrências atrasadas até hoje (comportamento atual de recuperação).

## 2. Busca de categoria com hierarquia

**Função pura** `buildCategoryRows(categories, query)` em `src/domain/category-tree.ts`:

- Normaliza texto (minúsculas + remove acentos via `NFD`), então "alimentacao" acha "Alimentação".
- Sem busca: árvore completa ordenada (mãe, depois filhas ordenadas). Subcategoria cuja mãe não está na lista recebida (órfã) aparece como raiz — corrige o sumiço atual.
- Com busca: mãe aparece se ela bater **ou** se alguma filha bater. Se a mãe bateu, mostra todas as filhas; se só filhas bateram, mostra só as que bateram. Cada linha: `{ category, depth: 0 | 1, parentName?: string, match: boolean }`.

**`CategoryCombobox`** usa as linhas: depth 1 sempre recuada com ícone menor, inclusive na busca. Mãe que entrou só como contexto continua selecionável. O botão fechado mostra `Mãe › Sub` quando a selecionada é subcategoria.

## 3. Orçamentos

`routes/Budgets`: a lista mostra só categorias com limite > 0 no mês (`linhas.filter(l => l.limite > 0)`). Vazio → "Sem orçamentos definidos" + texto "Toque em Definir limite para criar o primeiro." O texto "Sem limite definido — toque para definir" sai (a linha não existe mais). Botões "Nova categoria" e "Definir limite" continuam.

## 4. Dívidas

**Migração 32** (`20261122000100_32_dividas_acordo_opcional.sql`):

- `alter table public.debts alter column valor_acordo_centavos drop not null;`
- `regenerate_debt_installments`: `remaining := greatest(0, coalesce(d.valor_acordo_centavos, d.valor_original_centavos, 0) - paid);` (resto igual).
- Regenerar `src/lib/database.types.ts` (ou ajustar o tipo à mão: `valor_acordo_centavos: number | null`).

**Engine (`src/engine/debts.ts`)**:

- `debtTotal(debt) = valor_acordo_centavos ?? valor_original_centavos ?? 0`.
- `debtSummary`: `total = debtTotal(debt)`; status `sem_parcelas` quando não há parcelas e nada foi pago (novo valor de `DebtStatus`).
- `debtsTotals`: `totalAcordos` → soma de `debtTotal` (rótulo da tela: "Total em dívidas"); `economia` só soma quando `valor_acordo_centavos != null && valor_original_centavos != null`.

**Store** — `addDebt` aceita `parcelas`/`primeiro_vencimento` opcionais. Sem vencimento → cria só a dívida, sem parcelas. Com vencimento → parcelas sobre `debtTotal`.

**`DebtFormModal`**:

- "Credor" → **"Nome"** (placeholder "Ex.: Empréstimo Nubank, Serasa – Vivo"), obrigatório.
- "Valor original" obrigatório (> 0). "Valor do acordo" opcional e **editável também na edição**.
- Parcelas e primeiro vencimento opcionais na criação; a prévia aparece quando o vencimento é preenchido.
- Edição: se a dívida não tem parcelas → seção "Gerar parcelas" (parcelas + vencimento) que chama `regenerateUnpaid`. Se tem → checkbox atual "Recriar parcelas em aberto".
- Botão Salvar habilita com Nome + Valor original. Erro do banco aparece no modal.

**`DebtCard`** — sem parcelas: mostra o total, "Sem parcelas — edite para adicionar acordo e vencimento", sem barra de progresso e sem "Quitar tudo"/"Ver parcelas".

## 5. Saldo realizado × previsto

**Regra de realizado** — `isRealized(t, hoje) = t.pago && t.data <= hoje`.

**Engine (`src/engine/balances.ts`)** — `BalanceContext` ganha `asOf?: string`. Quando presente, `accountBalance` só soma transações realizadas até `asOf`. Faturas pagas continuam descontadas (o pagamento já aconteceu). Todos os chamadores de app passam `asOf: todayISO()`:

- `buildDashboard` (novo campo `hoje` em `DashboardInput`, obrigatório).
- `routes/Accounts` (lista e conciliação).
- `features/reports/widgets.tsx` (`WidgetEvolucao` e `buildDashboard`).

**Engine nova `src/engine/forecast.ts`** — `forecastBalance(contexto | 'CONSOLIDADO', input, mes, hoje)`:

```
horizonte = max(último dia de mes, hoje)
previsto  = saldo realizado (asOf hoje)
          + Σ receitas em conta NÃO realizadas com data ≤ horizonte
          − Σ despesas em conta NÃO realizadas com data ≤ horizonte
          − Σ faturas não pagas com data_vencimento ≤ horizonte (total da fatura)
```

- Filtra por contexto (transação: `t.contexto`; fatura: contexto do cartão). Contas arquivadas fora, igual ao saldo.
- Inclui atrasados (pendentes com data < hoje).
- Pernas de pró-labore/distribuição entram normalmente (no consolidado se anulam).
- Não inclui dívidas nem ocorrências de recorrência ainda não geradas.

`buildDashboard` passa a devolver `previstoPessoal`, `previstoEmpresarial`, `previstoConsolidado`.

**UI**:

- Dashboard: o hero continua com o saldo real; ao lado (abaixo no mobile), card **"Saldo previsto"** com o valor do contexto e o texto "Até {dd/mm} · inclui a receber, a pagar e faturas". No consolidado, mostra também a divisão Pessoal/Empresarial.
- Relatórios, widget "Saldos": 4º tile "Saldo previsto" (do contexto do seletor).
- Cards "Receitas/Despesas do mês" continuam por competência (sem mudança).

**`TransactionModal`**:

- Estado `situacaoTocada`. Enquanto o usuário não mexer na situação, data > hoje → pendente; data ≤ hoje → pago. Na edição começa como tocada (mantém o valor salvo).
- Rótulos: RECEITA → "Recebido / A receber"; DESPESA → "Pago / A pagar".

## 6. PWA Empar e mobile

**Ícones** — `scripts/generate-pwa-icons.py` (Pillow) recorta o símbolo de `Uploads/empar identidade visual/02_empar_icone.png` e gera em `public/icons/`: `icon-192.png`, `icon-512.png` (fundo branco, símbolo ~80%), `maskable-512.png` (símbolo ~60%, fundo branco), `apple-touch-icon-180.png` (fundo branco), `favicon-32.png`, e `public/brand/empar-symbol.png` (símbolo transparente, ~256px) + `public/brand/empar-logo.png` (logo horizontal preta de `04_empar_black.png`, recortada). PNGs gerados são versionados.

**`vite-plugin-pwa`** (devDependency) em `vite.config.ts`:

- `registerType: 'prompt'`, manifesto: `name: 'Empar — Finanças PJ & Pessoal'`, `short_name: 'Empar'`, `lang: 'pt-BR'`, `start_url: '/'`, `scope: '/'`, `display: 'standalone'`, `background_color: '#f6f7f9'`, `theme_color: '#f6f7f9'`, ícones acima (`purpose: 'any'` e `'maskable'`).
- Workbox: precache do build; `navigateFallback: '/index.html'`; cache em tempo de execução das fontes do Google (StaleWhileRevalidate/CacheFirst). Supabase **não** é cacheado.
- Desligado no `vitest` e no dev.

**`index.html`** — título "Empar", `viewport-fit=cover`, `theme-color #f6f7f9`, favicon, `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title="Empar"`, `apple-mobile-web-app-status-bar-style="default"`.

**`vercel.json`** — `rewrites: [{ source: '/(.*)', destination: '/index.html' }]` (o Vercel serve arquivos estáticos antes da reescrita) + header `Cache-Control: no-cache` para `/sw.js` e `/manifest.webmanifest`.

**Componentes**:

- `components/pwa/UpdatePrompt.tsx` — usa `useRegisterSW` (`virtual:pwa-register/react`); quando há versão nova, toast fixo "Nova versão disponível · Atualizar".
- `components/pwa/OfflineBanner.tsx` — faixa "Sem conexão — os dados podem estar desatualizados" com `online`/`offline`.
- `features/pwa/InstallCard.tsx` em Configurações — captura `beforeinstallprompt` (store `usePwaInstall`, registrado no `main.tsx`) e mostra "Instalar app"; no iOS (Safari, não standalone) mostra instruções "Compartilhar → Adicionar à Tela de Início"; já instalado → "App instalado".

**Marca** — sidebar e Login usam o símbolo + "Empar" (logo de `public/brand/`). O texto "App Finanças" sai da interface.

**Revisão mobile** (390×844 e 360×800, agent-browser) em todas as rotas (Início, Lançamentos, Contas, Cartões, Categorias, Orçamentos, Recorrências, Metas, Investimentos, Dívidas, Desejos, Relatórios, Membros, Configurações, Login) e nos modais principais (lançamento, recorrência, dívida, conta, cartão, orçamento). Critérios:

- Sem rolagem horizontal (`document.documentElement.scrollWidth <= innerWidth`).
- Inputs/selects/textarea com fonte ≥ 16px no mobile (`text-base sm:text-sm` em `controlBase`) — evita zoom do iOS.
- Header com `padding-top: env(safe-area-inset-top)`; bottom nav e rodapé de modal com `safe-area-inset-bottom`.
- Alvos de toque ≥ 40px nos controles principais; FAB não cobre o último item (padding inferior do `main` suficiente).
- Cabeçalhos de página com muitos botões quebram linha ou usam só ícone sem estourar.
- Gráficos responsivos sem cortar; modais em folha inferior rolam até o fim.

Correções ficam restritas a classes/estrutura de layout; nenhuma regra de negócio muda nesta etapa.

---

## Testes e validação

- **Vitest**: `isRealized`/`accountBalance` com `asOf`; `forecastBalance` (receita futura só no previsto, despesa pendente, fatura vencendo no mês e fora do mês, consolidado com pró-labore pendente, atrasado incluído); `buildCategoryRows` (acentos, filha sob mãe na busca, órfã como raiz); `recurrenceTxBase` (conta × cartão × inválido) e ciclo de fatura das ocorrências de cartão; `debtTotal`/`debtSummary`/`debtsTotals` sem acordo e sem parcelas. Testes de componente onde já existe padrão (DebtCard sem parcelas).
- `npm test`, `npm run typecheck`, `npm run build` limpos.
- **E2E (agent-browser, localhost)** na conta do usuário, itens `[E2E]`, apagados ao final: recorrência no cartão pela aba e pelo "Repetir" (aparece na aba e na fatura certa); busca "alim" mostra sub sob mãe; orçamentos vazio; dívida só com Nome + Valor original, depois edição gerando parcelas; receita futura muda só o "Saldo previsto"; checagens mobile acima; manifesto e service worker válidos no `vite preview`.
- **Pós-deploy**: `curl` de `/lancamentos` (200), `/manifest.webmanifest` (200, JSON com `short_name: "Empar"`), `/sw.js` (200).
- Relatório de validação em `docs/superpowers/e2e/2026-11-22-leva-4.md`.

## Fora do escopo

- Escrita offline / fila de sincronização.
- Notificações push.
- Previsão incluindo recorrências futuras ainda não geradas ou parcelas de dívidas.
- Mudar o cálculo de "Receitas/Despesas do mês".
