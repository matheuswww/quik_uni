#!/usr/bin/env python3
"""
Ativos de marca — Quik Uniformes
Gera favicons e a imagem de compartilhamento (Open Graph) a partir do
monograma vetorizado em assets/brand/qk-mark.svg e da fonte de display local.
"""
import io
import os
import re

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "assets/brand")
MARK = os.path.join(BRAND, "qk-mark.svg")

BREU = (11, 11, 12)
CROMO = (232, 234, 235)
LINHA = (255, 74, 30)


def carregar_paths():
    svg = open(MARK).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    paths = []
    for d in re.findall(r'd="M([^"]+)Z"', svg):
        pts = [(float(a), float(b)) for a, b in (q.split(",") for q in d.split())]
        paths.append(pts)
    return vb, paths


def desenhar_marca(size, cor, escala=0.66, ss=4):
    """Renderiza o monograma centralizado num quadrado transparente (even-odd)."""
    vb, paths = carregar_paths()
    S = size * ss
    alvo = S * escala
    k = alvo / max(vb[2], vb[3])
    offx = (S - vb[2] * k) / 2 - vb[0] * k
    offy = (S - vb[3] * k) / 2 - vb[1] * k
    acc = np.zeros((S, S), bool)
    for pts in paths:
        m = Image.new("1", (S, S), 0)
        ImageDraw.Draw(m).polygon([(x * k + offx, y * k + offy) for x, y in pts], fill=1)
        acc ^= np.asarray(m, bool)
    alpha = Image.fromarray((acc * 255).astype(np.uint8), "L").resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (*cor, 0))
    out.putalpha(alpha)
    return out


def favicon_svg():
    svg = open(MARK).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    corpo = "\n    ".join(re.findall(r"<path d=\"[^\"]+\"/>", svg))
    lado = max(vb[2], vb[3]) / 0.62
    ox = vb[0] - (lado - vb[2]) / 2
    oy = vb[1] - (lado - vb[3]) / 2
    out = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{ox:.1f} {oy:.1f} {lado:.1f} {lado:.1f}">
  <title>Quik Uniformes</title>
  <rect x="{ox:.1f}" y="{oy:.1f}" width="{lado:.1f}" height="{lado:.1f}" rx="{lado*0.22:.1f}" fill="#0b0b0c"/>
  <g fill="#e8eaeb" fill-rule="evenodd">
    {corpo}
  </g>
</svg>
'''
    open(os.path.join(BRAND, "favicon.svg"), "w").write(out)
    print("favicon.svg")


def favicon_png():
    for size, nome, raio in ((32, "favicon-32.png", 6), (180, "apple-touch-icon.png", 38)):
        base = Image.new("RGBA", (size * 4, size * 4), (0, 0, 0, 0))
        d = ImageDraw.Draw(base)
        d.rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=raio * 4, fill=(*BREU, 255))
        base = base.resize((size, size), Image.LANCZOS)
        base.alpha_composite(desenhar_marca(size, CROMO, escala=0.62))
        base.save(os.path.join(BRAND, nome))
        print(nome, base.size)


def fonte(path_woff2, tamanho):
    """woff2 -> ttf em memória para o PIL desenhar com a fonte da marca."""
    f = TTFont(path_woff2)
    buf = io.BytesIO()
    f.flavor = None
    f.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, tamanho)


def og_image():
    W, H = 1200, 630
    foto = os.path.join(ROOT, "assets/img/uniforme-staff-costas-1600.webp")
    base = Image.open(foto).convert("RGB").resize((int(H * 1.35), H), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), BREU)
    canvas.paste(base, (W - base.width, 0))
    # véu escuro da esquerda para a direita, para o texto respirar
    grad = Image.new("L", (W, 1))
    for x in range(W):
        t = x / W
        grad.putpixel((x, 0), int(255 - 190 * min(1.0, max(0.0, (t - 0.34) / 0.55))))
    veu = Image.new("RGB", (W, H), BREU)
    canvas = Image.composite(veu, canvas, grad.resize((W, H)))

    d = ImageDraw.Draw(canvas)
    fdir = os.path.join(ROOT, "assets/fonts")
    f_disp = fonte(os.path.join(fdir, "bigshoulders-latin-400-900.woff2"), 96)
    f_mono = fonte(os.path.join(fdir, "spacemono-latin-400.woff2"), 22)
    f_body = fonte(os.path.join(fdir, "archivo-latin-400-700.woff2"), 27)

    marca = desenhar_marca(96, CROMO, escala=0.98)
    canvas.paste(marca, (72, 62), marca)
    d.text((186, 74), "QUIK", font=fonte(os.path.join(fdir, "bigshoulders-latin-400-900.woff2"), 44), fill=CROMO)
    d.text((186, 116), "UNIFORMES", font=fonte(os.path.join(fdir, "spacemono-latin-400.woff2"), 17), fill=(154, 161, 166))

    d.text((72, 250), "UNIFORME NÃO É ROUPA.", font=f_disp, fill=CROMO)
    d.text((72, 338), "É A SUA MARCA VESTIDA.", font=f_disp, fill=LINHA)
    d.text((74, 452), "Peças personalizadas com 20 anos de bagagem —\ne um estúdio 3D para você criar a sua.",
           font=f_body, fill=(196, 200, 203), spacing=10)

    # linha de costura tracejada, do jeito que atravessa o site
    y = 214
    x = 72
    while x < W - 60:
        d.line([(x, y), (x + 16, y)], fill=(110, 118, 124), width=2)
        x += 28
    d.text((72, 576), "ESTÚDIO 3D QUIK  ·  UNIFORMES PERSONALIZADOS", font=f_mono, fill=(122, 129, 134))

    canvas.save(os.path.join(BRAND, "og-image.jpg"), quality=86, optimize=True)
    print("og-image.jpg", canvas.size)


if __name__ == "__main__":
    favicon_svg()
    favicon_png()
    og_image()
