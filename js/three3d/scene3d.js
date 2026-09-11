/**
 * Cena 3D: pega a MESMA textura do editor 2D (ao vivo, frame a frame) e
 * aplica por dentro de um tunel cilindrico, com a camera passeando por
 * ele. O espelhamento caleidoscopico que aparece nos videos de
 * referencia NAO e geometria fisicamente duplicada -- e um passe de
 * pos-processamento: renderiza a cena normal pra uma textura, depois
 * desenha essa textura numa tela cheia com um shader que espelha as
 * coordenadas UV em espaco polar (angulo modulo N-avos de volta,
 * espelhado dentro de cada fatia). E a tecnica classica de "kaleidoscope
 * shader" usada em visuais de VJ.
 *
 * Requer THREE (carregado via CDN no index.html) e so faz sentido depois
 * de Scene3D.init() ser chamado com um canvas real na tela.
 */
const Scene3D = {
  renderer: null,
  scene: null,
  camera: null,
  tunnelMesh: null,
  texture: null,
  rtTarget: null,
  postScene: null,
  postCamera: null,
  kaleidoMaterial: null,
  running: false,
  clockStart: 0,
  canvas: null,

  settings: {
    segments: 4,     // simetria N-avos do caleidoscopio (0 ou 1 = desliga)
    repeatX: 4,       // quantas vezes a textura repete ao redor da circunferencia
    repeatY: 10,      // quantas vezes repete ao longo do comprimento do tunel
    speedCycles: 1,   // "voltas" de textura escorregando por loopDuration (trava o loop, mesma ideia do snake)
    radius: 2.2,
    fov: 82
  },

  init(canvas){
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.05, 100);
    this.camera.position.set(0, 0, 0);

    // canvas placeholder ate a primeira textura real chegar via updateTextureSource
    const placeholder = document.createElement('canvas');
    placeholder.width = placeholder.height = 4;
    this.texture = new THREE.CanvasTexture(placeholder);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.repeat.set(this.settings.repeatX, this.settings.repeatY);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    const geo = new THREE.CylinderGeometry(this.settings.radius, this.settings.radius, 60, 40, 1, true);
    const mat = new THREE.MeshBasicMaterial({map: this.texture, side: THREE.BackSide});
    this.tunnelMesh = new THREE.Mesh(geo, mat);
    // cilindro do three nasce com o eixo em Y; giramos pra ficar em Z
    // (profundidade do tunel, alinhado com a direcao da camera).
    this.tunnelMesh.rotation.x = Math.PI / 2;
    this.scene.add(this.tunnelMesh);

    this.rtTarget = new THREE.WebGLRenderTarget(2, 2);

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.kaleidoMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: {value: this.rtTarget.texture},
        segments: {value: this.settings.segments}
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float segments;
        varying vec2 vUv;
        void main(){
          if(segments < 1.5){
            gl_FragColor = texture2D(tDiffuse, vUv);
            return;
          }
          vec2 uv = vUv - 0.5;
          float r = length(uv);
          float a = atan(uv.y, uv.x);
          float seg = 6.28318530718 / segments;
          a = mod(a, seg);
          a = abs(a - seg * 0.5); // espelha dentro da fatia -- e o "kaleidoscope"
          uv = vec2(cos(a), sin(a)) * r;
          uv += 0.5;
          gl_FragColor = texture2D(tDiffuse, uv);
        }
      `
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.kaleidoMaterial);
    this.postScene.add(quad);

    this.clockStart = performance.now();
    this.resize();
  },

  resize(){
    if(!this.renderer) return;
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rtTarget.setSize(w, h);
  },

  // Chamado a cada frame pelo main.js com o canvas 2D recem-renderizado
  // do tile (a mesma fonte que alimenta o preview 3x3) -- assim o tunel
  // 3D nunca desalinha do que o editor 2D esta mostrando.
  updateTextureSource(sourceCanvas){
    this.texture.image = sourceCanvas;
    this.texture.needsUpdate = true;
  },

  applySettings(){
    this.texture.repeat.set(this.settings.repeatX, this.settings.repeatY);
    this.kaleidoMaterial.uniforms.segments.value = this.settings.segments;
    if(this.tunnelMesh){
      this.tunnelMesh.geometry.dispose();
      this.tunnelMesh.geometry = new THREE.CylinderGeometry(this.settings.radius, this.settings.radius, 60, 40, 1, true);
    }
  },

  start(){
    this.running = true;
    this._loop();
  },

  stop(){
    this.running = false;
  },

  _loop(){
    if(!this.running) return;
    const timeSec = (performance.now() - this.clockStart) / 1000;
    this.render(timeSec);
    requestAnimationFrame(() => this._loop());
  },

  render(timeSec){
    if(!this.renderer) return;

    // avanco pelo tunel: nao movemos a camera de verdade, so escorregamos
    // o offset da textura -- e a mesma matematica de "ciclos travados no
    // loop" do snake, entao a passagem pelo tunel fecha exatamente junto
    // com o resto dos efeitos animados.
    const loopDuration = (typeof AppState !== 'undefined' && AppState.loopDuration) || 4;
    const cyclesPerSec = this.settings.speedCycles / loopDuration;
    this.texture.offset.y = -(timeSec * cyclesPerSec) % 1;

    this.renderer.setRenderTarget(this.rtTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
};
