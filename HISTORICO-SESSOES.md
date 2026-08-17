# Histórico de Sessões — juridico-zx-control

> Registro do que foi feito a cada sessão de trabalho neste projeto (mais recente no topo).
> Mantido pelo `/encerrar` via `zx-worklog.py`. Ler no início pra recuperar contexto.

---

## 2026-08-13 — Fix Gemini aposentado (404)

**Feito:** Mesmo defeito do gemini-2.5-flash/2.0-flash aposentado encontrado e corrigido nos 4 repos irmaos da linha de nicho + no setup Semana 1, apos achar na Clinica Cheia (aluno Diogo reportou).
**Fix:** modelo default trocado p/ alias gemini-flash-lite-latest, GEMINI_MODEL opcional com trim+fallback, parser resiliente a part sem text e a thought:true (raciocinio interno).
**Arquivos:** src/gemini/client.ts (contabilidade, corretor) · src/config.ts+src/ia.ts (juridico) · scripts/agent_bant.py+setup/setup_agent.py (semana1) · setup/configure.mjs+setup/smoke.mjs (corretor).
**Deploy:** push origin/main nos 4 (CI verde: 101/164/84 testes). Cascas geradoras (~/.claude/skills/criar-repo-setup-colaborador/templates/) corrigidas junto p/ setup novo nao nascer quebrado; regra registrada na SKILL.md.
**Pendencias:** nenhuma. Aviso enviado no grupo ZX Control 5 com instrucao de git pull + wrangler deploy.

## 2026-08-11 — Reconciliação do spec congelado com o PR #2 (6 agentes + DataJud/Equipe/Financeiro)

**Feito:** Reconciliado o spec congelado (docs/specs/2026-06-11-...) com o codigo real em producao — PR #2 ("Jurídico Otimizado 2", 5fc0c07, mergeado 18/Jun) tinha entrado na main sem atualizar o spec, deixando-o desatualizado por ~6 semanas (dizia "5 agentes", codigo tinha 6, e 3 blocos inteiros de feature sem documento nenhum).
**Mudancas no spec:** nova secao §4.6 (Roteirista de Conteudo, agente 6 — formatos, CTA, estrutura em 4 blocos, trava etica OAB no prompt) + nova secao §11 (DataJud/consulta CNJ, Equipe/criar-acesso, Financeiro-CRM) + nota em §7.2 distinguindo "fonte oficial consultada por identificador" (DataJud, permitido) de "julgado produzido pelo modelo" (proibido) + §10 ajustado (integracao com tribunais passou de fora-de-escopo pra parcial) + tabela de historico de revisoes no topo. Numeracao §1-§10 preservada de proposito (CLAUDE.md e PR template referenciam essas secoes).
**Tambem alinhados** (grep de "5 agentes" zerado — DoD item 3 do proprio repo): CLAUDE.md, README.md, docs/COMECE-AQUI.md, comentarios de cabecalho de src/agentes.ts e src/index.ts.
**Nao tocado (decisao comercial do Rafael):** docs/apresentacao.html — material de venda do aluno, ainda diz "5 agentes".
**Arquivos:** docs/specs/2026-06-11-juridico-zx-control-design.md, CLAUDE.md, README.md, docs/COMECE-AQUI.md, src/agentes.ts, src/index.ts.
**Deploy:** nao aplicavel (docs). Commit 9320616 na branch docs/reconciliar-spec-pr2, pushada — PR nao aberto (main protegida, so o Rafael mergeia).
**Verificacao:** pnpm typecheck limpo + 164 testes passando (12 arquivos), rodados na base de origin/main.
**Pendencias:** abrir o PR quando o Rafael decidir; confirmar com quem mandou o recado original (fala em "agentes 6 e 7" e "PR por vir") se ha trabalho local nao pushado que possa conflitar — nenhum commit nos ultimos 45 dias em nenhuma branch/repo de nicho menciona isso.

