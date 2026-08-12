/* ==========================================================================
   Introdução — a logo é costurada
   O monograma vetorizado da própria logo entra como uma linha de pontos que
   avança pela agulha. Curta (≈1,4 s), interrompível, e só na primeira visita
   da sessão. Nunca espera recurso não essencial: se algo demorar, a página
   abre de qualquer jeito.
   ========================================================================== */

import { semMovimento, esperar } from "./movimento.js";
import { QUIK_CONFIG } from "../config.js";

const CHAVE = "quik:intro-vista";
const MARCA = "assets/brand/qk-mark.svg";
const LIMITE = 2600; // trava de segurança: nunca prender mais que isso

function introJaVista() {
  try {
    return sessionStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function guardarIntroVista() {
  try {
    sessionStorage.setItem(CHAVE, "1");
  } catch {
    /* armazenamento indisponível não pode prender nem quebrar a página */
  }
}

export async function iniciarIntro() {
  const preloader = document.getElementById("preloader");
  const corpo = document.body;
  // páginas sem introdução (o estúdio, por exemplo) já entram prontas
  if (!preloader) {
    corpo.dataset.preload = "off";
    document.documentElement.classList.add("pronto");
    corpo.classList.add("pronto");
    window.dispatchEvent(new CustomEvent("quik:intro-fim"));
    return;
  }

  const jaViu = introJaVista();
  const umaVez = QUIK_CONFIG.opcoes?.introUmaVezPorSessao !== false;

  if ((umaVez && jaViu) || semMovimento()) {
    encerrar(preloader, corpo, true);
    return;
  }

  const relogio = setTimeout(() => encerrar(preloader, corpo), LIMITE);
  document.getElementById("pular-intro")?.addEventListener("click", () => {
    clearTimeout(relogio);
    encerrar(preloader, corpo);
  }, { once: true });

  try {
    await costurar(preloader);
  } catch {
    /* se a marca não carregar, a introdução simplesmente termina */
  }
  clearTimeout(relogio);
  encerrar(preloader, corpo);
}

/* Monta o SVG da introdução a partir do arquivo da marca e desenha os
   pontos progressivamente, usando uma máscara que avança pelo traçado. */
async function costurar(preloader) {
  const svg = preloader.querySelector(".preloader__marca");
  const grupoPontos = preloader.querySelector(".preloader__pontos");
  const grupoCheio = preloader.querySelector(".preloader__cheio");

  const texto = await fetch(MARCA).then((r) => r.text());
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  const origem = doc.querySelector("svg");
  const caminhos = Array.from(doc.querySelectorAll("path")).map((p) => p.getAttribute("d"));
  if (!caminhos.length) throw new Error("marca sem traçado");

  svg.setAttribute("viewBox", origem.getAttribute("viewBox"));

  // máscara: um traço grosso que cresce ao longo do mesmo caminho
  const ns = "http://www.w3.org/2000/svg";
  const defs = document.createElementNS(ns, "defs");
  const mascara = document.createElementNS(ns, "mask");
  mascara.setAttribute("id", "intro-revela");
  mascara.setAttribute("maskUnits", "userSpaceOnUse");
  defs.appendChild(mascara);
  svg.prepend(defs);

  const reveladores = [];
  caminhos.forEach((d) => {
    const contorno = document.createElementNS(ns, "path");
    contorno.setAttribute("d", d);
    grupoPontos.appendChild(contorno);

    const cheio = document.createElementNS(ns, "path");
    cheio.setAttribute("d", d);
    grupoCheio.appendChild(cheio);

    const revelador = document.createElementNS(ns, "path");
    revelador.setAttribute("d", d);
    revelador.setAttribute("fill", "none");
    revelador.setAttribute("stroke", "#fff");
    revelador.setAttribute("stroke-width", "26");
    revelador.setAttribute("stroke-linecap", "round");
    mascara.appendChild(revelador);
    reveladores.push(revelador);
  });

  grupoPontos.setAttribute("mask", "url(#intro-revela)");

  // cada traçado é percorrido em sequência, como a agulha faria
  const duracaoTotal = 1150;
  const comprimentos = reveladores.map((p) => p.getTotalLength());
  const soma = comprimentos.reduce((a, b) => a + b, 0);
  let atraso = 0;
  const animacoes = [];

  reveladores.forEach((p, i) => {
    const L = comprimentos[i];
    const dur = Math.max(220, (L / soma) * duracaoTotal);
    p.style.strokeDasharray = `${L}`;
    p.style.strokeDashoffset = `${L}`;
    animacoes.push(p.animate(
      { strokeDashoffset: [L, 0] },
      { duration: dur, delay: atraso, easing: "cubic-bezier(.5,.05,.5,.95)", fill: "forwards" },
    ));
    atraso += dur * 0.72;
  });

  await Promise.all(animacoes.map((a) => a.finished.catch(() => {})));
  preloader.classList.add("costurado");
  await esperar(260);
}

function encerrar(preloader, corpo, imediato = false) {
  if (corpo.dataset.preload === "pronto" || corpo.dataset.preload === "off") return;
  guardarIntroVista();

  if (imediato) {
    corpo.dataset.preload = "off";
  } else {
    corpo.dataset.preload = "pronto";
    setTimeout(() => { preloader.hidden = true; }, 1200);
  }
  // libera as animações de entrada da primeira tela
  document.documentElement.classList.add("pronto");
  document.body.classList.add("pronto");
  window.dispatchEvent(new CustomEvent("quik:intro-fim"));
}
