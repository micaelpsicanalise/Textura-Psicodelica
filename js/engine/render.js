/**
 * Nucleo do tiling seamless.
 *
 * Um pattern e periodico por definicao: qualquer coisa desenhada em
 * (x, y) e visualmente identica a mesma coisa desenhada em
 * (x + tileSize, y) ou (x, y + tileSize). Entao pra garantir que um traco
 * que atravessa a borda do tile "continue" do outro lado, a gente nao
 * precisa de nenhuma logica especial de clip ou corte -- so precisa
 * desenhar CADA path 9 vezes, nos deslocamentos {-1,0,1} x {-1,0,1} vezes
 * tileSize, e deixar o clip retangular do canvas cortar naturalmente o
 * que nao pertence aquele tile. As 8 copias "fantasma" garantem que toda
 * borda tenha continuidade.
 */
const Renderer = {

  strokePath(ctx, path){
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = path.style.color;
    ctx.globalAlpha = path.style.opacity;
    ctx.lineWidth = path.style.width;
    Geometry.trace(ctx, path);
    ctx.stroke();
    ctx.restore();
  },

  // Desenha todos os paths (mais um draft opcional) com o stamping 3x3,
  // dentro do contexto ja posicionado com origin (0,0) = canto do tile.
  drawStamped(ctx, paths, tileSize, draft){
    const offsets = [-tileSize, 0, tileSize];
    const all = draft ? [...paths, draft] : paths;

    for(const path of all){
      if(!path.points && !path.box) continue;
      for(const dx of offsets){
        for(const dy of offsets){
          ctx.save();
          ctx.translate(dx, dy);
          this.strokePath(ctx, path);
          ctx.restore();
        }
      }
    }
  },

  // Renderiza exatamente um tile (tileSize x tileSize, sem sangria) num
  // canvas offscreen. Essa e a fonte de verdade usada tanto no preview
  // quanto no export -- assim preview e export nunca divergem.
  renderCleanTile(paths, tileSize, draft){
    const off = document.createElement('canvas');
    off.width = tileSize;
    off.height = tileSize;
    const ctx = off.getContext('2d');
    ctx.clearRect(0, 0, tileSize, tileSize);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, tileSize, tileSize);
    ctx.clip();
    this.drawStamped(ctx, paths, tileSize, draft);
    ctx.restore();
    return off;
  },

  // Canvas de edicao: mostra o tile com uma margem de sangria ao redor
  // (ghost mais transparente) pra dar contexto visual de como o padrao
  // continua, e desenha um guia tracejado no limite real do tile.
  renderEditView(canvas, paths, tileSize, draft, margin){
    const ctx = canvas.getContext('2d');
    const size = tileSize + margin * 2;
    if(canvas.width !== size) canvas.width = size;
    if(canvas.height !== size) canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // sangria fantasma (fora do tile), opacidade reduzida
    ctx.save();
    ctx.translate(margin, margin);
    ctx.globalAlpha = 0.35;
    this.drawStamped(ctx, paths, tileSize, draft);
    ctx.restore();

    // tile principal, clipado e em opacidade total
    ctx.save();
    ctx.translate(margin, margin);
    ctx.beginPath();
    ctx.rect(0, 0, tileSize, tileSize);
    ctx.clip();
    this.drawStamped(ctx, paths, tileSize, draft);
    ctx.restore();

    // guia do limite do tile
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeRect(margin + 0.5, margin + 0.5, tileSize - 1, tileSize - 1);
    ctx.restore();
  },

  // Preview: pega o tile limpo (renderCleanTile) e o repete em grid NxN.
  renderPreview(canvas, paths, tileSize, draft, gridN = 3){
    const tile = this.renderCleanTile(paths, tileSize, draft);
    const displayTile = 160; // px por celula, o CSS escala o canvas todo
    canvas.width = displayTile * gridN;
    canvas.height = displayTile * gridN;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    for(let row = 0; row < gridN; row++){
      for(let col = 0; col < gridN; col++){
        ctx.drawImage(tile, col * displayTile, row * displayTile, displayTile, displayTile);
      }
    }
  }
};
