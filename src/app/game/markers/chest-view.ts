import { Container, Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  CHEST_ANIM_MS,
  CHEST_HEIGHT_RATIO,
  CHEST_INNER_INSET_PX,
  CHEST_INSIDE_STEPS,
  CHEST_LATCH_HEIGHT_PX,
  CHEST_LATCH_WIDTH_PX,
  CHEST_LID_BAND_PX,
  CHEST_LID_CURVE,
  CHEST_LID_FIRST_LINE,
  CHEST_LID_LINES,
  CHEST_WIDTH_RATIO,
} from '../constants';
import { LINE, theme } from '../theme';
import { Board } from '../board/board';
import { Chest, Marker } from '../board/marker';
import { mixColors } from '../obstacles/obstacle-view';

/** Gli elementi grafici di uno scrigno e a che punto è l'apertura. */
interface ChestRecord {
  chest: Chest;
  root: Container;
  /** Tutto ciò che si disegna, ruotato come indica lo scrigno. */
  body: Container;
  /** L'interno, visibile da quando il coperchio comincia ad aprirsi. */
  inside: Graphics;
  /** Il coperchio (fondo pieno, linee della curvatura, fermaglio): ha l'origine sul lato lungo dietro, e si ribalta da lì. */
  lid: Container;
  /** Il contorno nitido, sempre sopra a tutto. */
  outline: Graphics;
  /** 0 = chiuso, 1 = aperto del tutto. */
  t: number;
}

/**
 * Disegna gli scrigni, visti dall'alto: un rettangolo dal contorno nitido, nel colore del tipo (rame, argento, oro).
 * Chiuso mostra il coperchio tondo, reso con linee parallele al lato lungo sempre più distanti verso il centro, e un fermaglio
 * davanti. Aperto resta una cassa vuota: l'interno è un incavo come le buche, ma con un fondo ben definito.
 * Aprendolo, il coperchio si ribalta verso il lato lungo dietro e scopre l'interno.
 */
export class ChestView {
  readonly container = new Container();
  private readonly records = new Map<Chest, ChestRecord>();
  /** Chi chiede meno movimento (impostazioni del sistema) vede lo scrigno cambiare di stato di colpo. */
  private readonly reduceMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** `visible` dice quali scrigni mostrare (quelli rivelati); senza, si vedono tutti. */
  redraw(board: Board, visible: (m: Marker) => boolean = () => true) {
    const shown = new Set(board.markers.filter((m): m is Chest => m.type === 'chest' && visible(m)));
    for (const [chest, rec] of this.records) {
      if (shown.has(chest)) continue;
      rec.root.destroy({ children: true });
      this.records.delete(chest);
    }
    for (const chest of shown) {
      let rec = this.records.get(chest);
      if (!rec) {
        rec = this.createRecord(chest);
        this.records.set(chest, rec);
        this.container.addChild(rec.root);
      }
      this.drawGeometry(rec); // anche al cambio di tema
    }
  }

  private createRecord(chest: Chest): ChestRecord {
    const root = new Container();
    root.position.set((chest.x + 0.5) * CELL_SIZE, (chest.y + 0.5) * CELL_SIZE);
    const inside = new Graphics();
    const lid = new Container();
    const outline = new Graphics();
    const body = new Container();
    body.rotation = ((chest.rotation ?? 0) * Math.PI) / 180; // il coperchio si apre dal lato "dietro", che ruota con lo scrigno
    body.addChild(inside, lid, outline);
    root.addChild(body);
    return { chest, root, body, inside, lid, outline, t: chest.open ? 1 : 0 };
  }

  private drawGeometry(rec: ChestRecord) {
    const w = CELL_SIZE * CHEST_WIDTH_RATIO;
    const h = CELL_SIZE * CHEST_HEIGHT_RATIO;
    const color = theme.color.chest[rec.chest.tier];
    const floor = theme.color.floor;
    const depth = theme.color.pit.depth;

    // Interno: una cornice che scende verso il fondo (gradiente come le buche), il fondo con il suo bordo, e le linee degli angoli.
    const inside = rec.inside.clear();
    const step = CHEST_INNER_INSET_PX / CHEST_INSIDE_STEPS;
    for (let i = 0; i < CHEST_INSIDE_STEPS; i++) {
      const inset = i * step;
      inside
        .rect(-w / 2 + inset, -h / 2 + inset, w - 2 * inset, h - 2 * inset)
        .fill(mixColors(floor, depth, (i + 1) / (CHEST_INSIDE_STEPS + 1)));
    }
    const bw = w - 2 * CHEST_INNER_INSET_PX;
    const bh = h - 2 * CHEST_INNER_INSET_PX;
    inside.rect(-bw / 2, -bh / 2, bw, bh).fill(depth);
    inside.rect(-bw / 2, -bh / 2, bw, bh).stroke({ width: LINE.hairline, color, alpha: theme.alpha.chestInside, pixelLine: true });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        inside.moveTo(sx * (w / 2 - 1), sy * (h / 2 - 1)).lineTo(sx * bw / 2, sy * bh / 2);
      }
    }
    inside.stroke({ width: LINE.hairline, color, alpha: theme.alpha.chestInside, pixelLine: true });

    // Coperchio: fondo pieno (nasconde l'interno), linee della curvatura e fermaglio. L'origine è sul lato lungo dietro.
    for (const child of rec.lid.removeChildren()) child.destroy();
    const lid = new Graphics();
    lid.rect(-w / 2, 0, w, h).fill(floor);
    // Due linee verticali vicino ai lati corti; le orizzontali stanno solo fra le due (le fasce alle estremità sono lisce).
    // Più fitte verso i lati lunghi e sempre più rade verso il centro.
    const half = h / 2;
    const xIn = w / 2 - CHEST_LID_BAND_PX;
    for (const s of [-1, 1]) lid.moveTo(s * xIn, 0).lineTo(s * xIn, h);
    for (let i = CHEST_LID_FIRST_LINE; i <= CHEST_LID_LINES; i++) {
      const d = half * (i / CHEST_LID_LINES) ** CHEST_LID_CURVE; // distanza dal lato lungo, in alto
      for (const y of i === CHEST_LID_LINES ? [d] : [d, 2 * half - d]) lid.moveTo(-xIn, y).lineTo(xIn, y);
    }
    lid.stroke({ width: LINE.hairline, color, alpha: theme.alpha.chestLid, pixelLine: true });
    lid
      .rect(-CHEST_LATCH_WIDTH_PX / 2, h - CHEST_LATCH_HEIGHT_PX / 2, CHEST_LATCH_WIDTH_PX, CHEST_LATCH_HEIGHT_PX)
      .fill(floor)
      .stroke({ width: LINE.hairline, color, pixelLine: true });
    rec.lid.addChild(lid);
    rec.lid.position.y = -h / 2;

    rec.outline.clear().rect(-w / 2, -h / 2, w, h).stroke({ width: LINE.hairline, color, join: 'miter', pixelLine: true });
    this.applyState(rec);
  }

  /** Da chiamare a ogni frame: il coperchio si ribalta quando lo scrigno viene aperto. */
  tick(deltaMs: number) {
    for (const rec of this.records.values()) {
      const target = rec.chest.open ? 1 : 0;
      if (rec.t === target) continue;
      rec.t = this.reduceMotion
        ? target
        : rec.t < target
          ? Math.min(target, rec.t + deltaMs / CHEST_ANIM_MS)
          : Math.max(target, rec.t - deltaMs / CHEST_ANIM_MS);
      this.applyState(rec);
    }
  }

  /** Mostra lo stato di apertura: il coperchio si accorcia verso il lato dietro, e sparisce quando è aperto del tutto. */
  private applyState(rec: ChestRecord) {
    const ease = 1 - (1 - rec.t) ** 2;
    rec.inside.visible = rec.t > 0;
    rec.lid.visible = rec.t < 1;
    rec.lid.scale.y = Math.max(0.0001, 1 - ease);
  }
}
