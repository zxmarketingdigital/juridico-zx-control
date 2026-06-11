# Jurídico ZX Control — Spec de Produto (Design aprovado)

> Data: 11/Jun/2026 · Aprovado por Rafael Castro
> 3º produto de nicho da linha ZX Control v3 (irmãos: Clínica Cheia, Corretor ZX Control)
> Desenvolvimento: colaborador externo via PR · DoD: Setup de Nicho v2

## 1. O que é

Mini sistema **white-label** que o aluno ZX Control instala e revende para **advogados solo e escritórios pequenos**. O advogado faz login, escolhe um dos **5 agentes de IA**, passa informações ou sobe documentos, e a IA processa e gera o resultado (análise, minuta, resumo, prazo, ficha) — acelerando tarefas manuais e burocráticas do dia a dia jurídico.

**Persona do comprador final:** advogado(a) autônomo ou escritório com 1–10 advogados, sem equipe de TI, que perde horas com leitura de autos, redação de minutas e controle de prazos.

## 2. Stack (padrão da linha — inegociável)

- **Cloudflare Workers** (API) + **Cloudflare Pages** (painel)
- **Supabase**: Postgres com **RLS obrigatório em toda tabela**, Auth, Storage
- **IA**: Gemini Flash como provider default, **trocável pelo aluno** ("a que o aluno preferir") — model id e provider em **constante única** ("um valor, um lugar"), nunca espalhado
- **Vitest** + pnpm + TypeScript
- Estrutura: `src/ tests/ supabase/migrations/ painel/ setup/ demo/ docs/`

## 3. Autenticação (diferença-chave vs Corretor)

- **Supabase Auth email/senha, multi-usuário**: cada advogado do escritório tem login próprio.
- **Toda rota do Worker é fail-closed**: valida o JWT do Supabase; sem token válido → 401. Nenhuma rota nova nasce sem auth.
- Tela de login no painel + logout + indicação do usuário logado.
- Dados são compartilhados entre os usuários do mesmo escritório (uma instalação = um escritório). Não há multi-tenancy entre escritórios na v1 — cada cliente final recebe a própria instalação (modelo da linha).
- **Demo local continua sem credencial**: mock server com login fake (qualquer email/senha entra).

## 4. Os 5 agentes

Cada agente é um card no painel com formulário/upload → resultado renderizado no painel + salvo no histórico (tabela `pecas_geradas` ou equivalente), exportável.

### 4.1 Analisador de Contratos
- Input: upload de contrato (PDF/DOCX) + contexto opcional (quem o advogado representa).
- Output: lista de **riscos**, **cláusulas abusivas ou faltantes**, **sugestões de redação**, com **semáforo por cláusula** (verde/amarelo/vermelho).

### 4.2 Gerador de Petições/Minutas
- Input: tipo de peça (petição inicial, contestação, notificação extrajudicial, contrato) + fatos + partes + pedidos.
- Output: minuta estruturada em markdown, renderizada no painel e exportável (copiar/baixar).

### 4.3 Resumidor de Processos
- Input: upload de 1+ PDFs (autos, decisões, despachos).
- Output: **resumo executivo** + **linha do tempo** dos eventos + **situação atual** + **próximos passos sugeridos**.

### 4.4 Extrator de Prazos
- Input: upload de intimação/publicação (PDF ou texto colado).
- Output: prazo identificado (tipo, contagem, dias) + **data fatal calculada em dias úteis** (timezone **America/Sao_Paulo**, feriados nacionais) + **gravação automática na agenda de prazos** do painel.
- O cálculo de dias úteis/feriados é função pura testada (Vitest), incluindo casos com feriado no meio e prazo terminando em fim de semana.

### 4.5 Triagem de Cliente
- Input: relato do cliente em texto livre (colado pelo advogado).
- Output: **ficha do caso** (partes, fatos, pedido), **área do direito**, **documentos necessários** para o cliente trazer, **avaliação preliminar de viabilidade** (forte/médio/fraco com justificativa).

## 5. Documentos (upload e armazenamento)

- PDF enviado ao Gemini via **multimodal inline** (sem OCR próprio).
- Arquivo original guardado no **Supabase Storage com RLS**, vinculado ao caso/cliente.
- Resultado da IA + metadados gravados nas tabelas (nunca só na tela).

## 6. Entidades do painel (CRUD completo — DoD item 3)

Toda entidade listada tem botão "+ Novo" com modal funcional:

1. **Clientes** (nome, contato, CPF/CNPJ opcional)
2. **Casos/Processos** (cliente, número do processo opcional, área, status)
3. **Documentos** (vinculados a caso, com link pro Storage)
4. **Prazos** — agenda com destaque visual para prazos vencendo em **≤5 dias** e vencidos
5. **Peças geradas** — histórico dos outputs dos agentes (tipo, caso, data, conteúdo)

## 7. Regras inquebráveis do nicho

1. **Disclaimer obrigatório** em todo output de IA: *"Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória."* Renderizado no painel E embutido em qualquer exportação. Teste que falha se remover.
2. **Proibido o prompt pedir/citar jurisprudência ou julgados específicos** (números de processo, ementas, precedentes nomeados). Alucinação de julgado é risco profissional grave para o advogado. Agente de pesquisa de jurisprudência fica **explicitamente fora da v1**.
3. **Prazos sempre em dias úteis, America/Sao_Paulo**, com feriados nacionais. Nunca usar UTC ou data corrida.
4. **LGPD**: dados de cliente/caso **nunca em log** (nem console.log do Worker, nem log do painel). RLS em todas as tabelas e no Storage.
5. Invariantes da linha (já nos templates): auth fail-closed em toda rota, "um valor, um lugar", DoD com teste-que-falha-se-reverter + caminho grava-vs-lê, monolito com higiene (sem split `engine/` vs `nicho/`).

> Nota: este produto **não dispara mensagens proativas** (WhatsApp/email) na v1 — os invariantes de disparo (rate-cap, dedup, janela, opt-out) não se aplicam, mas permanecem no CLAUDE.md para qualquer feature futura de notificação de prazo.

## 8. Demo local (DoD item 4)

`node demo/server.mjs` sobe o painel populado sem credencial:
- Login fake (qualquer email/senha).
- Dados fictícios **realistas do nicho**: ≥10 clientes, ≥10 casos (áreas variadas: trabalhista, cível, família, consumidor), ≥10 prazos (alguns vencendo, um vencido), ≥10 peças geradas com conteúdo plausível.
- Agentes respondem com outputs mock pré-gravados (sem chamada de IA real).

## 9. DoD — Setup de Nicho v2 (critério de aceite do PR final)

1. Instalação **guiada** via CLAUDE.md (aluno cola o link do repo no Claude Code; nunca wizard `.mjs` como caminho principal)
2. Painel **premium** nos tokens ZX Control (`#0D0D0D`, `#D97706`, Inter + JetBrains Mono — ver `docs/DESIGN-TOKENS.md`)
3. **CRUD completo** (§6)
4. **Demo local populada** (§8)
5. **`docs/apresentacao.html`** — LP do setup pro aluno
6. **`docs/proposta.html`** — apresentação comercial white-label com precificação preenchida

Regra transversal: **zero placeholders `{{...}}`** em arquivo entregue. O dev roda `/validar-dod` antes de abrir o PR; CI perfil `nicho-dod` valida N1–N6.

## 10. Fora de escopo da v1

- Pesquisa de jurisprudência (§7.2)
- Integração com tribunais/PJe/push de andamentos
- Disparo de WhatsApp/email (notificação de prazo) — candidato a v1.1
- Multi-tenancy entre escritórios
- Assinatura eletrônica de documentos
