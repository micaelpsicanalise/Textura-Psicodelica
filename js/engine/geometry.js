const Geometry = {
  dist(a, b){
    return Math.hypot(a.x - b.x, a.y - b.y);
  },

  // Traca no contexto de canvas um path do tipo 'pen' (ancoras com handles
  // bezier opcionais) ou 'freehand' (polilinha de pontos), 'ellipse' ou
  // 'rect'. Nao aplica stroke/fill, so monta o Path2D-equivalente via ctx.
  trace(ctx, path){
    if(path.tool === 'ellipse'){
      const {x, y, w, h} = path.box;
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
      return;
    }
    if(path.tool === 'rect'){
      const {x, y, w, h} = path.box;
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      return;
    }

    const pts = path.points;
    if(!pts || pts.length === 0) return;

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);

    if(path.tool === 'freehand'){
      for(let i = 1; i < pts.length; i++){
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    } else {
      // pen tool: cada ponto pode ter handleOut (saindo dele) e o proximo
      // handleIn (entrando nele). Se nao houver handles, cai pra reta.
      for(let i = 1; i < pts.length; i++){
        const prev = pts[i-1];
        const cur = pts[i];
        const c1 = prev.handleOut || {x: prev.x, y: prev.y};
        const c2 = cur.handleIn || {x: cur.x, y: cur.y};
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cur.x, cur.y);
      }
      if(path.closed && pts.length > 2){
        const prev = pts[pts.length-1];
        const cur = pts[0];
        const c1 = prev.handleOut || {x: prev.x, y: prev.y};
        const c2 = cur.handleIn || {x: cur.x, y: cur.y};
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, cur.x, cur.y);
        ctx.closePath();
      }
    }
  }
};
