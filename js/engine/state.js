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

  // Estilo "corrente" -- usado quando um path novo e criado. Cada path
  // guarda seu proprio snapshot (ver cloneStyle) entao mudar isso aqui
  // depois nao afeta traços ja desenhados -- isso so vem com uma
  // ferramenta de selecao (roadmap).
  style: {
    color: '#ff3d81',
    width: 8,
    opacity: 1,
    gradient: {
      enabled: false,
      stops: [
        {pos: 0, color: '#ff3d81'},
        {pos: 1, color: '#3d6bff'}
      ]
    },
    glow: {
      enabled: false,
      blur: 20,
      color: null // null = usa a cor/gradiente do proprio traço
    },
    taper: {
      enabled: false,
      startWidth: 2,
      endWidth: 28
    },
    dash: {
      enabled: false,
      len: 18,
      gap: 14,
      speed: 60 // px/s de deslocamento do dash
    },
    pulse: {
      enabled: false,
      speed: 0.6 // ciclos/s
    },
    snake: {
      enabled: false,
      lengthFrac: 0.18,     // fracao do perimetro que o segmento movel ocupa
      startPosFrac: 0,      // posicao inicial (0..1) ao longo do path
      reverse: false,       // inverte o sentido de viagem (cauda sempre arrasta atras)
      cyclesMode: 'off',    // 'off' = velocidade livre | '1'/'2'/'3'/'4' = N voltas travadas no loop
      freeSpeed: 0.25,      // voltas/s, usado so quando cyclesMode === 'off'
      widthStart: 2,        // espessura na cauda
      widthEnd: 26          // espessura na cabeca (frente do movimento)
    },
    colorShift: {
      enabled: false,
      speed: 0.15 // voltas de matiz (360°) por segundo
    }
  },

  // Duracao do loop em segundos -- os efeitos com "ciclos travados"
  // (ex: travelling stroke com N voltas) usam isso pra garantir que a
  // animacao feche exatamente sem salto, o que importa quando isso virar
  // export de sequencia/WebM (roadmap).
  loopDuration: 4,

  // Matiz global -- gira a cor de TODO o tile já composto (diferente do
  // shift de cor por-traço). Aplicado como filtro CSS no canvas final.
  globalHue: {
    enabled: false,
    speed: 0.1 // voltas de matiz por segundo
  },

  // Copia profunda do estilo atual -- necessario porque style tem objetos
  // aninhados (gradient/glow/taper/dash/pulse); um spread raso deixaria
  // todos os paths compartilhando a MESMA referencia desses objetos.
  cloneStyle(){
    return JSON.parse(JSON.stringify(this.style));
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
