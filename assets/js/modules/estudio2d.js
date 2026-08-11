/* ==========================================================================
   Estúdio em modo plano — usado quando o navegador não abre WebGL
   --------------------------------------------------------------------------
   Mesma interface do motor 3D, mesmos painéis de tecido. Em vez de girar a
   peça no espaço, mostra um painel por vez (frente, costas ou manga) dentro
   da silhueta da modelagem escolhida. Tudo o que importa continua de pé:
   trocar peça, mudar cor, enviar logo, posicionar, girar e escalar a estampa,
   e gerar a imagem.
   ========================================================================== */

import { luminancia } from "./tecido.js";
import { limitar } from "./movimento.js";

const SILHUETA_MANGA = "M22 26 C40 6 60 6 78 26 L70 94 L30 94 Z";

/* como a vista é dita em voz alta (região de status) e como aparece escrita
   embaixo da peça */
const NOME_VISTA = {
  frente: "de frente",
  costas: "de costas",
  "manga-esq": "na manga esquerda",
  "manga-dir": "na manga direita",
};
const ROTULO_VISTA = {
  frente: "frente da peça",
  costas: "costas da peça",
  "manga-esq": "manga esquerda",
  "manga-dir": "manga direita",
};

export function criarEstudio2D({ container, tecido, aoMudarVista }) {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);
  container.dataset.plano = "sim";
  const ctx = canvas.getContext("2d");

  let peca = null;
  let cor = "#1b1d21";
  let vista = "frente";
  let zoom = 1;
  const ordem = ["frente", "costas", "manga-esq", "manga-dir"];
  const vistasDisponiveis = () => ordem.filter((id) => peca?.areas.includes(id));

  /* ------------------------------ medidas ------------------------------ */
  let larg = 1, alt = 1, dpr = 1;

  function medir() {
    const r = container.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    larg = Math.max(1, r.width);
    alt = Math.max(1, r.height);
    canvas.width = Math.round(larg * dpr);
    canvas.height = Math.round(alt * dpr);
    canvas.style.width = `${larg}px`;
    canvas.style.height = `${alt}px`;
    desenhar();
  }

  /** Caixa onde a peça é desenhada, em pixels de CSS.
      Reserva o alto (dica) e o rodapé (barra de câmera) do visor. */
  function caixa() {
    const topo = 104; // o recado do modo plano ocupa o alto do visor
    const barra = container.closest(".visor")?.querySelector(".visor__barra");
    const base = barra ? barra.getBoundingClientRect().height + 14 : 74;
    const util = Math.max(80, alt - topo - base);
    const escala = Math.min(larg / 100, util / 104) * 0.92 * zoom;
    const l = 100 * escala;
    const a = 104 * escala;
    return { x: (larg - l) / 2, y: topo + (util - a) / 2, l, a, escala };
  }

  /* ------------------------------ desenho ------------------------------ */
  function desenhar() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, larg, alt);
    if (!peca) return;

    const { x, y, l, a, escala } = caixa();
    const daManga = vista.startsWith("manga");
    const risco = daManga ? SILHUETA_MANGA : peca.risco;
    // o primeiro subcaminho é a silhueta; os outros são detalhes (carcela,
    // recortes) e servem só para o traço, nunca para o recorte
    const forma = new Path2D(risco.split(/(?=\sM)/)[0]);
    const detalhes = new Path2D(risco);
    const painel = tecido.canvas(vista);

    // prancha clara atrás da peça: sem 3D, a silhueta precisa de contraste
    const prancha = ctx.createLinearGradient(0, y - a * 0.08, 0, y + a * 1.08);
    prancha.addColorStop(0, "rgba(232,234,235,0.09)");
    prancha.addColorStop(1, "rgba(232,234,235,0.03)");
    ctx.fillStyle = prancha;
    ctx.fillRect(x - l * 0.12, y - a * 0.08, l * 1.24, a * 1.16);

    // sombra de contato
    const sombra = ctx.createRadialGradient(larg / 2, y + a * 0.99, 4, larg / 2, y + a * 0.99, l * 0.5);
    sombra.addColorStop(0, "rgba(0,0,0,0.5)");
    sombra.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sombra;
    ctx.fillRect(0, y + a * 0.86, larg, a * 0.24);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    ctx.clip(forma);

    // o painel de tecido preenche a silhueta
    ctx.fillStyle = cor;
    ctx.fillRect(0, 0, 100, 104);
    if (painel) {
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(painel, 0, 0, painel.width, painel.height, 0, 0, 100, 104);
    }
    ctx.restore();

    // contorno e costura, na linguagem do molde
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(escala, escala);
    ctx.lineWidth = 1 / escala * 1.4;
    ctx.strokeStyle = luminancia(cor) > 0.55 ? "rgba(0,0,0,0.45)" : "rgba(232,234,235,0.5)";
    ctx.stroke(detalhes);
    ctx.setLineDash([3 / escala * 1.6, 3 / escala * 1.6]);
    ctx.lineWidth = 1 / escala;
    ctx.strokeStyle = "rgba(255,74,30,0.75)";
    ctx.stroke(forma);
    ctx.restore();

    // etiqueta da vista
    ctx.font = `500 ${11}px "Space Mono", monospace`;
    ctx.fillStyle = "rgba(143,150,156,0.9)";
    ctx.textAlign = "center";
    ctx.fillText((ROTULO_VISTA[vista] || vista).toUpperCase(), larg / 2, y + a + 22);
  }

  /* ---------------------- arrastar a estampa (plano) -------------------- */
  let arraste = null;

  function paraUV(e) {
    const r = canvas.getBoundingClientRect();
    const { x, y, l, a } = caixa();
    const u = (e.clientX - r.left - x) / l;
    const vTopo = (e.clientY - r.top - y) / a;
    return { u, vTopo, v: 1 - vTopo };
  }

  canvas.addEventListener("pointerdown", (e) => {
    const { u, vTopo, v } = paraUV(e);
    if (u < 0 || u > 1 || vTopo < 0 || vTopo > 1) return;
    const camada = tecido.acertar(vista, u, v);
    if (!camada) return;
    tecido.selecionarEstampa(vista, camada.id);
    const t = tecido.transform(vista);
    arraste = { offX: t.x - u, offY: t.y - vTopo };
    canvas.setPointerCapture?.(e.pointerId);
    container.dataset.arrastando = "sim";
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!arraste) return;
    const { u, vTopo } = paraUV(e);
    tecido.setTransform(vista, { x: u + arraste.offX, y: vTopo + arraste.offY });
  });

  const soltar = (e) => {
    arraste = null;
    delete container.dataset.arrastando;
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener("pointerup", soltar);
  canvas.addEventListener("pointercancel", soltar);

  container.addEventListener("keydown", (e) => {
    const mapa = {
      ArrowLeft: () => girar(-1),
      ArrowRight: () => girar(1),
      "+": () => aproximar(0.9),
      "=": () => aproximar(0.9),
      "-": () => aproximar(1.1),
      Home: () => reiniciar(),
    };
    if (mapa[e.key]) { e.preventDefault(); mapa[e.key](); }
  });

  tecido.aoAtualizar(() => desenhar());
  const observador = new ResizeObserver(medir);
  observador.observe(container);

  /* ------------------------------- ações -------------------------------- */
  function setVista(nova) {
    if (!vistasDisponiveis().includes(nova)) return;
    vista = nova;
    desenhar();
    aoMudarVista?.({ face: NOME_VISTA[vista], zoom: 1 / zoom });
  }

  function girar(dir = 1) {
    const vistas = vistasDisponiveis();
    const i = vistas.indexOf(vista);
    setVista(vistas[(i + (dir > 0 ? 1 : vistas.length - 1)) % vistas.length]);
  }

  function aproximar(fator) {
    zoom = limitar(zoom / fator, 0.7, 2.4);
    desenhar();
  }

  function reiniciar() {
    zoom = 1;
    setVista("frente");
  }

  return {
    tipo: "plano",
    setPeca(p) {
      peca = p;
      if (!vistasDisponiveis().includes(vista)) vista = vistasDisponiveis()[0] || "frente";
      desenhar();
    },
    setCor(hex) { cor = hex; desenhar(); },
    setVista,
    girar: (d) => girar(d > 0 ? 1 : -1),
    aproximar,
    verFrente: () => setVista("frente"),
    verCostas: () => setVista("costas"),
    verMangaEsq: () => setVista("manga-esq"),
    verMangaDir: () => setVista("manga-dir"),
    reiniciar,
    medir,
    capturar() {
      const alvo = document.createElement("canvas");
      alvo.width = canvas.width;
      alvo.height = canvas.height;
      const c = alvo.getContext("2d");
      c.fillStyle = "#111216";
      c.fillRect(0, 0, alvo.width, alvo.height);
      c.drawImage(canvas, 0, 0);
      return alvo.toDataURL("image/png");
    },
    capturarVistas() {
      const anterior = vista;
      const nomes = {
        frente: "Frente",
        costas: "Costas",
        "manga-esq": "Manga esquerda",
        "manga-dir": "Manga direita",
      };
      const saidas = ["frente", "costas", "manga-esq", "manga-dir"]
        .filter((area) => vistasDisponiveis().includes(area))
        .map((area) => {
          vista = area;
          desenhar();
          const alvo = document.createElement("canvas");
          alvo.width = canvas.width;
          alvo.height = canvas.height;
          const c = alvo.getContext("2d");
          c.fillStyle = "#111216";
          c.fillRect(0, 0, alvo.width, alvo.height);
          c.drawImage(canvas, 0, 0);
          return { id: area, nome: nomes[area], url: alvo.toDataURL("image/png") };
        });
      vista = anterior;
      desenhar();
      return saidas;
    },
    destruir() {
      observador.disconnect();
      canvas.remove();
      delete container.dataset.plano;
    },
  };
}
