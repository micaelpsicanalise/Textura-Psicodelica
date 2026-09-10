/**
 * Cada ferramenta implementa onDown/onMove/onUp/onDblClick/onKey e decide
 * quando finalizar em AppState.draft -> AppState.addPath().
 * Coordenadas que chegam aqui ja estao em espaco tile-local (ver main.js).
 */
const Tools = {

  pen: {
    active: false,

    onDown(pt){
      if(!this.active){
        this.active = true;
        AppState.draft = {
          id: AppState.newId(),
          tool: 'pen',
          points: [{x: pt.x, y: pt.y}],
          closed: false,
          style: {...AppState.style}
        };
        this._dragStart = null;
        return;
      }
      // clicou perto do primeiro ponto -> fecha o path
      const first = AppState.draft.points[0];
      if(AppState.draft.points.length > 2 && Geometry.dist(pt, first) < 10){
        AppState.draft.closed = true;
        this.finish();
        return;
      }
      AppState.draft.points.push({x: pt.x, y: pt.y});
      this._dragStart = {index: AppState.draft.points.length - 1, pt};
    },

    onMove(pt){
      if(!this.active || !this._dragStart) return;
      // arrastar apos clicar cria handles simetricos (curva suave)
      const idx = this._dragStart.index;
      const anchor = AppState.draft.points[idx];
      const dx = pt.x - anchor.x;
      const dy = pt.y - anchor.y;
      anchor.handleOut = {x: anchor.x + dx, y: anchor.y + dy};
      anchor.handleIn = {x: anchor.x - dx, y: anchor.y - dy};
    },

    onUp(){
      this._dragStart = null;
    },

    onDblClick(){
      if(this.active) this.finish();
    },

    onKey(e){
      if(!this.active) return;
      if(e.key === 'Enter') this.finish();
      if(e.key === 'Escape') this.cancel();
    },

    finish(){
      if(AppState.draft && AppState.draft.points.length > 1){
        AppState.addPath(AppState.draft);
      }
      AppState.draft = null;
      this.active = false;
      this._dragStart = null;
    },

    cancel(){
      AppState.draft = null;
      this.active = false;
      this._dragStart = null;
    }
  },

  freehand: {
    drawing: false,

    onDown(pt){
      this.drawing = true;
      AppState.draft = {
        id: AppState.newId(),
        tool: 'freehand',
        points: [{x: pt.x, y: pt.y}],
        closed: false,
        style: {...AppState.style}
      };
    },

    onMove(pt){
      if(!this.drawing) return;
      const pts = AppState.draft.points;
      const last = pts[pts.length - 1];
      // amostra so se andou o suficiente, evita path gigante por pixel
      if(Geometry.dist(last, pt) > 2){
        pts.push({x: pt.x, y: pt.y});
      }
    },

    onUp(){
      if(this.drawing && AppState.draft && AppState.draft.points.length > 1){
        AppState.addPath(AppState.draft);
      } else {
        AppState.draft = null;
      }
      this.drawing = false;
    },

    onDblClick(){},
    onKey(){}
  },

  ellipse: {
    dragging: false,
    origin: null,

    onDown(pt){
      this.dragging = true;
      this.origin = pt;
      AppState.draft = {
        id: AppState.newId(),
        tool: 'ellipse',
        box: {x: pt.x, y: pt.y, w: 0, h: 0},
        style: {...AppState.style}
      };
    },

    onMove(pt){
      if(!this.dragging) return;
      AppState.draft.box = {
        x: Math.min(this.origin.x, pt.x),
        y: Math.min(this.origin.y, pt.y),
        w: Math.abs(pt.x - this.origin.x),
        h: Math.abs(pt.y - this.origin.y)
      };
    },

    onUp(){
      if(this.dragging && AppState.draft && (AppState.draft.box.w > 2 || AppState.draft.box.h > 2)){
        AppState.addPath(AppState.draft);
      } else {
        AppState.draft = null;
      }
      this.dragging = false;
    },

    onDblClick(){},
    onKey(){}
  },

  rect: {
    dragging: false,
    origin: null,

    onDown(pt){
      this.dragging = true;
      this.origin = pt;
      AppState.draft = {
        id: AppState.newId(),
        tool: 'rect',
        box: {x: pt.x, y: pt.y, w: 0, h: 0},
        style: {...AppState.style}
      };
    },

    onMove(pt){
      if(!this.dragging) return;
      AppState.draft.box = {
        x: Math.min(this.origin.x, pt.x),
        y: Math.min(this.origin.y, pt.y),
        w: Math.abs(pt.x - this.origin.x),
        h: Math.abs(pt.y - this.origin.y)
      };
    },

    onUp(){
      if(this.dragging && AppState.draft && (AppState.draft.box.w > 2 || AppState.draft.box.h > 2)){
        AppState.addPath(AppState.draft);
      } else {
        AppState.draft = null;
      }
      this.dragging = false;
    },

    onDblClick(){},
    onKey(){}
  }
};
