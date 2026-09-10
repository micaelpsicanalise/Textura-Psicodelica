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

  function render(timeSec){
    Renderer.renderEditView(editCanvas, AppState.paths, AppState.tileSize, AppState.draft, MARGIN, timeSec);
    Renderer.renderPreview(previewCanvas, AppState.paths, AppState.tileSize, AppState.draft, 3, timeSec);
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
})();
