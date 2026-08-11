/* ==========================================================================
   Geometria das peças
   --------------------------------------------------------------------------
   As quatro peças são construídas por modelagem no navegador, a partir de um
   perfil de largura/profundidade — do mesmo jeito que um molde é montado:
   painel da frente, painel das costas, pala do ombro, gola, mangas e as
   sobras fechadas (barra e punhos).

   Por que geometria e não arquivo: cada painel precisa de um mapeamento de
   textura previsível (a frente é exatamente o canvas da frente), e assim não
   dependemos de nenhum modelo de terceiro nem da licença dele.

   Para usar um modelo próprio, informe `glb` na peça em dados.js — ver
   README.md. O restante do estúdio não muda.
   ========================================================================== */

import * as THREE from "../../../vendor/three/three.module.js";

/* Perfil do corpo: [v, largura, profundidade] — v=0 na barra, v=1 no ombro. */
const PERFIL = [
  [0.00, 1.000, 1.000],
  [0.16, 0.985, 0.995],
  [0.38, 0.955, 0.980],
  [0.56, 0.975, 1.000],
  [0.74, 1.040, 1.015],
  [0.88, 1.055, 0.960],
  [1.00, 0.985, 0.870],
];

const suave = (t) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
const misturar = (a, b, t) => a + (b - a) * t;

function perfil(v, cintura = 0) {
  let i = 0;
  while (i < PERFIL.length - 2 && v > PERFIL[i + 1][0]) i++;
  const [v0, w0, d0] = PERFIL[i];
  const [v1, w1, d1] = PERFIL[i + 1];
  const t = suave((v - v0) / (v1 - v0 || 1));
  // a cintura aperta o meio da peça (modelagem esportiva)
  const aperto = cintura * Math.sin(Math.PI * Math.min(1, v / 0.75)) * 0.6;
  return { w: misturar(w0, w1, t) - aperto, d: misturar(d0, d1, t) - aperto * 0.5 };
}

/** Recorte da gola: 1 no centro, 0 na borda da abertura. */
function recorteGola(u, largura) {
  const d = Math.abs(u - 0.5) / largura;
  if (d >= 1) return 0;
  return Math.cos((Math.PI / 2) * d) ** 1.4;
}

/* ------------------------ malha a partir de função ----------------------- */

function superficie(fn, nu, nv, { inverter = false, uv } = {}) {
  const pos = [];
  const uvs = [];
  const idx = [];

  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = i / nu;
      const v = j / nv;
      const p = fn(u, v);
      pos.push(p[0], p[1], p[2]);
      const c = uv ? uv(u, v) : [u, v];
      uvs.push(c[0], c[1]);
    }
  }
  const linha = nu + 1;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * linha + i;
      const b = a + 1;
      const c = a + linha + 1;
      const d = a + linha;
      if (inverter) idx.push(a, c, b, a, d, c);
      else idx.push(a, b, c, a, c, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Tampa em leque: fecha barra, punho e o vão da gola. */
function tampa(pontos, centro, inverter = false) {
  const pos = [centro.x, centro.y, centro.z];
  const uvs = [0.5, 0.5];
  const idx = [];
  pontos.forEach((p) => {
    pos.push(p.x, p.y, p.z);
    uvs.push(0.5, 0.5);
  });
  for (let i = 1; i <= pontos.length; i++) {
    const a = i;
    const b = i === pontos.length ? 1 : i + 1;
    if (inverter) idx.push(0, b, a);
    else idx.push(0, a, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* =============================== a peça ================================== */

/**
 * Monta a peça inteira.
 * @param {object} forma  bloco `forma` da peça em dados.js
 * @param {object} mats   { frente, costas, mangaEsq, mangaDir, liso, gola, avesso }
 * @returns {{grupo: THREE.Group, partes: object, geometrias: THREE.BufferGeometry[]}}
 */
export function construirPeca(forma, mats) {
  const { largura: W, profundidade: D, altura: H, cintura = 0, gola, manga } = forma;
  const meiaW = W / 2;
  const meiaD = D / 2;
  const yBarra = -H / 2;
  const yOmbro = H / 2;
  const NU = 84;
  const NV = 64;
  const folga = 0.05; // sobreposição no costado, para não abrir fenda

  const grupo = new THREE.Group();
  const partes = {};
  const geometrias = [];

  const anguloDe = (u) => (-Math.PI / 2 - folga) + (Math.PI + 2 * folga) * u;
  /* O painel é curvo, mas a arte precisa seguir a largura visível da peça,
     não o ângulo da curva. Esse UV compensa a projeção senoidal e preserva a
     proporção de logos e textos no centro do peito e das costas. */
  const uPelaLargura = (u) => (Math.sin(anguloDe(u)) + 1) / 2;

  /* o ombro cai do decote para a cava: sem isso a gola fica como uma corda
     apoiada num topo reto, e não como um decote costurado */
  // Ombro menos inclinado: mantém o decote mais reto e evita que artes altas
  // pareçam dobrar junto da gola.
  const quedaOmbro = H * 0.025;
  const inclinaOmbro = (u) => quedaOmbro * Math.min(1, Math.abs(u - 0.5) / 0.5) ** 1.3;

  /* ---- ponto do painel: frente (+1) ou costas (-1) ---- */
  const pontoCasca = (frente) => (u, v) => {
    const th = anguloDe(u);
    const p = perfil(v, cintura);
    const x = meiaW * p.w * Math.sin(th);
    // O centro do painel é realmente plano: a curvatura começa apenas nos
    // 32% laterais. Assim uma logo no peito não acompanha uma superfície
    // cilíndrica e mantém linhas, letras e proporções sem deformação.
    const larguraRelativa = Math.min(1, Math.abs(x) / (meiaW * p.w));
    const quedaLateral = suave((larguraRelativa - 0.68) / 0.32);
    // A parte superior não recua em direção à gola. Isso elimina as ondas
    // horizontais que ainda apareciam atrás de logos posicionados no peito.
    const profundidadePainel = misturar(p.d, 1, suave((v - 0.78) / 0.22));
    const z = frente * meiaD * profundidadePainel * (1 - quedaLateral);
    const dip = recorteGola(u, gola.largura) * gola.profundidade * H * (frente > 0 ? 1 : 0.42);
    // O decote e a queda do ombro ficam restritos à borda superior. Abaixo
    // dela, o painel permanece reto para receber a aplicação.
    const faixaGola = suave((v - 0.88) / 0.12);
    const faixaOmbro = suave((v - 0.84) / 0.16);
    const y = yBarra + H * v - dip * faixaGola - inclinaOmbro(u) * faixaOmbro;
    return [x, y, z];
  };

  const frenteGeo = superficie(pontoCasca(1), NU, NV, { uv: (u, v) => [uPelaLargura(u), v] });
  // nas costas o u da textura é espelhado: quem olha por trás lê a arte na
  // ordem certa (esquerda na tela = esquerda de quem olha)
  const costasGeo = superficie(pontoCasca(-1), NU, NV, {
    inverter: true,
    uv: (u, v) => [1 - uPelaLargura(u), v],
  });

  partes.frente = new THREE.Mesh(frenteGeo, mats.frente);
  partes.costas = new THREE.Mesh(costasGeo, mats.costas);
  grupo.add(partes.frente, partes.costas);
  geometrias.push(frenteGeo, costasGeo);

  /* ---- pala do ombro: liga frente e costas fora da abertura da gola ---- */
  const topoFrente = (u) => {
    const p = pontoCasca(1)(u, 1);
    return new THREE.Vector3(p[0], p[1], p[2]);
  };
  const topoCostas = (u) => {
    const p = pontoCasca(-1)(u, 1);
    return new THREE.Vector3(p[0], p[1], p[2]);
  };

  const uGola = gola.largura;
  const faixas = [[0, 0.5 - uGola], [0.5 + uGola, 1]];
  faixas.forEach(([u0, u1], i) => {
    const geo = superficie((a, s) => {
      const u = misturar(u0, u1, a);
      const f = topoFrente(u);
      const c = topoCostas(u);
      const arco = Math.sin(Math.PI * s) * H * 0.02;
      return [misturar(f.x, c.x, s), misturar(f.y, c.y, s) + arco, misturar(f.z, c.z, s)];
    }, 26, 10);
    const m = new THREE.Mesh(geo, mats.liso);
    grupo.add(m);
    geometrias.push(geo);
    partes[`pala${i}`] = m;
  });

  /* ---- contorno da gola: frente + costas fecham o vão ---- */
  const passos = 46;
  const loopGola = [];
  for (let i = 0; i <= passos; i++) {
    loopGola.push(topoFrente(misturar(0.5 - uGola, 0.5 + uGola, i / passos)));
  }
  for (let i = passos; i >= 0; i--) {
    loopGola.push(topoCostas(misturar(0.5 - uGola, 0.5 + uGola, i / passos)));
  }

  // fecha o vão (avesso da peça visto pela gola)
  const centroGola = loopGola
    .reduce((acc, p) => acc.add(p), new THREE.Vector3())
    .multiplyScalar(1 / loopGola.length);
  centroGola.y -= H * 0.05;
  const vaoGeo = tampa(loopGola, centroGola, true);
  const vao = new THREE.Mesh(vaoGeo, mats.avesso);
  grupo.add(vao);
  geometrias.push(vaoGeo);

  /* ---- gola: ribana, polo ou alta ---- */
  const curvaGola = new THREE.CatmullRomCurve3(loopGola, true, "centripetal", 0.4);

  if (gola.tipo === "ribana") {
    const geo = new THREE.TubeGeometry(curvaGola, 190, gola.raio, 10, true);
    const m = new THREE.Mesh(geo, mats.gola);
    grupo.add(m);
    geometrias.push(geo);
    partes.gola = m;
  } else if (gola.tipo === "alta") {
    // gola mais alta: uma faixa em pé em volta de todo o contorno
    const geo = faixaGola(curvaGola, H * 0.075, 0.024);
    const m = new THREE.Mesh(geo, mats.gola);
    grupo.add(m);
    geometrias.push(geo);
    partes.gola = m;
    const tubo = new THREE.TubeGeometry(curvaGola, 170, gola.raio, 8, true);
    const mt = new THREE.Mesh(tubo, mats.gola);
    grupo.add(mt);
    geometrias.push(tubo);
  } else {
    // gola polo: faixa deitada para fora, mais baixa na frente do peito
    const geo = faixaGola(curvaGola, H * 0.062, 0.05, true);
    const m = new THREE.Mesh(geo, mats.gola);
    grupo.add(m);
    geometrias.push(geo);
    partes.gola = m;
    const tubo = new THREE.TubeGeometry(curvaGola, 170, gola.raio * 0.8, 8, true);
    const mt = new THREE.Mesh(tubo, mats.gola);
    grupo.add(mt);
    geometrias.push(tubo);
  }

  /* ---- mangas ---- */
  [-1, 1].forEach((lado) => {
    const nome = lado < 0 ? "mangaEsq" : "mangaDir";
    // a manga sai da cava, logo abaixo do ponto onde o ombro termina
    const p0 = new THREE.Vector3(lado * meiaW * perfil(1, cintura).w * 0.78, yOmbro - quedaOmbro - H * 0.03, 0);
    const dir = new THREE.Vector3(lado * Math.cos(manga.queda), -Math.sin(manga.queda), 0).normalize();
    const eixoZ = new THREE.Vector3(0, 0, 1);
    const eixoY = new THREE.Vector3().crossVectors(dir, eixoZ).normalize();
    const comprimento = manga.comprimento * H * 0.62;

    const ponto = (u, v) => {
      const t = v;
      const r = misturar(manga.raio, manga.punho, suave(t)) * W;
      const ang = Math.PI * 2 * (u - 0.5);
      const centro = new THREE.Vector3()
        .copy(p0)
        .addScaledVector(dir, t * comprimento);
      const pt = centro
        .addScaledVector(eixoZ, r * Math.cos(ang))
        .addScaledVector(eixoY, r * Math.sin(ang));
      return [pt.x, pt.y, pt.z];
    };

    const geo = superficie(ponto, 44, 30, {
      // O v da manga nasce no ombro e termina no punho, ao contrário do
      // canvas. Invertê-lo aqui mantém topo/baixo da imagem na orientação
      // correta; a esquerda também espelha apenas o eixo horizontal.
      uv: lado < 0 ? (u, v) => [1 - u, 1 - v] : (u, v) => [u, 1 - v],
    });
    const m = new THREE.Mesh(geo, lado < 0 ? mats.mangaEsq : mats.mangaDir);
    grupo.add(m);
    geometrias.push(geo);
    partes[nome] = m;

    // punho fechado
    const aro = [];
    for (let i = 0; i < 26; i++) {
      const p = ponto(i / 26, 1);
      aro.push(new THREE.Vector3(p[0], p[1], p[2]));
    }
    const centroPunho = new THREE.Vector3().copy(p0).addScaledVector(dir, comprimento);
    const geoPunho = tampa(aro, centroPunho, lado > 0);
    // O fechamento usa o mesmo tom externo da peça. O material de avesso
    // ficava quase preto e parecia um buraco/transparência visto de lado.
    const mp = new THREE.Mesh(geoPunho, mats.liso);
    grupo.add(mp);
    geometrias.push(geoPunho);
  });

  /* ---- barra fechada ---- */
  const aroBarra = [];
  const n = 54;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const th = Math.PI * 2 * u;
    const p = perfil(0, cintura);
    aroBarra.push(new THREE.Vector3(
      meiaW * p.w * Math.sin(th),
      yBarra,
      meiaD * p.d * Math.cos(th),
    ));
  }
  const geoBarra = tampa(aroBarra, new THREE.Vector3(0, yBarra + H * 0.01, 0), false);
  const mb = new THREE.Mesh(geoBarra, mats.avesso);
  grupo.add(mb);
  geometrias.push(geoBarra);

  grupo.traverse((o) => {
    if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; }
  });

  return { grupo, partes, geometrias };
}

/** Faixa em pé (ou deitada) ao longo do contorno da gola. */
function faixaGola(curva, altura, saida, deitada = false) {
  const N = 150;
  const pontos = curva.getSpacedPoints(N);
  const centro = pontos
    .reduce((acc, p) => acc.add(p.clone()), new THREE.Vector3())
    .multiplyScalar(1 / pontos.length);

  return superficie((u, s) => {
    const i = Math.min(pontos.length - 1, Math.round(u * (pontos.length - 1)));
    const p = pontos[i];
    const fora = new THREE.Vector3(p.x - centro.x, 0, p.z - centro.z).normalize();
    // na frente do peito a gola é mais baixa: abre o decote
    const frontal = Math.max(0, fora.z);
    const alt = altura * (deitada ? misturar(1, 0.25, frontal ** 1.5) : misturar(1, 0.55, frontal ** 2));
    const pt = new THREE.Vector3()
      .copy(p)
      .addScaledVector(fora, saida * s + 0.004)
      .add(new THREE.Vector3(0, alt * s * (deitada ? 0.35 : 1), 0));
    return [pt.x, pt.y, pt.z];
  }, N, 6, { inverter: true });
}
