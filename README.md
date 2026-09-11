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

## O que já tem (v0.2)

- Pena Bézier (clique = âncora reta, clique+arrasta = handle suave,
  clique perto do primeiro ponto fecha o path, Enter finaliza, Esc cancela)
- Mão livre, elipse, retângulo
- Wrap seamless completo (o difícil)
- Preview 3x3 do padrão repetido, sincronizado em tempo real
- Undo (histórico de snapshots), export PNG (256/512/1024)
- **Efeitos** (`js/engine/render.js` + `js/engine/geometry.js` + `js/engine/color.js`):
  - **Gradiente** — linear, 2 paradas de cor, direção = do primeiro ao
    último ponto amostrado da forma (`Geometry.flatten`).
  - **Taper** (afinamento nas pontas) — Canvas não tem stroke de largura
    variável nativo, então a centerline é convertida num polígono
    preenchido (`Geometry.taperedPolygon`), com largura interpolada por
    **fração do comprimento de arco** (não por índice de ponto, pra ficar
    proporcional visualmente mesmo em curvas com pontos desiguais).
  - **Glow** — `ctx.shadowBlur` + `ctx.shadowColor`.
  - **Dash animado** — `ctx.setLineDash` + `lineDashOffset` animado por
    tempo real (`requestAnimationFrame`), velocidade em px/s (negativa
    inverte o sentido).
  - **Pulso de opacidade** — oscilação senoidal em função do tempo,
    velocidade em ciclos/s.
  - **Snake** (traço viajando ao redor da forma) — equivalente ao "Travelling
    stroke" do produto original: um segmento curto e afinado (não o path
    inteiro) que percorre o perímetro em loop, com **posição inicial %**,
    **reverse** (a ponta grossa sempre lidera o movimento, a cauda fina
    sempre arrasta atrás — isso é resolvido invertendo start/end do
    polígono, não o sentido do cálculo de posição) e **ciclos travados no
    loop** (`Off` = velocidade livre para preview; `N` = exatamente N
    voltas dentro de `AppState.loopDuration`, o que garante fechamento
    perfeito quando isso virar export de sequência animada). Implementado
    com `Geometry.arcLengthTable` + `Geometry.snakeSegment` (extrai a
    janela móvel do path, com wrap quando a cabeça cruza o ponto de
    origem) e reaproveita `widthPolygonFromPoints` (mesma base do taper).
    **Substitui** taper e dash normais nesse path enquanto ligado.
  - **Shift de cor** (por traço) — rotação contínua de matiz (HSL) em
    função do tempo (`ColorUtil.shiftHue`), aplicado tanto a cor sólida
    quanto a cada parada do gradiente.
  - **Matiz global** — equivalente ao "Global hue" do original: gira a
    cor de **todo o tile já composto**, via `ctx.filter = hue-rotate(...)`
    aplicado no canvas final (`Renderer.applyGlobalHueFilter`), diferente
    do shift por-traço acima.

Os efeitos são hoje **globais** (aplicam ao próximo traço desenhado, não
retroativos aos já existentes) — cada path guarda seu próprio snapshot de
estilo (`AppState.cloneStyle()`, cópia profunda), então tecnicamente já
está pronto pra virar "por objeto" assim que existir uma ferramenta de
seleção. Export PNG congela em t=0 (determinístico); export animado é
item de roadmap (sequência PNG / WebM).

## Roadmap (próximos commits, em ordem de dependência)

1. **Ferramenta de seleção + estilo por path** — clicar num traço
   existente e reabrir seu estilo no painel (hoje só dá pra definir o
   estilo do *próximo* traço, com o botão "Reaplicar estilo" como
   atalho de força-bruta pra tudo).
2. **Taper com zona + profile** — o original tem `Start length%` /
   `End length%` (o taper pode valer só numa fração do comprimento, não
   o traço inteiro) e um `Profile` (expoente de easing da interpolação,
   1 = linear). Hoje meu taper é sempre linear e cobre 100% do traço.
3. **Dash taper** — cada segmento do dash animado também pode ter seu
   próprio afinamento nas pontas, independente do taper do traço todo.
4. **Gradiente com N paradas (até 16)** — o motor já suporta
   (`CanvasGradient` aceita quantos stops quiser), falta só a UI de
   lista dinâmica em vez de 2 cores fixas.
5. **Grid snap ao desenhar** — "Snap to grid" com espaçamento configurável,
   presente no produto original, ainda não implementado aqui.
6. **Camadas** — agrupar paths, reordenar, visibilidade, duplicar.
7. **Export de sequência PNG + WebM** — sequência é rodar o render
   frame a frame fora de tempo real (já dá pra fazer isso corretamente
   agora que os efeitos com ciclos travados fecham no `loopDuration`) e
   empacotar com JSZip; WebM é `canvas.captureStream()` + `MediaRecorder`
   (mesma limitação de fundo opaco do original, a menos que se troque
   por ffmpeg.wasm).
8. **Tracing de imagem raster → path editável** — algoritmo tipo potrace
   (diferente do Canny que a gente usou no preview de tatuagem — ali era
   detecção de borda, aqui precisa ser fill de região + contorno
   fechado). Dá pra usar lib pronta (`potrace` / `ImageTracer.js`).
9. **Salvar/carregar projeto (`.tsproj` equivalente)** — serializar
   `AppState.paths` + config em JSON. Trivial, o modelo já é
   serializável hoje.
10. **Empacotamento desktop** — Electron por cima do mesmo HTML/JS/CSS.

## Limitação conhecida do taper

`Geometry.taperedPolygon` usa a técnica simples de offset perpendicular
por normal local — funciona bem na maioria dos casos, mas pode
autointersectar em curvas muito fechadas com largura grande (artefato
visual, não erro). Se aparecer, é o próximo ajuste fino a fazer.

## Supabase (quando entrar)

Não tem nada de Supabase ainda nessa v0.1 — é 100% local/client-side, de
propósito, igual ao produto original ("no account or internet connection
required"). Onde o Supabase provavelmente entra depois: sincronizar
projetos entre dispositivos, ou uma galeria de padrões salvos — mas isso
é opcional e não deveria ser dependência pra usar o editor.
