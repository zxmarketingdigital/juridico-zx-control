// ════════════════════════════════════════════════════════════════════════
// Dados fictícios da DEMO local (sem banco, sem credencial). Nicho jurídico,
// pt-BR realista. ≥10 registros por entidade principal (DoD N4). Datas
// relativas a "agora" pra agenda exibir vencido/vencendo/futuro.
// ════════════════════════════════════════════════════════════════════════

const hoje = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const ahead = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return iso(d); };
const ago = (n) => ahead(-n);

export const clientes = [
  { id: "cli-1", nome: "Construtora Horizonte Ltda.", contato: "(11) 3221-4400", cpf_cnpj: "12.345.678/0001-90", created_at: ago(120) },
  { id: "cli-2", nome: "Maria Aparecida de Souza", contato: "maria.souza@gmail.com", cpf_cnpj: "321.654.987-00", created_at: ago(98) },
  { id: "cli-3", nome: "Tech Nordeste Comércio S.A.", contato: "(81) 99812-3344", cpf_cnpj: "98.765.432/0001-10", created_at: ago(87) },
  { id: "cli-4", nome: "João Batista Ferreira", contato: "(31) 98777-1212", cpf_cnpj: "147.258.369-11", created_at: ago(76) },
  { id: "cli-5", nome: "Padaria Pão Quente ME", contato: "contato@paoquente.com.br", cpf_cnpj: "11.222.333/0001-44", created_at: ago(60) },
  { id: "cli-6", nome: "Rita de Cássia Almeida", contato: "(21) 99654-7788", cpf_cnpj: "258.369.147-22", created_at: ago(52) },
  { id: "cli-7", nome: "Transportes Veloz EIRELI", contato: "financeiro@veloz.log", cpf_cnpj: "44.555.666/0001-77", created_at: ago(40) },
  { id: "cli-8", nome: "Carlos Eduardo Lima", contato: "(41) 98123-4567", cpf_cnpj: "369.147.258-33", created_at: ago(33) },
  { id: "cli-9", nome: "Clínica Vida Plena Ltda.", contato: "(62) 3333-2211", cpf_cnpj: "55.666.777/0001-88", created_at: ago(25) },
  { id: "cli-10", nome: "Fernanda Oliveira Castro", contato: "fernanda.castro@outlook.com", cpf_cnpj: "741.852.963-44", created_at: ago(14) },
  { id: "cli-11", nome: "Mercado Bom Preço Ltda.", contato: "(85) 3098-7766", cpf_cnpj: "66.777.888/0001-99", created_at: ago(7) },
];

export const casos = [
  { id: "cas-1", cliente_id: "cli-2", numero_processo: "1001234-56.2025.8.26.0100", area: "trabalhista", status: "ativo", created_at: ago(95) },
  { id: "cas-2", cliente_id: "cli-1", numero_processo: "2002345-67.2025.8.26.0011", area: "civel", status: "ativo", created_at: ago(88) },
  { id: "cas-3", cliente_id: "cli-4", numero_processo: "", area: "familia", status: "novo", created_at: ago(70) },
  { id: "cas-4", cliente_id: "cli-6", numero_processo: "3003456-78.2025.8.19.0001", area: "consumidor", status: "ativo", created_at: ago(64) },
  { id: "cas-5", cliente_id: "cli-3", numero_processo: "4004567-89.2025.5.06.0010", area: "trabalhista", status: "suspenso", created_at: ago(58) },
  { id: "cas-6", cliente_id: "cli-8", numero_processo: "5005678-90.2025.8.16.0185", area: "tributario", status: "ativo", created_at: ago(45) },
  { id: "cas-7", cliente_id: "cli-7", numero_processo: "", area: "empresarial", status: "novo", created_at: ago(38) },
  { id: "cas-8", cliente_id: "cli-9", numero_processo: "6006789-01.2025.8.09.0051", area: "consumidor", status: "encerrado", created_at: ago(30) },
  { id: "cas-9", cliente_id: "cli-10", numero_processo: "7007890-12.2025.8.26.0224", area: "familia", status: "ativo", created_at: ago(22) },
  { id: "cas-10", cliente_id: "cli-5", numero_processo: "8008901-23.2025.5.02.0301", area: "trabalhista", status: "ativo", created_at: ago(12) },
  { id: "cas-11", cliente_id: "cli-11", numero_processo: "", area: "civel", status: "arquivado", created_at: ago(5) },
];

export const documentos = [
  { id: "doc-1", caso_id: "cas-1", nome: "Reclamação trabalhista.pdf", mime: "application/pdf", storage_path: "documentos/cas-1/inicial.pdf", created_at: ago(95) },
  { id: "doc-2", caso_id: "cas-1", nome: "CTPS e holerites.pdf", mime: "application/pdf", storage_path: "documentos/cas-1/ctps.pdf", created_at: ago(94) },
  { id: "doc-3", caso_id: "cas-2", nome: "Contrato de empreitada.pdf", mime: "application/pdf", storage_path: "documentos/cas-2/contrato.pdf", created_at: ago(86) },
  { id: "doc-4", caso_id: "cas-4", nome: "Notas fiscais e protocolo SAC.pdf", mime: "application/pdf", storage_path: "documentos/cas-4/provas.pdf", created_at: ago(63) },
  { id: "doc-5", caso_id: "cas-5", nome: "Acordo coletivo 2024.pdf", mime: "application/pdf", storage_path: "documentos/cas-5/act.pdf", created_at: ago(57) },
  { id: "doc-6", caso_id: "cas-6", nome: "Auto de infração ISS.pdf", mime: "application/pdf", storage_path: "documentos/cas-6/auto.pdf", created_at: ago(44) },
  { id: "doc-7", caso_id: "cas-8", nome: "Sentença de 1º grau.pdf", mime: "application/pdf", storage_path: "documentos/cas-8/sentenca.pdf", created_at: ago(29) },
  { id: "doc-8", caso_id: "cas-9", nome: "Certidão de casamento.pdf", mime: "application/pdf", storage_path: "documentos/cas-9/certidao.pdf", created_at: ago(21) },
  { id: "doc-9", caso_id: "cas-10", nome: "Cartões de ponto.pdf", mime: "application/pdf", storage_path: "documentos/cas-10/ponto.pdf", created_at: ago(11) },
  { id: "doc-10", caso_id: "cas-2", nome: "Laudo pericial de obra.pdf", mime: "application/pdf", storage_path: "documentos/cas-2/laudo.pdf", created_at: ago(9) },
  { id: "doc-11", caso_id: "cas-6", nome: "Impugnação ao auto.pdf", mime: "application/pdf", storage_path: "documentos/cas-6/impugnacao.pdf", created_at: ago(3) },
];

export const prazos = [
  { id: "prz-1", caso_id: "cas-1", tipo: "Contestação", data_publicacao: ago(20), data_fatal: ago(4), dias: 15, status: "vencido", created_at: ago(20) },
  { id: "prz-2", caso_id: "cas-2", tipo: "Réplica", data_publicacao: ago(10), data_fatal: ahead(2), dias: 15, status: "pendente", created_at: ago(10) },
  { id: "prz-3", caso_id: "cas-4", tipo: "Recurso inominado", data_publicacao: ago(5), data_fatal: ahead(4), dias: 10, status: "pendente", created_at: ago(5) },
  { id: "prz-4", caso_id: "cas-5", tipo: "Manifestação sobre documentos", data_publicacao: ago(3), data_fatal: ahead(5), dias: 5, status: "pendente", created_at: ago(3) },
  { id: "prz-5", caso_id: "cas-6", tipo: "Embargos de declaração", data_publicacao: ago(2), data_fatal: ahead(1), dias: 5, status: "pendente", created_at: ago(2) },
  { id: "prz-6", caso_id: "cas-9", tipo: "Alegações finais", data_publicacao: ago(1), data_fatal: ahead(12), dias: 15, status: "pendente", created_at: ago(1) },
  { id: "prz-7", caso_id: "cas-10", tipo: "Contestação", data_publicacao: ago(6), data_fatal: ahead(20), dias: 15, status: "pendente", created_at: ago(6) },
  { id: "prz-8", caso_id: "cas-2", tipo: "Apelação", data_publicacao: ago(40), data_fatal: ago(15), dias: 15, status: "cumprido", created_at: ago(40) },
  { id: "prz-9", caso_id: "cas-1", tipo: "Razões finais", data_publicacao: ago(8), data_fatal: ahead(3), dias: 10, status: "pendente", created_at: ago(8) },
  { id: "prz-10", caso_id: "cas-6", tipo: "Recurso ordinário", data_publicacao: ago(7), data_fatal: ahead(30), dias: 15, status: "pendente", created_at: ago(7) },
  { id: "prz-11", caso_id: "cas-4", tipo: "Cumprimento de sentença", data_publicacao: ago(50), data_fatal: ago(10), dias: 15, status: "cumprido", created_at: ago(50) },
  { id: "prz-12", caso_id: "cas-5", tipo: "Impugnação", data_publicacao: ago(2), data_fatal: ahead(8), dias: 15, status: "pendente", created_at: ago(2) },
];

const DISCLAIMER = "Conteúdo gerado por IA — a revisão pelo advogado responsável é obrigatória.";
const peca = (corpo) => `${corpo}\n\n---\n${DISCLAIMER}`;

export const pecas_geradas = [
  { id: "pec-1", caso_id: "cas-1", agente: "extrator_prazos", tipo: "Contestação", created_at: ago(20), conteudo: peca("**Prazo identificado:** Contestação\n**Contagem:** 15 dias úteis\n**Termo inicial:** primeiro dia útil após a publicação.") },
  { id: "pec-2", caso_id: "cas-2", agente: "analisador_contratos", tipo: "Análise", created_at: ago(86), conteudo: peca("### Riscos\n- Cláusula 7 (multa) desproporcional 🔴\n- Ausência de cláusula de reajuste 🟡\n\n### Sugestões\n- Incluir limite de multa a 10%.") },
  { id: "pec-3", caso_id: "cas-3", agente: "triagem_cliente", tipo: "Triagem", created_at: ago(70), conteudo: peca("**Área:** Família\n**Pedido:** Divórcio consensual\n**Viabilidade:** Forte\n**Documentos:** certidão de casamento, RG, comprovante de residência.") },
  { id: "pec-4", caso_id: "cas-4", agente: "gerador_pecas", tipo: "Recurso inominado", created_at: ago(63), conteudo: peca("EXCELENTÍSSIMO(A) SENHOR(A)...\n\n**DOS FATOS**\nO consumidor adquiriu produto com vício...\n\n**DOS PEDIDOS**\nReforma da sentença.") },
  { id: "pec-5", caso_id: "cas-8", agente: "resumidor_processos", tipo: "Resumo", created_at: ago(30), conteudo: peca("**Resumo:** ação de reparação julgada parcialmente procedente.\n**Linha do tempo:** distribuição → contestação → sentença.\n**Próximos passos:** avaliar apelação.") },
  { id: "pec-6", caso_id: "cas-5", agente: "analisador_contratos", tipo: "Análise", created_at: ago(57), conteudo: peca("### Cláusulas\n- Banco de horas sem limite 🔴\n- Adicional noturno omisso 🟡") },
  { id: "pec-7", caso_id: "cas-6", agente: "gerador_pecas", tipo: "Impugnação", created_at: ago(44), conteudo: peca("**IMPUGNAÇÃO AO AUTO DE INFRAÇÃO**\nDo equívoco na base de cálculo do ISS...") },
  { id: "pec-8", caso_id: "cas-9", agente: "triagem_cliente", tipo: "Triagem", created_at: ago(21), conteudo: peca("**Área:** Família\n**Pedido:** Guarda compartilhada\n**Viabilidade:** Médio.") },
  { id: "pec-9", caso_id: "cas-10", agente: "extrator_prazos", tipo: "Contestação", created_at: ago(6), conteudo: peca("**Prazo:** Contestação — 15 dias úteis a partir do 1º dia útil seguinte à publicação.") },
  { id: "pec-10", caso_id: "cas-2", agente: "resumidor_processos", tipo: "Resumo", created_at: ago(9), conteudo: peca("**Situação atual:** aguardando perícia de engenharia.\n**Próximos passos:** quesitos e assistente técnico.") },
  { id: "pec-11", caso_id: "cas-1", agente: "gerador_pecas", tipo: "Razões finais", created_at: ago(8), conteudo: peca("**RAZÕES FINAIS**\nDa comprovação do vínculo e das horas extras...") },
  { id: "pec-12", caso_id: "cas-4", agente: "analisador_contratos", tipo: "Análise", created_at: ago(2), conteudo: peca("### Riscos\n- Foro de eleição abusivo em contrato de adesão 🔴") },
];
