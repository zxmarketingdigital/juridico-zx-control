# Histórico de Sessões — juridico-zx-control

> Registro do que foi feito a cada sessão de trabalho neste projeto (mais recente no topo).
> Mantido pelo `/encerrar` via `zx-worklog.py`. Ler no início pra recuperar contexto.

---

## 2026-07-28 — Demo pública entra direto (sem login) + cache busting

**Feito:** a demo publica (juridico-zx-control-demo.pages.dev) passou a abrir direto no painel. As credenciais de teste divulgadas na area de membros (advogado@teste.com / Teste@12345) foram aposentadas.

**Abordagem (importante):** o bypass NAO inverteu o markup do painel. O estado padrao do documento continua sendo o de PRODUCAO (login visivel, #app-view com .hidden); um script inline no <head> le ZX.DEMO e marca `html.zx-demo`, e o CSS faz o resto. Roda antes do <body> ser parseado, entao nao ha flash da tela de login — e se app.js nao carregar, a instalacao do aluno abre na tela de acesso, nao no shell do app.

**Onde entra a correcao:** demo/dist/ e GITIGNORED (artefato de `node demo/build-pages.mjs`, que copia painel/). Editar so o dist seria perdido no proximo build — a mudanca entrou em painel/. Verificado antes de mexer: o gerador reproduz byte-a-byte (md5) os 4 arquivos publicados.

**GOTCHA:** demo/build-pages.mjs e demo/pages-worker.mjs so existem na branch `docs/proposta-rica` — NAO estao na main.

**Cache busting:** assets com ?v=<hash> no build (mesmo motivo da contabilidade: CSS antigo em cache mascarava o fix).

**Arquivos:** painel/{app.js,index.html,style.css}, demo/build-pages.mjs
**Commits:** e6e09f8, 48d8a89 na branch feat/demo-visivel (main protegida/PR-only — branch pushada)
**Deploy:** wrangler pages deploy demo/dist --project-name juridico-zx-control-demo — VERIFICADO ao vivo (abre direto nos 6 agentes; API respondeu 11 clientes)
**Guard:** vitest 164/164 (auth fail-closed do produto intacta — ZX.DEMO e undefined em producao, testado com config sem DEMO)
**Pendências:** abrir PR de feat/demo-visivel

## 2026-07-13 — Fix demo hospedada: login quebrado → modo DEMO puro no Pages do Rafael

**Feito:** Root cause do login quebrado do protótipo (reclamação de aluna): config.js do deploy antigo apontava pra Supabase free de teste do Álvaro (vwqsrgryfulgztxcbbtr) que foi pausada/deletada → NXDOMAIN → qualquer credencial falhava. Criados demo/pages-worker.mjs (port do demo/server.mjs pra Pages advanced mode) + demo/build-pages.mjs (gera _worker.js autocontido com data.mjs inline). Deploy novo: https://juridico-zx-control-demo.pages.dev (conta CF do Rafael, modo DEMO puro, qualquer login entra). Verificado end-to-end no browser com advogado@teste.com/Teste@12345.
**Arquivos:** demo/pages-worker.mjs, demo/build-pages.mjs, .gitignore (commit 69ec8a5 na branch docs/proposta-rica)
**Deploy:** wrangler pages deploy demo/dist --project-name=juridico-zx-control-demo
**Pendências:** branch docs/proposta-rica está 3 commits à frente de main sem PR (estado herdado); avisar Álvaro que pode apagar o projeto zxcontrolsetup da conta dele; revisão Codex gpt-5.6-terra: sem regressão acionável

