/* ==========================================================================
   Bagagem — o "20" que revela a foto
   --------------------------------------------------------------------------
   Os dígitos são a máscara: a fotografia do bordado só existe dentro deles.
   Enquanto a seção passa, a foto desliza atrás do recorte — quem rola vê o
   bordado atravessar o número. Com movimento reduzido, a foto fica parada e
   o conteúdo continua o mesmo.
   ========================================================================== */

import { aoRolar, aoEntrar, semMovimento, mapear } from "./movimento.js";

export function ligarBagagem() {
  const bloco = document.querySelector("[data-numero]");
  if (!bloco) return;

  const digitos = bloco.querySelector(".numero-mascara__digitos");
  if (!digitos || semMovimento()) return;

  let visivel = false;
  aoEntrar(bloco, (_, dentro) => { visivel = dentro; }, { umaVez: false, limiar: 0 });

  aoRolar(({ alturaTela }) => {
    if (!visivel) return;
    const r = bloco.getBoundingClientRect();
    // 0 quando o bloco entra por baixo, 1 quando sai por cima
    const t = mapear(r.top, alturaTela, -r.height, 0, 1);
    digitos.style.setProperty("--bg-y", `${30 + t * 40}%`);
  });
}
