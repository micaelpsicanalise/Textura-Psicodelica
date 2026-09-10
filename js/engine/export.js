const Exporter = {
  // Exporta o tile limpo (sem sangria, sem guia) no tamanho logico do
  // tileSize atual. Reaproveita renderCleanTile pra garantir que o export
  // seja pixel-a-pixel igual ao que o preview mostra.
  exportPNG(paths, tileSize, filename){
    // t=0 fixo: export precisa ser deterministico, independente de quando
    // o botao foi clicado (efeitos animados como dash/pulso congelam no
    // frame inicial). Export de sequencia animada e item de roadmap.
    const tile = Renderer.renderCleanTile(paths, tileSize, null, 0);
    tile.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `texture_${tileSize}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
};
