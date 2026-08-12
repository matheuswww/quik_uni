/* ==========================================================================
   Cabeçalho, menu mobile e a espinha de costura da página
   A barra do topo é uma linha de costura: mede o progresso da leitura.
   A mesma medida move a agulha na calha esquerda.
   ========================================================================== */

import { aoRolar, limitar, semMovimento } from "./movimento.js";

export function ligarCabecalho() {
  const cabecalho = document.getElementById("cabecalho");
  const barra = document.getElementById("progresso-costura");
  const cta = document.querySelector(".cabecalho__cta");
  const espinha = document.querySelector(".espinha");
  const agulha = document.getElementById("espinha-agulha");
  // só os links que apontam para uma seção existente nesta página entram no
  // rastreio — com o estúdio em página própria, há links entre documentos
  const pares = Array.from(document.querySelectorAll("[data-nav]"))
    .map((link) => {
      const href = link.getAttribute("href") || "";
      return { link, secao: /^#.+/.test(href) ? document.querySelector(href) : null };
    })
    .filter((par) => par.secao);
  const links = pares.map((par) => par.link);
  const secoes = pares.map((par) => par.secao);

  let ultimoY = window.scrollY;
  let atual = -1;

  aoRolar(({ y, progresso, alturaTela }) => {
    cabecalho.dataset.rolado = y > 12 ? "sim" : "nao";

    const pct = `${(progresso * 100).toFixed(2)}%`;
    if (barra) barra.style.setProperty("--progresso", pct);
    if (espinha) espinha.style.setProperty("--progresso-espinha", pct);
    if (agulha && !semMovimento()) {
      const delta = limitar((y - ultimoY) * 0.6, -12, 12);
      agulha.style.transform = `rotate(${delta}deg)`;
    }

    // esconde o cabeçalho ao descer no celular, devolve ao subir
    if (window.innerWidth <= 860) {
      const descendo = y > ultimoY && y > 320;
      const aberto = document.getElementById("menu-mobile")?.dataset.aberto === "sim";
      cabecalho.dataset.oculto = descendo && !aberto ? "sim" : "nao";
    } else {
      cabecalho.dataset.oculto = "nao";
    }
    ultimoY = y;

    // seção atual: a última que já passou de um terço da tela
    let indice = -1;
    secoes.forEach((s, i) => {
      if (s.getBoundingClientRect().top <= alturaTela * 0.34) indice = i;
    });
    if (indice !== atual) {
      atual = indice;
      links.forEach((a, i) => {
        if (i === indice) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    }

    // o botão do cabeçalho aponta para o passo seguinte: cada página diz, nos
    // data-atributos do próprio botão, qual é o marco e para onde ir depois dele
    if (cta?.dataset.marco) {
      const marco = document.querySelector(cta.dataset.marco);
      const passou = marco && marco.getBoundingClientRect().bottom < alturaTela * 0.5;
      const alvo = passou ? cta.dataset.depoisHref : cta.dataset.antesHref;
      const texto = passou ? cta.dataset.depoisTexto : cta.dataset.antesTexto;
      if (alvo && cta.getAttribute("href") !== alvo) {
        cta.setAttribute("href", alvo);
        const span = cta.querySelector(".botao__texto");
        if (span) span.textContent = texto;
      }
    }
  });

  ligarMenuMobile();
}

function ligarMenuMobile() {
  const botao = document.getElementById("menu-alternar");
  const menu = document.getElementById("menu-mobile");
  if (!botao || !menu) return;

  const focaveis = () => Array.from(menu.querySelectorAll("a"));

  function abrir() {
    menu.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => { menu.dataset.aberto = "sim"; });
    focaveis()[0]?.focus({ preventScroll: true });
  }

  function fechar({ devolverFoco = true } = {}) {
    menu.dataset.aberto = "nao";
    botao.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    const esconder = () => { menu.hidden = true; };
    if (semMovimento()) esconder();
    else setTimeout(esconder, 300);
    if (devolverFoco) botao.focus({ preventScroll: true });
  }

  botao.addEventListener("click", () => {
    if (botao.getAttribute("aria-expanded") === "true") fechar();
    else abrir();
  });

  menu.addEventListener("click", (e) => {
    if (e.target.closest("a")) fechar({ devolverFoco: false });
  });

  document.addEventListener("keydown", (e) => {
    if (menu.hidden) return;
    if (e.key === "Escape") { fechar(); return; }
    if (e.key !== "Tab") return;
    // mantém o foco dentro do menu enquanto ele está aberto
    const lista = [botao, ...focaveis()];
    const primeiro = lista[0];
    const ultimo = lista[lista.length - 1];
    if (e.shiftKey && document.activeElement === primeiro) {
      e.preventDefault(); ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault(); primeiro.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860 && !menu.hidden) fechar({ devolverFoco: false });
  });
}
