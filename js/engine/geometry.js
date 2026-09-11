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
  },

  cubicPoint(p0, c1, c2, p1, t){
    const mt = 1 - t;
    const a = mt*mt*mt, b = 3*mt*mt*t, c = 3*mt*t*t, d = t*t*t;
    return {
      x: a*p0.x + b*c1.x + c*c2.x + d*p1.x,
      y: a*p0.y + b*c1.y + c*c2.y + d*p1.y
    };
  },

  // Amostra o path como uma lista densa de pontos {x,y}, na ordem do
  // desenho. Usado pra taper (precisa de largura por posicao ao longo do
  // comprimento) e pra gradiente direcional (precisa do primeiro/ultimo
  // ponto real da forma).
  flatten(path, curveSegments = 24){
    if(path.tool === 'ellipse'){
      const {x, y, w, h} = path.box;
      const cx = x + w/2, cy = y + h/2, rx = Math.abs(w/2), ry = Math.abs(h/2);
      const pts = [];
      const N = 64;
      for(let i = 0; i <= N; i++){
        const a = (i/N) * Math.PI * 2;
        pts.push({x: cx + rx*Math.cos(a), y: cy + ry*Math.sin(a)});
      }
      return pts;
    }
    if(path.tool === 'rect'){
      const {x, y, w, h} = path.box;
      return [{x,y}, {x:x+w,y}, {x:x+w,y:y+h}, {x,y:y+h}, {x,y}];
    }

    const pts = path.points;
    if(!pts || pts.length === 0) return [];

    if(path.tool === 'freehand'){
      return pts.map(p => ({x: p.x, y: p.y}));
    }

    // pen tool: amostra cada segmento bezier
    const out = [];
    const segCount = path.closed ? pts.length : pts.length - 1;
    for(let i = 0; i < segCount; i++){
      const p0 = pts[i];
      const p1 = pts[(i+1) % pts.length];
      const c1 = p0.handleOut || {x: p0.x, y: p0.y};
      const c2 = p1.handleIn || {x: p1.x, y: p1.y};
      for(let s = 0; s < curveSegments; s++){
        out.push(this.cubicPoint(p0, c1, c2, p1, s / curveSegments));
      }
    }
    if(path.closed){
      out.push(out[0]);
    } else {
      out.push({x: pts[pts.length-1].x, y: pts[pts.length-1].y});
    }
    return out;
  },

  // Poligono preenchido com largura variavel ao longo do comprimento de
  // uma lista de pontos ja amostrada -- e assim que se faz "taper" no
  // Canvas, ja que stroke nativo nao suporta largura variavel. Interpola
  // por fracao do comprimento de arco (nao por indice de ponto), pra
  // ficar proporcional visualmente. Compartilhado por taperedPolygon
  // (path inteiro) e pelo snake (so um pedaco do path).
  widthPolygonFromPoints(pts, widthStart, widthEnd){
    if(pts.length < 2) return [];

    const lens = [0];
    for(let i = 1; i < pts.length; i++){
      lens.push(lens[i-1] + this.dist(pts[i-1], pts[i]));
    }
    const total = lens[lens.length - 1] || 1;

    const left = [], right = [];
    for(let i = 0; i < pts.length; i++){
      const t = lens[i] / total;
      const halfW = (widthStart + (widthEnd - widthStart) * t) / 2;

      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      const dx = next.x - prev.x, dy = next.y - prev.y;
      const segLen = Math.hypot(dx, dy) || 1;
      const nx = -dy / segLen, ny = dx / segLen;

      left.push({x: pts[i].x + nx*halfW, y: pts[i].y + ny*halfW});
      right.push({x: pts[i].x - nx*halfW, y: pts[i].y - ny*halfW});
    }
    return left.concat(right.reverse());
  },

  taperedPolygon(path, widthStart, widthEnd, curveSegments = 24){
    return this.widthPolygonFromPoints(this.flatten(path, curveSegments), widthStart, widthEnd);
  },

  // Tabela de comprimento de arco acumulado pro path inteiro -- base pro
  // "snake" (segmento que viaja ao redor da forma em loop).
  arcLengthTable(path, curveSegments = 24){
    const pts = this.flatten(path, curveSegments);
    const lens = [0];
    for(let i = 1; i < pts.length; i++){
      lens.push(lens[i-1] + this.dist(pts[i-1], pts[i]));
    }
    return {pts, lens, total: lens[lens.length - 1] || 1};
  },

  // Pontos do path cuja posicao (fracao 0..1 do comprimento total) cai
  // entre tFrom e tTo (tFrom <= tTo, sem wrap -- wrap e responsabilidade
  // de quem chama, ver snakeSegment).
  sliceByFraction(table, tFrom, tTo){
    const {pts, lens, total} = table;
    const from = tFrom * total, to = tTo * total;
    const out = [];
    for(let i = 0; i < pts.length; i++){
      if(lens[i] >= from && lens[i] <= to) out.push(pts[i]);
    }
    return out;
  },

  // O segmento que "viaja ao redor da forma": uma janela de comprimento
  // lenFrac (fracao do perimetro total) cuja ponta da frente esta em
  // headFrac (0..1, ciclico). Se a janela cruza o ponto de origem do
  // path (headFrac - lenFrac < 0), ela e montada em duas partes -- o
  // final do path + o comeco -- concatenadas, pra continuar continua.
  snakeSegment(path, headFrac, lenFrac, curveSegments = 24){
    const table = this.arcLengthTable(path, curveSegments);
    const tailFrac = headFrac - lenFrac;
    if(tailFrac >= 0){
      return this.sliceByFraction(table, tailFrac, headFrac);
    }
    const wrapTail = 1 + tailFrac; // ex: tailFrac=-0.1 -> comeca em 0.9
    const part1 = this.sliceByFraction(table, wrapTail, 1);
    const part2 = this.sliceByFraction(table, 0, headFrac);
    return part1.concat(part2);
  }
};
