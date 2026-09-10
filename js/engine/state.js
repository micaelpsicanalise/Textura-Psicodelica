/**
 * Estado central do app.
 *
 * Modelo de dados importante: as coordenadas de cada path sao "tile-local",
 * ou seja, relativas ao tile de tileSize x tileSize, mas SEM clamp -- um
 * ponto pode ter x = -30 ou x = tileSize + 30 (foi desenhado na margem de
 * sangria). Isso e o que permite o wrap seamless: no render, cada path e
 * desenhado 9 vezes (grid 3x3 de deslocamentos -tileSize/0/+tileSize em x e
 * y) e so a parte que cai dentro do tile fica visivel. Nao precisamos
 * normalizar nada na hora de desenhar.
 */
const AppState = {
  tileSize: 512,

  // cada path: { id, tool, points, closed, style }
  paths: [],

  // path em progresso (antes de finalizar), mesma forma de um path normal
  draft: null,

  currentTool: 'pen',

  style: {
    color: '#ff3d81',
    width: 8,
    opacity: 1,
  },

  history: [],
  historyLimit: 60,

  pushHistory(){
    const snapshot = JSON.stringify(this.paths);
    this.history.push(snapshot);
    if(this.history.length > this.historyLimit) this.history.shift();
  },

  undo(){
    if(this.history.length === 0) return false;
    const snapshot = this.history.pop();
    this.paths = JSON.parse(snapshot);
    return true;
  },

  clear(){
    this.pushHistory();
    this.paths = [];
  },

  addPath(path){
    this.pushHistory();
    this.paths.push(path);
  },

  nextId: 1,
  newId(){
    return 'p' + (this.nextId++);
  }
};
