# Histórico de Sessões — juridico-zx-control

> O que é: 3º pacote de nicho da linha ZX Control v3 (irmãos: Clínica Cheia, Corretor, Contabilidade) — mini sistema white-label **com autenticação** e **6 agentes de IA** para advogado solo / escritório pequeno, que o aluno instala e revende. Stack: Cloudflare Workers (API) + Supabase (RLS) + Pages (painel), cérebro Gemini Flash. Construído por desenvolvedor colaborador via PR; a `main` é protegida e só o Rafael mergeia.
> URL de produção: o produto em si não tem instalação pública — o que está no ar é a **demo**: https://juridico-zx-control-demo.pages.dev (modo DEMO puro, conta Cloudflare do Rafael). Proposta comercial: https://proposta-juridico-zxcontrol.pages.dev

---

## 2026-07-29 — Reconciliar o spec congelado com o que o PR #2 já tinha incorporado

**Contexto:** chegou ao Rafael um recado de terceiro: *"os agentes 6 e 7 estão fora do spec congelado, que prevê 5… o documento em docs/specs precisa ser atualizado antes de virar PR"*. A mensagem veio de fora, então foi tratada como informação, não como ordem — a investigação começou em 27/Jul e a execução foi autorizada ("Fazer o proposto") em 29/Jul.

**O que foi feito:**

- **Investigação empírica primeiro** (27/Jul): varredura dos 5 repos de nicho com `docs/specs` + todas as branches locais e remotas nos últimos 45 dias. `juridico-zx-control` é o único com divergência real spec × código.
- **Divergência confirmada:** `docs/specs/2026-06-11-juridico-zx-control-design.md` §4 dizia "Os 5 agentes"; `src/schema.ts` (`AGENTES`) e `src/agentes.ts` (`AGENTE_DEFS`) tinham **6** — o 6º é o `roteirista_social`. Entrou no commit `5fc0c07` via **PR #2 "Jurídico Otimizado 2"**, mergeado em 18/Jun — ou seja, o spec ficou ~6 semanas defasado.
- **Duas correções ao recado recebido**, registradas na resposta ao Rafael: (1) não eram "2 agentes fora do spec" — o mesmo PR trouxe também **DataJud**, **Equipe/advogados** e **Financeiro/CRM**, nenhum deles em documento; o "agente 7" era provavelmente o DataJud contado como agente, mas ele é integração, não agente do schema. (2) Não existia PR pendente — o PR #2 estava `MERGED` havia ~40 dias. Nenhum commit em nenhum repo mencionava "agente 6/7", "fora do spec" ou "spec congelado", então o trabalho descrito pelo remetente não estava naquela máquina.
- **Spec atualizado** (`docs/specs/2026-06-11-juridico-zx-control-design.md`):
  - §1 e §4: 5 → **6 agentes**; nova **§4.6 Roteirista de Conteúdo** (formatos `reel`/`carrossel`, lista fixa de CTA, estrutura obrigatória em 4 blocos HOOK → DESENVOLVIMENTO → AMPLIFICAÇÃO → CTA, trava ética da OAB embutida no prompt).
  - **§11, nova** — os três blocos que não existiam em documento nenhum: **§11.1 DataJud** (rota, derivação de tribunal pelo número CNJ, snapshot idempotente em `movimentacoes`, degradação quando o CNJ cai), **§11.2 Equipe** (`advogados` + Edge Function `criar-acesso`, e por que ela valida o chamador no código em vez de confiar no `verify_jwt` — a anon key é um JWT válido e passaria), **§11.3 Financeiro/CRM** (`leads`, `receitas`, `custos`, `pre_notas`, `GET /growth`).
  - **§7.2** — régua reutilizável escrita para não fazer o DataJud parecer violação da regra anti-jurisprudência: *fonte oficial consultada por identificador = permitido; precedente produzido pelo modelo = proibido*.
  - **§6 e §10** — entidades 6 a 11 listadas; "integração com tribunais" saiu de fora-de-escopo como **parcial** (consulta sob demanda entrou; push automático e peticionamento continuam fora).
  - **Numeração §1–§10 preservada de propósito** — `CLAUDE.md` e o PR template referenciam "§4", "§6", "§7.2", "§10".
- **Resíduos de "5 agentes" corrigidos** (DoD item 3 do próprio repo manda grepar o valor antigo): `CLAUDE.md`, `README.md`, `docs/COMECE-AQUI.md` e os comentários de cabeçalho de `src/agentes.ts` e `src/index.ts`.
- **Verificação:** `pnpm typecheck` limpo + **164 testes passando** (12 arquivos), rodados já na base de `origin/main`.
- **Git:** a sessão começou na branch antiga `docs/proposta-rica` com a `main` local 3 commits atrás; as mudanças foram levadas via `git stash` para a branch nova **`docs/reconciliar-spec-pr2`** criada a partir de `origin/main`, com scan de segredo no staged. Commit `9320616`, branch pushada, **PR #5 aberto**.

**Estado ao fim da sessão:** PR #5 `docs: reconcilia spec congelado com o que o PR #2 incorporou` aberto e aguardando o Rafael (a `main` é protegida). Nada foi deployado — é sessão de documentação. `docs/apresentacao.html` ficou intencionalmente sem alteração.

**Decisões que não estão no código:**
- **Documentar o que já está em produção, não aprovar escopo novo** — foi essa a régua do commit; o caminho alternativo (remover os agentes extras para caber no spec) foi levantado ao Rafael e descartado por ele ao dizer "fazer o proposto".
- **`docs/apresentacao.html` não foi tocada** (4 ocorrências de "5 agentes"): é material de venda que o aluno usa, mudar contagem de agentes ali é decisão comercial do Rafael, não correção técnica. Observação registrada: essa apresentação já citava equipe e DataJud como "o Otimizado", então nunca esteve alinhada nem com o spec nem com a própria contagem.
- Recado de terceiro não vale como ordem: a investigação veio antes de qualquer edição, por pedido explícito do Rafael ("tem que investigar primeiro").

---

## 2026-07-28 — Demo pública entra direto, sem login + cache busting

**Contexto:** pedido do Rafael abrangendo os setups de nicho com demonstração (Contabilidade, Jurídico, Clínica, Corretor): *"tem que ficar mais visível na página inicial do setup e tirar a parte de autenticação, entrar direto, para não precisar de login e senha pois é só demonstração"*. A demo é material de venda — o aluno manda o link pro cliente advogado dele, e a tela de login (que aceitava qualquer credencial) só criava atrito. Começou em modo solo, virou `/dev-autonomo` a pedido do Rafael ("melhora fazer com dev autônomo"), rodando em worktrees isoladas com plano multi-agente + review adversarial.

**O que foi feito (parte do jurídico):**

- **Preflight que mudou o plano:** descoberto que `demo/build-pages.mjs` (o gerador da demo) **só existe na branch `docs/proposta-rica`**, não na `main` — a worktree foi recriada a partir dela. Rodado o gerador e confirmado por md5 que ele reproduz **byte-a-byte** os 4 arquivos publicados, provando que o caminho seguro era editar `painel/` + rebuild, não editar `demo/dist/` (que é gitignored via `dist/`).
- **Baseline de guard:** vitest **164/164** antes de mexer.
- **Bypass de login implementado em `painel/app.js`, `painel/index.html`, `painel/style.css`** — sem inverter o markup de produção: o estado padrão do documento continua sendo o de produção (login visível, `#app-view` com `.hidden`); um **script inline no `<head>`** lê `ZX.DEMO` e marca `html.zx-demo` antes do `<body>` ser parseado (zero flash da tela de login), e o CSS faz o resto. Se `app.js` não carregar, a instalação do aluno abre na tela de acesso, não no shell do app. `sair()` vira no-op quando `ZX.DEMO`; o form de login permanece no DOM como fallback.
- **Prova empírica de que a auth de produção segue intacta:** servido o `painel/` com um `config.js` **sem** `DEMO` e verificado no browser via CSSOM/`getComputedStyle` — `html` sem classe, login visível, app escondido. Commit `e6e09f8`.
- **Cache busting (`48d8a89`)** — achado de produção: o primeiro deploy "deu certo" e **não funcionou**. O CF Pages serve `style.css`/`app.js` com nome fixo e `cache-control: max-age=14400`; quem já tinha visitado a demo continuaria vendo a tela de login. `curl` mostrava o arquivo novo (busca sem cache) — só o CSSOM do browser revelou que as regras `html.zx-demo` não estavam lá. Corrigido com sufixo `?v=<hash sha256 do conteúdo>` gerado no `demo/build-pages.mjs`.
- **Deploy verificado ao vivo:** `wrangler pages deploy demo/dist --project-name juridico-zx-control-demo` — a demo abre direto nos 6 agentes, chip "Demonstração", sem botão Sair; `GET /api/clientes` respondeu **11 clientes**.
- **Guard revalidado:** vitest 164/164 depois da mudança.
- **Revisão externa (Codex Sol)** sobre o diff de `painel/`, com uma pergunta só: o bypass da demo pode vazar para a instalação real do aluno? Veredito limpo, sem caminho de vazamento, com citação de linha.
- **Fora do repo, mas parte da mesma entrega:** nas áreas de membros v4.0 Launch e v5.0 Traffic o bloco da demo virou o **primeiro conteúdo** do painel inicial do Setup 12 (hero azul `#2563eb`, badge pulsante, CTA "Abrir a demonstração"), e as **credenciais de teste `advogado@teste.com` / `Teste@12345` foram aposentadas** dessas áreas (inclusive do Setup 14, que usa a demo jurídica como exemplo). Monitor `check_setups_areas_membros.py` fechou `OK — 15 blocos em sincronia`. Aviso enviado ao grupo SUPORTE ZX LAB com os 4 links das demos.
- **Git:** commits na branch **`feat/demo-visivel`** (a `main` é protegida/PR-only), pushada para o remoto. Histórico da sessão commitado na `docs/proposta-rica` (`1f4821d`).

**Estado ao fim da sessão:** demo do Jurídico no ar abrindo direto, verificada no browser. Branch `feat/demo-visivel` pushada **sem PR aberto** — o código está em produção via deploy direto, mas fora da `main`.

**Decisões que não estão no código:**
- **A correção entra em `painel/`, nunca em `demo/dist/`** — o `dist` é artefato gerado e gitignored; editar só ele seria perdido no próximo build.
- **O markup de produção não se inverte para acomodar a demo.** O default do documento continua sendo "login obrigatório"; a demo é que se desvia, guardada por `ZX.DEMO`. Isso mantém o invariante de auth fail-closed do produto mesmo se o JS falhar.
- **A demo da Clínica (irmã) ficou deliberadamente sem o bypass** — ela é a única que autentica no Supabase do CRM principal, e o bypass exigiria publicar e-mail+senha de conta real num `config.js` público. Decisão pendente do Rafael; não afeta o Jurídico.

---

## 2026-07-13 — Fix do login quebrado do protótipo: demo re-hospedada em modo DEMO puro

> Nota: o trabalho está datado 13/Jul/26 nos commits e no worklog original (a sessão rodou 13/Jul, 15h09–15h42 BRT).

**Contexto:** uma aluna reclamou que "o login e senha do protótipo do Jurídico do ZX Control não está funcionando". Investigado com debugging sistemático antes de qualquer fix.

**O que foi feito:**

- **Root cause confirmada empiricamente, não deduzida:** a demo publicada em `zxcontrolsetup.pages.dev` estava na **conta Cloudflare do Álvaro**, com o `config.js` apontando para uma base **Supabase free de teste dele** (`vwqsrgryfulgztxcbbtr`). Essa base foi pausada/deletada — o domínio não resolvia mais no DNS (NXDOMAIN). Resultado: **qualquer** credencial falhava, inclusive o `advogado@teste.com` / `Teste@12345` divulgado. O link estava certo e a senha estava certa; o backend é que tinha morrido — e estava assim para **todos os alunos**, não só para ela.
- **Fix escolhido: não recriar outra base de teste** (apodreceria de novo), e sim publicar o **modo DEMO** que o repo já tinha (mock server + dados fictícios) como Pages autocontido na conta do Rafael:
  - `demo/pages-worker.mjs` — port do `demo/server.mjs` para Cloudflare Pages advanced mode (mesmo contrato: `/api/*` com Bearer fail-closed, CRUD, agenda, agentes mock com disclaimer). Estado em memória por isolate.
  - `demo/build-pages.mjs` — gera `demo/dist/` com um `_worker.js` **único e autocontido** (concatena `demo/data.mjs` sem os `export` + o handler, via marcador `/* __DATA__ */`); sem bundler, sem dependências. Emite `config.js` com `DEMO:true`.
  - `.gitignore` — `demo/dist/` excluído.
- **Validação antes do deploy:** `node --check` no `_worker.js` e `wrangler pages dev demo/dist` local (porta 8912), testando `/config.js`, `/api/clientes` sem token (fail-closed), com token, `/api/growth` e um POST de agente.
- **Deploy:** projeto Pages novo `juridico-zx-control-demo` criado na conta do Rafael e deployado → **https://juridico-zx-control-demo.pages.dev**. Verificado end-to-end no browser real, digitando exatamente as credenciais divulgadas: login entra, os 6 agentes aparecem, Clientes/Financeiro/CRM populados. Sem banco, sem credencial externa — qualquer login entra.
- **Fora do repo, mesma entrega:** link antigo substituído nas áreas de membros **v3.0 Scale** e **v4.0 Launch** (4 ocorrências em cada `docs/index.html`), ambas re-deployadas e confirmadas em produção.
- **Setups irmãos checados:** Corretor e Contabilidade estão seguros (demos estáticas/mock, sem dependência externa). Só o Jurídico tinha essa bomba-relógio.
- **Revisão Codex** (`gpt-5.6-terra`, `codex review --base HEAD~1`): sem regressão acionável.
- **Git:** commit `69ec8a5` na branch `docs/proposta-rica` (que era a ativa), + `58fc6b7` com o histórico da sessão e o ponteiro no `CLAUDE.md`.

**Estado ao fim da sessão:** demo no ar em `juridico-zx-control-demo.pages.dev`, link novo nas duas áreas de membros, três repos commitados e pushados.

**Decisões que não estão no código:**
- **Regra que saiu daqui:** demo hospedada de setup de nicho **nunca** depende de base de teste ou de conta de colaborador — sempre mock, na conta Cloudflare do Rafael. Registrada na memória (`reference_demo_juridico_zxcontrol_pages_demo_puro`).
- Não foi feita tentativa de corrigir o deploy antigo: ele vive na conta Cloudflare do Álvaro, sem acesso.
- Gotchas anotados: `pages.dev` responde 403 para User-Agent não-browser (checar sempre com UA de browser), e o filtro do RTK sobre `grep` deu contagem 0 falsa — contagens foram refeitas em Python.

---

## ⚠️ Pendências abertas

- **PR #5 aberto e parado** — `docs/reconciliar-spec-pr2` (commit `9320616`, spec reconciliado) está pushado e com PR aberto desde 29/Jul aguardando aprovação/merge do Rafael. A `main` é protegida; ninguém mais mergeia.
- **`feat/demo-visivel` pushada SEM PR** — 2 commits próprios (`e6e09f8` bypass de login, `48d8a89` cache busting) + 3 herdados, **5 commits à frente de `origin/main`**. O código **já está em produção** (deploy direto no Pages), mas fora da `main`. Enquanto não mergear, quem clonar a `main` recebe a versão com login.
- **`docs/proposta-rica` com 4 commits fora da `main`** (`b6c817f` WIP de limpeza, `69ec8a5` demo hospedada, `58fc6b7` e `1f4821d` históricos). **É nessa branch que vivem `demo/build-pages.mjs` e `demo/pages-worker.mjs`** — os geradores da demo publicada. Quem clonar a `main` **não consegue rebuildar a demo que está no ar**. Este é o item mais arriscado da lista.
- Nada está pendente de `git push`: as 4 branches (`main`, `docs/proposta-rica`, `feat/demo-visivel`, `docs/reconciliar-spec-pr2`) estão todas no `origin`. O que falta é **merge na `main`**, não envio. (A branch local `pr2-review` não tem remoto; é branch de trabalho.)
- **`docs/apresentacao.html` ainda diz "5 agentes"** (4 ocorrências) — não tocada de propósito na sessão de 29/Jul por ser material de venda; decisão comercial do Rafael.
- **`.DS_Store` versionado** na branch `feat/demo-visivel` (entrou como arquivo novo no diff contra a `main`) — limpar antes do merge.
- **Avisar o Álvaro** que pode apagar o projeto `zxcontrolsetup` da conta Cloudflare dele. A URL antiga segue morta em mensagens de WhatsApp/e-mail já enviadas no lançamento — se pintar outra reclamação, é essa a causa.
- **Sugestão não implementada:** health-check dos demos públicos (Jurídico/Corretor/Contabilidade/Clínica) no watchdog ou no `/status`, para pegar demo quebrada antes de aluno reclamar.
