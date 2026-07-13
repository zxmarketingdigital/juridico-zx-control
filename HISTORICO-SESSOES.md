# Histórico de Sessões — juridico-zx-control

> Registro do que foi feito a cada sessão de trabalho neste projeto (mais recente no topo).
> Mantido pelo `/encerrar` via `zx-worklog.py`. Ler no início pra recuperar contexto.

---

## 2026-07-13 — Fix demo hospedada: login quebrado → modo DEMO puro no Pages do Rafael

**Feito:** Root cause do login quebrado do protótipo (reclamação de aluna): config.js do deploy antigo apontava pra Supabase free de teste do Álvaro (vwqsrgryfulgztxcbbtr) que foi pausada/deletada → NXDOMAIN → qualquer credencial falhava. Criados demo/pages-worker.mjs (port do demo/server.mjs pra Pages advanced mode) + demo/build-pages.mjs (gera _worker.js autocontido com data.mjs inline). Deploy novo: https://juridico-zx-control-demo.pages.dev (conta CF do Rafael, modo DEMO puro, qualquer login entra). Verificado end-to-end no browser com advogado@teste.com/Teste@12345.
**Arquivos:** demo/pages-worker.mjs, demo/build-pages.mjs, .gitignore (commit 69ec8a5 na branch docs/proposta-rica)
**Deploy:** wrangler pages deploy demo/dist --project-name=juridico-zx-control-demo
**Pendências:** branch docs/proposta-rica está 3 commits à frente de main sem PR (estado herdado); avisar Álvaro que pode apagar o projeto zxcontrolsetup da conta dele; revisão Codex gpt-5.6-terra: sem regressão acionável

