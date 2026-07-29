# Jurídico ZX Control

3º pacote da **linha de produtos de nicho do ZX Control v3** (irmãos: Clínica Cheia e Corretor ZX
Control). Um mini sistema **com autenticação** de **6 agentes de IA** para o **advogado solo /
escritório pequeno**, que o aluno do ZX Control instala e revende ao escritório.

> **Status:** em desenvolvimento (`v0.x`). O design está aprovado e congelado em
> [`docs/specs/2026-06-11-juridico-zx-control-design.md`](docs/specs/2026-06-11-juridico-zx-control-design.md)
> (revisado em 29/Jul/2026 para refletir o que o PR #2 incorporou).

## Os 6 agentes

1. **Analisador de Contratos** — upload do contrato → riscos, cláusulas abusivas/faltantes, semáforo por cláusula.
2. **Gerador de Petições/Minutas** — fatos + partes + tipo de peça → minuta estruturada exportável.
3. **Resumidor de Processos** — PDFs dos autos → resumo executivo + linha do tempo + próximos passos.
4. **Extrator de Prazos** — intimação/publicação → data fatal em dias úteis + agenda de prazos.
5. **Triagem de Cliente** — relato do cliente → ficha do caso, área do direito, viabilidade preliminar.
6. **Roteirista de Conteúdo** — tema + formato (reel/carrossel) + CTA → roteiro em 4 blocos para
   captação nas redes, com trava ética da OAB.

## Além dos agentes

**DataJud** (consulta do processo na API pública do CNJ) · **Equipe** (advogados com login próprio) ·
**Financeiro/CRM** (leads, receitas, custos, pré-notas) — ver §11 do spec.

## Stack

Cloudflare Workers + Supabase (Auth multi-usuário, RLS, Storage) · Cloudflare Pages (painel) ·
Gemini Flash (provider trocável) · Vitest.

## Desenvolvimento

Se você é o desenvolvedor colaborador: **leia o [`CLAUDE.md`](CLAUDE.md)** — ele te conduz. Fluxo de
contribuição em [`CONTRIBUINDO.md`](CONTRIBUINDO.md). Processo de release em [`RELEASING.md`](RELEASING.md).

```bash
pnpm install
pnpm ci      # typecheck + testes + wrangler dry-run
```
