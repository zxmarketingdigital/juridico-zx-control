# Jurídico ZX Control — Spec de Produto (Design aprovado)

> Data: 11/Jun/2026 · Aprovado por Rafael Castro
> 3º produto de nicho da linha ZX Control v3 (irmãos: Clínica Cheia, Corretor ZX Control)
> Desenvolvimento: colaborador externo via PR · DoD: Setup de Nicho v2

### Histórico de revisões

| Data | O que mudou | Origem |
|------|-------------|--------|
| 11/Jun/2026 | Design original aprovado — 5 agentes | — |
| 29/Jul/2026 | Reconciliação com o código em produção: 6º agente (§4.6) + DataJud, Equipe e Financeiro/CRM (§11) | PR #2 "Jurídico Otimizado 2" (`5fc0c07`), mergeado em 18/Jun/2026 |

> **Nota sobre esta revisão:** o PR #2 entrou na `main` sem atualizar este documento, deixando o spec
> congelado desatualizado por ~6 semanas. A revisão de 29/Jul **documenta o que já está em produção** —
> não aprova escopo novo. Se a decisão for reduzir o produto ao escopo original de 11/Jun, o caminho é
> remover o código, não reverter este documento.

## 1. O que é

Mini sistema **white-label** que o aluno ZX Control instala e revende para **advogados solo e escritórios pequenos**. O advogado faz login, escolhe um dos **6 agentes de IA**, passa informações ou sobe documentos, e a IA processa e gera o resultado (análise, minuta, resumo, prazo, ficha, roteiro) — acelerando tarefas manuais e burocráticas do dia a dia jurídico.

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

## 4. Os 6 agentes

Cada agente é um card no painel com formulário/upload → resultado renderizado no painel + salvo no histórico (tabela `pecas_geradas` ou equivalente), exportável.

A lista canônica vive em `src/schema.ts` (`AGENTES`) e as definições em `src/agentes.ts` (`AGENTE_DEFS`) — "um valor, um lugar". Agente novo entra nas duas + nesta seção, nunca só no código.

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

### 4.6 Roteirista de Conteúdo *(incorporado pelo PR #2 — 18/Jun/2026)*
- **Por que existe:** o advogado que compra o pacote precisa captar cliente, e a rede social é o canal
  dele. É o único agente do produto voltado a **aquisição**, não a execução do trabalho jurídico.
- Input: **tema** + **formato** (`reel` ou `carrossel` — constante `FORMATOS_SOCIAL`) + **CTA**
  escolhido de uma lista fixa (constante `CTA_OPCOES`, 6 opções).
- Output: roteiro em **4 blocos rotulados e nesta ordem** — HOOK (prende nos 3 primeiros segundos),
  DESENVOLVIMENTO, AMPLIFICAÇÃO, CTA. Carrossel entrega 5–7 slides numerados (1 ideia por slide);
  reel entrega roteiro de fala com indicação de cena/corte por bloco.
- **Trava ética embutida no prompt** (não é só recomendação de uso): proibido prometer resultado,
  proibida captação/mercantilização da advocacia e proibido citar jurisprudência — alinhado ao
  Código de Ética da OAB e à regra §7.2.
- Como todo agente, o output carrega o disclaimer obrigatório (§7.1) e vai pro histórico.

## 5. Documentos (upload e armazenamento)

- PDF enviado ao Gemini via **multimodal inline** (sem OCR próprio).
- Arquivo original guardado no **Supabase Storage com RLS**, vinculado ao caso/cliente.
- Resultado da IA + metadados gravados nas tabelas (nunca só na tela).

## 6. Entidades do painel (CRUD completo — DoD item 3)

Toda entidade listada tem botão "+ Novo" com modal funcional:

1. **Clientes** (nome, contato, CPF/CNPJ opcional)
2. **Casos/Processos** (cliente, número do processo opcional, área, status)
3. **Documentos** (vinculados a caso, com link pro Storage)
4. **Prazos** — agenda com destaque visual para prazos vencendo em **≤5 dias**
   (`PRAZO_ALERTA_DIAS`) e vencidos
5. **Peças geradas** — histórico dos outputs dos agentes (tipo, caso, data, conteúdo)

*Incorporadas pelo PR #2 (18/Jun/2026) — detalhe funcional em §11:*

6. **Advogados** (nome, OAB, email) — equipe do escritório, com ação "Criar acesso" (§11.2)
7. **Leads** (nome, contato, origem, status, cliente vinculado) — funil de captação (§11.3)
8. **Receitas** (cliente, descrição, valor, tipo `recorrente`/`unica`, data) (§11.3)
9. **Custos** (descrição, valor, tipo `fixo_mensal`/`unico`/`anuncios`, data) (§11.3)
10. **Pré-notas** (cliente, número, descrição do serviço, valor, vencimento, conteúdo) (§11.3)

Tabelas de apoio, sem CRUD próprio no painel (`TABELAS_APOIO`): `advogado_clientes` (vínculo
advogado↔cliente) e `movimentacoes` (andamentos do DataJud — §11.1).

A lista canônica de tabelas vive em `src/schema.ts` (`TABLES`).

## 7. Regras inquebráveis do nicho

1. **Disclaimer obrigatório** em todo output de IA: *"Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória."* Renderizado no painel E embutido em qualquer exportação. Teste que falha se remover.
2. **Proibido o prompt pedir/citar jurisprudência ou julgados específicos** (números de processo, ementas, precedentes nomeados). Alucinação de julgado é risco profissional grave para o advogado. Agente de pesquisa de jurisprudência fica **explicitamente fora da v1**.

   > **Esta regra NÃO proíbe o DataJud (§11.1)** — e a distinção é o ponto todo dela. O que a regra
   > veda é a **IA inventar** um julgado de terceiro que ela "lembra". O DataJud faz o oposto: busca
   > na **API pública oficial do CNJ**, por número CNJ, o **processo do próprio cliente do advogado** —
   > dado factual e verificável, não precedente gerado. Quando o resumo do processo passa pela IA, o
   > prompt reafirma *"não cite jurisprudência"* em cima dos andamentos reais. Regra prática para
   > qualquer feature futura: **fonte oficial consultada por identificador = permitido; precedente
   > produzido pelo modelo = proibido.**
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
- ~~Integração com tribunais/PJe/push de andamentos~~ → **parcialmente incorporado.** A **consulta sob
  demanda** ao DataJud entrou (§11.1). Continuam fora: **push automático** de andamentos (só há
  consulta disparada pelo usuário), peticionamento eletrônico e integração com PJe/e-SAJ.
- Disparo de WhatsApp/email (notificação de prazo) — candidato a v1.1
- Multi-tenancy entre escritórios
- Assinatura eletrônica de documentos

## 11. Extensões incorporadas pelo PR #2 *(18/Jun/2026)*

Três blocos que **não estavam no design de 11/Jun** e entraram junto com o agente §4.6. Documentados
aqui, fora da numeração original, para que as referências cruzadas (§4, §6, §7.2, §10) sigam válidas
no `CLAUDE.md` e no template de PR.

### 11.1 DataJud — consulta processual no CNJ

- **O que é:** consulta à **API pública do CNJ** por número CNJ (20 dígitos) → capa do processo
  (classe, assuntos, órgão julgador, tribunal/grau) + andamentos. **Não é um agente** — não está em
  `AGENTES` nem tem card próprio; é um botão **DataJud** na linha de cada Caso.
- **Rota:** `POST /datajud` (fail-closed como toda rota, §3). Corpo: `numero`, `caso_id`, `salvar`,
  `resumir`.
- `aliasDoNumero` deriva o tribunal a partir do número CNJ (segmento J + TR, Res. 65 do CNJ) e cobre
  justiças estadual, trabalhista, federal, eleitoral e STJ. É **função pura testada**.
- `salvar: true` grava os andamentos em `movimentacoes` (`fonte='datajud'`), substituindo o snapshot
  anterior daquele caso — a leitura é idempotente, não acumula duplicata.
- `resumir: true` passa capa + andamentos pelo **Resumidor (§4.3)**, com o prompt reafirmando
  *"não cite jurisprudência"*. Output com disclaimer (§7.1).
- **Degradação:** CNJ fora do ar → `502 datajud_indisponivel`; processo inexistente → `200
  {existe:false}`. A consulta nunca derruba o painel.
- Chave pública do DataJud, base URL e timeout em constante única (`src/config.ts`), sobrescrevíveis
  por `DATAJUD_API_KEY`.

### 11.2 Equipe do escritório

- Tabela **`advogados`** (nome, OAB, email) + vínculo **`advogado_clientes`** (quais clientes cada
  advogado atende).
- **Criar acesso:** botão na linha do advogado → Edge Function **`criar-acesso`**, que cria o login no
  Supabase Auth com senha temporária e a devolve para o advogado repassar.
- **Segurança (não relaxar):** a função roda com a **service role nativa** da Edge Function — nenhum
  segredo de admin no Worker ou no painel. O `verify_jwt` da plataforma **não basta**, porque a anon
  key é um JWT válido e passaria no gate; por isso a função **valida o chamador no próprio código**
  (token → usuário real; anon key ou token inválido → 401). Isso materializa o §3 para criação de
  usuário.

### 11.3 Financeiro & CRM (Growth)

Camada de gestão do escritório como negócio — não gera output de IA.

- **`leads`** — funil de captação com status `desqualificado` → `recebeu_formulario` →
  `respondeu_formulario` → `reuniao_agendada` → `convertido` (constante `LEAD_STATUS`).
  `POST /leads/:id/converter` promove o lead a **cliente**, preservando o vínculo.
- **`receitas`** (`recorrente` | `unica`) e **`custos`** (`fixo_mensal` | `unico` | `anuncios`).
- **`GET /growth`** — agrega receitas, custos e leads convertidos e devolve os indicadores calculados
  por `calcularGrowth` (função pura).
- **`pre_notas`** — `POST /pre_notas/gerar` monta a pré-nota de serviço (número default
  `PN-<data São Paulo>`, cliente, descrição, valor, vencimento) e persiste conteúdo + metadados.
  **Não é nota fiscal** e não integra com prefeitura — é documento de cobrança interno.
- Vale o §7.4 (LGPD): valor e dado de cliente **nunca em log**, RLS em todas essas tabelas.
