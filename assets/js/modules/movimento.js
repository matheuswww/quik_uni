/* ==========================================================================
   Movimento — utilidades compartilhadas
   Um único listener de scroll e um único laço de rAF para toda a página.
   Nada anima fora da tela; nada anima se o visitante pediu menos movimento.
   ========================================================================== */

const consultaMovimento = window.matchMedia("(prefers-reduced-motion: reduce)");
export const semMovimento = () => consultaMovimento.matches;
export const toque = () => window.matchMedia("(hover: none)").matches;

export function aoMudarMovimento(cb) {
  consultaMovimento.addEventListener("change", () => cb(consultaMovimento.matches));
}

export const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
export const misturar = (a, b, t) => a + (b - a) * t;
export const mapear = (v, a, b, c, d) => c + ((limitar(v, a, b) - a) / (b - a)) * (d - c);
export const suavizar = (a, b, v) => {
  const t = limitar((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/* ------------------------------ scroll ---------------------------------- */

const ouvintesScroll = new Set();
let agendado = false;

function despachar() {
  agendado = false;
  const y = window.scrollY;
  const alturaTela = window.innerHeight;
  const total = document.documentElement.scrollHeight - alturaTela;
  const progresso = total > 0 ? limitar(y / total, 0, 1) : 0;
  for (const cb of ouvintesScroll) cb({ y, progresso, alturaTela });
}

function agendar() {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(despachar);
}

export function aoRolar(cb, { imediato = true } = {}) {
  ouvintesScroll.add(cb);
  if (ouvintesScroll.size === 1) {
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar, { passive: true });
  }
  if (imediato) agendar();
  return () => ouvintesScroll.delete(cb);
}

/* --------------------------- laço de animação ---------------------------- */
/* Quem precisa de quadros contínuos (amortecimento do 3D, paralaxe do
   cursor) se inscreve aqui. O laço para sozinho quando ninguém precisa. */

const tarefas = new Set();
let rodando = false;

function laco(t) {
  for (const tarefa of tarefas) tarefa(t);
  if (tarefas.size) requestAnimationFrame(laco);
  else rodando = false;
}

export function aoQuadro(cb) {
  tarefas.add(cb);
  if (!rodando) {
    rodando = true;
    requestAnimationFrame(laco);
  }
  return () => tarefas.delete(cb);
}

/* ------------------------- entrada na viewport --------------------------- */

export function aoEntrar(alvos, cb, { margem = "0px 0px -12% 0px", limiar = 0.15, umaVez = true } = {}) {
  const lista = alvos instanceof Element ? [alvos] : Array.from(alvos);
  if (!lista.length) return () => {};

  if (!("IntersectionObserver" in window)) {
    lista.forEach((el) => cb(el, true));
    return () => {};
  }

  const obs = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      cb(e.target, e.isIntersecting, e);
      if (e.isIntersecting && umaVez) obs.unobserve(e.target);
    }
  }, { rootMargin: margem, threshold: limiar });

  lista.forEach((el) => obs.observe(el));
  return () => obs.disconnect();
}

/* ----------------------------- revelações -------------------------------- */

export function ligarRevelacoes(raiz = document) {
  const alvos = raiz.querySelectorAll("[data-reveal], [data-revela-grupo]");
  aoEntrar(alvos, (el, dentro) => {
    if (dentro) el.dataset.visivel = "sim";
  });
}

/* --------------------------- botões magnéticos --------------------------- */
/* Deslocamento máximo de 4px: dá vida ao botão sem tirá-lo de baixo do dedo
   nem do cursor. Desligado no toque e com movimento reduzido. */

export function ligarMagneticos(raiz = document) {
  if (semMovimento() || toque()) return;
  const botoes = raiz.querySelectorAll("[data-magnetico]");

  botoes.forEach((botao) => {
    let dentro = false;

    botao.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = botao.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      dentro = true;
      botao.style.transform = `translate(${limitar(dx * 4, -4, 4)}px, ${limitar(dy * 3, -3, 3)}px)`;
    });

    const soltar = () => {
      if (!dentro) return;
      dentro = false;
      botao.style.transform = "";
    };
    botao.addEventListener("pointerleave", soltar);
    botao.addEventListener("blur", soltar);
  });
}

/* -------------------------------- outros --------------------------------- */

export function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Anuncia algo para leitores de tela sem mexer no layout. */
export function anunciar(el, texto) {
  if (!el) return;
  el.textContent = "";
  requestAnimationFrame(() => { el.textContent = texto; });
}
