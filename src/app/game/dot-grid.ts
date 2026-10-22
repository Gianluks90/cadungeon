import { Geometry, Mesh, Shader } from 'pixi.js';
import {
  CELL_SIZE,
  DOT_MIN_SPACING_PX,
  DOT_RADIUS_PX,
} from './constants';
import { theme } from './theme';

const vertex = `
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// Per ogni pixel dello schermo calcola dov'è nel mondo e quanto dista dal puntino più vicino.
// Il puntino è un cerchio con bordo morbido di 1 px: nitido a qualsiasi zoom.
const fragment = `
precision highp float;
out vec4 finalColor;
uniform vec2 uScreenSize;   // dimensione canvas, pixel reali
uniform vec2 uOffset;       // dove cade l'origine del mondo sullo schermo, pixel reali
uniform float uScale;       // zoom * densità schermo
uniform float uStep;        // un puntino ogni uStep celle (potenza di 2)
uniform float uFade;        // opacità dei puntini che spariranno al livello successivo (0..1)
uniform float uRadius;      // raggio in pixel reali
uniform vec3 uDotColor;
uniform float uOpacity;
uniform float uCell;
void main() {
  vec2 screen = vec2(gl_FragCoord.x, uScreenSize.y - gl_FragCoord.y);
  vec2 world = (screen - uOffset) / uScale;
  float spacing = uCell * uStep;
  vec2 d = (world / spacing) - floor(world / spacing + 0.5);
  float distPx = length(d) * spacing * uScale;
  float a = (1.0 - smoothstep(uRadius - 0.75, uRadius + 0.75, distPx)) * uOpacity;
  // I puntini con indice pari su entrambi gli assi restano anche al livello successivo; gli altri sfumano.
  vec2 n = floor(world / spacing + 0.5);
  bool keep = mod(n.x, 2.0) == 0.0 && mod(n.y, 2.0) == 0.0;
  if (!keep) a *= uFade;
  finalColor = vec4(uDotColor * a, a);
}`;

function hexToRgb(hex: number): [number, number, number] {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

/** Sfondo di puntini: un solo rettangolo a schermo intero disegnato da uno shader. */
export class DotGrid {
  readonly mesh: Mesh<Geometry, Shader>;
  private readonly uniforms: Record<string, any>;

  constructor() {
    const geometry = new Geometry({
      attributes: { aPosition: [-1, -1, 1, -1, 1, 1, -1, 1] },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const shader = Shader.from({
      gl: { vertex, fragment },
      resources: {
        dot: {
          uScreenSize: { value: [1, 1], type: 'vec2<f32>' },
          uOffset: { value: [0, 0], type: 'vec2<f32>' },
          uScale: { value: 1, type: 'f32' },
          uStep: { value: 1, type: 'f32' },
          uFade: { value: 1, type: 'f32' },
          uRadius: { value: DOT_RADIUS_PX, type: 'f32' },
          uDotColor: { value: hexToRgb(theme.color.dots), type: 'vec3<f32>' },
          uOpacity: { value: theme.alpha.dots, type: 'f32' },
          uCell: { value: CELL_SIZE, type: 'f32' },
        },
      },
    });
    this.uniforms = (shader.resources['dot'] as any).uniforms;
    this.mesh = new Mesh({ geometry, shader });
  }

  /** Riprende i colori dal tema attuale (da chiamare quando il tema cambia). */
  applyTheme() {
    this.uniforms['uDotColor'] = hexToRgb(theme.color.dots);
    this.uniforms['uOpacity'] = theme.alpha.dots;
  }

  /**
   * Aggiorna lo sfondo con la camera attuale.
   * Tutto in pixel CSS: la densità dello schermo (dpr) viene applicata qui.
   */
  update(width: number, height: number, offsetX: number, offsetY: number, zoom: number, dpr: number) {
    const u = this.uniforms;
    u['uScreenSize'] = [width * dpr, height * dpr];
    u['uOffset'] = [offsetX * dpr, offsetY * dpr];
    u['uScale'] = zoom * dpr;
    u['uRadius'] = DOT_RADIUS_PX * dpr;
    // Più si esce con lo zoom, più i puntini si diradano: ogni volta che lo spazio sullo schermo
    // dimezza, metà dei puntini sfuma gradualmente invece di sparire di colpo.
    const level = Math.max(0, Math.log2(DOT_MIN_SPACING_PX / (CELL_SIZE * zoom)));
    const k = Math.floor(level);
    u['uStep'] = 2 ** k;
    u['uFade'] = 1 - (level - k);
  }
}
