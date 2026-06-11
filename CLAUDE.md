# Jurídico ZX Control — guia do desenvolvedor (Claude Code)

> Você (Claude Code) está no repositório de um **produto em construção**: o **Jurídico ZX Control**,
> 3º pacote da linha de produtos de nicho do ZX Control v3 (irmãos: Clínica Cheia e Corretor ZX Control).
> É um mini sistema **com autenticação** de **5 agentes de IA** para o **advogado solo / escritório
> pequeno**: ele faz login, passa informações ou sobe documentos, e a IA processa e gera o resultado
> (análise de contrato, minuta, resumo de processo, prazo, ficha de triagem). O dono deste repo é um
> **desenvolvedor colaborador** contratado pra construir o produto. O ZX LAB (Rafael,
> `@zxmarketingdigital`) revisa e publica.

## 🎯 Seu papel: CONSTRUIR o produto a partir do spec, via PR

Diferente do repo de um produto já pronto (onde o Claude só configura), **aqui você desenvolve código**.
Mas dentro de regras firmes:

1. **O spec é a fonte de verdade. Leia-o inteiro antes de tocar em qualquer arquivo:**
   `docs/specs/2026-06-11-juridico-zx-control-design.md`. Tudo que você construir tem que sair dele.
   Se algo no spec estiver ambíguo ou faltando, **pergunte ao colaborador humano** (que pergunta ao
   Rafael) — não invente requisito.
2. **TDD sempre.** Escreva o teste primeiro, veja falhar, implemente o mínimo, veja passar. O núcleo
   da linha é validado por teste — sem suíte verde não há release.
3. **Monolito com boa higiene de módulos.** Wrapper Gemini, auth middleware, cálculo de prazos e cada
   agente em arquivos/módulos próprios e bem separados — mas **NÃO** crie a fronteira de pastas
   `engine/` vs `nicho/`. Essa extração é trabalho futuro. Estrutura: `src/`, `tests/`, `supabase/`,
   `painel/`, `setup/`, `demo/`, `docs/`.
4. **PR pequeno e escopado.** Um PR por unidade coerente (um agente, o schema, o auth…). `pnpm ci`
   tem que passar local antes de abrir. PR ≤ ~1.000 linhas de diff.

## Os 5 agentes (spec §4)

1. **Analisador de Contratos** — upload PDF/DOCX → riscos, cláusulas abusivas/faltantes, sugestões de
   redação, semáforo por cláusula.
2. **Gerador de Petições/Minutas** — tipo de peça + fatos + partes → minuta em markdown exportável.
3. **Resumidor de Processos** — 1+ PDFs dos autos → resumo executivo + linha do tempo + situação atual
   + próximos passos.
4. **Extrator de Prazos** — intimação/publicação → prazo + data fatal em dias úteis + grava na agenda.
5. **Triagem de Cliente** — relato em texto → ficha do caso, área do direito, documentos necessários,
   viabilidade preliminar.

## Regras inquebráveis (saem do spec — não negocie)

- **Stack da linha:** Cloudflare **Workers** (API) + **Supabase** (1 base por instalação, **RLS
  habilitado por padrão em toda tabela** e no Storage) + **Pages** (painel). Cérebro: **Gemini Flash**,
  provider trocável pelo aluno.
- **Auth multi-usuário (diferencial deste pacote, spec §3):** Supabase Auth email/senha; cada advogado
  tem login próprio. **TODA rota do Worker valida o JWT, falha-fechado** — o check tem que estar no
  caminho DELA (não só existir em outra rota). Token ausente/vazio/inválido → 401 sempre. Foi
  exatamente o bug CRITICAL do PR #2 do Corretor (auth bypass nos imports) — não repita.
- **Disclaimer obrigatório em todo output de IA:** *"Conteúdo gerado por IA — a revisão pelo advogado
  responsável é obrigatória."* Renderizado no painel E embutido em toda exportação. Com teste que
  falha se removido.
- **Proibido o prompt pedir/citar jurisprudência ou julgados específicos** (números de processo,
  ementas, precedentes nomeados). Alucinação de julgado é risco profissional grave pro advogado.
  Pesquisa de jurisprudência está explicitamente FORA da v1 (spec §7.2 e §10).
- **Prazos sempre em dias úteis, timezone America/Sao_Paulo, com feriados nacionais.** Função pura
  testada (Vitest) com casos de feriado no meio e prazo caindo em fim de semana. Nunca UTC, nunca
  data corrida.
- **LGPD:** dados de cliente/caso **nunca em log** (nem `console.log` do Worker, nem log do painel).
  RLS em todas as tabelas e buckets.
- **Documentos:** PDF vai ao Gemini via multimodal inline; original guardado no Supabase Storage (RLS)
  vinculado ao caso; resultado + metadados gravados em tabela (nunca só na tela).
- **Sem disparo proativo na v1** (WhatsApp/email de notificação ficam pra v1.1). Se uma feature de
  envio for adicionada no futuro, valem os invariantes da linha: dedup com chave por toque +
  idempotência + **janela com limite inferior E superior em America/Sao_Paulo** + **rate-cap GLOBAL
  da linha EMISSORA (nunca por destinatário)** + delay/jitter entre envios + opt-out "SAIR".
- **Núcleo congelado e versionado:** distribuição por **tag** `vX.Y.Z` (ver `RELEASING.md`), nunca a `main`.
- **Sem segredo no repo.** Credenciais vivem em `.env`/wrangler secret (gitignored). Sem ID interno do ZX LAB.
- **Um valor, um lugar.** Model id do Gemini, lista de feriados, limites e qualquer valor de
  configuração ficam em **uma constante exportada única** que todos os consumidores importam —
  incluindo `setup/` e `painel/`. Literal repetido em 2+ arquivos = fix incompleto garantido.

## Definition of Done (sem isso o PR volta)

1. **Teste de invariante de verdade**: para cada invariante tocado (auth, disclaimer, prazos, LGPD),
   existe um teste que **falha se o seu código for revertido**. Critério objetivo: `git stash` no seu
   código, rode a suíte — o teste novo TEM que quebrar. Se continua verde, é teatro (mock testando mock).
2. **Caminho de integração coberto**: se um fluxo grava (upload/agente) e outro lê (painel/agenda), há
   um teste passando dados reais de ponta a ponta — coluna gravada = coluna lida.
3. **Fix de valor/ID com grep**: trocou um valor? `grep -rn` do valor antigo no repo inteiro, zero
   ocorrências.
4. **Auto-review adversarial rodado** e resultado colado no PR (prompt no `CONTRIBUINDO.md`).
5. `pnpm ci` verde local + PR ≤ ~1.000 linhas de diff.

**Entrega final = DoD Setup de Nicho v2 completo** (6 itens — ver `.github/PULL_REQUEST_TEMPLATE.md`):
instalação guiada via CLAUDE.md de instalador, painel premium nos tokens ZX Control
(`docs/DESIGN-TOKENS.md`), CRUD completo, demo local populada (≥10 registros/entidade),
`docs/apresentacao.html`, `docs/proposta.html` com preço. Zero placeholders `{{...}}`. Rode a skill
local **`/validar-dod`** antes de abrir o PR de entrega.

## Ordem de construção sugerida (derive seu plano do spec)

1. `supabase/migrations/` — schema do spec §6 (clientes, casos, documentos, prazos, pecas_geradas)
   **com RLS** + bucket de Storage com policy.
2. Primitivas de núcleo: **auth middleware (JWT Supabase, fail-closed)**, wrapper Gemini
   (retry/timeout, provider trocável), **cálculo de prazos em dias úteis testado**.
3. **Agente 4 (Extrator de Prazos)** — exercita upload + Gemini + gravação na agenda (caminho
   grava-vs-lê completo).
4. Agentes **1, 2, 3, 5** (cada um um PR; todos com disclaimer testado).
5. `painel/` (Pages) — login + cards dos agentes + CRUD das 5 entidades + agenda de prazos.
6. `demo/` — mock server com login fake + dados realistas (≥10/entidade).
7. `setup/` — apoio à instalação guiada + `smoke.mjs`; **CLAUDE.md de INSTALADOR** (conduz o aluno
   conversando — modele no da Clínica Cheia; nunca wizard como caminho principal).
8. `docs/apresentacao.html` + `docs/proposta.html` (preencher os placeholders de conteúdo).

## Modelo de colaboração (importante)

- A `main` é **protegida**: você **não dá push direto**. Crie branch, abra **PR** com sua própria conta GitHub.
- **Só o Rafael (`@zxmarketingdigital`) aprova e mergeia.** Você propõe; ele publica.
- **Nunca edite `.github/`** (workflows/CODEOWNERS) — é território do dono.
- Fluxo leigo passo-a-passo: ver `CONTRIBUINDO.md`.

## Comandos

```bash
pnpm install            # 1ª vez (gera o lockfile no seu 1º PR)
pnpm test               # roda a suíte
pnpm typecheck          # tsc src + tests
pnpm ci                 # typecheck + testes + wrangler dry-run (tem que passar antes do PR)
pnpm dev                # wrangler dev local
```
