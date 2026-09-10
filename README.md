# Textura Psicodélica — v0.1

Editor vetorial pra criar texturas seamless tileáveis, desenhando com
curvas Bézier / mão livre / formas, com preview lado a lado do tile único
e do padrão repetido. Feito porque a ferramenta que inspirou o conceito
só existe pra Windows — essa versão é web, vanilla JS/Canvas, sem build
step, seguindo o mesmo stack dos outros projetos (GitHub Pages /
Cloudflare Pages).

## Rodando local

Sem dependências, sem build. Só precisa servir os arquivos estáticos
(não abrir o `index.html` direto com `file://`, porque os `<script>` são
carregados como arquivos separados e alguns navegadores bloqueiam):

```bash
npx serve .
# ou
python3 -m http.server 8080
```

## Como o tiling seamless funciona (o núcleo do produto)

Um padrão é periódico por definição: qualquer coisa em `(x, y)` é
idêntica à mesma coisa em `(x + tileSize, y)`. Por isso, em vez de tentar
"cortar e colar" o que passa da borda, cada path é desenhado **9 vezes**
— nos deslocamentos `{-tileSize, 0, +tileSize}` em X e Y — e o clip
retangular do tile corta naturalmente o que não pertence a ele. As 8
cópias fantasmas garantem continuidade em qualquer borda ou canto, sem
nenhuma lógica de recorte manual.

Ponto importante: os pontos de um path ficam em coordenadas "tile-local"
mas **sem clamp** — um ponto pode ter `x = -30` (foi desenhado na
margem de sangria à esquerda). Isso é intencional, é o que faz o wrap
funcionar sem nenhuma normalização.

Arquivos relevantes:
- `js/engine/render.js` — `drawStamped()` é o coração disso tudo.
- `js/engine/render.js` — `renderCleanTile()` gera o tile "de verdade"
  (usado tanto no preview quanto no export, pra nunca divergirem).
- `js/engine/render.js` — `renderEditView()` é só uma versão com sangria
  visível (opacidade reduzida) pra dar feedback visual ao desenhar perto
  da borda.

## Estrutura

```
index.html
css/style.css
js/main.js              — input do mouse/teclado, liga UI ao estado
js/engine/state.js       — AppState: paths, tool ativa, estilo, histórico
js/engine/geometry.js    — traça paths (bezier/freehand/elipse/retângulo) num ctx
js/engine/render.js      — motor de tiling (stamping 3x3) + preview + edit view
js/engine/tools.js       — Pen, Freehand, Ellipse, Rect (onDown/onMove/onUp)
js/engine/export.js      — export PNG
```

## O que já tem (v0.1)

- Pena Bézier (clique = âncora reta, clique+arrasta = handle suave,
  clique perto do primeiro ponto fecha o path, Enter finaliza, Esc cancela)
- Mão livre
- Elipse e retângulo
- Wrap seamless completo (o difícil)
- Preview 3x3 do padrão repetido, sincronizado em tempo real
- Estilo básico: cor, espessura, opacidade (traço único, sem por-path ainda)
- Undo (histórico de snapshots)
- Export PNG no tamanho do tile (256/512/1024)

## Roadmap (próximos commits, em ordem de dependência)

1. **Estilo por path + camadas** — hoje o estilo é global; precisa virar
   por-objeto, e depois agrupar em camadas com reordenação/visibilidade.
2. **Gradiente multi-stop (até 16 cores)** — `CanvasGradient` já suporta
   N stops nativamente, o trabalho é a UI de editar as paradas de cor.
3. **Taper (afinamento nas pontas)** — Canvas não tem `stroke-width`
   variável nativo. Precisa converter a centerline em um polígono
   preenchido com largura calculada ponto a ponto (largura interpolada
   entre `widthStart` e `widthEnd` ao longo do comprimento do path).
4. **Glow** — `ctx.shadowBlur` + `ctx.shadowColor` resolve o caso simples;
   glow mais forte pode precisar de um blur em canvas offscreen composto
   por cima.
5. **Dash animado / stroke viajando pela forma** — parametrizar tudo em
   função de `t` (0 a 1, módulo duração do loop) e usar
   `ctx.lineDashOffset` animado por `requestAnimationFrame`. Pulso de
   opacidade e shift de cor são a mesma ideia (interpolação por fase).
6. **Export de sequência PNG + WebM** — sequência é só rodar o render
   frame a frame fora de tempo real e empacotar com JSZip; WebM é
   `canvas.captureStream()` + `MediaRecorder` (tem a mesma limitação de
   fundo opaco do original, a menos que se troque por ffmpeg.wasm).
7. **Tracing de imagem raster → path editável** — algoritmo tipo potrace
   (diferente do Canny que a gente usou no preview de tatuagem — ali era
   detecção de borda, aqui precisa ser fill de região + contorno
   fechado). Dá pra usar uma lib pronta (ex: `potrace` ou
   `ImageTracer.js`) em vez de reescrever do zero.
8. **Salvar/carregar projeto (`.tsproj` equivalente)** — serializar
   `AppState.paths` + config em JSON. Trivial uma vez que o modelo de
   dados já é serializável (já é, hoje).
9. **Empacotamento desktop** — Electron por cima do mesmo HTML/JS/CSS,
   pra virar "app instalável" sem navegador, com salvar/abrir arquivo
   local nativo.

## Supabase (quando entrar)

Não tem nada de Supabase ainda nessa v0.1 — é 100% local/client-side, de
propósito, igual ao produto original ("no account or internet connection
required"). Onde o Supabase provavelmente entra depois: sincronizar
projetos entre dispositivos, ou uma galeria de padrões salvos — mas isso
é opcional e não deveria ser dependência pra usar o editor.
