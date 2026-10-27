import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CELL_SIZE, TORCH, WALL_WIDTH_PX } from '../constants';
import { Cell } from '../board/board';
import { theme } from '../theme';

/** Una torcia dell'avventura: l'incrocio della griglia a cui è appesa e il lato verso cui sporge dal muro. */
export interface Torch {
  x: number;
  y: number;
  facing: 'N' | 'E' | 'S' | 'W';
}

/** Di quanto ruota il disegno (che sporge verso il basso) per puntare verso `facing`. */
const ROTATION: Record<Torch['facing'], number> = { S: 0, W: Math.PI / 2, N: Math.PI, E: -Math.PI / 2 };

/** La macchia di luce: un cerchio bianco che sfuma verso i bordi (si colora e si somma al pavimento). Si crea una volta sola. */
let glowTexture: Texture | null = null;
function glow(): Texture {
  if (glowTexture) return glowTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = Texture.from(canvas);
  return glowTexture;
}

/**
 * Disegna le torce: una staffa sottile che sporge dal muro, la fiamma in punta e, sul pavimento, un alone caldo che si somma al colore.
 * L'alone è ritagliato sulle caselle già esplorate (non esce dai muri né svela ciò che non si è visto). La fiamma e l'alone ondeggiano piano.
 */
export class TorchView {
  readonly container = new Container();
  private readonly lights = new Container();
  private readonly mask = new Graphics();
  private readonly mounts = new Container();
  private flames: { fire: Graphics; glow: Sprite; phase: number }[] = [];
  private elapsed = 0;

  constructor() {
    this.lights.mask = this.mask;
    this.container.addChild(this.mask, this.lights, this.mounts);
  }

  /** Disegna le torce `shown`, con la luce solo sulle caselle `lit`. */
  redraw(shown: readonly Torch[], lit: readonly Cell[]) {
    this.mask.clear();
    for (const c of lit) this.mask.rect(c.x * CELL_SIZE, c.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    this.mask.fill(0xffffff);
    for (const child of this.lights.removeChildren()) child.destroy({ children: true });
    for (const child of this.mounts.removeChildren()) child.destroy({ children: true });
    this.flames = [];
    shown.forEach((t, i) => {
      const holder = new Container();
      holder.position.set(t.x * CELL_SIZE, t.y * CELL_SIZE);
      holder.rotation = ROTATION[t.facing];
      const start = WALL_WIDTH_PX / 2; // la faccia interna del muro
      const tip = start + TORCH.bracketPx;

      // La staffa e la coppa che regge il fuoco (la coppa è un anello nel colore dei muri).
      const cup = TORCH.cupPx;
      const bracket = new Graphics();
      bracket.moveTo(0, start).lineTo(0, tip);
      bracket.circle(0, tip + cup, cup).stroke({ width: TORCH.bracketWidthPx, color: theme.color.linePrimary, cap: 'round' });
      const fire = new Graphics();
      const flame = new Container();
      flame.position.set(0, tip + cup);
      flame.addChild(fire);

      // L'alone sta al centro della fiamma e non ruota con la staffa (è un cerchio): il ritaglio lo tiene dentro le stanze.
      const halo = new Sprite(glow());
      halo.anchor.set(0.5);
      halo.width = halo.height = TORCH.glowRadiusCells * 2 * CELL_SIZE;
      halo.tint = theme.color.torch.glow;
      halo.blendMode = 'add';
      halo.alpha = theme.alpha.torchGlow;
      const centre = { x: t.x * CELL_SIZE, y: t.y * CELL_SIZE };
      const out = [0, tip + cup];
      const c = Math.cos(holder.rotation), s = Math.sin(holder.rotation);
      halo.position.set(centre.x + out[0] * c - out[1] * s, centre.y + out[0] * s + out[1] * c);

      holder.addChild(bracket, flame);
      this.drawFire(fire, 0, i * 1.7);
      this.lights.addChild(halo);
      this.mounts.addChild(holder);
      this.flames.push({ fire, glow: halo, phase: i * 1.7 });
    });
  }

  /**
   * Il fuoco visto dall'alto: quattro strati (dal bordo al centro rosso-arancio, arancio, giallo, quasi bianco), ognuno una forma a lingue
   * il cui raggio cambia piano da un punto all'altro e nel tempo, un po' più lunga verso la stanza; più qualche scintilla che sale.
   */
  private drawFire(g: Graphics, ms: number, phase: number) {
    g.clear();
    const c = theme.color.torch;
    const layers: [number, number, number, number][] = [
      [c.outer, 7.2, 0.28, 0.9],
      [c.flame, 5.4, 0.3, 0.95],
      [c.core, 3.6, 0.32, 1],
      [c.hot, 1.9, 0.3, 1],
    ];
    const t = ms / TORCH.flickerMs + phase;
    layers.forEach(([color, radius, jag, alpha], n) => {
      const points: number[] = [];
      const steps = 20;
      for (let k = 0; k < steps; k++) {
        const a = (k / steps) * Math.PI * 2;
        const wobble = Math.sin(a * 3 + t * (1.3 + n * 0.35) + n) * 0.6 + Math.sin(a * 5 - t * 1.9 + n * 2) * 0.4;
        const r = radius * (1 + jag * wobble);
        points.push(Math.cos(a) * r, Math.sin(a) * r * (a > 0 && a < Math.PI ? 1.18 : 1)); // più lungo verso la stanza (+y)
      }
      g.poly(points, true).fill({ color, alpha });
    });
    // Scintille: salgono verso la stanza e si spengono.
    for (let e = 0; e < TORCH.embers; e++) {
      const p = ((ms / TORCH.emberRiseMs) + e / TORCH.embers + phase * 0.13) % 1;
      const side = Math.sin(e * 2.4 + phase) * 6 * p;
      g.circle(side, 6 + p * 14, 0.9).fill({ color: c.core, alpha: (1 - p) * 0.9 });
    }
  }

  /** Il lampeggio lento: l'alone respira e il fuoco cambia forma. */
  tick(dtMs: number) {
    if (!this.flames.length) return;
    this.elapsed += dtMs;
    const base = theme.alpha.torchGlow;
    for (const f of this.flames) {
      const t = this.elapsed / TORCH.flickerMs + f.phase;
      const wobble = 0.5 * Math.sin(t) + 0.3 * Math.sin(t * 2.3 + 1) + 0.2 * Math.sin(t * 0.47);
      f.glow.alpha = base * (0.85 + 0.15 * wobble);
      this.drawFire(f.fire, this.elapsed, f.phase);
    }
  }
}
