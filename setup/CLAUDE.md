# Instalação guiada — Jurídico ZX Control (você, Claude Code, conduz o aluno)

> Este arquivo é o **roteiro de instalação**. Quando o aluno colar o link do repo no Claude Code e
> pedir o **clone deste repositório**, **você (Claude Code) conduz a instalação conversando** — uma
> credencial de cada vez, explicando onde achar cada uma e validando ao final. **Nunca** rode um
> wizard `.mjs` como caminho principal; o caminho é a conversa. O aluno é leigo: fale simples.

## Como conduzir (regras)

- **Uma coisa de cada vez.** Peça **uma credencial por vez**, espere a resposta, confirme, siga.
- **Explique onde achar** cada valor antes de pedir. Nunca despeje uma lista de variáveis de uma vez.
- **Nunca** peça para o aluno editar arquivo de código na mão se você pode fazer por ele.
- **Não exponha segredo** em log nem no chat depois de configurado.
- Ao final, rode o smoke (`node setup/smoke.mjs`) e confirme que está tudo no ar.

## Antes de começar — contas necessárias (cheque com o aluno, conversando)

Pergunte, uma de cada vez, se o aluno já tem:
1. **Cloudflare** — para publicar a API (Workers) e o painel (Pages).
2. **Supabase** — o banco de dados, login dos advogados e o armazenamento de documentos.
3. **Google AI Studio (Gemini)** — a chave de IA (o "cérebro"). É trocável depois.

Se faltar alguma, oriente a criar (todas têm plano gratuito) antes de seguir.

## Passo a passo (você executa, conduzindo)

### 0. Marca do escritório — nome, cor e logo (pergunte ANTES de instalar qualquer coisa)

O painel, a proposta e a apresentação saem com a **marca do aluno**, não com a da ZX. Pergunte, **um
campo por vez**, e só depois grave:

1. **Nome do escritório** (obrigatório) — ex.: "Silva & Associados". É o nome que aparece no topo do
   painel, no login e na proposta.
2. **Cor principal** (obrigatória) — peça no formato `#RRGGBB` (ex.: `#1E3A8A`); aceite `#RGB` também.
   Se o aluno não souber, ofereça ajudar a escolher pela cor do site ou do logo dele. Se mesmo assim
   não quiser escolher, siga **sem** `--cor`: o painel usa a cor padrão ZX (âmbar) e o script avisa
   isso no terminal. Diga ao aluno que dá para trocar depois rodando o comando de novo.
3. **Cor secundária** (opcional) — mesmo formato. Em branco = o painel usa uma versão mais escura da principal.
4. **Logo** (opcional) — caminho de uma imagem **no computador do aluno** (png, jpg, svg ou webp, até
   2 MB) **ou** uma URL `https`. Sem logo, o painel mostra só o nome. **Nunca** coloque a logo da ZX no lugar.

Depois de ter as respostas, rode (omita as flags que o aluno não preencheu):

```
node setup/marca.mjs --nome "<nome>" --cor "<#RRGGBB>" [--secundaria "<#RRGGBB>"] [--logo "<caminho ou URL https>"]
```

- **Exit 0** = gravado em `painel/marca.config.js` (arquivo do aluno, gitignored — não vai pro GitHub).
- **Exit 1** = algum campo inválido (o script lista qual). **Não grave na mão**: explique o erro em uma
  frase, pergunte aquele campo de novo e rode outra vez.
- Para conferir antes de publicar, rode a demo (`node demo/server.mjs`) e abra o painel: cor, nome e
  logo já devem estar aplicados. O botão fica com texto escuro ou claro automaticamente, conforme a cor.
- Trocar a marca depois = rodar o mesmo comando de novo com os novos valores (e publicar o painel outra vez).

### 1. Supabase — banco + Auth + Storage
- Peça ao aluno para criar um **projeto** no Supabase. Conduza: "Me manda a **URL do projeto**
  (Settings → API → Project URL)." Guarde em `SUPABASE_URL`.
- Em seguida peça a **anon key** (`SUPABASE_ANON_KEY`, em Settings → API) — é pública, pode ser
  colada à vontade. A **service key** é **opcional** (só se for aplicar migrations via CLI; pelo
  SQL Editor não precisa) e, se usada, é secreta — nunca commitar.
- Aplique as migrations de `supabase/migrations/` (cria as tabelas com RLS e o bucket de documentos).
- Confirme que a RLS ficou habilitada em todas as tabelas.

### 2. Gemini — a chave de IA
- Conduza: "Crie uma **API key** no Google AI Studio e me cole aqui." Guarde em `GEMINI_API_KEY`.
- Explique que o provider é trocável depois (uma só configuração em `src/config.ts`).

### 3. Worker (API) — Cloudflare
- Grave os segredos no Worker (`wrangler secret put` para `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`). **Nunca** commite esses valores.
- Publique: `pnpm run deploy`. Confirme que respondeu sem erro.

### 4. Painel (Pages) — Cloudflare
- Crie `painel/config.js` a partir de `painel/config.example.js` com `SUPABASE_URL` e
  `SUPABASE_ANON_KEY` do aluno (esse arquivo é gitignored).
- Confirme que `painel/marca.config.js` existe (passo 0) — ele é publicado junto com o painel.
- Publique a pasta `painel/` no Cloudflare Pages.

### 5. Primeiro advogado
- No Supabase Auth, crie o **primeiro usuário** (e-mail + senha) do escritório. Cada advogado terá
  o próprio login depois.

### 6. Validação final
- Rode `node setup/smoke.mjs` (confere que as variáveis essenciais estão presentes).
- Abra o painel, faça login, rode um agente e confirme que o resultado aparece **com o aviso de
  revisão obrigatória pelo advogado**.

## Para demonstrar sem instalar nada

Se o aluno só quer **mostrar para um cliente**, faça o **passo 0 (Marca)** e rode a demo local — sobe o
painel populado, já com o nome, a cor e a logo dele, sem nenhuma credencial:

```
node demo/server.mjs   →   http://localhost:8910
```
