/* ==========================================================================
   Estúdio 3D — cena, luz, câmera e as mãos
   --------------------------------------------------------------------------
   · Iluminação de estúdio gerada na hora (dois softboxes + contraluz), sem
     arquivo de ambiente para baixar.
   · Câmera orbital própria: mouse, toque (um dedo gira, dois aproximam),
     teclado e os botões da barra. A roda do mouse só aproxima depois que
     você interage com o visor — a página nunca perde o scroll.
   · Arrastar sobre a estampa move a estampa; arrastar no resto gira a peça.
   · Desenha sob demanda: sem interação e sem transição, nenhum quadro é
     renderizado. Fora da tela, o laço para.
   ========================================================================== */

import * as THREE from "../../../vendor/three/three.module.js";
import { construirPeca } from "./peca3d.js";
import { relevoMalha, luminancia } from "./tecido.js";
import { aoQuadro, aoEntrar, limitar, misturar, semMovimento } from "./movimento.js";

const AREA_POR_PARTE = {
  frente: "frente",
  costas: "costas",
  mangaEsq: "manga-esq",
  mangaDir: "manga-dir",
};

export function suporteWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGL2RenderingContext && c.getContext("webgl2")
      || window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

export function criarEstudio3D({ container, tecido, aoMudarVista, aoSelecionarArea }) {
  /* ------------------------------ renderer ------------------------------ */
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-hidden", "true");

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);

  /* --------------------------- luz de estúdio --------------------------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const ambienteCena = new THREE.Scene();
  ambienteCena.background = new THREE.Color("#1a1c21");
  const softbox = (x, y, z, intensidade, tamanho) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(tamanho, tamanho),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensidade, intensidade, intensidade) }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    ambienteCena.add(m);
    return m;
  };
  softbox(-3, 3, 3.4, 3.2, 5);      // principal
  softbox(3.6, 1.2, 2.0, 1.15, 4);  // preenchimento
  softbox(0, 2, -4, 2.1, 5);        // contraluz
  const ambiente = pmrem.fromScene(ambienteCena, 0.035);
  cena.environment = ambiente.texture;

  const chave = new THREE.DirectionalLight(0xfff4ec, 1.85);
  chave.position.set(-2.2, 2.6, 3.2);
  const preenche = new THREE.DirectionalLight(0xdce6f0, 0.5);
  preenche.position.set(3.0, 0.6, 1.4);
  const contra = new THREE.DirectionalLight(0xffffff, 1.05);
  contra.position.set(0.4, 1.8, -3.4);
  cena.add(chave, preenche, contra, new THREE.AmbientLight(0xffffff, 0.24));

  /* ------------------------- sombra de contato ------------------------- */
  const sombraCanvas = document.createElement("canvas");
  sombraCanvas.width = sombraCanvas.height = 256;
  {
    const c = sombraCanvas.getContext("2d");
    const g = c.createRadialGradient(128, 128, 6, 128, 128, 126);
    g.addColorStop(0, "rgba(0,0,0,0.72)");
    g.addColorStop(0.45, "rgba(0,0,0,0.34)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.5),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(sombraCanvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -0.78;
  cena.add(sombra);

  /* ----------------------------- materiais ----------------------------- */
  const relevo = new THREE.CanvasTexture(relevoMalha());
  relevo.wrapS = relevo.wrapT = THREE.RepeatWrapping;
  relevo.repeat.set(28, 34);

  const texturas = {};
  const materiais = {};

  function materialPainel(area) {
    const tex = new THREE.CanvasTexture(tecido.canvas(area));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texturas[area] = tex;
    return new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: relevo,
      bumpScale: 0.035,
      roughness: 0.82,
      metalness: 0.0,
      // A abertura da manga deixa parte do avesso visível em certos ângulos.
      // Renderizar as duas faces impede o efeito de manga transparente.
      side: area.startsWith("manga") ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  materiais.frente = materialPainel("frente");
  materiais.costas = materialPainel("costas");
  materiais.mangaEsq = materialPainel("manga-esq");
  materiais.mangaDir = materialPainel("manga-dir");
  materiais.liso = new THREE.MeshStandardMaterial({
    color: "#1b1d21", roughness: 0.85, metalness: 0, bumpMap: relevo, bumpScale: 0.03,
  });
  materiais.gola = new THREE.MeshStandardMaterial({
    color: "#1b1d21", roughness: 0.72, metalness: 0,
  });
  materiais.avesso = new THREE.MeshStandardMaterial({
    color: "#101114", roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });

  tecido.aoAtualizar((area) => {
    if (texturas[area]) texturas[area].needsUpdate = true;
    pedirQuadro();
  });

  /* ------------------------------- a peça ------------------------------ */
  let atual = null;
  let pedido = 0;
  let cancelarMontagem = null;

  function encerrarMontagem() {
    cancelarMontagem?.();
    cancelarMontagem = null;
  }

  function limpar() {
    encerrarMontagem();
    if (!atual) return;
    cena.remove(atual.grupo);
    atual.geometrias.forEach((g) => g.dispose());
    atual = null;
  }

  function setPeca(peca, { montar = true } = {}) {
    const meuPedido = ++pedido;
    limpar();
    atual = construirPeca(peca.forma, materiais);
    cena.add(atual.grupo);
    if (montar && !semMovimento()) animarMontagem(atual.partes);
    pedirQuadro();

    // se a peça aponta para um arquivo próprio, ele entra no lugar da
    // geometria gerada assim que carregar (ver README, item 5)
    if (peca.glb) trocarPorArquivo(peca, montar, meuPedido);
  }

  /* --------------------------- modelo em arquivo ------------------------ */
  /* A geometria gerada é o padrão. Quando `glb` existe em dados.js, o arquivo
     substitui a peça: as malhas precisam se chamar frente, costas, mangaEsq e
     mangaDir, com UV de 0 a 1 em cada painel. Se algo falhar, a peça gerada
     continua na tela e o motivo aparece no console — nada de peça vazia. */
  async function trocarPorArquivo(peca, montar, meu) {
    try {
      const { GLTFLoader } = await import("../../../vendor/three/GLTFLoader.js");
      const gltf = await new GLTFLoader().loadAsync(peca.glb);
      if (meu !== pedido) return; // a pessoa já trocou de peça

      const grupo = gltf.scene;
      const partes = {};
      const geometrias = [];
      let paineisEncontrados = 0;

      grupo.traverse((o) => {
        if (!o.isMesh) return;
        geometrias.push(o.geometry);
        const area = AREA_POR_PARTE[o.name];
        if (area) {
          o.material = materiais[o.name];
          partes[o.name] = o;
          paineisEncontrados++;
        } else {
          o.material = materiais.liso;
        }
      });

      if (!paineisEncontrados) {
        console.warn(
          `[Estúdio 3D] ${peca.glb} carregou, mas nenhuma malha se chama ` +
          "frente, costas, mangaEsq ou mangaDir — a estampa não teria onde ser " +
          "aplicada. Mantendo a peça gerada por geometria."
        );
        return;
      }

      enquadrar(grupo);
      limpar();
      atual = { grupo, partes, geometrias };
      cena.add(grupo);
      if (montar && !semMovimento()) animarMontagem(partes);
      pedirQuadro();
    } catch (erro) {
      console.warn(
        `[Estúdio 3D] não consegui carregar ${peca.glb}: ${erro.message}. ` +
        "A peça gerada por geometria continua na tela."
      );
    }
  }

  /** Normaliza a escala e o centro do modelo do arquivo para o mesmo enquadramento
      das peças geradas (altura ~1.3, centro na origem). */
  function enquadrar(grupo) {
    const caixa = new THREE.Box3().setFromObject(grupo);
    const tam = caixa.getSize(new THREE.Vector3());
    const centro = caixa.getCenter(new THREE.Vector3());
    const k = tam.y > 0 ? 1.3 / tam.y : 1;
    grupo.scale.setScalar(k);
    grupo.position.set(-centro.x * k, -centro.y * k, -centro.z * k);
  }

  /* A peça entra montada: as mangas encaixam, o corpo assenta. */
  function animarMontagem(partes) {
    encerrarMontagem();
    const alvos = [
      [partes.mangaEsq, new THREE.Vector3(-0.55, 0.1, 0)],
      [partes.mangaDir, new THREE.Vector3(0.55, 0.1, 0)],
      [partes.frente, new THREE.Vector3(0, 0, 0.35)],
      [partes.costas, new THREE.Vector3(0, 0, -0.35)],
      [partes.gola, new THREE.Vector3(0, 0.3, 0)],
    ].filter(([m]) => m);

    alvos.forEach(([m, off]) => m.position.copy(off));
    const inicio = performance.now();
    const dur = 620;
    let parar = null;
    const concluir = () => {
      alvos.forEach(([m]) => m.position.set(0, 0, 0));
      parar?.();
      cancelarMontagem = null;
      renderar();
    };
    cancelarMontagem = concluir;
    parar = aoQuadro((t) => {
      const k = limitar((t - inicio) / dur, 0, 1);
      const e = 1 - (1 - k) ** 3;
      alvos.forEach(([m, off]) => {
        m.position.set(off.x * (1 - e), off.y * (1 - e), off.z * (1 - e));
      });
      renderar();
      if (k >= 1) concluir();
    });
  }

  function setCor(hex) {
    const claro = luminancia(hex) > 0.55;
    materiais.liso.color.set(hex);
    materiais.gola.color.set(hex);
    materiais.gola.color.multiplyScalar(claro ? 0.92 : 1.18);
    materiais.avesso.color.set(hex);
    materiais.avesso.color.multiplyScalar(0.55);
    // tecido claro reflete mais e enruga menos
    for (const parte of ["frente", "costas", "mangaEsq", "mangaDir"]) {
      materiais[parte].roughness = claro ? 0.76 : 0.84;
    }
    pedirQuadro();
  }

  /* ------------------------------- câmera ------------------------------ */
  const vista = { theta: 0, phi: Math.PI / 2 - 0.06, raio: 3.05, alvoY: 0.02 };
  const alvo = { ...vista };
  const LIMITES = { raio: [1.9, 5.2], phi: [0.55, 2.35] };
  let fracaoBarra = 0;
  let capturando = false;

  function posicionar() {
    const { theta, phi, raio, alvoY } = vista;
    // No layout empilhado, a barra de câmera ocupa o rodapé do canvas.
    // Descontar metade desse espaço centraliza a peça na área realmente livre.
    const alturaVisivel = 2 * raio * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const centroY = alvoY - fracaoBarra * alturaVisivel;
    camera.position.set(
      raio * Math.sin(phi) * Math.sin(theta),
      raio * Math.cos(phi) + centroY,
      raio * Math.sin(phi) * Math.cos(theta),
    );
    camera.lookAt(0, centroY, 0);
  }

  let amortecendo = null;
  function amortecer() {
    if (amortecendo) return;
    amortecendo = aoQuadro(() => {
      const k = semMovimento() ? 1 : 0.16;
      vista.theta = misturar(vista.theta, alvo.theta, k);
      vista.phi = misturar(vista.phi, alvo.phi, k);
      vista.raio = misturar(vista.raio, alvo.raio, k);
      vista.alvoY = misturar(vista.alvoY, alvo.alvoY, k);
      posicionar();
      renderar();
      const perto = Math.abs(vista.theta - alvo.theta) < 0.0005
        && Math.abs(vista.phi - alvo.phi) < 0.0005
        && Math.abs(vista.raio - alvo.raio) < 0.0005
        && Math.abs(vista.alvoY - alvo.alvoY) < 0.0005;
      if (perto) {
        vista.theta = alvo.theta; vista.phi = alvo.phi;
        vista.raio = alvo.raio; vista.alvoY = alvo.alvoY;
        posicionar(); renderar();
        amortecendo(); amortecendo = null;
        avisarVista();
      }
    });
  }

  function girar(dTheta, dPhi = 0) {
    alvo.theta += dTheta;
    alvo.phi = limitar(alvo.phi + dPhi, ...LIMITES.phi);
    amortecer();
  }
  function aproximar(fator) {
    alvo.raio = limitar(alvo.raio * fator, ...LIMITES.raio);
    amortecer();
  }
  function verAngulo(theta, { raio, alvoY = 0.02 } = {}) {
    // vai pelo caminho mais curto
    const volta = Math.PI * 2;
    let d = (theta - alvo.theta) % volta;
    if (d > Math.PI) d -= volta;
    if (d < -Math.PI) d += volta;
    alvo.theta += d;
    alvo.phi = Math.PI / 2 - 0.06;
    if (raio) alvo.raio = limitar(raio, ...LIMITES.raio);
    alvo.alvoY = alvoY;
    // Seleções diretas devem responder na hora. Além de deixar o controle
    // preciso, evita que um amortecimento anterior impeça o foco solicitado.
    if (amortecendo) { amortecendo(); amortecendo = null; }
    vista.theta = alvo.theta;
    vista.phi = alvo.phi;
    vista.raio = alvo.raio;
    vista.alvoY = alvo.alvoY;
    posicionar();
    renderar();
    avisarVista();
  }

  function focarGola() {
    verAngulo(0, { raio: 2.35, alvoY: 0.31 });
  }

  function avisarVista() {
    const g = ((alvo.theta * 180) / Math.PI) % 360;
    const norm = (g + 360) % 360;
    let face = "de frente";
    if (norm > 45 && norm <= 135) face = "de lado (direita)";
    else if (norm > 135 && norm <= 225) face = "de costas";
    else if (norm > 225 && norm <= 315) face = "de lado (esquerda)";
    aoMudarVista?.({ face, zoom: alvo.raio });
  }

  /* --------------------------- mouse e toque --------------------------- */
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let arraste = null;
  let engajado = false;
  const toques = new Map();

  function coordenadas(e) {
    const r = renderer.domElement.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -((e.clientY - r.top) / r.height) * 2 + 1,
    };
  }

  /** Achou estampa embaixo do ponteiro? Devolve a área e o ponto em uv. */
  function estampaSob(e) {
    if (!atual) return null;
    const c = coordenadas(e);
    ponteiro.set(c.x, c.y);
    raio.setFromCamera(ponteiro, camera);
    const alvosMesh = Object.entries(AREA_POR_PARTE)
      .map(([parte, area]) => [atual.partes[parte], area])
      .filter(([m]) => m);
    const hits = raio.intersectObjects(alvosMesh.map(([m]) => m), false);
    if (!hits.length || !hits[0].uv) return null;
    const achado = alvosMesh.find(([m]) => m === hits[0].object);
    if (!achado) return null;
    const area = achado[1];
    const { x: u, y: v } = hits[0].uv;
    const camada = tecido.acertar(area, u, v);
    if (!camada) return null;
    return { area, camadaId: camada.id, u, v };
  }

  function golaSob(e) {
    const gola = atual?.partes.gola;
    if (!gola) return false;
    const c = coordenadas(e);
    ponteiro.set(c.x, c.y);
    raio.setFromCamera(ponteiro, camera);
    return raio.intersectObject(gola, false).length > 0;
  }

  function aoBaixar(e) {
    engajado = true;
    container.dataset.arrastando = "sim";
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) { arraste = { tipo: "pinca", base: distanciaToques(), raio: alvo.raio }; return; }

    const sob = estampaSob(e);
    if (sob) {
      tecido.selecionarEstampa(sob.area, sob.camadaId);
      const t = tecido.transform(sob.area);
      arraste = {
        tipo: "estampa",
        area: sob.area,
        offX: t.x - sob.u,
        offY: t.y - (1 - sob.v),
      };
      container.dataset.modo = "estampa";
    } else if (golaSob(e)) {
      aoSelecionarArea?.("frente");
      focarGola();
      arraste = { tipo: "orbita", x: e.clientX, y: e.clientY };
    } else {
      arraste = { tipo: "orbita", x: e.clientX, y: e.clientY };
    }
    renderer.domElement.setPointerCapture?.(e.pointerId);
  }

  function distanciaToques() {
    const [a, b] = [...toques.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function aoMover(e) {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!arraste) return;

    if (arraste.tipo === "pinca" && toques.size === 2) {
      const d = distanciaToques();
      alvo.raio = limitar(arraste.raio * (arraste.base / d), ...LIMITES.raio);
      amortecer();
      return;
    }

    if (arraste.tipo === "orbita") {
      const dx = e.clientX - arraste.x;
      const dy = e.clientY - arraste.y;
      arraste.x = e.clientX;
      arraste.y = e.clientY;
      alvo.theta -= dx * 0.008;
      alvo.phi = limitar(alvo.phi - dy * 0.006, ...LIMITES.phi);
      amortecer();
      return;
    }

    if (arraste.tipo === "estampa") {
      // segue a superfície: usa o uv de onde o raio bate agora
      const c = coordenadas(e);
      ponteiro.set(c.x, c.y);
      raio.setFromCamera(ponteiro, camera);
      const parte = Object.entries(AREA_POR_PARTE).find(([, a]) => a === arraste.area)?.[0];
      const mesh = atual?.partes[parte];
      if (!mesh) return;
      const hits = raio.intersectObject(mesh, false);
      if (!hits.length || !hits[0].uv) return;
      tecido.setTransform(arraste.area, {
        x: hits[0].uv.x + arraste.offX,
        y: (1 - hits[0].uv.y) + arraste.offY,
      });
    }
  }

  function aoSoltar(e) {
    toques.delete(e.pointerId);
    if (toques.size < 2 && arraste?.tipo === "pinca") arraste = null;
    if (!toques.size) {
      arraste = null;
      delete container.dataset.arrastando;
      delete container.dataset.modo;
    }
    renderer.domElement.releasePointerCapture?.(e.pointerId);
  }

  const tela = renderer.domElement;
  tela.addEventListener("pointerdown", aoBaixar);
  tela.addEventListener("pointermove", aoMover);
  tela.addEventListener("pointerup", aoSoltar);
  tela.addEventListener("pointercancel", aoSoltar);
  tela.addEventListener("pointerleave", (e) => { if (arraste?.tipo !== "estampa") aoSoltar(e); });

  // muda o cursor quando está sobre a estampa
  tela.addEventListener("pointermove", (e) => {
    if (arraste || e.pointerType !== "mouse") return;
    if (estampaSob(e)) container.dataset.modo = "estampa";
    else delete container.dataset.modo;
  });

  tela.addEventListener("wheel", (e) => {
    // só depois de o visitante interagir com o visor: a página não perde o scroll
    if (!engajado && document.activeElement !== container) return;
    e.preventDefault();
    aproximar(e.deltaY > 0 ? 1.08 : 0.93);
  }, { passive: false });

  document.addEventListener("pointerdown", (e) => {
    if (!container.contains(e.target)) engajado = false;
  });

  container.addEventListener("keydown", (e) => {
    const passo = e.shiftKey ? 0.32 : 0.14;
    const mapa = {
      ArrowLeft: () => girar(-passo),
      ArrowRight: () => girar(passo),
      ArrowUp: () => girar(0, -passo * 0.6),
      ArrowDown: () => girar(0, passo * 0.6),
      "+": () => aproximar(0.9),
      "=": () => aproximar(0.9),
      "-": () => aproximar(1.11),
      Home: () => reiniciar(),
    };
    if (mapa[e.key]) { e.preventDefault(); mapa[e.key](); }
  });

  function reiniciar() {
    alvo.theta = 0;
    alvo.phi = Math.PI / 2 - 0.06;
    alvo.raio = 3.05;
    alvo.alvoY = 0.02;
    amortecer();
  }

  /* ------------------------------ tamanho ------------------------------ */
  function medir() {
    const r = container.getBoundingClientRect();
    const l = Math.max(1, r.width);
    const a = Math.max(1, r.height);
    renderer.setSize(l, a, false);
    camera.aspect = l / a;
    // em telas estreitas afasta um pouco para a peça caber inteira
    camera.fov = l / a < 0.85 ? 40 : 34;
    camera.updateProjectionMatrix();
    const barra = container.closest(".visor")?.querySelector(".visor__barra");
    const layoutEmpilhado = window.matchMedia("(max-width: 1024px)").matches;
    fracaoBarra = !capturando && layoutEmpilhado && barra
      ? barra.getBoundingClientRect().height / (2 * a)
      : 0;
    posicionar();
    pedirQuadro();
  }
  const observador = new ResizeObserver(medir);
  observador.observe(container);

  /* --------------------------- render sob demanda ---------------------- */
  let visivel = true;
  let agendado = false;

  function renderar() {
    if (!visivel) return;
    renderer.render(cena, camera);
  }
  function pedirQuadro() {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => { agendado = false; renderar(); });
  }

  aoEntrar(container, (_el, dentro) => {
    visivel = dentro;
    if (dentro) pedirQuadro();
  }, { umaVez: false, limiar: 0 });

  medir();
  posicionar();

  /* ------------------------------ captura ------------------------------ */
  function capturar({ escala = 2 } = {}) {
    const anterior = renderer.getPixelRatio();
    capturando = true;
    renderer.setPixelRatio(Math.min(escala * (window.devicePixelRatio || 1), 3));
    medir();
    renderer.render(cena, camera);
    const url = renderer.domElement.toDataURL("image/png");
    renderer.setPixelRatio(anterior);
    capturando = false;
    medir();
    return url;
  }

  function capturarVistas() {
    encerrarMontagem();
    const originalVista = { ...vista };
    const originalAlvo = { ...alvo };
    if (amortecendo) { amortecendo(); amortecendo = null; }
    const configuracoes = [
      { id: "frente", nome: "Frente", theta: 0, raio: 3.05, alvoY: 0.02 },
      { id: "costas", nome: "Costas", theta: Math.PI, raio: 3.05, alvoY: 0.02 },
      { id: "manga-esq", nome: "Manga esquerda", theta: -Math.PI * 0.1, raio: 3.05, alvoY: 0.06 },
      { id: "manga-dir", nome: "Manga direita", theta: Math.PI * 0.1, raio: 3.05, alvoY: 0.06 },
    ];
    const saidas = configuracoes.map((config) => {
      vista.theta = config.theta;
      vista.raio = config.raio;
      vista.alvoY = config.alvoY;
      vista.phi = Math.PI / 2 - 0.06;
      posicionar();
      return { id: config.id, nome: config.nome, url: capturar({ escala: 1 }) };
    });
    Object.assign(vista, originalVista);
    Object.assign(alvo, originalAlvo);
    posicionar();
    renderar();
    return saidas;
  }

  function destruir() {
    observador.disconnect();
    limpar();
    Object.values(texturas).forEach((t) => t.dispose());
    Object.values(materiais).forEach((m) => m.dispose());
    ambiente.texture.dispose();
    pmrem.dispose();
    relevo.dispose();
    renderer.dispose();
    tela.remove();
  }

  return {
    tipo: "3d",
    setPeca,
    setCor,
    girar,
    aproximar,
    verFrente: () => verAngulo(0),
    verCostas: () => verAngulo(Math.PI),
    // Três quartos mostra a manga inteira; de perfil exato a câmera olhava
    // diretamente para o punho e escondia o restante da peça.
    verMangaEsq: () => verAngulo(-Math.PI * 0.1, { raio: 2.75, alvoY: 0.06 }),
    verMangaDir: () => verAngulo(Math.PI * 0.1, { raio: 2.75, alvoY: 0.06 }),
    focarGola,
    reiniciar,
    capturar,
    capturarVistas,
    destruir,
    medir,
  };
}
