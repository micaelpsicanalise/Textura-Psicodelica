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

  // Resolve a "tinta" do path: cor solida ou gradiente linear construido
  // do primeiro ao ultimo ponto amostrado da forma.
  resolvePaint(ctx, path){
    const g = path.style.gradient;
    if(g && g.enabled && g.stops.length >= 2){
      const pts = Geometry.flatten(path, 8);
      if(pts.length >= 2){
        const first = pts[0], last = pts[pts.length - 1];
        const grad = ctx.createLinearGradient(first.x, first.y, last.x, last.y);
        for(const stop of g.stops){
          grad.addColorStop(Math.min(1, Math.max(0, stop.pos)), stop.color);
        }
        return grad;
      }
    }
    return path.style.color;
  },

  // Opacidade final, considerando o efeito de pulso (oscila com o tempo).
  resolveOpacity(style, timeSec){
    const base = style.opacity;
    if(style.pulse && style.pulse.enabled){
      const wave = 0.5 + 0.5 * Math.sin(timeSec * style.pulse.speed * Math.PI * 2);
      return base * (0.25 + 0.75 * wave); // nunca some totalmente, so "respira"
    }
    return base;
  },

  strokePath(ctx, path, timeSec){
    const style = path.style;
    ctx.save();

    const paint = this.resolvePaint(ctx, path);
    ctx.globalAlpha = this.resolveOpacity(style, timeSec);

    if(style.glow && style.glow.enabled){
      ctx.shadowBlur = style.glow.blur;
      ctx.shadowColor = style.glow.color || (typeof paint === 'string' ? paint : style.color);
    }

    if(style.taper && style.taper.enabled){
      // largura variavel -> vira poligono preenchido, nao stroke nativo
      const poly = Geometry.taperedPolygon(path, style.taper.startWidth, style.taper.endWidth);
      if(poly.length > 2){
        ctx.beginPath();
        ctx.moveTo(poly[0].x, poly[0].y);
        for(let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
        ctx.closePath();
        ctx.fillStyle = paint;
        ctx.fill();
      }
    } else {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = paint;
      ctx.lineWidth = style.width;

      if(style.dash && style.dash.enabled){
        ctx.setLineDash([style.dash.len, style.dash.gap]);
        ctx.lineDashOffset = -(timeSec * style.dash.speed);
      } else {
        ctx.setLineDash([]);
      }

      Geometry.trace(ctx, path);
      ctx.stroke();
    }

    ctx.restore();
  },

  // Desenha todos os paths (mais um draft opcional) com o stamping 3x3,
  // dentro do contexto ja posicionado com origin (0,0) = canto do tile.
  drawStamped(ctx, paths, tileSize, draft, timeSec = 0){
    const offsets = [-tileSize, 0, tileSize];
    const all = draft ? [...paths, draft] : paths;

    for(const path of all){
      if(!path.points && !path.box) continue;
      for(const dx of offsets){
        for(const dy of offsets){
          ctx.save();
          ctx.translate(dx, dy);
          this.strokePath(ctx, path, timeSec);
          ctx.restore();
        }
      }
    }
  },

  // Renderiza exatamente um tile (tileSize x tileSize, sem sangria) num
  // canvas offscreen. Essa e a fonte de verdade usada tanto no preview
  // quanto no export -- assim preview e export nunca divergem.
  renderCleanTile(paths, tileSize, draft, timeSec = 0){
    const off = document.createElement('canvas');
    off.width = tileSize;
    off.height = tileSize;
    const ctx = off.getContext('2d');
    ctx.clearRect(0, 0, tileSize, tileSize);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, tileSize, tileSize);
    ctx.clip();
    this.drawStamped(ctx, paths, tileSize, draft, timeSec);
    ctx.restore();
    return off;
  },

  // Canvas de edicao: mostra o tile com uma margem de sangria ao redor
  // (ghost mais transparente) pra dar contexto visual de como o padrao
  // continua, e desenha um guia tracejado no limite real do tile.
  renderEditView(canvas, paths, tileSize, draft, margin, timeSec = 0){
    const ctx = canvas.getContext('2d');
    const size = tileSize + margin * 2;
    if(canvas.width !== size) canvas.width = size;
    if(canvas.height !== size) canvas.height = size;

    ctx.clearRect(0, 0, size, size);

    // sangria fantasma (fora do tile), opacidade reduzida
    ctx.save();
    ctx.translate(margin, margin);
    ctx.globalAlpha = 0.35;
    this.drawStamped(ctx, paths, tileSize, draft, timeSec);
    ctx.restore();

    // tile principal, clipado e em opacidade total
    ctx.save();
    ctx.translate(margin, margin);
    ctx.beginPath();
    ctx.rect(0, 0, tileSize, tileSize);
    ctx.clip();
    this.drawStamped(ctx, paths, tileSize, draft, timeSec);
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
  renderPreview(canvas, paths, tileSize, draft, gridN = 3, timeSec = 0){
    const tile = this.renderCleanTile(paths, tileSize, draft, timeSec);
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
