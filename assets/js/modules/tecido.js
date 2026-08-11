/* ==========================================================================
   Tecido — os painéis da peça em canvas
   --------------------------------------------------------------------------
   Cada área da peça (frente, costas, manga esquerda, manga direita) é um
   canvas: cor de base, trama da malha, recortes da modelagem e a estampa
   posicionada. Esses canvas são a textura do modelo 3D e também o que o modo
   plano desenha — assim o que você vê é sempre o mesmo dado, uma só verdade.
   ========================================================================== */

const MEDIDAS = {
  frente: { w: 1024, h: 1280 },
  costas: { w: 1024, h: 1280 },
  "manga-esq": { w: 640, h: 640 },
  "manga-dir": { w: 640, h: 640 },
};

const PADRAO_INICIAL = { x: 0.5, y: 0.5, escala: 0.4, rotacao: 0 };
const PADRAO_MANGA = { x: 0.5, y: 0.5, escala: 0.18, rotacao: 0 };
const BASE_TECIDO = "#d9dadd";

/**
 * Limite superior do painel no intervalo horizontal ocupado pela arte.
 * Replica a curva usada pela geometria 3D: o decote é profundo no centro e
 * desaparece ao chegar aos ombros. Nas costas, ele tem 42% da profundidade.
 */
function limiteDaGola(forma, area, inicioX, fimX) {
  if (!forma?.gola || (area !== "frente" && area !== "costas")) return 0;
  const { gola, altura } = forma;
  const largura = Math.max(0.001, gola.largura || 0);
  const pontoMaisCentral = Math.min(fimX, Math.max(inicioX, 0.5));
  const distancia = Math.abs(pontoMaisCentral - 0.5) / largura;
  const recorte = distancia >= 1
    ? 0
    : Math.cos((Math.PI / 2) * distancia) ** 1.4;
  const profundidade = gola.profundidade * (area === "frente" ? 1 : 0.42);
  const folgaCostura = Math.max(0.006, ((gola.raio || 0) / (altura || 1)) * 0.45);
  return profundidade * recorte + folgaCostura;
}

/* ---------------------- trama da malha (compartilhada) ------------------- */

let tramaCache = null;
function trama() {
  if (tramaCache) return tramaCache;
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const x = c.getContext("2d");
  x.fillStyle = "rgba(255,255,255,0.055)";
  for (let i = 0; i < 16; i += 4) {
    x.fillRect(i, i % 8, 2, 2);
    x.fillRect(i + 2, (i + 4) % 8 + 8, 2, 2);
  }
  x.fillStyle = "rgba(0,0,0,0.07)";
  for (let i = 0; i < 16; i += 4) {
    x.fillRect(i + 1, (i % 8) + 2, 1, 1);
    x.fillRect(i + 3, ((i + 4) % 8) + 10, 1, 1);
  }
  tramaCache = c;
  return c;
}

/** Relevo da malha, usado como bumpMap no 3D. */
export function relevoMalha() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#808080";
  x.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 4) {
    for (let i = 0; i < 256; i += 4) {
      const claro = ((i / 4 + y / 4) % 2) === 0;
      x.fillStyle = claro ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)";
      x.fillRect(i, y, 2, 2);
    }
  }
  return c;
}

/* --------------------------------- cor ---------------------------------- */

function paraRGB(cor) {
  const rgb = String(cor).match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) {
    return {
      r: Math.round(Number(rgb[1])),
      g: Math.round(Number(rgb[2])),
      b: Math.round(Number(rgb[3])),
    };
  }

  const s = String(cor).replace("#", "");
  const n = parseInt(s.length === 3 ? s.split("").map((c) => c + c).join("") : s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function luminancia(hex) {
  const { r, g, b } = paraRGB(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function mistura(hex, alvo, t) {
  const a = paraRGB(hex);
  const b = paraRGB(alvo);
  const m = (k) => Math.round(a[k] + (b[k] - a[k]) * t);
  return `rgb(${m("r")}, ${m("g")}, ${m("b")})`;
}

/* ================================ Tecido ================================= */

export class Tecido {
  constructor(areas = Object.keys(MEDIDAS)) {
    this.areas = areas;
    this.cor = "#1b1d21";
    this.opacidadeCor = 1;
    this.peca = "camiseta";
    this.forma = null;
    this.proximoId = 1;
    this.ouvintes = new Set();
    this.paineis = new Map();

    for (const area of areas) {
      const { w, h } = MEDIDAS[area];
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      this.paineis.set(area, {
        canvas,
        ctx: canvas.getContext("2d", { alpha: false }),
        estampas: [],
        ativaId: null,
      });
    }
    this.redesenharTudo();
  }

  /* ------------------------------ eventos ------------------------------ */
  aoAtualizar(cb) {
    this.ouvintes.add(cb);
    return () => this.ouvintes.delete(cb);
  }

  avisar(area, tipo = "desenho") {
    for (const cb of this.ouvintes) cb(area, tipo);
  }

  /* ------------------------------ estado ------------------------------- */
  setCor(hex, opacidade = this.opacidadeCor) {
    this.cor = hex;
    this.opacidadeCor = Math.min(1, Math.max(0, opacidade));
    this.redesenharTudo();
  }

  corFinal() {
    return mistura(BASE_TECIDO, this.cor, this.opacidadeCor);
  }

  setPeca(peca) {
    this.peca = typeof peca === "string" ? peca : peca.id;
    this.forma = typeof peca === "object" ? peca.forma : null;
    for (const [area, painel] of this.paineis) {
      for (const camada of painel.estampas) this.limitarTransform(area, camada);
    }
    this.redesenharTudo();
  }

  /** Dimensões compensadas pela proporção física de cada painel. */
  dimensoesEstampa(area, camada) {
    const { w, h } = MEDIDAS[area];
    const larg = camada.transform.escala * w;
    let alt = larg * (camada.imagem.height / camada.imagem.width);
    if (area.startsWith("manga") && this.forma?.manga) {
      const { manga, largura, altura } = this.forma;
      const t = Math.min(1, Math.max(0, camada.transform.y));
      const progresso = t * t * (3 - 2 * t);
      const raio = (manga.raio + (manga.punho - manga.raio) * progresso) * largura;
      const circunferencia = Math.PI * 2 * raio;
      const comprimento = manga.comprimento * altura * 0.62;
      // O canvas é quadrado, mas a superfície real não: esta compensação
      // pré-distorce a textura para que um círculo volte a ser círculo no 3D.
      alt *= (circunferencia / comprimento) * (h / w);
    }
    return { larg, alt };
  }

  /** Proporção física do painel aberto, usada pela prancheta de edição. */
  proporcaoPainel(area) {
    const { w, h } = MEDIDAS[area];
    if (!area.startsWith("manga") || !this.forma?.manga) return w / h;
    const { manga, largura, altura } = this.forma;
    const raioMedio = ((manga.raio + manga.punho) / 2) * largura;
    const circunferencia = Math.PI * 2 * raioMedio;
    const comprimento = manga.comprimento * altura * 0.62;
    return circunferencia / comprimento;
  }

  adicionarEstampa(area, imagem, nomeArquivo, opcoes = {}) {
    const p = this.paineis.get(area);
    if (!p) return null;
    const padrao = area.startsWith("manga") ? PADRAO_MANGA : PADRAO_INICIAL;
    const id = opcoes.id || `arte-${this.proximoId++}`;
    const camada = {
      id,
      imagem,
      nomeArquivo: nomeArquivo ?? "arte",
      arquivo: opcoes.arquivo || null,
      transform: { ...padrao, ...(opcoes.transform || {}) },
    };
    const numeroId = Number(String(id).match(/^arte-(\d+)$/)?.[1]);
    if (Number.isFinite(numeroId)) this.proximoId = Math.max(this.proximoId, numeroId + 1);
    p.estampas.push(camada);
    p.ativaId = camada.id;
    this.setTransform(area, {});
    return camada.id;
  }

  /* Mantido como alias para integrações que usavam o nome antigo. */
  setEstampa(area, imagem, nomeArquivo) {
    return this.adicionarEstampa(area, imagem, nomeArquivo);
  }

  listarEstampas(area) {
    const p = this.paineis.get(area);
    if (!p) return [];
    return p.estampas.map(({ id, nomeArquivo }) => ({
      id,
      nomeArquivo,
      ativa: id === p.ativaId,
    }));
  }

  estampaAtiva(area) {
    const p = this.paineis.get(area);
    return p?.estampas.find((camada) => camada.id === p.ativaId) || null;
  }

  selecionarEstampa(area, id) {
    const p = this.paineis.get(area);
    if (!p?.estampas.some((camada) => camada.id === id) || p.ativaId === id) return false;
    p.ativaId = id;
    this.avisar(area, "selecao");
    return true;
  }

  removerEstampa(area, id = null) {
    const p = this.paineis.get(area);
    if (!p) return;
    const alvo = id || p.ativaId;
    const indice = p.estampas.findIndex((camada) => camada.id === alvo);
    if (indice < 0) return;
    const eraAtiva = p.ativaId === alvo;
    p.estampas.splice(indice, 1);
    if (eraAtiva) {
      p.ativaId = p.estampas[Math.min(indice, p.estampas.length - 1)]?.id || null;
    }
    this.desenhar(area);
  }

  /** Estado leve e clonável, pronto para ser gravado no banco do navegador. */
  estadoPersistivel() {
    return {
      areas: Object.fromEntries([...this.paineis].map(([id, painel]) => [id, {
        ativaId: painel.ativaId,
        estampas: painel.estampas
          .filter((camada) => camada.arquivo instanceof Blob)
          .map((camada) => ({
            id: camada.id,
            nomeArquivo: camada.nomeArquivo,
            arquivo: camada.arquivo,
            transform: { ...camada.transform },
          })),
      }])),
    };
  }

  limparEstampas() {
    for (const painel of this.paineis.values()) {
      for (const camada of painel.estampas) camada.imagem.close?.();
      painel.estampas = [];
      painel.ativaId = null;
    }
    this.proximoId = 1;
    this.redesenharTudo();
  }

  temEstampa(area) {
    return Boolean(this.paineis.get(area)?.estampas.length);
  }

  transform(area) {
    return this.estampaAtiva(area)?.transform;
  }

  setTransform(area, parcial) {
    const camada = this.estampaAtiva(area);
    if (!camada) return;
    Object.assign(camada.transform, parcial);
    this.limitarTransform(area, camada);
    this.desenhar(area);
  }

  limitarTransform(area, camada) {
    camada.transform.escala = Math.min(1, Math.max(0.01, camada.transform.escala));
    const { w, h } = MEDIDAS[area];
    const corpo = area === "frente" || area === "costas";
    const angulo = (camada.transform.rotacao * Math.PI) / 180;
    const cos = Math.abs(Math.cos(angulo));
    const sin = Math.abs(Math.sin(angulo));

    if (corpo) {
      // O painel plano ocupa de 16% a 84% da largura. Tamanho e rotação
      // entram no cálculo para nenhuma ponta da arte alcançar as laterais.
      const aspecto = camada.imagem.height / camada.imagem.width;
      const escalaMaxima = 0.68 / Math.max(0.001, cos + aspecto * sin);
      camada.transform.escala = Math.min(camada.transform.escala, escalaMaxima);
    }

    const { larg, alt } = this.dimensoesEstampa(area, camada);
    const alcanceX = (cos * larg + sin * alt) / (2 * w);
    const alcanceY = (sin * larg + cos * alt) / (2 * h);
    if (corpo) {
      const minimoX = 0.16 + alcanceX;
      const maximoX = 0.84 - alcanceX;
      camada.transform.x = minimoX <= maximoX
        ? Math.min(maximoX, Math.max(minimoX, camada.transform.x))
        : 0.5;
    } else {
      camada.transform.x = Math.min(1.15, Math.max(-0.15, camada.transform.x));
    }
    // A borda superior acompanha o decote real da peça. A trava antiga usava
    // 14% fixos e deixava uma faixa vazia grande demais abaixo da gola.
    const limiteSuperior = corpo
      ? limiteDaGola(
        this.forma,
        area,
        camada.transform.x - alcanceX,
        camada.transform.x + alcanceX,
      )
      : -0.15;
    const topoSeguro = corpo
      ? limiteSuperior + alcanceY
      : -0.15;
    camada.transform.y = Math.min(1.15, Math.max(topoSeguro, camada.transform.y));
  }

  canvas(area) {
    return this.paineis.get(area)?.canvas;
  }

  nomeArquivo(area) {
    return this.estampaAtiva(area)?.nomeArquivo || null;
  }

  /** Retângulo da estampa em fração do painel — usado pela prancheta. */
  caixaEstampa(area) {
    const camada = this.estampaAtiva(area);
    if (!camada) return null;
    const { w, h } = MEDIDAS[area];
    const { larg, alt } = this.dimensoesEstampa(area, camada);
    return {
      x: camada.transform.x, y: camada.transform.y,
      largura: larg / w, altura: alt / h,
      rotacao: camada.transform.rotacao,
    };
  }

  /** Devolve a arte no topo tocada nesta coordenada de textura (u,v de 0 a 1). */
  acertar(area, u, v) {
    const p = this.paineis.get(area);
    if (!p?.estampas.length) return null;
    const { w, h } = MEDIDAS[area];
    const px = u * w;
    const py = (1 - v) * h; // v vem do 3D com origem embaixo
    for (let i = p.estampas.length - 1; i >= 0; i--) {
      const camada = p.estampas[i];
      const { transform: t } = camada;
      const { larg, alt } = this.dimensoesEstampa(area, camada);
      const a = (-t.rotacao * Math.PI) / 180;
      const dx = px - t.x * w;
      const dy = py - t.y * h;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      const folga = 1.12;
      if (Math.abs(lx) <= (larg / 2) * folga && Math.abs(ly) <= (alt / 2) * folga) {
        return camada;
      }
    }
    return null;
  }

  acertou(area, u, v) {
    return Boolean(this.acertar(area, u, v));
  }

  /* ----------------------------- desenho ------------------------------- */
  redesenharTudo() {
    for (const area of this.areas) this.desenhar(area);
  }

  desenhar(area) {
    const p = this.paineis.get(area);
    if (!p) return;
    const { ctx, canvas } = p;
    const { width: w, height: h } = canvas;
    const corFinal = this.corFinal();
    const claro = luminancia(corFinal) > 0.55;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // 1. cor de base
    ctx.fillStyle = corFinal;
    ctx.fillRect(0, 0, w, h);

    // 2. trama da malha
    ctx.globalCompositeOperation = claro ? "multiply" : "overlay";
    ctx.globalAlpha = claro ? 0.5 : 0.85;
    const pat = ctx.createPattern(trama(), "repeat");
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // 3. recortes e acabamentos da modelagem
    this.acabamentos(ctx, area, w, h, claro);

    // 4. estampa
    for (const camada of p.estampas) {
      const { imagem, transform: t } = camada;
      const { larg, alt } = this.dimensoesEstampa(area, camada);
      ctx.save();
      ctx.translate(t.x * w, t.y * h);
      ctx.rotate((t.rotacao * Math.PI) / 180);
      ctx.drawImage(imagem, -larg / 2, -alt / 2, larg, alt);
      ctx.restore();
    }

    // 5. sombra da modelagem: laterais e vinco do ombro
    const lados = ctx.createLinearGradient(0, 0, w, 0);
    lados.addColorStop(0, "rgba(0,0,0,0.42)");
    lados.addColorStop(0.14, "rgba(0,0,0,0.05)");
    lados.addColorStop(0.5, "rgba(0,0,0,0)");
    lados.addColorStop(0.86, "rgba(0,0,0,0.05)");
    lados.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = lados;
    ctx.fillRect(0, 0, w, h);

    if (!area.startsWith("manga")) {
      const ombro = ctx.createLinearGradient(0, 0, 0, h * 0.2);
      ombro.addColorStop(0, "rgba(0,0,0,0.34)");
      ombro.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ombro;
      ctx.fillRect(0, 0, w, h * 0.2);
    }
    ctx.globalCompositeOperation = "source-over";

    this.avisar(area);
  }

  /** Barra, ribana e os recortes que diferenciam cada modelagem. */
  acabamentos(ctx, area, w, h, claro) {
    const corFinal = this.corFinal();
    const escuro = mistura(corFinal, "#000000", claro ? 0.16 : 0.34);
    const realce = mistura(corFinal, claro ? "#000000" : "#ffffff", 0.14);

    if (area.startsWith("manga")) {
      // punho
      ctx.fillStyle = escuro;
      ctx.fillRect(0, h * 0.88, w, h * 0.12);
      ctx.strokeStyle = realce;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.88);
      ctx.lineTo(w, h * 0.88);
      ctx.stroke();
      return;
    }

    // barra da peça
    ctx.fillStyle = escuro;
    ctx.fillRect(0, h * 0.955, w, h * 0.045);

    // costura da barra: pontilhado, como na peça
    ctx.strokeStyle = realce;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.945);
    ctx.lineTo(w, h * 0.945);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.peca === "polo" && area === "frente") {
      // carcela: dois vincos e os botões
      const cx = w / 2;
      const topo = h * 0.02;
      const base = h * 0.2;
      ctx.strokeStyle = mistura(corFinal, "#000000", 0.4);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.035, topo); ctx.lineTo(cx - w * 0.035, base);
      ctx.moveTo(cx + w * 0.035, topo); ctx.lineTo(cx + w * 0.035, base);
      ctx.stroke();
      ctx.fillStyle = mistura(corFinal, "#ffffff", claro ? 0.0 : 0.22);
      [0.07, 0.15].forEach((f) => {
        ctx.beginPath();
        ctx.arc(cx, h * f, w * 0.012, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }
}

export { MEDIDAS };
