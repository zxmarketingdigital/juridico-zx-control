/* ════════════════════════════════════════════════════════════════════════
   Marca do aluno — loader mínimo (CSS custom properties, sem sistema de temas).
   Lê window.ZX_MARCA (gerado por `node setup/marca.mjs` em painel/marca.config.js,
   gitignored) e aplica em runtime: cor da marca, logo e nome do escritório.
   Sem config (ou campo inválido), nada muda: valem os defaults de style.css.

   UM VALOR, UM LUGAR: as regras de validação/derivação de cor vivem AQUI e são
   reutilizadas por setup/marca.mjs (carrega este mesmo arquivo) — não duplique.

   Contrato (SPEC marca-aluno): nome (obrigatório) · cor_primaria (#RRGGBB, aceita
   #RGB) · cor_secundaria (opcional) · logo (opcional: caminho relativo a painel/
   copiado pelo setup, ou URL https).
   ════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var COR_PADRAO = "#D97706";           // âmbar ZX (fallback com aviso no setup)
  var ESCURO = "#0D0D0D";               // texto sobre a cor da marca / fundo base
  var BRANCO = "#FFFFFF";
  var LOGO_LOCAL = /^[A-Za-z0-9_][A-Za-z0-9_./-]*\.(png|jpe?g|svg|webp)$/i;
  var LOGO_URL = /^https:\/\/[^\s"'<>()]+$/i;
  var NOME_MAX = 60;

  // ── cor ────────────────────────────────────────────────────────────────
  // Aceita #RGB / #RRGGBB (com ou sem '#'); devolve "#RRGGBB" maiúsculo ou null.
  function normalizarHex(v) {
    if (typeof v !== "string") return null;
    var s = v.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(s)) s = s.split("").map(function (c) { return c + c; }).join("");
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return "#" + s.toUpperCase();
  }
  function rgb(hex) {
    return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  }
  function hex(r) {
    return "#" + r.map(function (n) {
      var x = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return x.length < 2 ? "0" + x : x;
    }).join("").toUpperCase();
  }
  // mistura `a` com `b` em proporção t (0 = a, 1 = b)
  function misturar(a, b, t) {
    var x = rgb(a), y = rgb(b);
    return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
  }
  function luminancia(h) {
    var c = rgb(h).map(function (n) {
      n = n / 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contraste(a, b) {
    var la = luminancia(a), lb = luminancia(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  // Cor de texto sobre botão/selo da marca: a de maior contraste (escuro ou branco).
  function corSobre(fundo) {
    return contraste(fundo, ESCURO) >= contraste(fundo, BRANCO) ? ESCURO : BRANCO;
  }
  // Cor da marca usada COMO TEXTO sobre o fundo escuro: clareia até contraste >= 4.5.
  function corTexto(h) {
    var out = h, i = 0;
    while (contraste(out, ESCURO) < 4.5 && i < 20) { out = misturar(out, BRANCO, 0.12); i++; }
    return out;
  }

  // Deriva o conjunto de variáveis CSS a partir da primária (e secundária opcional).
  function derivar(primaria, secundaria) {
    var texto = corTexto(primaria);
    var claro = misturar(texto, BRANCO, 0.18);
    var brilho = misturar(texto, BRANCO, 0.5);
    var brand2 = secundaria || misturar(primaria, "#000000", 0.4);
    return {
      "--brand": primaria,
      "--brand-2": brand2,
      "--brand-rgb": rgb(primaria).join(", "),
      "--brand-light-rgb": rgb(claro).join(", "),
      "--brand-bright-rgb": rgb(brilho).join(", "),
      "--brand-text": texto,
      "--on-brand": corSobre(primaria),
      "--on-brand-hover": corSobre(claro),
      "--primary": primaria,
      "--primary-light": claro,
      "--primary-bright": brilho,
      "--primary-dark": brand2
    };
  }

  // ── validação do contrato ──────────────────────────────────────────────
  // Devolve { ok, erros[], marca, avisos[] }. `marca` já normalizada.
  function validar(entrada) {
    var e = entrada || {}, erros = [], avisos = [];
    var nome = typeof e.nome === "string" ? e.nome.replace(/\s+/g, " ").trim() : "";
    if (!nome) erros.push("nome: obrigatório");
    else if (nome.length > NOME_MAX) erros.push("nome: máximo de " + NOME_MAX + " caracteres");

    var cor = COR_PADRAO, usouPadrao = false;
    if (e.cor_primaria == null || String(e.cor_primaria).trim() === "") {
      usouPadrao = true;
      avisos.push("Usando a cor padrão ZX (âmbar). Troque depois em painel/marca.config.js.");
    } else {
      cor = normalizarHex(e.cor_primaria);
      if (!cor) { erros.push("cor_primaria: use o formato #RRGGBB (ex.: #1E3A8A)"); cor = COR_PADRAO; }
    }

    var sec = null;
    if (e.cor_secundaria != null && String(e.cor_secundaria).trim() !== "") {
      sec = normalizarHex(e.cor_secundaria);
      if (!sec) erros.push("cor_secundaria: use o formato #RRGGBB (ou deixe em branco)");
    }

    var logo = null;
    if (e.logo != null && String(e.logo).trim() !== "") {
      var l = String(e.logo).trim();
      if (LOGO_URL.test(l) || (LOGO_LOCAL.test(l) && l.indexOf("..") === -1)) logo = l;
      else erros.push("logo: use caminho de imagem (png/jpg/svg/webp) ou URL https");
    }

    return {
      ok: erros.length === 0,
      erros: erros,
      avisos: avisos,
      usouPadrao: usouPadrao,
      marca: { nome: nome, cor_primaria: cor, cor_secundaria: sec, logo: logo }
    };
  }

  // ── aplicação no DOM (só no browser) ───────────────────────────────────
  function resolverLogo(logo, base) {
    if (LOGO_URL.test(logo)) return logo;
    try { return new URL(logo, base || (root.location && root.location.href)).href; } catch (_) { return null; }
  }

  function aplicar(entrada, doc, base) {
    var r = validar(entrada);
    // Campo inválido nunca quebra a página: aplica o que for válido, ignora o resto.
    var m = r.marca;
    var vars = derivar(m.cor_primaria, m.cor_secundaria);
    var el = doc.documentElement;
    Object.keys(vars).forEach(function (k) { el.style.setProperty(k, vars[k]); });
    if (!m.nome) return r;
    Array.prototype.forEach.call(doc.querySelectorAll("[data-marca='nome']"), function (n) { n.textContent = m.nome; });
    Array.prototype.forEach.call(doc.querySelectorAll("[data-marca='nome-sep']"), function (n) { n.textContent = " · " + m.nome; });
    Array.prototype.forEach.call(doc.querySelectorAll("title[data-marca-title]"), function (t) {
      t.textContent = t.getAttribute("data-marca-title").replace("{nome}", m.nome);
    });
    if (m.logo) {
      var src = resolverLogo(m.logo, base);
      if (src) {
        Array.prototype.forEach.call(doc.querySelectorAll("[data-marca-logo]"), function (box) {
          var img = doc.createElement("img");
          img.alt = m.nome;
          img.onerror = function () { box.hidden = true; box.textContent = ""; };
          img.src = src;
          box.textContent = "";
          box.appendChild(img);
          box.hidden = false;
        });
      }
    }
    return r;
  }

  var api = {
    COR_PADRAO: COR_PADRAO, normalizarHex: normalizarHex, derivar: derivar, corSobre: corSobre,
    corTexto: corTexto, contraste: contraste, validar: validar, aplicar: aplicar
  };
  root.ZXMarca = api;

  // Auto-aplica no browser quando há config. A base do logo é a pasta deste script.
  if (root.document && root.ZX_MARCA) {
    var cs = root.document.currentScript;
    var base = cs && cs.src ? cs.src : undefined;
    var rodar = function () { aplicar(root.ZX_MARCA, root.document, base); };
    // cores no <html> imediatamente (evita flash); textos/logo quando o DOM existir
    var r0 = validar(root.ZX_MARCA);
    var v0 = derivar(r0.marca.cor_primaria, r0.marca.cor_secundaria);
    Object.keys(v0).forEach(function (k) { root.document.documentElement.style.setProperty(k, v0[k]); });
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", rodar);
    else rodar();
  }
})(typeof window !== "undefined" ? window : globalThis);
