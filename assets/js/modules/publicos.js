/* ==========================================================================
   Para quem — faixa de categorias
   No desktop a seção fica fixa e o scroll percorre os públicos: cada um troca
   a fotografia, o índice e o tom da seção. As abas são um tablist de verdade
   (setas do teclado funcionam) e clicar numa aba leva o scroll ao ponto
   correspondente — estado e rolagem nunca ficam fora de sincronia.
   No celular vira uma faixa de abas rolável, sem prender o scroll.
   ========================================================================== */

import { PUBLICOS } from "../dados.js";
import { aoRolar, limitar, semMovimento } from "./movimento.js";

export function ligarPublicos() {
  const secao = document.getElementById("para-quem");
  if (!secao) return;

  const trilho = secao.querySelector("[data-trilho]");
  const listaAbas = secao.querySelector("[data-abas]");
  const painel = secao.querySelector("[data-painel]");
  const caixaImagens = secao.querySelector("[data-imagens]");
  const elIndice = secao.querySelector("[data-indice]");
  const elTitulo = secao.querySelector("[data-titulo]");
  const elDescricao = secao.querySelector("[data-descricao]");
  const elPecas = secao.querySelector("[data-pecas]");
  const dica = secao.querySelector("[data-dica]");

  const grande = () => window.matchMedia("(min-width: 941px)").matches;
  secao.style.setProperty("--curso-publicos", `${PUBLICOS.length * 42}vh`);
  let ativo = -1;
  let travaScroll = false;

  /* -------------------------- monta as abas -------------------------- */
  const abas = PUBLICOS.map((p, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "aba";
    b.id = `aba-${p.id}`;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", "false");
    b.setAttribute("aria-controls", "painel-publico");
    b.tabIndex = -1;
    b.innerHTML = `<span class="aba__indice" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
                   <span class="aba__nome">${p.nome}</span>`;
    b.addEventListener("click", () => escolher(i, { rolar: true }));
    listaAbas.appendChild(b);
    return b;
  });

  painel.id = "painel-publico";
  painel.setAttribute("role", "tabpanel");

  /* ------------------------ monta as imagens ------------------------ */
  const imagens = PUBLICOS.map((p, i) => {
    const { base, larguras, alt } = p.imagem;
    const srcset = larguras.map((w) => `assets/img/${base}-${w}.webp ${w}w`).join(", ");
    const pic = document.createElement("picture");
    pic.innerHTML = `
      <source type="image/webp" srcset="${srcset}" sizes="(max-width: 940px) 92vw, 34vw">
      <img src="assets/img/${base}-${larguras[0]}.webp" alt="${alt}"
           width="${larguras[0]}" height="${Math.round(larguras[0] * 1.25)}"
           loading="${i === 0 ? "eager" : "lazy"}" decoding="async">`;
    caixaImagens.appendChild(pic);
    return pic;
  });

  /* ---------------------------- troca ------------------------------- */
  function escolher(i, { rolar = false, foco = false } = {}) {
    i = limitar(i, 0, PUBLICOS.length - 1);
    if (i === ativo) {
      if (rolar) irPara(i);
      return;
    }
    ativo = i;
    const p = PUBLICOS[i];

    abas.forEach((b, j) => {
      const sel = j === i;
      b.setAttribute("aria-selected", sel ? "true" : "false");
      b.tabIndex = sel ? 0 : -1;
    });
    imagens.forEach((pic, j) => {
      if (j === i) pic.dataset.ativa = "sim";
      else delete pic.dataset.ativa;
    });

    elIndice.textContent = String(i + 1).padStart(2, "0");
    elTitulo.textContent = p.titulo;
    elDescricao.textContent = p.descricao;
    elPecas.innerHTML = p.pecas.map((n) => `<li>${n}</li>`).join("");
    secao.style.setProperty("--tom-cat", p.tom);
    painel.setAttribute("aria-labelledby", `aba-${p.id}`);

    if (foco) abas[i].focus({ preventScroll: true });
    if (rolar) irPara(i);
  }

  /* --------------- rolagem <-> aba ativa (desktop) ------------------ */
  function metricas() {
    // posição no documento (offsetTop seria relativo à seção, não à página)
    const topo = trilho.getBoundingClientRect().top + window.scrollY;
    const curso = trilho.offsetHeight - window.innerHeight;
    return { topo, curso: Math.max(1, curso) };
  }

  function irPara(i) {
    if (!grande()) return;
    const { topo, curso } = metricas();
    const passo = curso / PUBLICOS.length;
    travaScroll = true;
    window.scrollTo({
      top: topo + passo * (i + 0.5),
      behavior: semMovimento() ? "auto" : "smooth",
    });
    setTimeout(() => { travaScroll = false; }, semMovimento() ? 40 : 700);
  }

  aoRolar(({ y }) => {
    if (!grande() || travaScroll) return;
    const { topo, curso } = metricas();
    const p = limitar((y - topo) / curso, 0, 0.9999);
    escolher(Math.floor(p * PUBLICOS.length));
  });

  /* ------------------------- teclado nas abas ----------------------- */
  listaAbas.addEventListener("keydown", (e) => {
    const mapa = {
      ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1,
    };
    if (e.key in mapa) {
      e.preventDefault();
      escolher(ativo + mapa[e.key], { rolar: true, foco: true });
    } else if (e.key === "Home") {
      e.preventDefault(); escolher(0, { rolar: true, foco: true });
    } else if (e.key === "End") {
      e.preventDefault(); escolher(PUBLICOS.length - 1, { rolar: true, foco: true });
    }
  });

  /* ------------------------- ajustes de tela ------------------------ */
  function ajustarDica() {
    if (!dica) return;
    dica.hidden = !grande();
  }
  window.addEventListener("resize", ajustarDica);
  ajustarDica();

  escolher(0);
}
