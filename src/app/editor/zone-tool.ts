import { EditorMapLayer } from './map-layer';
import { TileEditor } from './tile-editor';

interface Cell {
  x: number;
  y: number;
}

const key = (c: Cell) => `${c.x},${c.y}`;

/**
 * Lo strumento delle zone di innesco: gruppi di caselle di qualunque forma (anche non collegate) che gli eventi usano come innesco. Con lo strumento aperto si vedono i contorni delle
 * zone già fatte; nella modalità di creazione (o di modifica delle caselle di una zona) un clic su una casella di un tile la aggiunge e un secondo clic la toglie: le caselle scelte
 * si contornano in azzurro. Si conferma dal tasto della cassetta. Una casella può stare in più zone.
 */
export class ZoneTool {
  /** Strumento aperto (si vedono le zone) e modalità di scelta delle caselle (nuova zona, o `editing` per cambiare quelle di una esistente). */
  open = false;
  creating = false;
  /** La zona di cui si stanno cambiando le caselle (null: se ne crea una nuova). */
  editing: string | null = null;
  private selected = new Map<string, Cell>();
  /** La zona evidenziata (passando sulla sua scheda), o null. */
  private highlight: string | null = null;

  constructor(
    private readonly layer: EditorMapLayer,
    private readonly editor: TileEditor,
    private readonly notify: () => void,
  ) {}

  get count(): number {
    return this.selected.size;
  }

  setOpen(on: boolean) {
    this.open = on;
    if (!on) {
      this.creating = false;
      this.editing = null;
      this.highlight = null;
    }
    this.selected.clear();
    this.redraw();
    this.notify();
  }

  /** Comincia a scegliere le caselle di una zona nuova, o (con `id`) di una esistente, di cui si partono dalle sue caselle. */
  startChoosing(id: string | null = null) {
    if (!this.open) return;
    this.creating = true;
    this.editing = id;
    this.selected = new Map((id ? (this.editor.zones.find((z) => z.id === id)?.cells ?? []) : []).map((c) => [key(c), { x: c.x, y: c.y }]));
    this.redraw();
    this.notify();
  }

  cancel() {
    if (!this.creating) return;
    this.creating = false;
    this.editing = null;
    this.selected.clear();
    this.redraw();
    this.notify();
  }

  /** Evidenzia una zona sulla mappa (con il bordo più marcato), o nessuna. */
  setHighlight(id: string | null) {
    if (id === this.highlight) return;
    this.highlight = id;
    this.redraw();
  }

  /** Le zone sono cambiate (annulla, tessere tolte…): ridisegna. */
  refresh() {
    this.redraw();
  }

  /** Un clic sulla mappa (in celle, con la parte decimale): aggiunge o toglie la casella (solo caselle di un tile). */
  click(at: Cell) {
    if (!this.open || !this.creating) return;
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    if (!this.layer.isWalkable(cell)) return;
    const k = key(cell);
    if (this.selected.has(k)) this.selected.delete(k);
    else this.selected.set(k, cell);
    this.redraw();
    this.notify();
  }

  /** Conferma: crea la zona (o cambia le caselle di quella in modifica). Restituisce l'id e se è nuova, o null se non c'è niente da confermare. */
  confirm(): { id: string; created: boolean } | null {
    if (!this.creating || !this.selected.size) return null;
    const cells = [...this.selected.values()];
    const editing = this.editing;
    let id: string | null;
    if (editing) {
      this.editor.setZoneCells(editing, cells);
      id = editing;
    } else id = this.editor.createZone(cells);
    this.creating = false;
    this.editing = null;
    this.selected.clear();
    this.redraw();
    this.notify();
    return id ? { id, created: !editing } : null;
  }

  private redraw() {
    if (!this.open) {
      this.layer.setZoneOverlay(null);
      return;
    }
    this.layer.setZoneOverlay({
      zones: this.editor.zones.filter((z) => !(this.creating && z.id === this.editing)).map((z) => ({ cells: z.cells.map((c) => ({ x: c.x, y: c.y })), highlight: z.id === this.highlight })),
      selected: [...this.selected.values()],
    });
  }
}
