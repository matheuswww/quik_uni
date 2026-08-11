/* ==========================================================================
   Processo — a peça se monta enquanto você lê
   O scroll dita a etapa: as mangas encaixam no molde, a peça recebe a cor, a
   costura corre pela barra, a aplicação entra e a etiqueta fecha o pedido.
   A cor usada aqui é a mesma escolhida no estúdio.
   ========================================================================== */

import { aoRolar, aoEntrar, limitar } from "./movimento.js";

export function ligarProcesso() {
  const secao = document.getElementById("processo");
  if (!secao) return;

  const trilho = secao.querySelector("[data-processo]");
  const etapas = Array.from(secao.querySelectorAll("[data-etapa]"));
  const contador = secao.querySelector("[data-contador]");
  const visual = secao.querySelector("[data-peca-processo]");
  if (!etapas.length) return;

  let atual = 0;
  let visivel = false;

  aoEntrar(secao, (_el, dentro) => { visivel = dentro; }, { umaVez: false, limiar: 0 });

  function aplicar(i) {
    i = limitar(i, 0, etapas.length - 1);
    if (i === atual && trilho.dataset.etapaAtiva) return;
    atual = i;
    trilho.dataset.etapaAtiva = String(i + 1);
    etapas.forEach((li, j) => {
      if (j === i) li.dataset.ativa = "sim";
      else delete li.dataset.ativa;
    });
    if (contador) contador.textContent = String(i + 1).padStart(2, "0");
  }

  aoRolar(({ alturaTela }) => {
    if (!visivel) return;
    // a etapa ativa é a que está mais perto da linha de leitura
    const linha = alturaTela * 0.45;
    let melhor = 0;
    let menorDistancia = Infinity;
    etapas.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - linha);
      if (d < menorDistancia) { menorDistancia = d; melhor = i; }
    });
    aplicar(melhor);
  });

  // a cor da aplicação acompanha o estúdio
  window.addEventListener("quik:cor-peca", (e) => {
    visual?.style.setProperty("--tom-processo", e.detail.hex);
  });

  aplicar(0);
}
