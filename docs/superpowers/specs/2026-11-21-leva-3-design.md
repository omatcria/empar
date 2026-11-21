# Leva 3 — Reset, MEI, logos, Select padronizado, Dívidas e Lista de desejos

**Data:** 21/11/2026 · **Branch:** `feat/leva-3` · **Status:** aprovado (decisões confirmadas pelo usuário no brainstorming; execução autônoma autorizada)

## Contexto

App Finanças (Vite 8 + React 19 + TS 6 + Tailwind v4 + Zustand 5 + Supabase). Padrões existentes que esta leva segue:

- Engine PURA em `src/engine/` (sem React/DB), testada com Vitest.
- Dados por **workspace** com RLS `is_member` (select) / `has_write` (insert/update/delete), inserts com `ownerCols()` = `{user_id, workspace_id}`.
- Dinheiro em **centavos** (`bigint`), datas ISO.
- Ícones só via `@/components/icons` (Tabler com nomes estilo-Lucide).
- Tema claro AbacatePay; tokens em `src/styles/globals.css`.

Acesso ao banco nesta leva: Supabase Management API (`POST /v1/projects/gkzstunjcftvqoljgvce/database/query`) com o token já configurado em `.mcp.json` (autorizado pelo usuário). Migrações registradas em `supabase_migrations.schema_migrations` e versionadas em `supabase/migrations/`.

## Decisões do usuário (brainstorming)

| Tema | Decisão |
|---|---|
| Reset | Apaga **tudo** (exceto perfil, membros, espaço, preferências e config MEI), recria categorias/envelopes/metas padrão e volta ao onboarding |
| Dívidas | **Acordo com parcelas**; marcar cada parcela como paga |
| Cartões | **Logo do banco + seletor de bandeira** (Visa, Mastercard, Elo, Amex, Hipercard) |
| Alerta de preço | **Queda ≥ 5%** vs. último preço **ou** atingir **preço-alvo** opcional |
| Logos | Baixar SVGs (Tgentil/Bancos-em-SVG; bandeiras do simple-icons CC0) + adicionar bancos PJ/MEI |
| Lojas | Leitor **genérico** (qualquer e-commerce); fallback manual quando a loja bloquear |
| E2E | agent-browser na **conta principal** do usuário: itens `[E2E]` criados e apagados; **Reset não é executado pela UI**; nenhuma configuração do usuário é salva |

Decisão própria: acompanhamento MEI **ligado por padrão** (limite R$ 81.000,00), desligável em Configurações.

---

## 1. Reset de dados

**Banco**
- `public.seed_workspace_defaults(_ws uuid, _uid uuid)` — extrai de `handle_new_user` a criação de categorias (sistema + padrão PESSOAL/EMPRESARIAL), envelopes de imposto e metas preset. `handle_new_user` passa a chamá-la (comportamento idêntico). `SECURITY DEFINER`, `search_path=public`, EXECUTE revogado de `public/anon/authenticated`.
- RPC `public.reset_workspace_data(_ws uuid) returns void` — `SECURITY DEFINER`; exige `is_owner(_ws)` (senão `raise exception 'Apenas o dono do espaço pode resetar os dados'`). Em uma transação, apaga do espaço, em ordem segura de FK: reações e notificações do espaço, `activity_log`, movimentos e investimentos, parcelas e dívidas, histórico/itens/categorias de desejos, transações, faturas, recorrências, orçamentos, metas, cartões, contas, categorias (zera `categoria_pai_id` antes), envelopes. Depois chama `seed_workspace_defaults(_ws, auth.uid())` e marca `profiles.onboarding_completo=false` para `auth.uid()`. EXECUTE só para `authenticated`.
- Mantém: `profiles` (nome, foto, pró-labore padrão, CDI), `workspaces` (incl. config MEI), membros, convites, `notification_prefs`.

**App**
- `features/reset/DangerZone.tsx` — seção “Zona de perigo” em Configurações, visível só para o dono (`role === 'owner'`).
- Modal de confirmação: lista o que será apagado e o que fica, botão **“Baixar backup antes”** (reusa `exportBackup`, agora incluindo dívidas, desejos e investimentos), campo para digitar `RESETAR` (botão vermelho só habilita com o texto exato).
- Ação `resetWorkspace()` em `store/data.ts`: chama a RPC, recarrega todas as stores (data, dívidas, desejos, notificações) e navega para `/` (o gate existente leva ao onboarding).
- Erro da RPC → mensagem no modal, nada é recarregado.

## 2. Alertas do MEI

**Regras (Lei Complementar 123/2006, MEI)**
- Limite anual padrão R$ 81.000,00 (configurável).
- No ano de abertura, o limite é proporcional: `limite/12 × meses de atividade` (do mês de abertura até dezembro, inclusive) — R$ 6.750/mês no padrão.
- Excesso até 20%: DAS complementar sobre o excedente e desenquadramento a partir de 1º de janeiro do ano seguinte.
- Excesso acima de 20%: desenquadramento retroativo a janeiro (ou à data de abertura).

**Banco** — `workspaces` ganha `mei_ativo boolean not null default true`, `mei_limite_anual_centavos bigint not null default 8100000`, `mei_abertura date null`. `notification_prefs` ganha `mei_alertas boolean not null default true` e `wishlist_precos boolean not null default true`.

**Engine pura `src/engine/mei.ts`**
- `meiRevenue(transactions, categories, year)` → `{ realizado, previsto }`: soma receitas `EMPRESARIAL`/`RECEITA` do ano-calendário, **excluindo** pares de ponte (`transfer_id` não nulo) e categorias de sistema. `realizado` = só `pago=true`; `previsto` = todas.
- `meiLimit(limiteAnual, abertura, year)` → limite efetivo (proporcional no ano de abertura).
- `meiStatus(valor, limite)` → `{ pct, nivel, restante }` com níveis: `ok` (<70%), `atencao` (70–<90%), `critico` (90–<100%), `excedido` (100–120%), `desenquadrado` (>120%).
- `meiProjection(realizado, today)` → ritmo anual (`realizado / meses decorridos × 12`) e média mensal ainda disponível.
- `meiMessage(status, ...)` → título + texto profissional + ação recomendada por nível (ex.: crítico: “Faltam R$ X para o teto. Avalie postergar recebimentos e converse com seu contador sobre a migração para ME”).
- `meiImpact(statusAtual, valorNovo, limite)` → novo status se o lançamento for salvo; indica se o nível sobe.

**UI**
- `features/mei/MeiCard.tsx` — card no Dashboard (contexto Empresarial e Consolidado, se `mei_ativo`): barra com marcas 70/90/100%, realizado, previsto, restante, projeção, mensagem do nível. Também registrado no catálogo de widgets de Relatórios (`'mei'`).
- `features/mei/MeiImpactAlert.tsx` — no `TransactionModal`, quando contexto `EMPRESARIAL` + tipo `RECEITA`: mostra em tempo real o impacto do valor digitado (“Com este lançamento: 92% do limite — nível crítico”). Aparece a partir de 70% ou quando o nível sobe.
- Notificações: `computeNotifications` recebe entrada MEI e gera uma notificação por nível atingido no ano (`dedupe_key = mei-<ano>-<nivel>`), respeitando `prefs.mei_alertas`.
- `features/mei/MeiSettings.tsx` — seção em Configurações: liga/desliga, limite anual (MoneyInput), data de abertura (opcional) com explicação da regra proporcional. Editável só pelo dono (RLS de `workspaces` já é `is_owner`); demais veem só leitura. `useWorkspace.updateWorkspace(patch)`.

## 3. Logos de bancos + cor automática

**Causa raiz:** 8 dos 11 SVGs em `src/domain/bank-logos.ts` têm o atributo `xmlns` duplicado (resíduo do Inkscape) → XML inválido → `<img>` não renderiza (Nubank, Inter, Bradesco, BB, Caixa, Mercado Pago, C6, Santander). Next e Will não têm SVG.

- Script de desenvolvimento `scripts/build-bank-logos.mjs`: baixa os SVGs, **saneia** (remove prólogo/comentários/`metadata`/`sodipodi:*`/`inkscape:*`, deduplica atributos, garante um único `xmlns` e `viewBox`) e gera `src/domain/bank-logos.ts`.
- Catálogo `BANKS` ganha bancos PJ/MEI que existirem na fonte: Cora, Stone, InfinitePay, PagBank, BTG Pactual, Sicoob, Sicredi, Banco Pan (cada um com cor de marca). Sem SVG → mantém o selo colorido com sigla.
- Teste de regressão: todo SVG do catálogo é parseado com `DOMParser` (jsdom) sem `parsererror` e com `viewBox`.
- **Cor automática:** nos formulários de Conta, Cartão e Investimento, escolher um banco define `cor = bank.cor`. A fileira de cores mostra a cor do banco como primeira opção (“Cor do banco”), selecionada; o usuário ainda pode trocar.

## 4. Bandeiras de cartão

- `src/domain/card-brands.tsx`: `CARD_BRANDS` (`visa`, `mastercard`, `elo`, `amex`, `hipercard`) com SVG saneado (simple-icons quando existir; senão selo desenhado), `CardBrandLogo`, `CardBrandPicker` (grade igual ao `BankPicker`, com opção “Nenhuma”), `normalizeBrand(text)` (mapeia textos antigos como “Visa”, “Master”, “Mastercard” → id).
- `cards.bandeira` passa a guardar o id. Valores antigos em texto continuam aparecendo (normalizados quando possível, senão o texto).
- Card de cartão mostra logo do banco no topo e logo da bandeira no canto, como um cartão real; gradiente usa a cor (agora a da marca).

## 5. Select padronizado

- `src/components/ui/Select.tsx` substitui o `<select>` nativo, **compatível com a API atual** (props `value`, `onChange(e)` com `e.target.value`, filhos `<option>`/`<optgroup>`, `disabled`, `id`, `className`, `aria-*`). `form.tsx` re-exporta como `Select` → os 36 usos em 14 arquivos migram sem reescrita.
- Visual igual ao `CategoryCombobox`: gatilho com o mesmo `controlBase` + chevron; painel `bg-app-surface`, borda `app-border`, `rounded-xl`, sombra, item ativo `bg-app-surface-2` com ícone de check.
- Painel em **portal** com posição fixa (não é cortado por modais), abre para cima quando falta espaço, largura do gatilho, altura máx. 18rem com rolagem.
- Busca automática quando há mais de 8 opções.
- Teclado: ↑/↓, Home/End, Enter/Espaço, Esc, Tab fecha, digitação salta para a opção. ARIA: `combobox`/`listbox`/`option`, `aria-expanded`, `aria-activedescendant`, `aria-selected`.
- Fecha em clique fora; reposiciona em scroll/resize.

## 6. Empréstimos e dívidas (isoladas)

**Banco**
- `debts`: `id, workspace_id, user_id, contexto (default 'PESSOAL'), credor text not null, origem text not null default 'Serasa Limpa Nome', descricao text, valor_original_centavos bigint null, valor_acordo_centavos bigint not null, data_acordo date null, observacoes text, created_at, updated_at`.
- `debt_installments`: `id, workspace_id, user_id, debt_id (fk cascade), numero int, valor_centavos bigint, vencimento date, pago boolean default false, pago_em date null`, `unique(debt_id, numero)`.
- RLS padrão (`is_member`/`has_write`), GRANTs para `authenticated`, trigger `updated_at`.

**Engine pura `src/engine/debts.ts`**
- `buildDebtInstallments(total, n, primeiroVencimento)` — divide centavos (resto nas primeiras parcelas), vencimentos mensais com dia limitado ao fim do mês.
- `debtSummary(debt, parcelas, today)` → total, pago, restante, `pagas/total`, próxima parcela, atrasadas, status (`quitada` | `em_dia` | `atrasada`).
- `debtsTotals(lista)` → total em acordos, pago, restante, economia negociada (original − acordo).

**Isolamento:** dívidas **não** geram transações e **não** entram em saldos, saldo previsto, “a pagar”, despesas, orçamentos, relatórios ou notificações. A página explica isso num aviso discreto.

**UI** — rota `/dividas` (“Dívidas”, nav secundária):
- Cards de resumo: Total em acordos · Já pago · Restante · Economia negociada.
- Lista de dívidas: credor, origem, progresso das parcelas, próxima parcela, status. Expandir mostra as parcelas com “Marcar paga”/“Desfazer” e data do pagamento. Ação “Quitar tudo”.
- Modal Nova/Editar dívida: credor, origem (Select: Serasa Limpa Nome, Acordo direto com o credor, Banco/Financeira, Outro), descrição, contexto, valor original, valor do acordo, nº de parcelas, 1º vencimento, observações; pré-visualização das parcelas. Na edição, os campos de identificação são editáveis; parcelas são editadas individualmente (valor/vencimento) ou recriadas (só as não pagas).
- Excluir com confirmação.
- Store própria `store/debts.ts` (load por workspace + CRUD).

## 7. Lista de desejos com monitoramento de preço

**Banco**
- `wishlist_categories`: `id, workspace_id, user_id, nome, icone, cor, created_at`.
- `wishlist_items`: `id, workspace_id, user_id, category_id (fk set null), url, titulo, descricao, imagem_url, loja, preco_atual_centavos, preco_inicial_centavos, preco_minimo_centavos, preco_alvo_centavos, comprado bool, comprado_em date, monitorar bool default true, ultima_verificacao timestamptz, ultimo_erro text, created_at, updated_at`.
- `wishlist_price_history`: `id, workspace_id, item_id (fk cascade), preco_centavos, verificado_em timestamptz default now()`; índice `(item_id, verificado_em)`.
- RLS padrão nas três. Extensões `pg_cron` e `pg_net`.

**Leitor de produto (compartilhado)** — `supabase/functions/_shared/product-parser.ts` (TS puro, sem DOM/Deno), testado no Vitest:
- Ordem: JSON-LD (`Product`, `ProductGroup`, `@graph`, `offers.price`/`lowPrice`/`priceSpecification.price`) → OpenGraph/meta (`og:title`, `og:description`, `og:image`, `og:site_name`, `product:price:amount`, `og:price:amount`, `itemprop=price`, `twitter:image`) → `<title>`.
- Normaliza preço em formatos “1.299,90”, “1299.90”, “R$ 1.299”, número.
- Decodifica entidades HTML; resolve URL de imagem relativa.

**Lógica compartilhada** — `supabase/functions/_shared/wishlist-logic.ts`, re-exportada por `src/engine/wishlist.ts`:
- `acharPromoUrl(url)`: remove `http(s)://` e um `www.` inicial e prefixa `https://www.achar.promo/`, preservando caminho, query e hash **exatamente**. Ex.: `https://www.mercadolivre.com.br/cama-box.../p/MLB80595545#reco...` → `https://www.achar.promo/mercadolivre.com.br/cama-box.../p/MLB80595545#reco...`.
- `priceAlert(anterior, novo, alvo)` → `'queda'` (queda ≥ 5%), `'alvo'` (cruzou o alvo: `anterior > alvo ≥ novo`, ou primeiro preço já ≤ alvo) ou `null`.
- `priceStats(historico)` → mínimo, máximo, variação vs. inicial, `isLowest`.

**Edge Functions**
- `wishlist-scrape` (`verify_jwt=true`): `POST {url}` → baixa o HTML com cabeçalhos de navegador (UA desktop, `Accept-Language: pt-BR`), redirects, timeout 12s, limite 3 MB; proteção SSRF (só http/https, bloqueia `localhost`/IPs privados/link-local); retorna `{ ok, titulo, descricao, imagem_url, preco_centavos, loja, motivo? }`.
- `wishlist-price-check` (`verify_jwt=false`, exige cabeçalho `x-cron-secret` igual ao secret `CRON_SECRET`): com service role, percorre itens `monitorar && !comprado` (concorrência 4), grava histórico, atualiza `preco_atual`/`preco_minimo`/`ultima_verificacao`/`ultimo_erro`; quando `priceAlert` dispara, cria notificação `wishlist` para cada membro ativo com `prefs.wishlist_precos` (`dedupe_key = wish-<item>-<data>`).
- Agendamento: `pg_cron` diário às 11:00 UTC (08:00 de Brasília) chamando a função via `pg_net`; o secret fica no Vault (`wishlist_cron_secret`).

**UI** — rota `/desejos` (“Desejos”, nav secundária):
- Resumo: total da lista (itens não comprados), itens em queda, economia vs. preço inicial.
- Filtros: chips de categoria (+ “Todas”), “Mostrar comprados”, ordenação (recentes, menor preço, maior queda).
- Grade de cards: imagem (`object-contain` em fundo branco, `referrerPolicy="no-referrer"`), título (2 linhas), loja, preço, selo de variação (↓ 12%), selo “Menor preço”, indicador de preço-alvo.
- Modal de detalhe: imagem, título, descrição, preço, **histórico de preço** (gráfico Recharts, lazy) com mín./máx., preço-alvo editável, categoria, alternar monitoramento, botões **Abrir na loja**, **Ver semelhantes** (abre `acharPromoUrl(url)` em nova aba), **Atualizar preço agora**, **Marcar como comprado**, editar, excluir.
- Modal Adicionar: colar link → busca automática (`wishlist-scrape`) → campos preenchidos e editáveis (título, descrição, URL da imagem com prévia, preço, categoria, preço-alvo). Se falhar: “Não conseguimos ler esta loja automaticamente — preencha os campos abaixo.”
- Categorias de desejo: criar inline no modal + gerenciar (renomear/excluir) com nome, ícone (catálogo existente) e cor.
- Store própria `store/wishlist.ts`. O preço inicial é gravado também como primeiro ponto do histórico.

## 8. Fiação compartilhada (feita antes do trabalho paralelo)

Para que as frentes paralelas não editem os mesmos arquivos, o controlador faz primeiro:
- Migrações + regeneração de `src/lib/database.types.ts` + aliases em `src/domain/types.ts`.
- Ícones novos em `src/components/icons.ts`.
- Rotas `/dividas` e `/desejos` em `App.tsx` e itens de navegação em `AppShell.tsx`.
- Carregamento das stores novas no `App.tsx` junto do `loadAll`.
- Componentes-stub conectados nos pontos de integração (Settings, Dashboard, TransactionModal), que cada frente depois implementa.

## Testes e validação

- **Unitários (Vitest):** `mei`, `debts`, `wishlist-logic` (incl. o exemplo exato de achar.promo), `product-parser` (fixtures JSON-LD/OG/BRL/sem preço), validade dos SVGs de bancos e bandeiras, `Select` (abrir, clique, teclado, optgroup, disabled, onChange), notificações MEI.
- **Banco:** RLS das tabelas novas (anon não lê); `reset_workspace_data` testado num espaço temporário dentro de transação revertida; `handle_new_user` continua semeando igual; advisors de segurança sem novos ERRORs.
- **Edge Functions:** `wishlist-scrape` via UI; `wishlist-price-check` via chamada com o secret e via job do cron.
- **E2E (agent-browser, conta principal):** Selects novos em modais; logos visíveis nos pickers; cor do banco aplicada ao escolher Nubank (cancelar sem salvar); seletor de bandeira; dívida `[E2E]` com parcelas → marcar paga → conferir que Dashboard/“a pagar” não mudam → excluir; desejo `[E2E]` com o link do Mercado Livre → preenchimento automático → “Ver semelhantes” aponta para o achar.promo correto → excluir; card MEI no Dashboard Empresarial; alerta MEI no modal de receita PJ (cancelar sem salvar); Zona de perigo abre e o botão só habilita com `RESETAR` (cancelar, **não executar**).
- **Build:** `npm run typecheck`, `npm test`, `npm run build` verdes.

## Fora de escopo

- Sincronizar dívidas com o caixa (são isoladas por decisão).
- Leitura de lojas que exigem JavaScript/antibot (Shopee, às vezes Amazon/Shein/AliExpress): o preenchimento cai no modo manual e o monitoramento registra `ultimo_erro`.
- Importação OFX/CSV e IR/Carnê-Leão (backlog anterior).
