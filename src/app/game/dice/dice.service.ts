import { Injectable, NgZone, inject } from '@angular/core';
import { DieColor } from '../items/item';
import { DieFace, FaceRoll } from './faces';

export type { DieFace, FaceRoll } from './faces';

interface DieTable {
  theme: string;
  themeColor: string;
  faces: DieFace[];
}

/** Il risultato di un tiro: i totali di tutti i dadi. `miss` = almeno un Mancato (l'attacco fallisce del tutto). */
export interface RollTotals {
  hearts: number;
  surge: number;
  range: number;
  miss: boolean;
}

/** La grandezza dei dadi 3D (dice-box `scale`: 5 è il valore di partenza della libreria). */
const DICE_SCALE = 4;

/** Quanto restano i dadi sul tavolo dopo essersi fermati, in millisecondi. */
const DICE_LINGER_MS = 4000;

/**
 * I dadi 3D (dice-box, docs/dadi.md): un secondo canvas trasparente sopra tutta la pagina, creato al primo tiro. Ogni colore ha il suo tema
 * (public/dice/themes/<colore>/) e le sue facce (public/dice/faces.json): il numero 1–6 che esce dal d6 è la faccia.
 * Per ora il valore lo decide la fisica nel browser; col multigiocatore dovrà deciderlo l'host (docs/dadi.md).
 */
@Injectable({ providedIn: 'root' })
export class DiceService {
  private readonly zone = inject(NgZone);
  private box: any = null;
  private starting: Promise<void> | null = null;
  private tables: Record<string, DieTable> = {};
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  /** Chiamato a fine tiro da `rollItem` con una riga di testo: la scena la mostra come notifica (temporaneo, per provare i dadi). */
  onResult: ((text: string) => void) | null = null;

  /** Tira i dadi di un oggetto (un d6 per ogni colore indicato) e dice il risultato. */
  async rollItem(name: string, colors: readonly string[]): Promise<void> {
    if (!colors.length) return;
    const totals = await this.roll(colors);
    if (!totals) return;
    const parts = totals.miss
      ? ['Mancato!']
      : [`${totals.hearts} cuori`, `${totals.surge} Scariche`, `gittata ${totals.range}`];
    this.onResult?.(`${name}: ${parts.join(' · ')}`);
  }

  /** Tira un d6 per ogni colore (i colori si possono ripetere). Restituisce i totali, o null se i dadi non si sono potuti creare. */
  async roll(colors: readonly string[]): Promise<RollTotals | null> {
    const rolls = await this.rollFaces(colors as DieColor[]);
    if (!rolls) return null;
    const totals: RollTotals = { hearts: 0, surge: 0, range: 0, miss: false };
    for (const { face } of rolls) {
      if (face.slash) continue; // le facce multivalenti si risolveranno in combattimento, chiedendo al giocatore quale valore accettare
      totals.hearts += face.hearts;
      totals.surge += face.surge;
      totals.range += face.range;
      totals.miss ||= face.miss;
    }
    return totals;
  }

  /** Tira un d6 per ogni colore e restituisce colore e faccia di ogni dado (raggruppati per colore, nell'ordine in cui compaiono). Null se i dadi non si sono potuti creare. */
  async rollFaces(colors: readonly DieColor[]): Promise<FaceRoll[] | null> {
    await this.ensureReady();
    if (!this.box) return null;
    if (this.clearTimer) clearTimeout(this.clearTimer);
    const counts = new Map<DieColor, number>();
    for (const c of colors) if (this.tables[c]) counts.set(c, (counts.get(c) ?? 0) + 1);
    let first = true;
    const pending: Promise<{ value: number }[]>[] = [];
    for (const [color, n] of counts) {
      const table = this.tables[color];
      const options = { theme: table.theme, themeColor: table.themeColor };
      // `roll` svuota il tavolo, `add` aggiunge: il primo colore pulisce, gli altri si aggiungono
      pending.push(this.zone.runOutsideAngular(() => (first ? this.box.roll(`${n}d6`, options) : this.box.add(`${n}d6`, options))));
      first = false;
    }
    const groups = await Promise.all(pending);
    const out: FaceRoll[] = [];
    [...counts.keys()].forEach((color, i) => {
      for (const die of groups[i]) {
        const face = this.tables[color].faces[die.value - 1];
        if (face) out.push({ color, face });
      }
    });
    this.scheduleClear();
    return out;
  }

  /** Toglie i dadi dal tavolo dopo un po' (o subito, con `now`). */
  scheduleClear(now = false) {
    if (this.clearTimer) clearTimeout(this.clearTimer);
    if (now) this.box?.clear();
    else this.clearTimer = setTimeout(() => this.box?.clear(), DICE_LINGER_MS);
  }

  /** Crea il canvas e carica temi e facce, una volta sola. */
  private ensureReady(): Promise<void> {
    this.starting ??= this.zone.runOutsideAngular(async () => {
      try {
        const res = await fetch('dice/faces.json');
        this.tables = (await res.json()).dice;
        const layer = document.createElement('div');
        layer.id = 'dice-layer';
        layer.style.cssText = 'position:fixed;inset:0;z-index:1000;pointer-events:none;';
        const style = document.createElement('style');
        style.textContent = '#dice-layer canvas{width:100%;height:100%;display:block;}';
        layer.appendChild(style);
        document.body.appendChild(layer);
        const { default: DiceBox } = await import('@3d-dice/dice-box'); // pesante: si carica solo al primo tiro
        const themes = Object.values(this.tables).map((t) => t.theme);
        this.box = new DiceBox({
          container: '#dice-layer',
          assetPath: new URL('dice/', document.baseURI).pathname,
          theme: themes[0],
          scale: DICE_SCALE,
        });
        await this.box.init();
        for (const theme of themes.slice(1)) await this.box.loadTheme(theme); // tutti i temi pronti prima del primo tiro
      } catch (e) {
        console.warn('Dadi 3D non disponibili', e);
        this.box = null;
      }
    });
    return this.starting;
  }
}
