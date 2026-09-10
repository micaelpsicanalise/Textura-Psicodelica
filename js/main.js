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

  function requestRender(){
    Renderer.renderEditView(editCanvas, AppState.paths, AppState.tileSize, AppState.draft, MARGIN);
    Renderer.renderPreview(previewCanvas, AppState.paths, AppState.tileSize, AppState.draft, 3);
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

  // ---- boot ----
  requestRender();
})();
