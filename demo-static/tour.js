// DEMO (CD Tech): auto-login (sem tela de senha) + balões explicativos por seção,
// em linguagem simples pra leigos. Não toca em app.js — usa os mesmos elementos.

(function () {
  const TOUR = {
    agentes: { title: "Agentes de IA", text: "Os 5 assistentes do escritório. Cada um faz uma tarefa pesada em minutos: analisar contrato, gerar petição, resumir processo, calcular prazo e triar um caso novo. Clique num card para testar." },
    clientes: { title: "Clientes", text: "A lista de clientes do escritório. É daqui que os assistentes sabem quem é quem nos casos e nas cobranças." },
    advogados: { title: "Equipe", text: "Os advogados do escritório. Dá para vincular cada um aos seus clientes e até criar um login de acesso para o colega." },
    casos: { title: "Casos / Processos", text: "Os casos e processos do escritório, com a área do direito e a situação de cada um. O botão DataJud consulta o andamento no tribunal." },
    documentos: { title: "Documentos", text: "Os arquivos de cada caso (petições, contratos, provas). No produto, é a partir desses PDFs que o assistente faz a análise." },
    prazos: { title: "Agenda de Prazos", text: "Os prazos com a data fatal de cada um. Vermelho = já venceu, amarelo = vence nos próximos dias. O assistente calcula tudo em dias úteis para nada passar batido." },
    pecas_geradas: { title: "Peças Geradas", text: "Tudo que os assistentes já produziram (análises, petições, resumos) fica salvo aqui para consultar e copiar quando precisar." },
    roteiros: { title: "Roteiros Gerados", text: "Roteiros de conteúdo (Reels e carrosséis) que o assistente cria para o escritório aparecer nas redes e atrair novos clientes." },
    growth: { title: "Financeiro", text: "O dinheiro do escritório num lugar só: receita que se repete todo mês (MRR), custos, anúncios e quanto custa conquistar cada cliente. Dá para gerar pré-nota de cobrança." },
    crm: { title: "CRM — funil de clientes", text: "Cada possível cliente (lead) e em que etapa ele está: recebeu o formulário, agendou reunião, virou cliente. Um clique converte o lead em cliente." },
  };

  function init() {
    const content = document.querySelector("main.content");
    if (!content) return;

    const balloon = document.createElement("div");
    balloon.className = "tour-balloon";
    balloon.style.display = "none";
    balloon.innerHTML =
      '<button class="tour-balloon__close" aria-label="Fechar">&times;</button>' +
      '<div class="tour-balloon__title"></div><div class="tour-balloon__text"></div>';
    content.insertBefore(balloon, content.firstChild);
    const elTitle = balloon.querySelector(".tour-balloon__title");
    const elText = balloon.querySelector(".tour-balloon__text");

    function show(view) {
      const info = TOUR[view];
      if (!info) { balloon.style.display = "none"; return; }
      elTitle.textContent = info.title;
      elText.textContent = info.text;
      balloon.style.display = "block";
      balloon.classList.remove("tour-balloon--in");
      void balloon.offsetWidth;
      balloon.classList.add("tour-balloon--in");
    }
    balloon.querySelector(".tour-balloon__close").addEventListener("click", () => { balloon.style.display = "none"; });
    document.querySelectorAll(".navpill").forEach((b) => b.addEventListener("click", () => show(b.dataset.view)));

    // Auto-login da demo (sem tela de senha) + abre o balão da seção inicial.
    if (window.ZX && window.ZX.DEMO) {
      const f = document.getElementById("login-form");
      const lv = document.getElementById("login-view");
      if (f && lv && !lv.classList.contains("hidden")) {
        document.getElementById("login-email").value = "demo@escritorio.adv.br";
        document.getElementById("login-senha").value = "demo";
        if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", { cancelable: true }));
      }
      setTimeout(() => show("agentes"), 450);
    }
  }

  if (document.readyState !== "loading") init();
  else document.addEventListener("DOMContentLoaded", init);
})();
