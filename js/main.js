(function(){
  const MARGIN = 64; // sangria visivel em volta do tile, em px logicos

  const editCanvas = document.getElementById('editCanvas');
  const previewCanvas = document.getElementById('previewCanvas');

  const tileSizeSelect = document.getElementById('tileSize');
  const undoBtn = document.getElementById('undoBtn');
  const clearBtn = document.getElementById('clearBtn');
  const exportBtn = document.getElementById('exportBtn');

  const strokeColor = document.getElementById('strokeColor');
  const strokeWidth = document.getElementById('strokeWidth');
  const strokeWidthOut = document.getElementById('strokeWidthOut');
  const strokeOpacity = document.getElementById('strokeOpacity');
  const strokeOpacityOut = document.getElementById('strokeOpacityOut');

  let isPointerDown = false;

  function currentTool(){
    return Tools[AppState.currentTool];
  }

  // converte coordenadas de mouse (client, relativas ao canvas em pixels
  // reais) para espaco tile-local (subtrai a margem de sangria).
  function toTileLocal(evt){
    const rect = editCanvas.getBoundingClientRect();
    const scaleX = editCanvas.width / rect.width;
    const scaleY = editCanvas.height / rect.height;
    const x = (evt.clientX - rect.left) * scaleX - MARGIN;
    const y = (evt.clientY - rect.top) * scaleY - MARGIN;
    return {x, y};
  }

  const clockStart = performance.now();

  let currentView = '2d';
  let scene3dInitialized = false;

  function render(timeSec){
    Renderer.renderEditView(editCanvas, AppState.paths, AppState.tileSize, AppState.draft, MARGIN, timeSec);
    Renderer.renderPreview(previewCanvas, AppState.paths, AppState.tileSize, AppState.draft, 3, timeSec);

    if(currentView === '3d' && scene3dInitialized){
      // mesma fonte de verdade do preview 2D -- garante que o tunel
      // nunca mostre nada que o editor 2D nao mostraria tambem.
      const cleanTile = Renderer.renderCleanTile(AppState.paths, AppState.tileSize, AppState.draft, timeSec);
      Scene3D.updateTextureSource(cleanTile);
    }
  }

  // loop continuo: necessario pros efeitos animados (dash a fluir, pulso
  // de opacidade). Um redraw parado no tempo so funcionava enquanto
  // nenhum path tinha animacao -- agora sempre roda, o custo e baixo pro
  // tamanho de canvas que estamos desenhando.
  function loop(now){
    render((now - clockStart) / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // mantido por compatibilidade com o resto do arquivo: so forca um
  // redraw imediato fora do proximo frame do loop (input sente mais
  // responsivo que esperar o rAF).
  function requestRender(){
    render((performance.now() - clockStart) / 1000);
  }

  // ---- input do canvas de edicao ----

  editCanvas.addEventListener('pointerdown', (e) => {
    isPointerDown = true;
    currentTool().onDown(toTileLocal(e));
    requestRender();
  });

  editCanvas.addEventListener('pointermove', (e) => {
    currentTool().onMove(toTileLocal(e));
    if(isPointerDown || AppState.currentTool === 'pen'){
      requestRender();
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDown = false;
    currentTool().onUp();
    requestRender();
  });

  editCanvas.addEventListener('dblclick', () => {
    currentTool().onDblClick();
    requestRender();
  });

  window.addEventListener('keydown', (e) => {
    currentTool().onKey(e);
    if((e.ctrlKey || e.metaKey) && e.key === 'z'){
      AppState.undo();
    }
    requestRender();
  });

  // ---- toolbar ----

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // cancela qualquer draft pendente ao trocar de ferramenta
      const prev = currentTool();
      if(prev && prev.cancel) prev.cancel();
      AppState.draft = null;

      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.currentTool = btn.dataset.tool;
      requestRender();
    });
  });

  tileSizeSelect.addEventListener('change', () => {
    AppState.tileSize = parseInt(tileSizeSelect.value, 10);
    requestRender();
  });

  document.getElementById('loopDuration').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    if(v > 0) AppState.loopDuration = v;
  });

  undoBtn.addEventListener('click', () => {
    AppState.undo();
    requestRender();
  });

  // Correcao de UX: marcar um checkbox de efeito no painel so afeta o
  // PROXIMO traço (cada path guarda seu style no momento em que foi
  // criado). Esse botao e o atalho manual pra reaplicar o estilo atual
  // do painel a tudo que ja existe -- ate a ferramenta de selecao por
  // objeto entrar (roadmap).
  document.getElementById('reapplyBtn').addEventListener('click', () => {
    if(AppState.paths.length === 0) return;
    AppState.pushHistory();
    for(const path of AppState.paths){
      path.style = AppState.cloneStyle();
    }
    requestRender();
  });

  clearBtn.addEventListener('click', () => {
    if(confirm('Limpar todo o desenho?')){
      AppState.clear();
      requestRender();
    }
  });

  exportBtn.addEventListener('click', () => {
    Exporter.exportPNG(AppState.paths, AppState.tileSize);
  });

  // ---- painel de estilo ----

  strokeColor.addEventListener('input', () => {
    AppState.style.color = strokeColor.value;
  });

  strokeWidth.addEventListener('input', () => {
    AppState.style.width = parseInt(strokeWidth.value, 10);
    strokeWidthOut.textContent = strokeWidth.value;
  });

  strokeOpacity.addEventListener('input', () => {
    AppState.style.opacity = parseInt(strokeOpacity.value, 10) / 100;
    strokeOpacityOut.textContent = strokeOpacity.value + '%';
  });

  // ---- gradiente ----
  const gradientToggle = document.getElementById('gradientToggle');
  const gradientStop0 = document.getElementById('gradientStop0');
  const gradientStop1 = document.getElementById('gradientStop1');
  const soloColorField = document.getElementById('soloColorField');
  const gradientFields = document.getElementById('gradientFields');

  gradientToggle.addEventListener('change', () => {
    AppState.style.gradient.enabled = gradientToggle.checked;
    soloColorField.style.display = gradientToggle.checked ? 'none' : 'flex';
    gradientFields.style.display = gradientToggle.checked ? 'flex' : 'none';
  });
  gradientStop0.addEventListener('input', () => {
    AppState.style.gradient.stops[0].color = gradientStop0.value;
  });
  gradientStop1.addEventListener('input', () => {
    AppState.style.gradient.stops[1].color = gradientStop1.value;
  });

  // ---- taper ----
  const taperToggle = document.getElementById('taperToggle');
  const taperStart = document.getElementById('taperStart');
  const taperEnd = document.getElementById('taperEnd');
  const taperFields = document.getElementById('taperFields');
  const widthField = document.getElementById('widthField');

  taperToggle.addEventListener('change', () => {
    AppState.style.taper.enabled = taperToggle.checked;
    taperFields.style.display = taperToggle.checked ? 'flex' : 'none';
    widthField.style.display = taperToggle.checked ? 'none' : 'flex';
  });
  taperStart.addEventListener('input', () => {
    AppState.style.taper.startWidth = parseInt(taperStart.value, 10);
  });
  taperEnd.addEventListener('input', () => {
    AppState.style.taper.endWidth = parseInt(taperEnd.value, 10);
  });

  // ---- glow ----
  const glowToggle = document.getElementById('glowToggle');
  const glowBlur = document.getElementById('glowBlur');
  const glowFields = document.getElementById('glowFields');

  glowToggle.addEventListener('change', () => {
    AppState.style.glow.enabled = glowToggle.checked;
    glowFields.style.display = glowToggle.checked ? 'flex' : 'none';
  });
  glowBlur.addEventListener('input', () => {
    AppState.style.glow.blur = parseInt(glowBlur.value, 10);
  });

  // ---- dash animado ----
  const dashToggle = document.getElementById('dashToggle');
  const dashLen = document.getElementById('dashLen');
  const dashGap = document.getElementById('dashGap');
  const dashSpeed = document.getElementById('dashSpeed');
  const dashFields = document.getElementById('dashFields');

  dashToggle.addEventListener('change', () => {
    AppState.style.dash.enabled = dashToggle.checked;
    dashFields.style.display = dashToggle.checked ? 'flex' : 'none';
  });
  dashLen.addEventListener('input', () => { AppState.style.dash.len = parseInt(dashLen.value, 10); });
  dashGap.addEventListener('input', () => { AppState.style.dash.gap = parseInt(dashGap.value, 10); });
  dashSpeed.addEventListener('input', () => { AppState.style.dash.speed = parseInt(dashSpeed.value, 10); });

  // ---- pulso de opacidade ----
  const pulseToggle = document.getElementById('pulseToggle');
  const pulseSpeed = document.getElementById('pulseSpeed');
  const pulseFields = document.getElementById('pulseFields');

  pulseToggle.addEventListener('change', () => {
    AppState.style.pulse.enabled = pulseToggle.checked;
    pulseFields.style.display = pulseToggle.checked ? 'flex' : 'none';
  });
  pulseSpeed.addEventListener('input', () => {
    AppState.style.pulse.speed = parseInt(pulseSpeed.value, 10) / 10;
  });

  // ---- shift de cor ----
  const colorShiftToggle = document.getElementById('colorShiftToggle');
  const colorShiftSpeed = document.getElementById('colorShiftSpeed');
  const colorShiftFields = document.getElementById('colorShiftFields');

  colorShiftToggle.addEventListener('change', () => {
    AppState.style.colorShift.enabled = colorShiftToggle.checked;
    colorShiftFields.style.display = colorShiftToggle.checked ? 'flex' : 'none';
  });
  colorShiftSpeed.addEventListener('input', () => {
    AppState.style.colorShift.speed = parseInt(colorShiftSpeed.value, 10) / 100;
  });

  // ---- snake (traco viajando ao redor da forma) ----
  const snakeToggle = document.getElementById('snakeToggle');
  const snakeLength = document.getElementById('snakeLength');
  const snakeStart = document.getElementById('snakeStart');
  const snakeEnd = document.getElementById('snakeEnd');
  const snakeStartPos = document.getElementById('snakeStartPos');
  const snakeCycles = document.getElementById('snakeCycles');
  const snakeSpeed = document.getElementById('snakeSpeed');
  const snakeReverse = document.getElementById('snakeReverse');
  const snakeFields = document.getElementById('snakeFields');
  const snakeFreeSpeedField = document.getElementById('snakeFreeSpeedField');

  snakeToggle.addEventListener('change', () => {
    AppState.style.snake.enabled = snakeToggle.checked;
    snakeFields.style.display = snakeToggle.checked ? 'flex' : 'none';
  });
  snakeLength.addEventListener('input', () => {
    AppState.style.snake.lengthFrac = parseInt(snakeLength.value, 10) / 100;
  });
  snakeStart.addEventListener('input', () => {
    AppState.style.snake.widthStart = parseInt(snakeStart.value, 10);
  });
  snakeEnd.addEventListener('input', () => {
    AppState.style.snake.widthEnd = parseInt(snakeEnd.value, 10);
  });
  snakeStartPos.addEventListener('input', () => {
    AppState.style.snake.startPosFrac = parseInt(snakeStartPos.value, 10) / 100;
  });
  snakeCycles.addEventListener('change', () => {
    AppState.style.snake.cyclesMode = snakeCycles.value;
    snakeFreeSpeedField.style.display = snakeCycles.value === 'off' ? 'flex' : 'none';
  });
  snakeSpeed.addEventListener('input', () => {
    AppState.style.snake.freeSpeed = parseInt(snakeSpeed.value, 10) / 100;
  });
  snakeReverse.addEventListener('change', () => {
    AppState.style.snake.reverse = snakeReverse.checked;
  });

  // ---- matiz global ----
  const globalHueToggle = document.getElementById('globalHueToggle');
  const globalHueSpeed = document.getElementById('globalHueSpeed');
  const globalHueFields = document.getElementById('globalHueFields');

  globalHueToggle.addEventListener('change', () => {
    AppState.globalHue.enabled = globalHueToggle.checked;
    globalHueFields.style.display = globalHueToggle.checked ? 'flex' : 'none';
  });
  globalHueSpeed.addEventListener('input', () => {
    AppState.globalHue.speed = parseInt(globalHueSpeed.value, 10) / 100;
  });

  // ---- troca entre view 2D e view 3D ----
  const view2D = document.getElementById('view2D');
  const view3D = document.getElementById('view3D');
  const toolsPanel = document.getElementById('toolsPanel');
  const stylePanel2D = document.getElementById('stylePanel2D');
  const stylePanel3D = document.getElementById('stylePanel3D');
  const scene3dCanvas = document.getElementById('scene3dCanvas');

  document.querySelectorAll('.view-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;

      const is3d = currentView === '3d';
      view2D.style.display = is3d ? 'none' : 'flex';
      view3D.style.display = is3d ? 'flex' : 'none';
      toolsPanel.style.display = is3d ? 'none' : 'flex';
      stylePanel2D.style.display = is3d ? 'none' : 'block';
      stylePanel3D.style.display = is3d ? 'block' : 'none';

      if(is3d){
        if(!scene3dInitialized){
          Scene3D.init(scene3dCanvas);
          scene3dInitialized = true;
        }
        Scene3D.resize();
        Scene3D.start();
      } else {
        Scene3D.stop();
      }
    });
  });

  window.addEventListener('resize', () => {
    if(scene3dInitialized && currentView === '3d') Scene3D.resize();
  });

  // ---- controles da cena 3D ----
  document.getElementById('tunnelRadius').addEventListener('input', (e) => {
    Scene3D.settings.radius = parseInt(e.target.value, 10) / 10;
    if(scene3dInitialized) Scene3D.applySettings();
  });
  document.getElementById('tunnelRepeatX').addEventListener('input', (e) => {
    Scene3D.settings.repeatX = parseInt(e.target.value, 10);
    if(scene3dInitialized) Scene3D.applySettings();
  });
  document.getElementById('tunnelRepeatY').addEventListener('input', (e) => {
    Scene3D.settings.repeatY = parseInt(e.target.value, 10);
    if(scene3dInitialized) Scene3D.applySettings();
  });
  document.getElementById('tunnelSpeedCycles').addEventListener('change', (e) => {
    Scene3D.settings.speedCycles = parseInt(e.target.value, 10);
  });
  document.getElementById('kaleidoSegments').addEventListener('change', (e) => {
    Scene3D.settings.segments = parseInt(e.target.value, 10);
    if(scene3dInitialized) Scene3D.applySettings();
  });
})();
