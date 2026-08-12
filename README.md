# Quik Uniformes — site

Duas páginas: o site (`index.html`) e o **Estúdio 3D** (`estudio.html`), um
configurador de peças que funciona de verdade no navegador. **HTML, CSS e
JavaScript puros**, sem framework e sem dependência remota em produção. O build
usa Vite; a única biblioteca carregada no navegador é o three.js, que está no
repositório — e ela só é baixada por quem abre o estúdio.

---

## 1. Rodar localmente

Instale as dependências de desenvolvimento e inicie o servidor do Vite:

```bash
cd quik_uni
npm install
npm run dev
```

Para gerar e conferir a versão de produção:

```bash
npm run build
npm run preview
```

O build gera `dist/` com HTML, CSS e JavaScript minificados, nomes com hash para
cache e chunks separados para o 3D e o carregador GLTF. Publique apenas o
conteúdo de `dist/`. Os módulos ES exigem HTTP; abrir o `index.html` diretamente
por `file://` não funciona.

## 2. Preencher os dados da empresa

**Um arquivo só:** `assets/js/config.js`.

```js
contato: {
  whatsapp: "5513991900224",
  email: null,
  whatsappVisivel: "(13) 99190-0224",
  endereco: null,
  instagram: null,       // "@quikuniformes"
}
```

Enquanto um campo estiver `null`, **o canal simplesmente não aparece** no
rodapé. O contato principal do site é direto pelo WhatsApp; não há
formulário intermediário.

O mesmo arquivo guarda dois comportamentos (`opcoes.introUmaVezPorSessao`,
`opcoes.limiteArquivoMB`).

> O console do navegador avisa, em modo informativo, quais canais ainda estão
> sem preencher. É recado para quem publica, nunca para o visitante.

## 3. Estrutura

```
index.html                  o site: hero, express, bagagem, públicos, contato
estudio.html                o Estúdio 3D + "o que testar" + contato
package.json                scripts e dependências do build
vite.config.js              duas entradas, minificação, chunks e assets dinâmicos
dist/                       saída de produção (gerada, não versionada)
assets/
  css/  base.css            tokens, tipografia, botões, reveals, reduced-motion
        layout.css          preloader, cabeçalho, espinha, cascas de seção, rodapé
        sections.css        hero, bagagem, públicos, chamada do estúdio,
                            processo, contato
        studio.css          Estúdio 3D (visor, painel, prancheta)
        fonts.css           @font-face locais
  js/   config.js           >>> dados da empresa (editar) <<<
        dados.js            catálogo: tons, peças, áreas, públicos
        main.js             liga tudo
        modules/
          movimento.js      utilidades de scroll/rAF/observers e reduced-motion
          preloader.js      introdução costurada (1x por sessão)
          cabecalho.js      estado do cabeçalho, progresso, menu, CTA contextual
          hero.js           amostras de tom, paralaxe do molde, faixa rolante
          bagagem.js        a foto que desliza dentro do "20"
          publicos.js       abas de categoria sincronizadas com o scroll
          processo.js       máquina de estados das 4 etapas
          estudio.js        interface do estúdio (peça, cor, arquivo, prancheta)
          estudio3d.js      motor 3D (three.js) — carregado sob demanda
          estudio2d.js      motor plano, para navegador sem WebGL
          peca3d.js         geometria das peças
          tecido.js         painéis em canvas (cor, trama, acabamento e artes)
  img/                      fotos ilustrativas (WebP, 3 larguras)
  fonts/                    WOFF2 locais
  brand/                    monograma, favicons, imagem de compartilhamento
  models/                   vazio: as peças são geométricas (ver item 5)
vendor/three/               three.js r161 (MIT)
tools/                      scripts que geraram imagens e ícones
.originais/                 JPGs originais das fotos (não vão para o ar)
SOURCES.md                  autores, plataformas, licenças e recortes
```

## 4. Como o estúdio funciona

Uma verdade só: a classe `Tecido` mantém **um canvas por área** da peça
(frente, costas, manga esquerda, manga direita) com cor de base, trama da
malha, acabamentos da modelagem e várias artes posicionadas. Esse mesmo canvas é a
textura do modelo 3D e é o que o modo plano desenha. Mudou a cor, mudou o
canvas, mudou tudo o que está na tela.

- O estúdio mora em `estudio.html`. A home só carrega o convite (a seção
  `#estudio-chamada`), então quem nunca abre o estúdio nunca baixa o 3D.
- O motor só é carregado quando a seção chega perto da tela (`import()`
  dinâmico). Antes disso o three.js não é baixado.
- Sem WebGL, entra `estudio2d.js`: mesma interface, mesmos painéis, um painel
  por vez dentro da silhueta da modelagem. Cor RGB, opacidade, múltiplos uploads, posição, tamanho,
  rotação e captura continuam funcionando — e o visor avisa que está em modo
  plano.
- O 3D desenha **sob demanda**: sem interação e sem transição, nenhum quadro é
  renderizado; fora da tela, o laço para.
- A roda do mouse só aproxima depois de interagir com o visor, para a página
  nunca perder o scroll.
- Arrastar sobre uma arte seleciona e move essa camada (raycast + teste de acerto no UV);
  arrastar no resto gira a peça.
- Teclado no visor: setas giram, `+`/`-` aproximam, `Home` reinicia. Na
  prancheta: setas movem (com `Shift`, mais rápido), `+`/`-` redimensionam,
  `[`/`]` giram.

## 5. Trocar as peças por modelos próprios (.glb)

Hoje as quatro peças são **geradas por geometria** em `peca3d.js`, a partir do
bloco `forma` de cada peça em `dados.js`. Foi decisão de projeto: sem arquivo de
terceiro não há dúvida de licença, e o mapeamento de textura fica previsível.

Para usar um modelo próprio:

1. coloque o arquivo em `assets/models/`;
2. informe o caminho no campo `glb` da peça, em `assets/js/dados.js`
   (hoje `glb: null`);
3. o modelo precisa ter as malhas nomeadas `frente`, `costas`, `mangaEsq` e
   `mangaDir`, com UV de 0 a 1 por painel — é isso que faz o canvas da frente
   cair exatamente na frente da peça;
4. mantenha a lista `areas` coerente com o que o modelo tem. Uma peça sem
   mangas, por exemplo, deve listar apenas `["frente", "costas"]`, e o estúdio
   deixa de oferecer manga.

O carregamento já está implementado (`GLTFLoader` local, importado só quando
alguma peça tem `glb`): a peça gerada aparece primeiro e o arquivo entra no lugar
dela quando termina de carregar, com escala e centro normalizados. Se o arquivo
falhar ou não tiver nenhuma malha com esses nomes, a peça gerada continua na tela
e o motivo aparece no console — o estúdio nunca fica vazio.

Enquanto `glb` for `null`, a peça continua sendo gerada por geometria. Nenhuma
opção aparece na interface sem existir de fato.

### Acrescentar uma cor

`TONS`, em `dados.js`. Hero e estúdio leem a mesma lista; o estúdio também
aceita qualquer tom RGB com controle de opacidade.

### Acrescentar uma categoria de público

`PUBLICOS`, em `dados.js` — abas, imagem, tom da seção e texto vêm de lá. A
imagem precisa existir em `assets/img/` nas larguras informadas.

## 6. Rodar os scripts de apoio

Precisam de Python 3 e, no caso das imagens, do ImageMagick 7 (`magick`).

```bash
# refaz as imagens ilustrativas e regera o SOURCES.md
python3 tools/build_images.py            # usa os originais em .originais/
python3 tools/build_images.py --force    # baixa tudo de novo
python3 tools/build_images.py --sources  # só regera o SOURCES.md

# refaz favicons, ícone de toque e imagem de compartilhamento
python3 tools/build_brand.py
```

O `MANIFESTO` no topo de `build_images.py` é a fonte de verdade das fotos:
slug, autor, formato, recorte e onde a imagem aparece. Editar lá e rodar de novo
mantém o `SOURCES.md` correto.

## 7. Acessibilidade e movimento

- `prefers-reduced-motion` remove paralaxe, movimento por cursor e a montagem
  animada da peça; a introdução é ignorada e todo o conteúdo aparece de imediato.
  Nenhuma informação existe apenas dentro de uma animação.
- As categorias são um `tablist` real; o visor 3D tem `role="application"`,
  descrição em texto que acompanha o estado da peça e
  região de status para avisar cada mudança.
- Foco visível em tudo, menu do celular com foco preso enquanto aberto e
  fechamento por `Esc`.

## 8. Sobre o conteúdo

Os textos falam de uniformes e peças personalizadas, personalização, acabamento
e atendimento — e da experiência de 20 anos dos responsáveis. **Não há número,
cliente, marca atendida, prazo, preço, avaliação ou certificação inventado.** As
fotografias são ilustrativas e o site diz isso onde elas aparecem; os créditos
estão em [SOURCES.md](SOURCES.md).
# quik_uni
