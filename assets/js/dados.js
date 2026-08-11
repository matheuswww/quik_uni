/* ==========================================================================
   Quik Uniformes — catálogo e conteúdo das seções orientadas a dados
   ========================================================================== */

/* --------------------------------- tons ---------------------------------- */
/* Nomes de tom que a Quik pode conferir na prática. Se um tom sair da carta,
   basta editar aqui — hero, estúdio e processo usam a mesma lista. */
export const TONS = [
  { id: "breu",     nome: "Preto carvão",  hex: "#1b1d21" },
  { id: "cromo",    nome: "Cinza cromo",   hex: "#9aa1a6" },
  { id: "cru",      nome: "Off white",     hex: "#e8e2d6" },
  { id: "linha",    nome: "Laranja linha", hex: "#e8501f" },
  { id: "vinho",    nome: "Vinho",         hex: "#6d1f2a" },
  { id: "petroleo", nome: "Azul petróleo", hex: "#1d3b4a" },
  { id: "musgo",    nome: "Verde musgo",   hex: "#3a4433" },
  { id: "areia",    nome: "Areia",         hex: "#b39b7a" },
];

/* -------------------------------- peças ---------------------------------- */
/* Cada peça é gerada por geometria no navegador (nada de arquivo externo).
   Para trocar por um modelo próprio, coloque o .glb em assets/models/ e
   informe o caminho em `glb` — o estúdio carrega o arquivo em vez da
   geometria gerada. Ver README.md. */
export const PECAS = [
  {
    id: "camiseta",
    nome: "Camiseta",
    nota: "Malha de gola redonda, manga curta. O básico que mais sai.",
    glb: null,
    areas: ["frente", "costas", "manga-esq", "manga-dir"],
    forma: {
      largura: 1.0, profundidade: 0.60, altura: 1.30,
      manga: { comprimento: 0.44, raio: 0.185, punho: 0.135, queda: 0.72 },
      gola: { tipo: "ribana", profundidade: 0.045, largura: 0.118, raio: 0.018 },
      cintura: 0.0,
    },
    risco: "M22 11 L36 6 C44 15 56 15 64 6 L78 11 L96 30 L84 44 L78 36 L79 98 L21 98 L22 36 L16 44 L4 30 Z",
  },
  {
    id: "polo",
    nome: "Polo",
    nota: "Gola polo com carcela e dois botões. Cara de atendimento.",
    glb: null,
    areas: ["frente", "costas", "manga-esq", "manga-dir"],
    forma: {
      largura: 0.97, profundidade: 0.58, altura: 1.30,
      manga: { comprimento: 0.42, raio: 0.175, punho: 0.132, queda: 0.7 },
      gola: { tipo: "polo", profundidade: 0.07, largura: 0.115, raio: 0.019 },
      cintura: 0.02,
    },
    risco: "M22 11 L34 6 L44 17 L50 11 L56 17 L66 6 L78 11 L96 30 L84 44 L78 36 L79 98 L21 98 L22 36 L16 44 L4 30 Z M46 17 L46 42 M54 17 L54 42",
  },
  {
    id: "manga-longa",
    nome: "Manga longa",
    nota: "Mesma malha, manga inteira. Boa para frio e para cobrir mais.",
    glb: null,
    areas: ["frente", "costas", "manga-esq", "manga-dir"],
    forma: {
      largura: 1.0, profundidade: 0.60, altura: 1.30,
      manga: { comprimento: 1.35, raio: 0.185, punho: 0.092, queda: 0.98 },
      gola: { tipo: "ribana", profundidade: 0.045, largura: 0.118, raio: 0.018 },
      cintura: 0.0,
    },
    risco: "M22 11 L36 6 C44 15 56 15 64 6 L78 11 L92 26 L99 80 L86 85 L78 40 L79 98 L21 98 L22 40 L14 85 L1 80 L8 26 Z",
  },
];

/* ------------------------------- áreas ----------------------------------- */
export const AREAS = [
  { id: "frente",    nome: "Frente",      curto: "frente",          onde: "na frente",          origem: "da frente" },
  { id: "costas",    nome: "Costas",      curto: "costas",          onde: "nas costas",         origem: "das costas" },
  { id: "manga-esq", nome: "Manga esq.",  curto: "manga esquerda",  onde: "na manga esquerda",  origem: "da manga esquerda" },
  { id: "manga-dir", nome: "Manga dir.",  curto: "manga direita",   onde: "na manga direita",   origem: "da manga direita" },
];

/* ------------------------------ públicos --------------------------------- */
export const PUBLICOS = [
  {
    id: "empresas",
    nome: "Empresas e equipes",
    titulo: "Empresas e equipes corporativas",
    descricao: "Time inteiro com a mesma cara, do escritório à operação. Numeração de tamanhos organizada por pessoa e uma referência de cor guardada para a próxima reposição.",
    pecas: ["Camiseta", "Polo", "Manga longa"],
    tom: "rgba(154, 161, 166, 0.16)",
    imagem: {
      base: "uniforme-staff-costas",
      larguras: [700, 1100, 1600],
      alt: "Duas pessoas de costas vestindo a mesma camiseta escura de equipe, com aplicação nas costas",
    },
  },
  {
    id: "negocios",
    nome: "Pequenos negócios",
    titulo: "Pequenos e médios negócios",
    descricao: "Poucas peças, mesmo padrão. Dá para começar com o essencial e repor depois sem perder a cor nem a posição da logo.",
    pecas: ["Camiseta", "Polo"],
    tom: "rgba(179, 155, 122, 0.18)",
    imagem: {
      base: "atendimento-loja",
      larguras: [480, 900, 1400],
      alt: "Atendente de avental escuro anotando um pedido no salão de um estabelecimento",
    },
  },
  {
    id: "servicos",
    nome: "Lojas e serviços",
    titulo: "Lojas, restaurantes e prestadores de serviço",
    descricao: "Quem atende de frente precisa de peça que aguente turno inteiro e lavagem frequente — e que continue apresentável na frente do cliente.",
    pecas: ["Camiseta", "Polo", "Manga longa"],
    tom: "rgba(232, 80, 31, 0.14)",
    imagem: {
      base: "cafe-balcao-dupla",
      larguras: [480, 900, 1400],
      alt: "Dupla de atendentes de avental atrás do balcão de uma cafeteria",
    },
  },
  {
    id: "eventos",
    nome: "Eventos e projetos",
    titulo: "Eventos, equipes e projetos especiais",
    descricao: "Lote para uma data específica: staff de evento, ação de marca, campeonato interno, turma de curso. Peça reconhecível de longe.",
    pecas: ["Camiseta", "Polo"],
    tom: "rgba(232, 80, 31, 0.2)",
    imagem: {
      base: "staff-evento",
      larguras: [480, 900, 1400],
      alt: "Homem de costas vestindo camiseta com a palavra STAFF estampada em laranja",
    },
  },
  {
    id: "marcas",
    nome: "Marcas e criações",
    titulo: "Marcas e criações próprias",
    descricao: "Você tem a arte e quer ver virar peça. A gente fecha o arquivo, testa a aplicação e produz a sua tiragem.",
    pecas: ["Camiseta", "Manga longa"],
    tom: "rgba(109, 31, 42, 0.22)",
    imagem: {
      base: "serigrafia-tela",
      larguras: [480, 900, 1400],
      alt: "Pessoa segurando uma tela de serigrafia com desenho gravado contra a luz da janela",
    },
  },
];
