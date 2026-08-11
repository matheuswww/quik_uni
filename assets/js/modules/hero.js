/* ==========================================================================
   Hero — o molde da frente com a foto dentro
   Interações: amostras de tom recolorem a peça e a linha de costura do
   contorno; o cursor move as camadas em profundidades diferentes e desloca o
   brilho no tecido. No toque, os tons passam sozinhos em ritmo lento.
   ========================================================================== */

import { TONS } from "../dados.js";
import { aoQuadro, aoEntrar, semMovimento, toque, misturar, limitar } from "./movimento.js";

const TONS_HERO = ["breu", "linha", "petroleo", "vinho", "cru"];

export function ligarHero() {
  const hero = document.getElementById("hero");
  if (!hero) return;

  const molde = document.getElementById("hero-molde");
  const camadaCor = document.getElementById("molde-cor");
  const contorno = hero.querySelector(".molde-contorno__linha");
  const lista = hero.querySelector("[data-amostras]");

  const tons = TONS_HERO.map((id) => TONS.find((t) => t.id === id)).filter(Boolean);
  let ativo = 0;

  /* ---------------------------- amostras ---------------------------- */
  const botoes = tons.map((tom, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "amostra";
    b.style.setProperty("--tom", tom.hex);
    b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
    // o nome do tom é a informação; a bolinha é só o atalho visual
    b.setAttribute("aria-label", `Ver o molde em ${tom.nome}`);
    b.addEventListener("click", () => aplicar(i, { manual: true }));
    b.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse") aplicar(i);
    });
    lista?.appendChild(b);
    return b;
  });

  function aplicar(i, { manual = false } = {}) {
    ativo = i;
    const tom = tons[i];
    if (camadaCor) camadaCor.style.setProperty("--tom", tom.hex);
    if (contorno) contorno.style.setProperty("--tom-linha", tom.id === "linha" ? "var(--cromo)" : "var(--linha)");
    botoes.forEach((b, j) => b.setAttribute("aria-pressed", j === i ? "true" : "false"));
    // o tom escolhido aqui é a sugestão inicial do estúdio
    window.dispatchEvent(new CustomEvent("quik:tom-hero", { detail: { tom, manual } }));
    if (manual) pararCiclo();
  }

  aplicar(0);

  /* ------------------- ciclo automático no toque -------------------- */
  let ciclo = null;
  function pararCiclo() {
    if (ciclo) { clearInterval(ciclo); ciclo = null; }
  }
  if (toque() && !semMovimento()) {
    aoEntrar(molde, (_el, dentro) => {
      if (dentro && !ciclo) {
        ciclo = setInterval(() => aplicar((ativo + 1) % tons.length), 2600);
      } else if (!dentro) {
        pararCiclo();
      }
    }, { umaVez: false, limiar: 0.3 });
  }

  /* --------------------- paralaxe pelo cursor ---------------------- */
  if (!semMovimento() && !toque() && molde) {
    const camadas = Array.from(molde.querySelectorAll("[data-profundidade]"));
    const brilho = molde.querySelector(".molde__brilho");
    let alvoX = 0, alvoY = 0, x = 0, y = 0, ativoQuadro = null;

    hero.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = hero.getBoundingClientRect();
      alvoX = limitar((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      alvoY = limitar((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      if (brilho) {
        const rm = molde.getBoundingClientRect();
        brilho.style.setProperty("--mx", `${((e.clientX - rm.left) / rm.width) * 100}%`);
        brilho.style.setProperty("--my", `${((e.clientY - rm.top) / rm.height) * 100}%`);
      }
      if (!ativoQuadro) ativoQuadro = aoQuadro(passo);
    });

    hero.addEventListener("pointerleave", () => { alvoX = 0; alvoY = 0; });

    function passo() {
      x = misturar(x, alvoX, 0.08);
      y = misturar(y, alvoY, 0.08);
      camadas.forEach((c) => {
        const p = parseFloat(c.dataset.profundidade) || 1;
        c.style.transform = `translate3d(${(-x * 10 * p).toFixed(2)}px, ${(-y * 8 * p).toFixed(2)}px, 0)`;
      });
      if (Math.abs(x - alvoX) < 0.001 && Math.abs(y - alvoY) < 0.001) {
        ativoQuadro?.(); ativoQuadro = null;
      }
    }
  }

  /* --------------- faixa rolante: para quando não se vê -------------- */
  const faixa = hero.querySelector("[data-faixa]");
  if (faixa) {
    // duplica o conteúdo para o laço ficar contínuo
    faixa.innerHTML += faixa.innerHTML;
    if (semMovimento()) {
      faixa.dataset.parado = "sim";
    } else {
      aoEntrar(faixa, (el, dentro) => {
        el.dataset.parado = dentro ? "nao" : "sim";
      }, { umaVez: false, limiar: 0 });
      faixa.parentElement.addEventListener("pointerenter", () => { faixa.dataset.parado = "sim"; });
      faixa.parentElement.addEventListener("pointerleave", () => { faixa.dataset.parado = "nao"; });
    }
  }
}
