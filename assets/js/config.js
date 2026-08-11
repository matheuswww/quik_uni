/* ==========================================================================
   Quik Uniformes — configuração do site
   --------------------------------------------------------------------------
   >>> PREENCHER ANTES DE PUBLICAR <<<
   Tudo que depende de dados reais da empresa está reunido aqui. Enquanto um
   campo estiver como null, o site simplesmente não mostra o canal — nenhum
   botão falso, nenhum link quebrado, nenhum número inventado.
   ========================================================================== */

export const QUIK_CONFIG = {

  /* ----------------------------------------------------------------------
     CANAIS DE CONTATO  —  null = não publicado
     ---------------------------------------------------------------------- */
  contato: {
    // só dígitos, com DDI e DDD. ex.: "5511999999999"
    whatsapp: "5513991900224",
    // ex.: "contato@exemplo.com.br"
    email: null,
    // como você quer que apareça na tela. ex.: "(11) 99999-9999"
    whatsappVisivel: "(13) 99190-0224",
    // ex.: "Rua Exemplo, 100 — Bairro, Cidade/UF"
    endereco: null,
    // ex.: "@quikuniformes"
    instagram: "quik_uni",
  },

  /* ----------------------------------------------------------------------
     COMPORTAMENTO
     ---------------------------------------------------------------------- */
  opcoes: {
    // mostra a introdução costurada apenas uma vez por sessão
    introUmaVezPorSessao: true,
    // tamanho máximo do arquivo de estampa, em MB
    limiteArquivoMB: 20,
  },
};
