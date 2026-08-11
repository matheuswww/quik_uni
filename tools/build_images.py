#!/usr/bin/env python3
"""
Pipeline de imagens ilustrativas — Quik Uniformes
=================================================
Baixa os originais do CDN do Unsplash, aplica um mesmo tratamento de cor
(para que fotos de autores diferentes formem um conjunto coerente),
recorta nos formatos usados no layout e exporta WebP em 3 larguras.

Uso:  python3 tools/build_images.py [--force]

O MANIFESTO abaixo é a única fonte de verdade: alimenta a conversão e a
geração do SOURCES.md (autor, plataforma, licença, uso na página).
Todas as fotos são da Unsplash License (uso comercial livre, sem atribuição
obrigatória — creditamos por escolha editorial). Nenhuma imagem premium
(plus.unsplash.com) é usada.
"""
import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(ROOT, ".originais")          # fora do build final
OUT = os.path.join(ROOT, "assets/img")
CDN = "https://images.unsplash.com/"

# formato -> (proporção, larguras exportadas)
FORMATOS = {
    "retrato":  (4 / 5,   [480, 900, 1400]),
    "paisagem": (3 / 2,   [600, 1200, 1800]),
    "quadrado": (1 / 1,   [500, 1000, 1500]),
    "heroi":    (4 / 5,   [700, 1100, 1600]),
    "alta":     (3 / 4,   [560, 1000, 1500]),
    "faixa":    (16 / 9,  [700, 1300, 1900]),
    "textura":  (3 / 2,   [900]),
}

# slug, id-cdn, autor, formato, gravity, uso na página, alt
MANIFESTO = [
    ("uniforme-staff-costas", "photo-1641122669951-3e2aff778d3b", "Joao Viegas", "heroi", "center",
     "Categoria: empresas e equipes",
     "Costas de jaquetas de uniforme escuras com a palavra STAFF aplicada em prata"),
    ("bordado-maquina", "photo-1772351720165-d9218e428cf0", "Rendy Novantino", "faixa", "center",
     "Seção 20 anos — imagem revelada dentro do numeral",
     "Máquina de bordar industrial costurando um desenho sobre tecido preso no bastidor"),
    ("costura-linha-preta", "photo-1497997092403-f091fcf5b6c4", "Alexander Andrews", "retrato", "center",
     "Seção 20 anos e galeria",
     "Calcador de máquina de costura com linha branca sobre tecido preto"),
    ("agulha-ponto-tecido", "photo-1783070610434-0a58f21852bd", "PJ Wallace", "quadrado", "center",
     "Galeria — ponto da máquina em close",
     "Agulha de máquina formando pontos brancos em tecido escuro, em close"),
    ("uniforme-avental-detalhe", "photo-1729774094914-836c6e124152", "Golden Horn Bridge", "retrato", "center",
     "Hero — foto dentro do molde",
     "Detalhe de avental preto de uniforme vestido, com bolso frontal costurado"),
    ("atendimento-loja", "photo-1758519289791-ffce8889ca8c", "Vitaly Gariev", "retrato", "north",
     "Categoria: pequenos e médios negócios",
     "Atendente de avental escuro anotando um pedido no salão de um estabelecimento"),
    ("cafe-balcao-dupla", "photo-1753351052046-8c6818304a4f", "Vitaly Gariev", "retrato", "north",
     "Categoria: lojas, restaurantes e serviços",
     "Dupla de atendentes de avental atrás do balcão de uma cafeteria"),
    ("staff-evento", "photo-1531844188816-f64ca68eecd1", "Omar Lopez", "retrato", "center",
     "Categoria: eventos e projetos",
     "Homem de costas vestindo camiseta com a palavra STAFF estampada em laranja"),
    ("serigrafia-tela", "photo-1456456496250-d5e7c0a9b44d", "emarts emarts", "retrato", "center",
     "Categoria: marcas e criações próprias",
     "Pessoa segurando uma tela de serigrafia com desenho gravado contra a luz da janela"),
    ("serigrafia-mesa", "photo-1634713157685-676e35324215", "Đồng Phục Hải Triều", "paisagem", "center",
     "Galeria — aplicação na mesa de serigrafia",
     "Mãos puxando tinta com espátula sobre a bandeja de uma mesa de serigrafia industrial"),
    ("serigrafia-rodo", "photo-1643216674491-33878507b402", "Deniz Demirci", "paisagem", "center",
     "Galeria — rodo sobre a tela",
     "Mãos com luvas passando o rodo sobre uma tela de serigrafia amarela"),
    ("tecido-textura", "photo-1637004732258-4b792ce8f474", "Lawless Capture", "textura", "center",
     "Textura de fundo (baixa opacidade)",
     "Textura de malha preta em close, mostrando a trama do tecido"),
    ("tecido-relevo", "photo-1756364237224-49a7eef70960", "engin akyurt", "textura", "center",
     "Textura de fundo (baixa opacidade)",
     "Tecido escuro com relevo, iluminado de lado"),
]

# Recortes aplicados ANTES do enquadramento, em pixels do original (2200px de
# largura). Motivo de cada um está no SOURCES.md — em geral, tirar de quadro
# qualquer marca, patrocínio ou produto identificável.
CROPS = {
    # centraliza a peça com a aplicação legível
    "uniforme-staff-costas": "1174x1467+230+0",
    # fora: bastidor verde que puxava a foto para longe da paleta
    "agulha-ponto-tecido": "1100x1100+780+60",
    # fora: as peças com um emblema dourado repetido, que é a arte de outra
    # marca; sobra o gesto da aplicação, que é o assunto
    "serigrafia-mesa": "830x540+1370+400",
}

# tratamento de cor comum a todas: dessatura, dá contraste e joga um véu
# quente escuro por cima — é o que costura fotos de origens diferentes
# num único conjunto.
GRADE = [
    "-modulate", "99,72",
    "-brightness-contrast", "-3x9",
    "-fill", "#17120e", "-colorize", "7%",
]


def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("  ERRO:", " ".join(cmd)[:160], "\n ", r.stderr.strip()[:300])
        return False
    return True


def baixar(slug, pid, force):
    dst = os.path.join(ORIG, f"{slug}.jpg")
    if os.path.exists(dst) and os.path.getsize(dst) > 20000 and not force:
        return dst
    url = f"{CDN}{pid}?w=2200&q=82&fm=jpg&fit=max"
    ok = sh(["curl", "-sS", "--max-time", "120", "-o", dst, url])
    return dst if ok and os.path.getsize(dst) > 20000 else None


def converter(slug, fmt, gravity, force):
    src = os.path.join(ORIG, f"{slug}.jpg")
    ratio, larguras = FORMATOS[fmt]
    feitos = []
    for w in larguras:
        h = round(w / ratio)
        dst = os.path.join(OUT, f"{slug}-{w}.webp")
        if os.path.exists(dst) and not force:
            feitos.append(dst)
            continue
        recorte = ["-crop", CROPS[slug], "+repage"] if slug in CROPS else []
        cmd = ["magick", src, "-auto-orient", "-colorspace", "sRGB", *recorte,
               "-resize", f"{w}x{h}^", "-gravity", gravity, "-extent", f"{w}x{h}",
               *GRADE, "-unsharp", "0x0.7+0.6+0.02",
               "-define", "webp:method=6", "-quality", "76", "-strip", dst]
        if sh(cmd):
            feitos.append(dst)
    return feitos


CABECA_SOURCES = """<!-- Arquivo gerado por tools/build_images.py --sources. Não edite à mão:
     edite o MANIFESTO no script e rode de novo. -->

# Fontes, licenças e créditos

Tudo o que este site carrega vem de arquivos locais. Não há hotlink, CDN de
terceiros, rastreador nem fonte remota.

> **As fotografias são ilustrativas.** Vêm de banco de imagens gratuito, foram
> escolhidas para mostrar *tipos* de peça, aplicação e acabamento, e **não são
> trabalhos executados pela Quik Uniformes, nem clientes, nem pessoas ligadas à
> empresa.** O site diz isso na própria seção de referências e no rodapé.

---

## Fotografias — Unsplash

**Licença:** [Unsplash License](https://unsplash.com/license) — uso comercial
livre, sem atribuição obrigatória. Creditamos por escolha editorial. Nenhum
arquivo de Unsplash+ (`plus.unsplash.com`) foi usado; todos os originais foram
baixados do CDN público (`images.unsplash.com`) e estão versionados em
`.originais/` fora do site publicado.

**Verificação feita em cada imagem antes de entrar:**

1. licença conferida na página original da foto;
2. sem conteúdo premium ou pago;
3. sem logo, marca, patrocínio, estampa protegida ou produto identificável —
   quando aparecia algo assim, a foto foi recortada (ver "recortes") ou
   descartada;
4. nenhuma foto sugere que a pessoa ou a empresa retratada seja cliente da Quik;
5. nenhuma foto é apresentada como portfólio.

**Tratamento comum a todas** (é o que faz fotos de autores diferentes virarem um
conjunto só): dessaturação para 72%, contraste +9, brilho −3, véu de `#17120e` a
7%, leve unsharp; exportação em WebP (qualidade 76, method 6) em três larguras
por formato, com `loading="lazy"` e `srcset`/`sizes` no HTML.

Os links abaixo apontam para o **arquivo original no CDN da Unsplash** — é
exatamente o que foi baixado e tratado, e o endereço pode ser conferido a
qualquer momento. A licença é a mesma para todo o acervo público da plataforma
(link acima); o autor de cada foto está na tabela e pode ser procurado em
`unsplash.com/@`.

| Arquivo local | Autor | Plataforma | Licença | Onde aparece | Original |
|---|---|---|---|---|---|
"""

RODAPE_SOURCES = """
### Recortes aplicados

Feitos antes do enquadramento, para tirar de quadro qualquer marca ou elemento
que não deveria estar num site de outra empresa:

| Arquivo | Recorte | Motivo |
|---|---|---|
| `serigrafia-mesa` | `830x540+1370+400` | tira as peças com o emblema dourado de outra marca; fica só o gesto da aplicação |
| `uniforme-staff-costas` | `1174x1467+230+0` | centraliza a peça e a aplicação nas costas |
| `agulha-ponto-tecido` | `1100x1100+780+60` | tira o bastidor verde, que fugia da paleta |

Fotos descartadas na revisão visual, para registro: uma com trena de marca
visível, uma com listras de tênis reconhecíveis, aventais com texto em outro
idioma, camisetas com logo de empresa real e fotos de fundo branco de catálogo,
que quebravam a direção fotográfica.

---

## Tipografia

Fontes baixadas do Google Fonts e servidas localmente em `assets/fonts/`
(subconjuntos latin e latin-ext, WOFF2).

| Família | Uso | Licença |
|---|---|---|
| **Big Shoulders Display** (400–900) | títulos, numerais, rótulos de peça | [SIL Open Font License 1.1](https://openfontlicense.org/) |
| **Archivo** (400–700) | texto corrido | SIL Open Font License 1.1 |
| **Space Mono** (400/700) | rótulos técnicos, fichas, códigos de molde | SIL Open Font License 1.1 |

## Biblioteca 3D

| Item | Versão | Licença |
|---|---|---|
| **three.js** (`vendor/three/three.module.js`) | r161 | [MIT](https://github.com/mrdoob/three.js/blob/dev/LICENSE) |
| **GLTFLoader** (`vendor/three/GLTFLoader.js`) | r161 | MIT — mesmo repositório (`examples/jsm/loaders`) |
| **BufferGeometryUtils** (`vendor/three/BufferGeometryUtils.js`) | r161 | MIT — dependência do GLTFLoader (`examples/jsm/utils`) |

Nos dois arquivos de `examples/jsm` a única alteração foi apontar o `import`
para o `three.module.js` que está ao lado. Isso permite carregar o código-fonte
diretamente e também incluí-lo no build do Vite.

Nenhuma outra biblioteca de runtime ou framework é usado. Vite e o minificador
de HTML são dependências apenas de desenvolvimento. O `OrbitControls` não foi
incluído: a órbita da câmera é própria, em `assets/js/modules/estudio3d.js`. O
GLTFLoader fica em um chunk separado e só é baixado se alguma peça em `dados.js`
apontar para um arquivo `.glb` — no site como está, ele nunca é requisitado.

## Modelos 3D

**Não há modelo de terceiros neste projeto.** As quatro peças do Estúdio 3D Quik
são geradas por geometria no navegador (`assets/js/modules/peca3d.js`), a partir
de um perfil de modelagem descrito em `assets/js/dados.js`. A escolha foi
deliberada: sem arquivo externo não há dúvida de licença ou de procedência, e o
mapeamento de textura fica previsível — o canvas da frente é exatamente o painel
da frente. Para usar um modelo próprio (`.glb`/`.gltf`), veja o README.

O ambiente de iluminação também é gerado em tempo de execução (três softboxes +
PMREM), sem arquivo HDR para baixar.

## Marca

A logo da Quik Uniformes foi fornecida pela empresa (`pasted file.png`). O
monograma vetorial `assets/brand/qk-mark.svg`, o favicon, o ícone de toque e a
imagem de compartilhamento foram traçados a partir dela por
`tools/build_brand.py`. Esses arquivos são da Quik Uniformes e não estão sob as
licenças acima.
"""


def escrever_sources():
    linhas = []
    for slug, pid, autor, fmt, grav, uso, alt in MANIFESTO:
        larguras = ", ".join(str(w) for w in FORMATOS[fmt][1])
        link = f"{CDN}{pid}"
        linhas.append(
            f"| `{slug}` ({larguras}px) | {autor} | Unsplash | Unsplash License | {uso} | [arquivo]({link}) |"
        )
    caminho = os.path.join(ROOT, "SOURCES.md")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write(CABECA_SOURCES + "\n".join(linhas) + "\n" + RODAPE_SOURCES)
    print(f"SOURCES.md escrito com {len(MANIFESTO)} imagens")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--sources", action="store_true",
                    help="apenas regera o SOURCES.md a partir do MANIFESTO")
    args = ap.parse_args()

    if args.sources:
        escrever_sources()
        return
    os.makedirs(ORIG, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)

    total = 0
    falhas = []
    for slug, pid, autor, fmt, grav, uso, alt in MANIFESTO:
        if not baixar(slug, pid, args.force):
            falhas.append(slug)
            print(f"[falhou download] {slug}")
            continue
        feitos = converter(slug, fmt, grav, args.force)
        kb = sum(os.path.getsize(f) for f in feitos) / 1024
        total += kb
        print(f"{slug:26s} {fmt:9s} {len(feitos)} arquivos  {kb:7.1f} KB")

    print(f"\ntotal {total/1024:.2f} MB em assets/img")
    escrever_sources()

    if falhas:
        print("FALHAS:", falhas)
        sys.exit(1)


if __name__ == "__main__":
    main()
