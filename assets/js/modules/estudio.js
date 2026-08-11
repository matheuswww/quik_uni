/* ==========================================================================
   Estúdio 3D Quik — a mesa de trabalho
   --------------------------------------------------------------------------
   Este módulo é a interface: peça, cor, arquivo, área de aplicação e
   prancheta de posicionamento. Ele mantém um único `Tecido` (a verdade do
   que está desenhado) e entrega esse tecido ao motor de visualização.

   O motor entra em cena só quando a seção chega perto da tela:
   · com WebGL  → estudio3d.js (peça em 3D, gira, aproxima)
   · sem WebGL  → estudio2d.js (mesmos painéis, em modo plano)
   Nenhum controle aparece prometendo algo que o motor não faça.
   ========================================================================== */

import { PECAS, TONS, AREAS } from "../dados.js";
import { Tecido } from "./tecido.js";
import { aoEntrar, anunciar, limitar, toque } from "./movimento.js";
import { QUIK_CONFIG } from "../config.js";

const CFG = QUIK_CONFIG;
const LIMITE_MB = CFG.opcoes?.limiteArquivoMB ?? 8;
const TIPOS = ["image/png", "image/jpeg", "image/svg+xml"];
const LADO_MAX = 2048; // teto de resolução da estampa, para a textura não pesar
const BANCO_ESTUDIO = "quik-estudio-local";
const VERSAO_BANCO = 1;
const COLECAO_PROJETOS = "projetos";
const CHAVE_PROJETO = "atual";

/* IndexedDB guarda os próprios arquivos enviados. Assim várias artes não
   disputam o limite pequeno do localStorage e continuam disponíveis depois
   que a página ou o navegador forem fechados. */
function abrirBancoEstudio() {
  return new Promise((ok, falha) => {
    const pedido = indexedDB.open(BANCO_ESTUDIO, VERSAO_BANCO);
    pedido.onupgradeneeded = () => {
      if (!pedido.result.objectStoreNames.contains(COLECAO_PROJETOS)) {
        pedido.result.createObjectStore(COLECAO_PROJETOS);
      }
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => falha(pedido.error || new Error("banco local indisponível"));
  });
}

async function lerProjetoLocal() {
  const banco = await abrirBancoEstudio();
  try {
    return await new Promise((ok, falha) => {
      const pedido = banco.transaction(COLECAO_PROJETOS, "readonly")
        .objectStore(COLECAO_PROJETOS).get(CHAVE_PROJETO);
      pedido.onsuccess = () => ok(pedido.result || null);
      pedido.onerror = () => falha(pedido.error);
    });
  } finally {
    banco.close();
  }
}

async function gravarProjetoLocal(projeto) {
  const banco = await abrirBancoEstudio();
  try {
    await new Promise((ok, falha) => {
      const transacao = banco.transaction(COLECAO_PROJETOS, "readwrite");
      transacao.objectStore(COLECAO_PROJETOS).put(projeto, CHAVE_PROJETO);
      transacao.oncomplete = () => ok();
      transacao.onerror = () => falha(transacao.error);
      transacao.onabort = () => falha(transacao.error);
    });
  } finally {
    banco.close();
  }
}

async function apagarProjetoLocal() {
  const banco = await abrirBancoEstudio();
  try {
    await new Promise((ok, falha) => {
      const transacao = banco.transaction(COLECAO_PROJETOS, "readwrite");
      transacao.objectStore(COLECAO_PROJETOS).delete(CHAVE_PROJETO);
      transacao.oncomplete = () => ok();
      transacao.onerror = () => falha(transacao.error);
      transacao.onabort = () => falha(transacao.error);
    });
  } finally {
    banco.close();
  }
}

/* --------------------------- suporte a WebGL ----------------------------- */
/* Repetido aqui de propósito: perguntar isso não pode custar o download do
   Three.js. O import do motor 3D só acontece depois desta resposta. */
function suporteWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/* ------------------------------ utilidades ------------------------------- */

function svgEl(pathD, viewBox = "0 0 100 104") {
  return `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false"><path d="${pathD}"/></svg>`;
}

function hexParaRGB(hex) {
  const s = hex.replace("#", "");
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbParaHex({ r, g, b }) {
  const canal = (v) => Math.round(limitar(Number(v) || 0, 0, 255)).toString(16).padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

function baixar(url, nome) {
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function carregarDataURL(url) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = falha;
    img.src = url;
  });
}

/** Reúne as quatro direções em um único PNG, evitando bloqueio de downloads. */
async function montarFolhaDeVistas(vistas) {
  const carregadas = await Promise.all(vistas.map(async (vista) => ({
    ...vista,
    imagem: await carregarDataURL(vista.url),
  })));
  const larguraCelula = Math.max(...carregadas.map((v) => v.imagem.width));
  const alturaImagem = Math.max(...carregadas.map((v) => v.imagem.height));
  const margem = Math.max(24, Math.round(larguraCelula * 0.025));
  const faixa = Math.max(58, Math.round(alturaImagem * 0.065));
  const canvas = document.createElement("canvas");
  canvas.width = larguraCelula * 2 + margem * 3;
  canvas.height = (alturaImagem + faixa) * 2 + margem * 3;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#0d0e11";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  carregadas.forEach((vista, i) => {
    const coluna = i % 2;
    const linha = Math.floor(i / 2);
    const x = margem + coluna * (larguraCelula + margem);
    const y = margem + linha * (alturaImagem + faixa + margem);
    ctx.fillStyle = "#15161a";
    ctx.fillRect(x, y, larguraCelula, alturaImagem + faixa);
    const dx = x + (larguraCelula - vista.imagem.width) / 2;
    const dy = y + (alturaImagem - vista.imagem.height) / 2;
    ctx.drawImage(vista.imagem, dx, dy);
    ctx.fillStyle = "#ff4b26";
    ctx.font = `700 ${Math.max(24, Math.round(faixa * 0.42))}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(vista.nome.toUpperCase(), x + larguraCelula / 2, y + alturaImagem + faixa / 2);
  });
  return canvas.toDataURL("image/png");
}

/** Grupo de rádio acessível: uma parada de tabulação, setas navegam. */
function ligarRadios(container, escolher) {
  container.addEventListener("click", (e) => {
    const b = e.target.closest("[role='radio']");
    if (b && container.contains(b)) escolher(b.dataset.valor, { foco: false });
  });

  container.addEventListener("keydown", (e) => {
    const itens = [...container.querySelectorAll("[role='radio']")];
    const i = itens.indexOf(document.activeElement);
    if (i < 0) return;
    const passo = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (passo) {
      e.preventDefault();
      const alvo = itens[(i + passo + itens.length) % itens.length];
      escolher(alvo.dataset.valor, { foco: true });
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      escolher(itens[e.key === "Home" ? 0 : itens.length - 1].dataset.valor, { foco: true });
    }
  });
}

function marcarRadio(container, valor, { foco = false } = {}) {
  for (const b of container.querySelectorAll("[role='radio']")) {
    const ativo = b.dataset.valor === valor;
    b.setAttribute("aria-checked", ativo ? "true" : "false");
    b.tabIndex = ativo ? 0 : -1;
    if (ativo && foco) b.focus();
  }
}

/** Lê o arquivo e devolve algo desenhável com largura e altura conhecidas. */
async function abrirEstampa(arquivo) {
  if (arquivo.type === "image/svg+xml") return rasterizarSVG(arquivo);

  let img;
  if ("createImageBitmap" in window) {
    try {
      // Respeita explicitamente a orientação EXIF de fotos vindas do celular.
      img = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      img = null;
    }
  }
  if (!img) {
    const url = URL.createObjectURL(arquivo);
    try { img = await carregarImagem(url); }
    finally { URL.revokeObjectURL(url); }
  }

  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (Math.max(w, h) <= LADO_MAX) return img;
  const reduzida = reduzir(img, w, h);
  img.close?.();
  return reduzida;
}

function carregarImagem(url) {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("imagem ilegível"));
    img.src = url;
  });
}

/* SVG entra sem tamanho intrínseco garantido e sem nada executável: lemos o
   texto, tiramos script/foreignObject por higiene, fixamos as medidas a partir
   do viewBox e rasterizamos numa resolução boa para estampa. */
async function rasterizarSVG(arquivo) {
  const texto = await arquivo.text();
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg || doc.querySelector("parsererror")) throw new Error("SVG inválido");
  doc.querySelectorAll("script, foreignObject").forEach((n) => n.remove());

  const vb = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
  let w = parseFloat(svg.getAttribute("width")) || (vb.length === 4 ? vb[2] : 0);
  let h = parseFloat(svg.getAttribute("height")) || (vb.length === 4 ? vb[3] : 0);
  if (!w || !h) { w = 1000; h = 1000; }

  const k = LADO_MAX / Math.max(w, h);
  const lw = Math.max(1, Math.round(w * k));
  const lh = Math.max(1, Math.round(h * k));
  svg.setAttribute("width", lw);
  svg.setAttribute("height", lh);
  if (vb.length !== 4) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const fonte = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([fonte], { type: "image/svg+xml" }));
  try {
    const img = await carregarImagem(url);
    return reduzir(img, lw, lh, 1);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function reduzir(img, w, h, escalaTeto = LADO_MAX) {
  const k = escalaTeto === 1 ? 1 : Math.min(1, LADO_MAX / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* ================================ estúdio ================================ */

export function ligarEstudio() {
  const secao = document.getElementById("estudio");
  if (!secao) return null;

  const q = (sel, raiz = secao) => raiz.querySelector(sel);

  const tela = q("#visor-tela");
  const descricao = q("[data-descricao-3d]");
  const carregando = q("[data-carregando]");
  const semTresD = q("[data-sem-3d]");
  const dica = q("[data-dica-visor]");
  const estado3d = q("[data-estado-estudio]");
  const entrada = q("[data-entrada]");

  const listaPecas = q("[data-pecas-lista]");
  const notaPeca = q("[data-nota-peca]");
  const listaCores = q("[data-cores-lista]");
  const corLivre = q("[data-cor-livre]");
  const nomeCor = q("[data-cor-nome]");
  const entradasRGB = new Map([...secao.querySelectorAll("[data-rgb]")].map((el) => [el.dataset.rgb, el]));
  const opacidadeCor = q("[data-cor-opacidade]");
  const saidaAlpha = q("[data-cor-alpha]");

  const envio = q("[data-envio]");
  const entradaArquivo = q("[data-arquivo]");
  const solta = q("[data-solta]");
  const erroEnvio = q("[data-erro-envio]");

  const blocoAreas = q("[data-areas]");
  const listaAreas = q("[data-areas-lista]");
  const blocoCamadas = q("[data-camadas]");
  const listaCamadas = q("[data-camadas-lista]");

  const prancheta = q("[data-prancheta]");
  const nomeArea = q("[data-area-nome]");
  const palco = q("[data-prancheta-palco]");
  const telaPrancheta = q("[data-prancheta-canvas]");
  const caixa = q("[data-caixa]");
  const alca = q("[data-alca]");
  const centralizarBt = q("[data-centralizar]");
  const capturaBt = q("[data-captura]");
  const resetBt = q("[data-reset-estudio]");
  const estadoSalvo = q("[data-estado-salvo]");
  const dialogoReset = document.querySelector("[data-dialog-reset]");
  const ctrls = new Map([...secao.querySelectorAll("[data-ctrl]")].map((el) => [el.dataset.ctrl, el]));
  const saidas = new Map([...secao.querySelectorAll("[data-saida]")].map((el) => [el.dataset.saida, el]));

  const puxador = q("#painel-puxador");

  const tecido = new Tecido();
  let peca = PECAS[0];
  tecido.setPeca(peca);
  let cor = { ...TONS[0], alpha: 1 };
  let area = "frente";
  let motor = null;
  let pedindoMotor = null;
  let vistaAtual = "de frente";
  let restaurando = true;
  let timerSalvar = null;
  let filaSalvamento = Promise.resolve();
  let avisoFalhaSalvamento = false;

  function mostrarEstadoSalvo(texto, erro = false) {
    if (!estadoSalvo) return;
    estadoSalvo.textContent = texto;
    estadoSalvo.dataset.erro = erro ? "sim" : "nao";
  }

  function estadoAtual() {
    return {
      versao: 1,
      atualizadoEm: Date.now(),
      pecaId: peca.id,
      cor: { ...cor },
      area,
      tecido: tecido.estadoPersistivel(),
    };
  }

  function salvarAgora() {
    if (restaurando) return;
    const projeto = estadoAtual();
    filaSalvamento = filaSalvamento
      .then(() => gravarProjetoLocal(projeto))
      .then(() => {
        avisoFalhaSalvamento = false;
        mostrarEstadoSalvo("Salvo agora neste navegador.");
      })
      .catch(() => {
        mostrarEstadoSalvo("Não foi possível salvar neste navegador.", true);
        if (!avisoFalhaSalvamento) {
          avisoFalhaSalvamento = true;
          anunciar(estado3d, "O navegador não permitiu salvar o projeto localmente.");
        }
      });
  }

  function agendarSalvamento() {
    if (restaurando) return;
    if (timerSalvar) clearTimeout(timerSalvar);
    mostrarEstadoSalvo("Salvando alterações…");
    timerSalvar = setTimeout(() => {
      timerSalvar = null;
      salvarAgora();
    }, 420);
  }

  /* ------------------------------- peças -------------------------------- */
  listaPecas.innerHTML = PECAS.map((p, i) => `
    <button type="button" class="peca" role="radio" data-valor="${p.id}"
            aria-checked="${i === 0 ? "true" : "false"}" tabindex="${i === 0 ? 0 : -1}">
      <span class="peca__risco">${svgEl(p.risco)}</span>
      <span class="peca__nome">${p.nome}</span>
    </button>`).join("");

  ligarRadios(listaPecas, (id, opts) => trocarPeca(id, opts));

  function trocarPeca(id, { foco = false } = {}) {
    const nova = PECAS.find((p) => p.id === id);
    if (!nova || nova.id === peca.id) {
      marcarRadio(listaPecas, id, { foco });
      return;
    }
    peca = nova;
    marcarRadio(listaPecas, id, { foco });
    notaPeca.textContent = peca.nota;
    tecido.setPeca(peca);
    motor?.setPeca(peca);
    montarAreas();
    if (!peca.areas.includes(area)) escolherArea(peca.areas[0]);
    else atualizarEditorArte();
    descrever();
    anunciar(estado3d, `Peça trocada para ${peca.nome}. ${peca.nota}`);
  }

  notaPeca.textContent = peca.nota;

  /* -------------------------------- cores ------------------------------- */
  listaCores.innerHTML = TONS.map((t, i) => `
    <button type="button" class="cor" role="radio" data-valor="${t.id}"
            style="--tom: ${t.hex}" aria-label="${t.nome}"
            aria-checked="${i === 0 ? "true" : "false"}" tabindex="${i === 0 ? 0 : -1}"></button>`).join("");

  ligarRadios(listaCores, (id, opts) => {
    const tom = TONS.find((t) => t.id === id);
    if (tom) aplicarCor(tom, opts);
  });

  let timerCor = null;

  function sincronizarEditorCor() {
    const rgb = hexParaRGB(cor.hex);
    corLivre.value = cor.hex;
    for (const canal of ["r", "g", "b"]) entradasRGB.get(canal).value = rgb[canal];
    opacidadeCor.value = Math.round(cor.alpha * 100);
    saidaAlpha.textContent = `${Math.round(cor.alpha * 100)}%`;
  }

  function aplicarCor(tom, { foco = false, doSeletor = false } = {}) {
    if (!doSeletor && timerCor) {
      clearTimeout(timerCor);
      timerCor = null;
    }
    cor = { ...tom, alpha: tom.alpha ?? 1 };
    marcarRadio(listaCores, doSeletor ? "—" : tom.id, { foco });
    const rgb = hexParaRGB(cor.hex);
    nomeCor.textContent = doSeletor
      ? `RGB ${rgb.r}, ${rgb.g}, ${rgb.b} · ${Math.round(cor.alpha * 100)}%`
      : tom.nome;
    sincronizarEditorCor();
    tecido.setCor(cor.hex, cor.alpha);
    motor?.setCor(tecido.corFinal());
    desenharPrancheta();
    descrever();
    window.dispatchEvent(new CustomEvent("quik:cor-peca", { detail: { hex: tecido.corFinal(), nome: cor.nome } }));
    anunciar(estado3d, `Cor da peça: ${nomeCor.textContent}.`);
  }

  function aplicarEditorCor() {
    timerCor = null;
    const rgb = Object.fromEntries([...entradasRGB].map(([canal, el]) => [canal, limitar(Number(el.value) || 0, 0, 255)]));
    const hex = rgbParaHex(rgb);
    const alpha = limitar(Number(opacidadeCor.value) / 100, 0, 1);
    aplicarCor({ id: "livre", nome: "Tom personalizado", hex, alpha }, { doSeletor: true });
  }

  // Redesenhar e reenviar quatro texturas grandes a cada evento do seletor
  // derrubava o FPS. A interface continua respondendo imediatamente, mas o
  // trabalho pesado é consolidado em no máximo uma atualização a cada 90 ms.
  function agendarEditorCor() {
    saidaAlpha.textContent = `${Math.round(limitar(Number(opacidadeCor.value), 0, 100))}%`;
    if (timerCor) clearTimeout(timerCor);
    timerCor = setTimeout(aplicarEditorCor, 90);
  }

  function finalizarEditorCor() {
    if (timerCor) clearTimeout(timerCor);
    aplicarEditorCor();
  }

  corLivre.addEventListener("input", () => {
    const rgb = hexParaRGB(corLivre.value);
    for (const canal of ["r", "g", "b"]) entradasRGB.get(canal).value = rgb[canal];
    agendarEditorCor();
  });
  corLivre.addEventListener("change", finalizarEditorCor);
  for (const entradaRGB of entradasRGB.values()) {
    entradaRGB.addEventListener("input", agendarEditorCor);
    entradaRGB.addEventListener("change", finalizarEditorCor);
  }
  opacidadeCor.addEventListener("input", agendarEditorCor);
  opacidadeCor.addEventListener("change", finalizarEditorCor);
  sincronizarEditorCor();

  /* -------------------------------- envio ------------------------------- */
  function falharEnvio(msg) {
    erroEnvio.textContent = msg;
    erroEnvio.hidden = false;
    anunciar(estado3d, msg);
  }

  async function receber(arquivo) {
    erroEnvio.hidden = true;
    if (!arquivo) return;

    if (!TIPOS.includes(arquivo.type)) {
      falharEnvio("Esse formato não entra aqui. Envie PNG, JPG ou SVG — e prefira PNG com fundo transparente.");
      return;
    }
    if (arquivo.size > LIMITE_MB * 1024 * 1024) {
      const mb = (arquivo.size / 1024 / 1024).toFixed(1);
      falharEnvio(`O arquivo tem ${mb} MB e o limite aqui é ${LIMITE_MB} MB. Salve numa resolução menor e tente de novo.`);
      return;
    }

    try {
      const imagem = await abrirEstampa(arquivo);
      tecido.adicionarEstampa(area, imagem, arquivo.name, { arquivo });
      envio.dataset.comArquivo = "sim";
      solta.querySelector(".envio__texto strong").textContent = "Adicionar mais artes";
      blocoAreas.hidden = false;
      montarAreas();
      atualizarEditorArte();
      descrever();
      anunciar(estado3d, `${arquivo.name} aplicado ${ondeDe(area)}. Use a prancheta para mover, girar e redimensionar.`);
    } catch {
      falharEnvio("Não consegui abrir esse arquivo. Ele pode estar corrompido ou salvo em outro formato.");
    }
  }

  async function receberArquivos(arquivos) {
    if (!arquivos.length) return;
    envio.dataset.carregando = "sim";
    try {
      for (const arquivo of arquivos) await receber(arquivo);
    } finally {
      delete envio.dataset.carregando;
    }
  }

  entradaArquivo.addEventListener("change", () => {
    receberArquivos([...(entradaArquivo.files || [])]);
    entradaArquivo.value = ""; // permite reenviar o mesmo arquivo
  });

  for (const evt of ["dragenter", "dragover"]) {
    solta.addEventListener(evt, (e) => { e.preventDefault(); solta.dataset.sobre = "sim"; });
  }
  for (const evt of ["dragleave", "dragend", "drop"]) {
    solta.addEventListener(evt, () => delete solta.dataset.sobre);
  }
  solta.addEventListener("drop", (e) => {
    e.preventDefault();
    receberArquivos([...(e.dataTransfer?.files || [])]);
  });

  /* ------------------------------- áreas -------------------------------- */
  function nomeDe(id) {
    return AREAS.find((a) => a.id === id)?.curto || id;
  }

  function ondeDe(id) {
    return AREAS.find((a) => a.id === id)?.onde || `na ${nomeDe(id)}`;
  }

  function origemDe(id) {
    return AREAS.find((a) => a.id === id)?.origem || `da ${nomeDe(id)}`;
  }

  function montarAreas() {
    const disponiveis = AREAS.filter((a) => peca.areas.includes(a.id));
    listaAreas.innerHTML = disponiveis.map((a) => `
      <button type="button" class="area" role="radio" data-valor="${a.id}"
              aria-checked="${a.id === area ? "true" : "false"}" tabindex="${a.id === area ? 0 : -1}"
              data-tem-estampa="${tecido.temEstampa(a.id) ? "sim" : "nao"}">${a.nome}</button>`).join("");
  }

  montarAreas();
  ligarRadios(listaAreas, (id, opts) => escolherArea(id, opts));

  function montarCamadas() {
    const camadas = tecido.listarEstampas(area);
    listaCamadas.replaceChildren();
    camadas.forEach((camada, i) => {
      const linha = document.createElement("div");
      linha.className = "camada";
      if (camada.ativa) linha.dataset.ativa = "sim";
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "camada__arquivo";
      botao.dataset.camada = camada.id;
      botao.setAttribute("aria-pressed", camada.ativa ? "true" : "false");
      const indice = document.createElement("span");
      indice.textContent = String(i + 1).padStart(2, "0");
      const nome = document.createElement("span");
      nome.textContent = camada.nomeArquivo;
      botao.append(indice, nome);
      const excluir = document.createElement("button");
      excluir.type = "button";
      excluir.className = "camada__remover";
      excluir.dataset.removerCamada = camada.id;
      excluir.setAttribute("aria-label", `Remover ${camada.nomeArquivo}`);
      excluir.textContent = "×";
      linha.append(botao, excluir);
      listaCamadas.append(linha);
    });
    blocoCamadas.hidden = !camadas.length;
  }

  function atualizarEditorArte() {
    const temAtiva = Boolean(tecido.estampaAtiva(area));
    montarCamadas();
    configurarPrancheta();
    prancheta.hidden = !temAtiva;
    if (!temAtiva) {
      caixa.hidden = true;
      return;
    }
    sincronizarControles();
    desenharPrancheta();
  }

  listaCamadas.addEventListener("click", (e) => {
    const excluir = e.target.closest("[data-remover-camada]");
    if (excluir) {
      removerCamada(excluir.dataset.removerCamada);
      return;
    }
    const botao = e.target.closest("[data-camada]");
    if (!botao) return;
    tecido.selecionarEstampa(area, botao.dataset.camada);
  });

  function escolherArea(id, { foco = false } = {}) {
    if (!peca.areas.includes(id)) return;
    area = id;
    marcarRadio(listaAreas, id, { foco });
    nomeArea.textContent = nomeDe(id);

    montarAreas();
    atualizarEditorArte();
    descrever();
    const focar = {
      frente: "verFrente",
      costas: "verCostas",
      "manga-esq": "verMangaEsq",
      "manga-dir": "verMangaDir",
    }[id];
    if (focar) {
      if (motor) motor[focar]?.();
      else acordarMotor().then((m) => m?.[focar]?.());
    }
    agendarSalvamento();
  }

  function removerCamada(id) {
    if (!tecido.temEstampa(area)) return;
    tecido.removerEstampa(area, id);
    montarAreas();
    atualizarEditorArte();
    descrever();
    if (!AREAS.some((a) => tecido.temEstampa(a.id))) {
      envio.dataset.comArquivo = "nao";
      solta.querySelector(".envio__texto strong").textContent = "Adicionar artes";
    }
    anunciar(estado3d, `Arte removida ${origemDe(area)}.`);
  }

  centralizarBt.addEventListener("click", () => {
    tecido.setTransform(area, { x: 0.5, y: 0.5, rotacao: 0 });
    sincronizarControles();
    desenharPrancheta();
    anunciar(estado3d, "Estampa centralizada na área.");
  });

  /* ------------------------------ prancheta ----------------------------- */
  const ctxP = telaPrancheta.getContext("2d");
  let CW = telaPrancheta.width;
  let CH = telaPrancheta.height;

  function configurarPrancheta() {
    const manga = area.startsWith("manga");
    const proporcao = manga ? tecido.proporcaoPainel(area) : 4 / 5;
    const largura = manga ? 600 : 300;
    const altura = Math.max(180, Math.round(largura / proporcao));
    if (telaPrancheta.width !== largura || telaPrancheta.height !== altura) {
      telaPrancheta.width = largura;
      telaPrancheta.height = altura;
      CW = largura;
      CH = altura;
    }
    palco.dataset.manga = manga ? "sim" : "nao";
    palco.style.aspectRatio = String(proporcao);
  }

  /** Retângulo (em fração do palco) onde o painel do tecido é desenhado. */
  function moldura() {
    const p = tecido.canvas(area);
    if (!p) return { x: 0, y: 0, l: 1, a: 1 };
    const proporcao = tecido.proporcaoPainel(area);
    const k = Math.min(CW / proporcao, CH);
    const l = (proporcao * k) / CW;
    const a = k / CH;
    return { x: (1 - l) / 2, y: (1 - a) / 2, l, a };
  }

  function desenharPrancheta() {
    if (prancheta.hidden) return;
    const painel = tecido.canvas(area);
    ctxP.clearRect(0, 0, CW, CH);
    if (!painel) return;

    const m = moldura();
    ctxP.drawImage(painel, m.x * CW, m.y * CH, m.l * CW, m.a * CH);

    // marca de centro, como no risco do molde
    ctxP.save();
    ctxP.strokeStyle = "rgba(232,80,31,0.4)";
    ctxP.setLineDash([4, 5]);
    ctxP.lineWidth = 1;
    ctxP.beginPath();
    ctxP.moveTo(Math.round(CW / 2) + 0.5, m.y * CH);
    ctxP.lineTo(Math.round(CW / 2) + 0.5, (m.y + m.a) * CH);
    ctxP.stroke();
    ctxP.restore();

    posicionarCaixa();
  }

  function posicionarCaixa() {
    const c = tecido.caixaEstampa(area);
    if (!c) { caixa.hidden = true; return; }
    const m = moldura();
    caixa.hidden = false;
    caixa.style.left = `${(m.x + (c.x - c.largura / 2) * m.l) * 100}%`;
    caixa.style.top = `${(m.y + (c.y - c.altura / 2) * m.a) * 100}%`;
    caixa.style.width = `${c.largura * m.l * 100}%`;
    caixa.style.height = `${c.altura * m.a * 100}%`;
    caixa.style.transform = `rotate(${c.rotacao}deg)`;
  }

  tecido.aoAtualizar((areaMudada, tipo) => {
    agendarSalvamento();
    if (areaMudada !== area) return;
    if (tipo === "selecao") atualizarEditorArte();
    else desenharPrancheta();
  });

  /* arrastar na prancheta: dentro da caixa move, na alça redimensiona */
  let gesto = null;

  function pontoPalco(e) {
    const r = palco.getBoundingClientRect();
    return { px: (e.clientX - r.left) / r.width, py: (e.clientY - r.top) / r.height };
  }

  function paraPainel({ px, py }) {
    const m = moldura();
    return { u: (px - m.x) / m.l, vTopo: (py - m.y) / m.a };
  }

  palco.addEventListener("pointerdown", (e) => {
    if (!tecido.temEstampa(area)) return;
    const p = pontoPalco(e);
    const { u, vTopo } = paraPainel(p);

    if (e.target === alca) {
      const t = tecido.transform(area);
      if (!t) return;
      gesto = { tipo: "escala", base: t.escala, u0: u, v0: vTopo };
    } else {
      const camada = tecido.acertar(area, u, 1 - vTopo);
      if (!camada) return; // clique fora das artes não faz nada
      tecido.selecionarEstampa(area, camada.id);
      const t = tecido.transform(area);
      gesto = { tipo: "mover", dx: t.x - u, dy: t.y - vTopo };
    }
    palco.setPointerCapture?.(e.pointerId);
    palco.dataset.arrastando = "sim";
    e.preventDefault();
  });

  palco.addEventListener("pointermove", (e) => {
    if (!gesto) return;
    const { u, vTopo } = paraPainel(pontoPalco(e));
    if (gesto.tipo === "mover") {
      tecido.setTransform(area, { x: u + gesto.dx, y: vTopo + gesto.dy });
    } else {
      const t = tecido.transform(area);
      const d0 = Math.hypot(gesto.u0 - t.x, gesto.v0 - t.y) || 0.001;
      const d1 = Math.hypot(u - t.x, vTopo - t.y);
      tecido.setTransform(area, { escala: limitar(gesto.base * (d1 / d0), 0.01, 1) });
    }
    sincronizarControles();
  });

  const soltarGesto = (e) => {
    if (!gesto) return;
    gesto = null;
    delete palco.dataset.arrastando;
    palco.releasePointerCapture?.(e.pointerId);
  };
  palco.addEventListener("pointerup", soltarGesto);
  palco.addEventListener("pointercancel", soltarGesto);

  palco.addEventListener("keydown", (e) => {
    if (!tecido.temEstampa(area)) return;
    const t = tecido.transform(area);
    const passo = e.shiftKey ? 0.05 : 0.01;
    const acoes = {
      ArrowLeft: () => ({ x: t.x - passo }),
      ArrowRight: () => ({ x: t.x + passo }),
      ArrowUp: () => ({ y: t.y - passo }),
      ArrowDown: () => ({ y: t.y + passo }),
      "+": () => ({ escala: limitar(t.escala + 0.02, 0.01, 1) }),
      "=": () => ({ escala: limitar(t.escala + 0.02, 0.01, 1) }),
      "-": () => ({ escala: limitar(t.escala - 0.02, 0.01, 1) }),
      "[": () => ({ rotacao: t.rotacao - 5 }),
      "]": () => ({ rotacao: t.rotacao + 5 }),
    };
    if (!acoes[e.key]) return;
    e.preventDefault();
    tecido.setTransform(area, acoes[e.key]());
    sincronizarControles();
  });

  /* ------------------------- controles de faixa ------------------------- */
  const formatar = {
    escala: (v) => `${Math.round(v)}%`,
    rotacao: (v) => `${Math.round(v)}°`,
    x: (v) => (Math.round(v) === 50 ? "centro" : `${Math.round(v)}%`),
    y: (v) => `${Math.round(v)}%`,
  };

  for (const [nome, el] of ctrls) {
    el.addEventListener("input", () => {
      const v = Number(el.value);
      const mapa = {
        escala: { escala: v / 100 },
        rotacao: { rotacao: v },
        x: { x: v / 100 },
        y: { y: v / 100 },
      };
      tecido.setTransform(area, mapa[nome]);
      // A faixa junto ao recorte da gola é protegida contra distorção; se o
      // limite corrigir a posição, o controle precisa mostrar o valor real.
      sincronizarControles();
    });
  }

  function sincronizarControles() {
    const t = tecido.transform(area);
    if (!t) return;
    const valores = {
      escala: t.escala * 100,
      rotacao: t.rotacao,
      x: t.x * 100,
      y: t.y * 100,
    };
    for (const [nome, el] of ctrls) {
      el.value = Math.round(valores[nome]);
      saidas.get(nome).textContent = formatar[nome](valores[nome]);
    }
  }

  /* -------------------------------- câmera ------------------------------ */
  const acoesCamera = {
    "girar-esq": () => motor?.girar(-0.45),
    "girar-dir": () => motor?.girar(0.45),
    frente: () => motor?.verFrente(),
    costas: () => motor?.verCostas(),
    mais: () => motor?.aproximar(0.88),
    menos: () => motor?.aproximar(1.14),
    reiniciar: () => motor?.reiniciar(),
  };

  secao.addEventListener("click", (e) => {
    const bt = e.target.closest("[data-camera]");
    if (!bt) return;
    acordarMotor().then(() => {
      acoesCamera[bt.dataset.camera]?.();
      esconderDica();
    });
  });

  function esconderDica() {
    if (dica) dica.dataset.oculta = "sim";
  }
  tela.addEventListener("pointerdown", esconderDica, { once: true });

  capturaBt?.addEventListener("click", async () => {
    const texto = capturaBt.querySelector(".botao__texto");
    const rotulo = texto?.textContent;
    capturaBt.setAttribute("aria-busy", "true");
    if (texto) texto.textContent = "gerando prévia…";
    try {
      const m = await acordarMotor();
      const vistas = await m?.capturarVistas?.();
      if (!vistas?.length) throw new Error("captura indisponível");
      const imagem = await montarFolhaDeVistas(vistas);
      baixar(imagem, `quik-previa-completa-${peca.id}.png`);
      anunciar(estado3d, "Prévia completa baixada com frente, costas e as duas mangas.");
    } catch {
      anunciar(estado3d, "Não consegui gerar a prévia agora. Tente novamente.");
    } finally {
      capturaBt.removeAttribute("aria-busy");
      if (texto && rotulo) texto.textContent = rotulo;
    }
  });

  /* ---------------------- persistência e reset local ------------------- */
  async function restaurarProjeto() {
    try {
      const salvo = await lerProjetoLocal();
      if (!salvo || salvo.versao !== 1) {
        mostrarEstadoSalvo("Salvo automaticamente neste navegador.");
        return;
      }

      envio.dataset.carregando = "sim";
      const pecaSalva = PECAS.find((item) => item.id === salvo.pecaId) || PECAS[0];
      peca = pecaSalva;
      marcarRadio(listaPecas, peca.id);
      notaPeca.textContent = peca.nota;
      tecido.setPeca(peca);
      motor?.setPeca(peca);

      const corSalva = salvo.cor && /^#[0-9a-f]{6}$/i.test(salvo.cor.hex || "")
        ? salvo.cor
        : { ...TONS[0], alpha: 1 };
      const corPredefinida = TONS.some((tom) => tom.id === corSalva.id);
      aplicarCor(corSalva, { doSeletor: !corPredefinida });

      tecido.limparEstampas();
      const areasSalvas = salvo.tecido?.areas || {};
      for (const areaDados of Object.entries(areasSalvas)) {
        const [areaId, painel] = areaDados;
        if (!AREAS.some((item) => item.id === areaId)) continue;
        for (const camada of painel.estampas || []) {
          if (!(camada.arquivo instanceof Blob)) continue;
          const arquivo = camada.arquivo instanceof File
            ? camada.arquivo
            : new File([camada.arquivo], camada.nomeArquivo || "arte", {
              type: camada.arquivo.type,
              lastModified: Date.now(),
            });
          try {
            const imagem = await abrirEstampa(arquivo);
            tecido.adicionarEstampa(areaId, imagem, camada.nomeArquivo, {
              arquivo,
              id: camada.id,
              transform: camada.transform,
            });
          } catch {
            // Uma arte corrompida não impede a restauração das outras.
          }
        }
        if (painel.ativaId) tecido.selecionarEstampa(areaId, painel.ativaId);
      }

      area = peca.areas.includes(salvo.area) ? salvo.area : peca.areas[0];
      marcarRadio(listaAreas, area);
      montarAreas();
      marcarRadio(listaAreas, area);
      nomeArea.textContent = nomeDe(area);
      const temArtes = AREAS.some((item) => tecido.temEstampa(item.id));
      envio.dataset.comArquivo = temArtes ? "sim" : "nao";
      solta.querySelector(".envio__texto strong").textContent = temArtes
        ? "Adicionar mais artes"
        : "Adicionar artes";
      atualizarEditorArte();
      descrever();
      mostrarEstadoSalvo("Projeto anterior restaurado neste navegador.");
      anunciar(estado3d, "Seu projeto salvo foi restaurado.");
    } catch {
      mostrarEstadoSalvo("O salvamento local não está disponível.", true);
    } finally {
      delete envio.dataset.carregando;
      restaurando = false;
    }
  }

  async function resetarProjeto() {
    restaurando = true;
    if (timerSalvar) {
      clearTimeout(timerSalvar);
      timerSalvar = null;
    }
    await filaSalvamento;
    try {
      await apagarProjetoLocal();
      tecido.limparEstampas();
      peca = PECAS[0];
      marcarRadio(listaPecas, peca.id);
      notaPeca.textContent = peca.nota;
      tecido.setPeca(peca);
      motor?.setPeca(peca);
      cor = { ...TONS[0], alpha: 1 };
      aplicarCor(cor);
      area = "frente";
      montarAreas();
      marcarRadio(listaAreas, area);
      nomeArea.textContent = nomeDe(area);
      envio.dataset.comArquivo = "nao";
      solta.querySelector(".envio__texto strong").textContent = "Adicionar artes";
      erroEnvio.hidden = true;
      atualizarEditorArte();
      motor?.reiniciar?.();
      descrever();
      mostrarEstadoSalvo("Estúdio resetado. Nenhum projeto salvo.");
      anunciar(estado3d, "Estúdio resetado. Peça, cor e artes foram removidas.");
    } catch {
      mostrarEstadoSalvo("Não foi possível apagar o projeto local.", true);
      anunciar(estado3d, "Não consegui apagar o projeto salvo neste navegador.");
    } finally {
      restaurando = false;
    }
  }

  resetBt?.addEventListener("click", () => {
    if (dialogoReset?.showModal) {
      dialogoReset.returnValue = "";
      dialogoReset.showModal();
      return;
    }
    if (window.confirm("Resetar a peça, a cor e todas as artes salvas?")) resetarProjeto();
  });

  dialogoReset?.addEventListener("close", () => {
    if (dialogoReset.returnValue === "resetar") resetarProjeto();
  });
  dialogoReset?.addEventListener("click", (e) => {
    if (e.target === dialogoReset) dialogoReset.close("cancelar");
  });

  /* ------------------------------ descrição ----------------------------- */
  function descrever(vista = vistaAtual) {
    vistaAtual = vista;
    const areasComArte = AREAS.filter((a) => peca.areas.includes(a.id) && tecido.temEstampa(a.id));
    const totalArtes = areasComArte.reduce((total, a) => total + tecido.listarEstampas(a.id).length, 0);
    const comEstampa = areasComArte
      .map((a) => a.onde);
    const onde = comEstampa.length
      ? `com ${totalArtes} ${totalArtes === 1 ? "arte aplicada" : "artes aplicadas"} ${comEstampa.join(", ")}`
      : "sem arte aplicada";
    const modo = motor?.tipo === "plano" ? "Prévia plana" : "Prévia 3D";
    descricao.textContent = `${modo} de uma ${peca.nome.toLowerCase()} na cor ${cor.nome.toLowerCase()}, ${vista}, ${onde}.`;
  }

  /* -------------------------------- motor ------------------------------- */
  async function acordarMotor() {
    if (motor) return motor;
    if (pedindoMotor) return pedindoMotor;

    pedindoMotor = (async () => {
      carregando.hidden = false;
      try {
        if (!suporteWebGL()) throw new Error("sem-webgl");
        const mod = await import("./estudio3d.js");
        motor = mod.criarEstudio3D({
          container: tela,
          tecido,
          aoMudarVista: ({ face }) => descrever(face),
          aoSelecionarArea: (novaArea) => escolherArea(novaArea),
        });
      } catch {
        const mod = await import("./estudio2d.js");
        motor = mod.criarEstudio2D({
          container: tela,
          tecido,
          aoMudarVista: ({ face }) => descrever(face),
        });
        semTresD.hidden = false;
        tela.setAttribute("aria-label",
          "Prévia plana da peça. Use as setas para trocar a vista, mais e menos para aproximar.");
        if (dica) {
          dica.textContent = "Troque a vista pelos botões · arraste sobre a estampa para movê-la";
        }
      }
      motor.setPeca(peca);
      motor.setCor(tecido.corFinal());
      motor.medir?.();
      carregando.hidden = true;
      descrever();
      return motor;
    })();

    return pedindoMotor;
  }

  /* acende a luz e monta a peça quando a seção chega perto da tela */
  aoEntrar(secao, (_, dentro) => {
    if (!dentro) return;
    if (entrada) secao.style.setProperty("--luz", "1");
    acordarMotor();
  }, { margem: "0px 0px 20% 0px", limiar: 0.05 });

  /* ------------------------------- gaveta ------------------------------- */
  if (puxador) {
    puxador.addEventListener("click", () => {
      const aberto = puxador.getAttribute("aria-expanded") === "true";
      puxador.setAttribute("aria-expanded", aberto ? "false" : "true");
    });
    // no toque a gaveta começa aberta na primeira visita à seção
    if (toque()) {
      aoEntrar(secao, (_, dentro) => {
        if (dentro) puxador.setAttribute("aria-expanded", "true");
      }, { limiar: 0.25 });
    }
  }

  atualizarEditorArte();
  descrever();
  restaurarProjeto();

  return {
    tecido,
    anunciar: (texto) => anunciar(estado3d, texto),
    async capturar() {
      const m = await acordarMotor();
      return m?.capturar?.() || null;
    },
  };
}
