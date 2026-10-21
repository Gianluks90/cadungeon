import { Filter, GlProgram } from 'pixi.js';

// Il vertice è quello standard dei filtri di Pixi: disegna il rettangolo che contiene l'acqua.
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) {
  return aPosition * (uOutputFrame.zw * uInputSize.zw);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}`;

// Parte dall'acqua già disegnata (le fasce di colore) e ci aggiunge la luce che si muove.
const fragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform float uTime;   // millisecondi
uniform float uScale;  // zoom * densità dello schermo: da pixel dello schermo a pixel del mondo

// Caustiche: la rete di righe di luce che si intreccia sul fondo. Ogni strato disegna le sue righe (dove sin() passa
// per lo zero) su una coordinata che si deforma piano piano nel tempo; sommando gli strati le righe si incrociano.
float caustics(vec2 p, float t) {
  vec2 q = p;
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q += vec2(sin(q.y * 1.7 + t * (0.9 + fi * 0.35)), cos(q.x * 1.3 - t * (0.8 + fi * 0.3))) * 0.55;
    sum += pow(1.0 - abs(sin(q.x * 2.1 + q.y * 1.4 + fi * 1.7)), 9.0);
  }
  return sum * 0.5;
}

void main(void) {
  vec4 base = texture(uTexture, vTextureCoord);
  if (base.a < 0.02) {
    finalColor = base;
    return;
  }
  vec3 col = base.rgb / base.a;
  // Quanto è "profonda" questa zona, dal colore della fascia: 0 = riva, 1 = fondo.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float depth = clamp((0.40 - lum) / 0.13, 0.0, 1.0);

  // Posizione nel mondo (ancorata all'acqua, non allo schermo): resta ferma quando si fa pan o zoom.
  vec2 w = (vTextureCoord * uInputSize.xy) / uScale;
  float t = uTime * 0.0006;

  // Caustiche: più visibili sul fondo che sulla riva.
  float c = caustics(w / 13.0, t);
  col += vec3(0.45, 0.85, 1.0) * c * (0.10 + 0.30 * depth);

  // Sulla riva la luce si alza e si abbassa piano, come l'acqua che lambisce il bordo.
  float swell = 0.5 + 0.5 * sin(t * 2.2 + w.x * 0.035 + w.y * 0.025);
  col += vec3(0.20, 0.45, 0.60) * swell * (1.0 - depth) * 0.10;

  finalColor = vec4(col * base.a, base.a);
}`;

/** Filtro per l'acqua: caustiche e luce sulla riva che si muovono lentamente. Solo estetica. */
export class WaterFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'water-filter' }),
      resources: { waterUniforms: { uTime: { value: 0, type: 'f32' }, uScale: { value: 1, type: 'f32' } } },
      resolution: 'inherit', // nitido anche sugli schermi ad alta densità
      antialias: 'inherit',
    });
  }

  private get uniforms(): Record<string, number> {
    return (this.resources['waterUniforms'] as any).uniforms;
  }

  set time(ms: number) {
    this.uniforms['uTime'] = ms;
  }

  set scale(s: number) {
    this.uniforms['uScale'] = s;
  }
}
