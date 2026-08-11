import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { minify } from "html-minifier-terser";
import { defineConfig } from "vite";
import { PUBLICOS } from "./assets/js/dados.js";

const RAIZ = import.meta.dirname;
const EXTENSOES_MODELO = new Set([
  ".bin", ".glb", ".gltf", ".jpeg", ".jpg", ".ktx2", ".png", ".webp",
]);
const IMAGENS_DINAMICAS = new Set(PUBLICOS.flatMap(({ imagem }) =>
  imagem.larguras.map((largura) => `${imagem.base}-${largura}.webp`)));

async function listarArquivos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = await Promise.all(entradas.map(async (entrada) => {
    const absoluto = path.join(diretorio, entrada.name);
    return entrada.isDirectory() ? listarArquivos(absoluto) : [absoluto];
  }));
  return arquivos.flat();
}

/*
 * As fotos de "Públicos" e os futuros modelos GLB são resolvidos a partir do
 * catálogo em tempo de execução. Como não há um import estático para o Vite
 * seguir, eles entram explicitamente no bundle com o mesmo caminho público.
 */
function copiarAssetsDinamicos() {
  return {
    name: "quik-assets-dinamicos",
    apply: "build",
    async generateBundle(_opcoes, bundle) {
      const grupos = [
        { diretorio: "assets/img", aceitar: (arquivo) => IMAGENS_DINAMICAS.has(path.basename(arquivo)) },
        { diretorio: "assets/models", aceitar: (arquivo) => EXTENSOES_MODELO.has(path.extname(arquivo).toLowerCase()) },
      ];

      for (const grupo of grupos) {
        const base = path.join(RAIZ, grupo.diretorio);
        for (const absoluto of await listarArquivos(base)) {
          if (!grupo.aceitar(absoluto)) continue;
          const nome = path.relative(RAIZ, absoluto).replaceAll(path.sep, "/");
          if (bundle[nome]) continue;
          this.emitFile({ type: "asset", fileName: nome, source: await readFile(absoluto) });
        }
      }
    },
  };
}

function minificarHtml() {
  return {
    name: "quik-html-minificado",
    apply: "build",
    enforce: "post",
    async transformIndexHtml(html) {
      return minify(html, {
        collapseWhitespace: true,
        conservativeCollapse: true,
        removeComments: true,
      });
    },
  };
}

export default defineConfig({
  plugins: [copiarAssetsDinamicos(), minificarHtml()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    minify: "oxc",
    cssMinify: "lightningcss",
    sourcemap: false,
    reportCompressedSize: true,
    // O three.js fica isolado e só é baixado ao entrar no estúdio 3D.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        entryFileNames: "assets/js/[name]-[hash].js",
        chunkFileNames: "assets/js/[name]-[hash].js",
        manualChunks(id) {
          if (id.endsWith("/vendor/three/three.module.js")) return "three";
        },
        assetFileNames(info) {
          const original = info.originalFileNames?.[0]?.replaceAll("\\", "/") || "";
          const pasta = original.match(/(?:^|\/)assets\/(brand|fonts|img|models)\//)?.[1];
          if (pasta) return `assets/${pasta}/[name][extname]`;
          if (info.names?.some((nome) => nome.endsWith(".css"))) {
            return "assets/css/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
});
