const ColorUtil = {
  hexToHsl(hex){
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max + min) / 2;

    if(max === min){
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch(max){
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
      }
      h *= 60;
    }
    return {h, s, l};
  },

  hslToHex(h, s, l){
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2*l - 1)) * s;
    const x = c * (1 - Math.abs((h/60) % 2 - 1));
    const m = l - c/2;
    let r,g,b;
    if(h < 60){ r=c; g=x; b=0; }
    else if(h < 120){ r=x; g=c; b=0; }
    else if(h < 180){ r=0; g=c; b=x; }
    else if(h < 240){ r=0; g=x; b=c; }
    else if(h < 300){ r=x; g=0; b=c; }
    else { r=c; g=0; b=x; }
    const toHex = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  // Gira o matiz de uma cor hex em N graus. Usado pro efeito "shifting
  // colors" -- cor do traco mudando continuamente ao longo do tempo.
  shiftHue(hex, degrees){
    const {h, s, l} = this.hexToHsl(hex);
    return this.hslToHex(h + degrees, s, l);
  }
};
