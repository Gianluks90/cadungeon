import { EditorMapLayer } from './map-layer';
import { TileEditor } from './tile-editor';

interface Cell {
  x: number;
  y: number;
}

const key = (c: Cell) => `${c.x},${c.y}`;
const NEIGHBORS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** Quanto è grande il tasto di conferma, in celle (il raggio): serve anche a riconoscere il clic. */
const BUTTON_RADIUS_CELLS = 0.3;

/** Un "pezzo": le caselle di un tile che stanno dalla stessa parte delle porte (un tile senza porte in mezzo è un pezzo solo; un corridoio diviso da una porta ne ha due). */
interface Piece {
  tile: number;
  cells: Cell[];
}

/**
 * Lo strumento per designare le aree, pezzo per pezzo. Un pezzo è un tile, o la parte di un tile da un lato di una porta (un corridoio interrotto a metà da una porta ha due pezzi
 * e può stare in due aree). Con lo strumento aperto si vedono i contorni delle aree già fatte (quella di partenza in giallo, le altre in azzurro). Nella modalità di creazione toccare
 * un pezzo lo contorna in azzurro; toccando un pezzo collegato a quelli scelti il contorno si allarga e abbraccia anche lui. I punti morti attaccati a un pezzo scelto si scelgono da
 * soli, a meno che una porta li separi dalla stanza; toccare di nuovo un pezzo scelto lo toglie (se gli altri restano collegati). Due aree possono essere vicine anche senza porta in mezzo:
 * conta solo quali pezzi si scelgono. Sul centro della prima stanza scelta (senza legarlo alla griglia) compare il tasto di conferma: un clic crea l'area. Una casella sta in una sola area.
 */
export class AreaTool {
  /** Strumento aperto (si vedono le aree) e modalità di creazione (si scelgono i pezzi). */
  open = false;
  creating = false;
  private selected: Piece[] = [];
  /** L'area evidenziata (passando o cliccando sulla sua scheda), o null. */
  private highlight: string | null = null;

  constructor(
    private readonly layer: EditorMapLayer,
    private readonly editor: TileEditor,
    private readonly notify: () => void,
  ) {}

  get count(): number {
    return this.selected.length;
  }

  setOpen(on: boolean) {
    this.open = on;
    if (!on) {
      this.creating = false;
      this.highlight = null;
    }
    this.selected = [];
    this.redraw();
    this.notify();
  }

  setCreating(on: boolean) {
    if (on === this.creating) return;
    this.creating = on && this.open;
    this.selected = [];
    this.redraw();
    this.notify();
  }

  /** Evidenzia un'area sulla mappa (con il bordo più chiaro), o nessuna. */
  setHighlight(id: string | null) {
    if (id === this.highlight) return;
    this.highlight = id;
    this.redraw();
  }

  /** I pezzi sono cambiati: la selezione non vale più, si riparte (le aree si ridisegnano). */
  refresh() {
    this.selected = [];
    this.redraw();
  }

  /** Le caselle già assegnate a un'area. */
  private assigned(): Set<string> {
    return new Set(this.editor.areaDefs.flatMap((a) => a.cells.map(key)));
  }

  /** Il pezzo che contiene la casella, senza le caselle già in un'area; null se non c'è un tile o non resta niente di libero. */
  private pieceAt(cell: Cell, taken: Set<string>): Piece | null {
    const tile = this.layer.tileIndexAt(cell);
    if (tile < 0) return null;
    const cells = this.layer.regionAt(cell).filter((c) => this.layer.tileIndexAt(c) === tile && !taken.has(key(c)));
    return cells.length ? { tile, cells } : null;
  }

  /** I due pezzi si toccano? Con `noDoor` solo se non c'è una porta in mezzo. */
  private touching(a: Piece, b: Piece, noDoor: boolean): boolean {
    const inB = new Set(b.cells.map(key));
    return a.cells.some((c) =>
      NEIGHBORS.some((d) => {
        const n = { x: c.x + d.x, y: c.y + d.y };
        return inB.has(key(n)) && this.layer.adjacent(c, n) && !(noDoor && this.layer.doorBetween(c, n));
      }),
    );
  }

  /** I pezzi scelti restano tutti collegati fra loro (anche attraverso le porte)? */
  private connected(pieces: Piece[]): boolean {
    if (pieces.length <= 1) return true;
    const seen = new Set([0]);
    const queue = [0];
    while (queue.length) {
      const cur = queue.pop()!;
      pieces.forEach((p, i) => {
        if (!seen.has(i) && this.touching(pieces[cur], p, false)) {
          seen.add(i);
          queue.push(i);
        }
      });
    }
    return seen.size === pieces.length;
  }

  /** I punti morti liberi attaccati a `piece` senza una porta in mezzo. */
  private deadEndsOf(piece: Piece, chosen: Piece[], taken: Set<string>): Piece[] {
    const found: Piece[] = [];
    this.editor.pieces.forEach((t, i) => {
      if (!t.def.deadEnd || i === piece.tile || chosen.some((c) => c.tile === i)) return;
      const first = [...this.layer.cellsOfTile(i)][0];
      const p = first ? this.pieceAt(first, taken) : null;
      if (p && this.touching(piece, p, true)) found.push(p);
    });
    return found;
  }

  /** Il centro del tasto di conferma: il centro della prima stanza (pezzo) scelta, senza legarlo alla griglia. */
  private buttonPoint(): Cell | null {
    const cells = this.selected[0]?.cells;
    if (!cells?.length) return null;
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    return { x: (Math.min(...xs) + Math.max(...xs) + 1) / 2, y: (Math.min(...ys) + Math.max(...ys) + 1) / 2 };
  }

  /** Un clic sulla mappa (in celle, con la parte decimale): sceglie o toglie un pezzo, o conferma l'area. */
  click(at: Cell) {
    if (!this.open || !this.creating) return;
    const b = this.buttonPoint();
    if (b && Math.hypot(at.x - b.x, at.y - b.y) <= BUTTON_RADIUS_CELLS) {
      this.confirm();
      return;
    }
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    const taken = this.assigned();
    const tile = this.layer.tileIndexAt(cell);
    if (tile < 0) return;
    const chosenAt = this.selected.find((p) => p.cells.some((c) => key(c) === key(cell)));
    if (chosenAt) {
      // Toglie il pezzo e, con lui, i punti morti che restano attaccati solo a lui.
      let rest = this.selected.filter((p) => p !== chosenAt);
      const dead = (p: Piece) => !!this.editor.pieces[p.tile]?.def.deadEnd;
      rest = rest.filter((p) => !dead(p) || rest.some((o) => !dead(o) && this.touching(o, p, true)));
      if (this.connected(rest)) this.selected = rest;
    } else {
      const piece = this.pieceAt(cell, taken);
      if (!piece || (this.selected.length && !this.selected.some((p) => this.touching(p, piece, false)))) return;
      const next = [...this.selected, piece];
      if (!this.editor.pieces[piece.tile]?.def.deadEnd) next.push(...this.deadEndsOf(piece, next, taken));
      this.selected = next;
    }
    this.redraw();
    this.notify();
  }

  /** Crea l'area con le caselle scelte e chiude la modalità di creazione. */
  confirm() {
    if (!this.selected.length) return;
    this.editor.createArea(this.selected.flatMap((p) => p.cells));
    this.creating = false;
    this.selected = [];
    this.redraw();
    this.notify();
  }

  /** Ridisegna contorni e selezione. */
  redraw() {
    if (!this.open) {
      this.layer.setAreaOverlay(null);
      return;
    }
    const areas = this.editor.areas().map((a) => ({ start: a.start, cells: a.def.cells, highlight: a.id === this.highlight }));
    this.layer.setAreaOverlay({ areas, selected: this.selected.flatMap((p) => p.cells), button: this.buttonPoint() });
  }
}
