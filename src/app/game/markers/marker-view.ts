import { reducedMotion } from '../graphics-settings';
import { twinDots } from './twin-pattern';
import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  GLYPH_ACTIVATE_MS,
  GLYPH_BURST_MS,
  GLYPH_BURST_SCALE,
  GLYPH_CIRCLE_SEGMENTS,
  GLYPH_DOUBLE_GAP_PX,
  GLYPH_GLOW_WIDTH_PX,
  GLYPH_PULSE_PERIOD_MS,
  GLYPH_RADIUS_RATIO,
  GLYPH_WAVE_PERIOD_MS,
  GLYPH_SMALL_RADIUS_RATIO,
  GLYPH_STAR_PINCH,
  GLYPH_STAR_RATIO,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Glyph, Marker } from '../board/marker';
import { mixSeed, mulberry32 } from '../map/rng';

/** Gli elementi grafici di un segnalino, e dove è arrivato nel passaggio da spento ad acceso. */
interface MarkerRecord {
  marker: Glyph;
  root: Container;
  off: Graphics;
  /** Lo stato acceso: i tratti e il loro alone, che pulsano insieme. */
  on: Container;
  burst: Graphics;
  /** Illuminato (editor, passando il mouse sulla coppia): si mostra come acceso, senza l'animazione dell'accensione. */
  highlight: boolean;
  /** Il prossimo frame lo stato mostrato salta subito al suo valore, senza dissolvenza. */
  snap: boolean;
  /** L'alone dei tratti acceso (si spegne se c'è una pedina sopra). */
  glow: Graphics | null;
  /** Tempo dall'ultima onda emessa come destinazione di un viaggio. */
  waveClock: number;
  /** 0 = spento, 1 = acceso del tutto. */
  t: number;
  /** Era acceso all'ultimo frame? Serve a riconoscere l'istante dell'accensione. */
  wasActive: boolean;
  /** Avanzamento dell'anello che si allarga all'accensione (0..1), o null. */
  burstProgress: number | null;
  /** Sfasamento della pulsazione: ogni glifo pulsa un po' per conto suo. */
  phase: number;
}

/**
 * Disegna i glifi, impressi nel pavimento: un cerchio a doppia linea inscritto nella cella e quattro cerchi più piccoli
 * nei punti in cui le diagonali della cella incontrano il cerchio (le diagonali non si disegnano). Solo linee.
 * Spento ha il colore delle crepe, perché è inciso come loro, e sta fermo. Acceso è bianco con un alone e pulsa piano.
 * La prima volta che si accende il colore sfuma nel bianco e un'unica onda parte dal centro e si espande.
 */
export class MarkerView {
  readonly container = new Container();
  private readonly records = new Map<Glyph, MarkerRecord>();
  /** Glifi che si mostrano ancora spenti anche se nello stato sono accesi: la scena li accende (`release`) al momento giusto, per la sequenza dei gemelli. */
  private readonly held = new Set<Glyph>();
  private highlighted: string | null = null;
  /** Chi chiede meno movimento (impostazioni del sistema o grafica leggera) vede i glifi senza pulsazione né anello. */
  private readonly reduceMotion =
    reducedMotion();

  /**
   * Chi sa cosa succede intorno ai glifi: quali sono destinazioni di un viaggio in questo momento (emettono l'onda) e quali
   * hanno una pedina sopra (non emettono bagliore). Si chiede a ogni frame.
   */
  stateProvider: (() => { destinations: ReadonlySet<Marker>; occupied: ReadonlySet<Marker> }) | null = null;

  constructor(private readonly seed: number) {}

  /** `visible` dice quali segnalini mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    const shown = new Set(board.markers.filter((m): m is Glyph => m.type === 'glyph' && visible(m)));
    for (const [marker, rec] of this.records) {
      if (shown.has(marker)) continue;
      rec.root.destroy({ children: true });
      this.records.delete(marker);
    }
    for (const marker of shown) {
      let rec = this.records.get(marker);
      if (!rec) {
        rec = this.createRecord(marker);
        this.records.set(marker, rec);
        this.container.addChild(rec.root);
      }
      this.drawGeometry(rec); // anche al cambio di tema
    }
  }

  /** Illumina i glifi gemelli della coppia con questa etichetta (null: nessuno): nell'editor, al passaggio del mouse. */
  setHighlight(twin: string | null) {
    if (twin === this.highlighted) return;
    this.highlighted = twin;
    for (const rec of this.records.values()) {
      const on = !!twin && rec.marker.twin === twin;
      if (on === rec.highlight) continue;
      rec.highlight = on;
      rec.snap = true;
    }
  }

  /** Tiene il glifo spento nel disegno finché non si chiama `release`. */
  hold(marker: Glyph) {
    this.held.add(marker);
  }

  /** Lascia che il glifo mostri il suo stato vero: se è acceso parte l'animazione dell'accensione. */
  release(marker: Glyph) {
    this.held.delete(marker);
  }

  private createRecord(marker: Glyph): MarkerRecord {
    const root = new Container();
    root.position.set((marker.x + 0.5) * CELL_SIZE, (marker.y + 0.5) * CELL_SIZE);
    const off = new Graphics();
    const on = new Container();
    const burst = new Graphics();
    root.addChild(off, on, burst);
    const active = !this.held.has(marker) && (!!marker.active || !!marker.sealed);
    return { marker, root, off, on, burst, glow: null, highlight: !!this.highlighted && marker.twin === this.highlighted, snap: true, waveClock: GLYPH_WAVE_PERIOD_MS, t: active ? 1 : 0, wasActive: active, burstProgress: null, phase: mulberry32(mixSeed(this.seed, marker.x, marker.y))() };
  }

  /** Il cerchio a doppia linea di raggio `r`. */
  private rings(g: Graphics, r: number) {
    this.circle(g, 0, 0, r);
    this.circle(g, 0, 0, r - GLYPH_DOUBLE_GAP_PX);
  }

  /** Un cerchio come poligono a molti lati: le linee sottili (pixelLine) non funzionano sui cerchi veri. */
  private circle(g: Graphics, cx: number, cy: number, r: number) {
    const pts: number[] = [];
    for (let i = 0; i < GLYPH_CIRCLE_SEGMENTS; i++) {
      const a = (i / GLYPH_CIRCLE_SEGMENTS) * Math.PI * 2;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.poly(pts, true);
  }

  /**
   * Una stella a quattro punte al centro, dentro il cerchio interno: i lati sono archi incurvati verso il centro, tanto
   * da farla sottile e acuta, con un effetto elfico. Solo contorno.
   */
  private star(g: Graphics, r: number) {
    const tip = (r - GLYPH_DOUBLE_GAP_PX) * GLYPH_STAR_RATIO;
    const k = tip * GLYPH_STAR_PINCH; // i punti di controllo stanno vicinissimi al centro
    g.moveTo(0, -tip)
      .quadraticCurveTo(k, -k, tip, 0)
      .quadraticCurveTo(k, k, 0, tip)
      .quadraticCurveTo(-k, k, -tip, 0)
      .quadraticCurveTo(-k, -k, 0, -tip)
      .closePath();
  }

  /** I quattro cerchietti, centrati sulla fascia fra le due linee dove le diagonali incontrano il cerchio. */
  private nodes(g: Graphics, r: number) {
    const d = (r - GLYPH_DOUBLE_GAP_PX / 2) / Math.SQRT2;
    const small = CELL_SIZE * GLYPH_SMALL_RADIUS_RATIO;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) this.circle(g, sx * d, sy * d, small);
  }

  /** Solo i cerchietti indicati (0 in alto a sinistra, poi in senso orario). */
  private nodesAt(g: Graphics, r: number, which: readonly number[]) {
    const d = (r - GLYPH_DOUBLE_GAP_PX / 2) / Math.SQRT2;
    const small = CELL_SIZE * GLYPH_SMALL_RADIUS_RATIO;
    const at: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const i of which) this.circle(g, at[i][0] * d, at[i][1] * d, small);
  }

  private drawGeometry(rec: MarkerRecord) {
    const r = CELL_SIZE * GLYPH_RADIUS_RATIO;
    const floor = theme.color.floor;
    rec.off.clear();
    this.rings(rec.off, r);
    this.star(rec.off, r);
    // Da spento: lo stesso colore e la stessa opacità delle crepe.
    const off = { width: LINE.hairline, color: theme.color.lineDetail, alpha: theme.alpha.crack, cap: 'round', join: 'round', pixelLine: true } as const;
    rec.off.stroke(off);
    this.nodes(rec.off, r);
    rec.off.fill(floor).stroke(off); // i cerchietti sono pieni: coprono le linee del cerchio
    const dots = twinDots(rec.marker.twin); // un glifo gemello ha pieni i cerchietti della sua coppia
    if (dots.length) {
      this.nodesAt(rec.off, r, dots);
      rec.off.fill({ color: theme.color.lineDetail, alpha: theme.alpha.glyphTwinDot });
    }

    for (const child of rec.on.removeChildren()) child.destroy();
    const glow = new Graphics();
    this.rings(glow, r);
    this.star(glow, r);
    this.nodes(glow, r);
    const lit = rec.marker.sealed ? theme.color.glyphSealed : theme.color.glyphOn;
    glow.stroke({ width: GLYPH_GLOW_WIDTH_PX, color: lit, alpha: theme.alpha.glyphGlow, cap: 'round', join: 'round' });
    const lines = new Graphics();
    const on = { width: LINE.hairline, color: lit, cap: 'round', join: 'round', pixelLine: true } as const;
    this.rings(lines, r);
    this.star(lines, r);
    lines.stroke(on);
    this.nodes(lines, r);
    lines.fill(floor).stroke(on);
    if (dots.length) {
      this.nodesAt(lines, r, dots);
      lines.fill(lit);
    }
    rec.on.addChild(glow, lines);
    rec.glow = glow;
  }

  /** Da chiamare a ogni frame: dissolvenza da spento ad acceso, pulsazione e anello dell'accensione. */
  tick(nowMs: number, deltaMs: number) {
    const a = theme.alpha;
    const r = CELL_SIZE * GLYPH_RADIUS_RATIO;
    const state = this.stateProvider?.();
    for (const rec of this.records.values()) {
      const active = !this.held.has(rec.marker) && (!!rec.marker.active || !!rec.marker.sealed); // un glifo sigillato pulsa come uno acceso, ma in rosso
      const occupied = !!state?.occupied.has(rec.marker);
      const destination = !!state?.destinations.has(rec.marker);
      if (active && !rec.wasActive && !this.reduceMotion) rec.burstProgress = 0; // la prima volta che si accende: un'unica onda
      rec.wasActive = active;

      const target = active || rec.highlight ? 1 : 0; // illuminato = come se fosse acceso (ma senza onda: quella parte solo dall'accensione vera)
      if (rec.snap) {
        rec.t = target;
        rec.snap = false;
      } else rec.t = this.reduceMotion ? target : rec.t < target ? Math.min(target, rec.t + deltaMs / GLYPH_ACTIVATE_MS) : Math.max(target, rec.t - deltaMs / GLYPH_ACTIVATE_MS);
      // Acceso: pulsa tra il minimo e il massimo; chi riduce il movimento vede una luce ferma a metà.
      const wave = this.reduceMotion ? 0.5 : (1 - Math.cos((nowMs / GLYPH_PULSE_PERIOD_MS + rec.phase) * Math.PI * 2)) / 2;
      // Con una pedina sopra il glifo non emette bagliore: niente alone e niente pulsazione, solo un bianco fermo.
      const calm = this.reduceMotion || occupied;
      const pulse = a.glyphOnMin + (a.glyphOnMax - a.glyphOnMin) * (calm ? 0.5 : wave);
      if (rec.glow) rec.glow.visible = !occupied;
      rec.off.alpha = 1 - rec.t; // l'opacità del tratto spento è già nella linea (come le crepe)
      rec.on.alpha = rec.t * pulse;
      rec.off.visible = rec.t < 1;
      rec.on.visible = rec.t > 0;

      // Destinazione di un viaggio: emette l'onda di accensione, e la ripete finché lo è.
      if (destination && !occupied && active && !this.reduceMotion) {
        rec.waveClock += deltaMs;
        if (rec.waveClock >= GLYPH_WAVE_PERIOD_MS) {
          rec.waveClock = 0;
          rec.burstProgress = 0;
        }
      } else {
        rec.waveClock = GLYPH_WAVE_PERIOD_MS; // pronto a partire subito la prossima volta
      }

      rec.burst.clear();
      if (rec.burstProgress !== null) {
        const b = rec.burstProgress + deltaMs / GLYPH_BURST_MS;
        if (b >= 1) rec.burstProgress = null;
        else {
          rec.burstProgress = b;
          const ease = 1 - (1 - b) ** 2;
          this.circle(rec.burst, 0, 0, r * (1 + (GLYPH_BURST_SCALE - 1) * ease));
          rec.burst.stroke({ width: LINE.hairline, color: rec.marker.sealed ? theme.color.glyphSealed : theme.color.glyphOn, alpha: 0.6 * (1 - b), pixelLine: true });
        }
      }
    }
  }
}
