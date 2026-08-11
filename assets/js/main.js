/* ==========================================================================
   Quik Uniformes — ponto de partida
   --------------------------------------------------------------------------
   Liga os módulos na ordem em que a página é vivida: a introdução costurada,
   o cabeçalho, o hero, as seções e o estúdio. Nada aqui depende de framework;
   o que precisa de 3D é carregado só quando a pessoa chega perto do estúdio.
   ========================================================================== */

import { iniciarIntro } from "./modules/preloader.js";
import { ligarCabecalho } from "./modules/cabecalho.js";
import { ligarHero } from "./modules/hero.js";
import { ligarBagagem } from "./modules/bagagem.js";
import { ligarPublicos } from "./modules/publicos.js";
import { ligarProcesso } from "./modules/processo.js";
import { ligarEstudio } from "./modules/estudio.js";
import { ligarRevelacoes, ligarMagneticos } from "./modules/movimento.js";
import { QUIK_CONFIG } from "./config.js";

const CFG = QUIK_CONFIG;

const ICONES_SOCIAIS = {
  whatsapp: `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.075-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.226 1.36.194 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.9 6.988c-.003 5.45-4.437 9.884-9.882 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
    </svg>`,
  instagram: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/>
    </svg>`,
};

function ligarIconesSociais() {
  document.querySelectorAll("[data-icone-social]").forEach((alvo) => {
    const nome = alvo.dataset.iconeSocial;
    if (!ICONES_SOCIAIS[nome] || alvo.querySelector(".icone-social")) return;
    const icone = document.createElement("span");
    icone.className = `icone-social icone-social--${nome}`;
    icone.setAttribute("aria-hidden", "true");
    icone.innerHTML = ICONES_SOCIAIS[nome];
    alvo.prepend(icone);
  });
}

/* ------------------------------- rodapé ---------------------------------- */

/* Só publica no rodapé os canais que existem de verdade em config.js. */
function ligarCanais() {
  const bloco = document.querySelector("[data-canais]");
  if (!bloco) return;

  const c = CFG.contato || {};
  const itens = [];

  if (c.whatsapp) {
    const numero = String(c.whatsapp).replace(/\D/g, "");
    itens.push({
      href: `https://wa.me/${numero}`,
      texto: c.whatsappVisivel ? `WhatsApp ${c.whatsappVisivel}` : "Falar no WhatsApp",
      externo: true,
      icone: "whatsapp",
    });
  }
  if (c.email) itens.push({ href: `mailto:${c.email}`, texto: c.email });
  if (c.instagram) {
    const arroba = c.instagram.replace("@", "");
    itens.push({ href: `https://instagram.com/${arroba}`, texto: `@${arroba}`, externo: true, icone: "instagram" });
  }

  if (!itens.length && !c.endereco) return;

  const vazio = bloco.querySelector("[data-canais-vazio]");
  if (vazio) vazio.hidden = true;

  const lista = document.createElement("ul");
  lista.className = "rodape__canais";
  for (const item of itens) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.href;
    a.textContent = item.texto;
    if (item.icone) a.dataset.iconeSocial = item.icone;
    if (item.externo) { a.target = "_blank"; a.rel = "noopener"; }
    li.append(a);
    lista.append(li);
  }
  if (itens.length) bloco.append(lista);

  if (c.endereco) {
    const p = document.createElement("p");
    p.className = "rodape__endereco";
    p.textContent = c.endereco;
    bloco.append(p);
  }
}

/* Recado de obra para quem for publicar o site — no console, nunca na tela. */
function avisarConfig() {
  const c = CFG.contato || {};
  const faltando = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
  if (!faltando.length) return;
  console.info(
    "%cQuik Uniformes","font-weight:bold",
    `\nCanais ainda não publicados: ${faltando.join(", ")}.` +
    "\nPreencha assets/js/config.js — eles aparecem sozinhos no rodapé."
  );
}

/* --------------------------------- ano ----------------------------------- */
function ligarAno() {
  const alvo = document.querySelector("[data-ano]");
  if (alvo) alvo.textContent = String(new Date().getFullYear());
}

/* -------------------------------- partida -------------------------------- */

function ligarTudo() {
  ligarAno();
  ligarCanais();
  ligarIconesSociais();
  ligarCabecalho();
  ligarHero();
  ligarBagagem();
  ligarPublicos();
  ligarProcesso();
  ligarRevelacoes();
  ligarMagneticos();

  ligarEstudio();

  avisarConfig();
}

/* A intro roda em paralelo: a página já está montada por baixo dela. */
iniciarIntro();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", ligarTudo, { once: true });
} else {
  ligarTudo();
}
