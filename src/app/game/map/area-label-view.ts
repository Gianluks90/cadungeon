import { Container, Graphics, Text } from 'pixi.js';
import { CELL_SIZE } from '../constants';
import { createFilledIcon } from '../icons/icon-loader';
import { theme } from '../theme';
import { LABEL_FONT_PX, LabelPlace, labelLeader, snapLabel } from './area-labels';

/** Le viste vive: lo zoom lo dà la camera (editor e partita) con `setAreaLabelZoom`. Da lontano il testo si ingrandisce (nel mondo) per restare leggibile, quindi le etichette si vedono sempre. */
const views = new Set<AreaLabelView>();
let currentZoom = 1;

export function setAreaLabelZoom(zoom: number) {
  currentZoom = zoom;
  for (const v of views) v.applyZoom();
}

/** Il testo non scende sotto questa altezza sullo schermo (pixel), e non cresce oltre `MAX_SCALE` volte. */
const MIN_SCREEN_FONT_PX = 12;
const MAX_SCALE = 8;
/** Il raggio della maniglia di spostamento (pixel del mondo, a scala 1) e la sua distanza dal testo. */
const HANDLE_RADIUS_PX = 12;
const HANDLE_GAP_PX = 18;
/** Quanto dura la dissolvenza con cui compare un'etichetta, e il suo livello di trasparenza. */
const FADE_MS = 700;
const TEXT_ALPHA = 0.78;
/** La linea che collega l'etichetta lontana: quanti tratti (per sfumarla) e lo spessore. */
const LEADER_STEPS = 10;
const LEADER_WIDTH_PX = 2;

/** Gli strumenti accanto all'etichetta (vista del Maligno): inquadra l'area e leggi le informazioni. Le icone sono quelle del tasto "tutta la mappa" (Z) e delle informazioni. */
export type AreaTool = 'zoom' | 'info';
const TOOLS: readonly { tool: AreaTool; icon: string }[] = [
  { tool: 'zoom', icon: 'fit_screen' },
  { tool: 'info', icon: 'info' },
];
/** Distanza fra i centri di due strumenti (pixel del mondo, a scala 1). */
const TOOL_STEP_PX = HANDLE_RADIUS_PX * 2 + 6;
/** Le icone degli strumenti, senza cerchio intorno (pixel del mondo, a scala 1). */
const TOOL_ICON_PX = 24;

/** Una etichetta disegnata: i suoi oggetti si creano una volta sola (il testo è costoso) e poi si spostano, ingrandiscono e sfumano. */
interface Node {
  place: LabelPlace;
  root: Container;
  text: Text;
  handle: Container | null;
  /** Gli strumenti a destra del testo (solo con `setTools`). */
  tools: Container | null;
  /** La larghezza vera del testo in pixel del mondo, a scala 1. */
  width: number;
}

/**
 * Le etichette delle aree sulla mappa: il nome dell'area, nel carattere dei titoli, sullo sfondo accanto all'area (`placeAreaLabels` dice dove). Se l'etichetta è lontana dall'area, una
 * sola linea del colore dei muri, al centro dell'etichetta, che parte dal muro esterno dell'area e sfuma verso l'etichetta, le collega. Compaiono con una dissolvenza la prima volta che si
 * vedono. Nell'editor, con lo strumento delle aree aperto (`setHandles`), a sinistra di ogni etichetta c'è una maniglia a quattro frecce (`open_with`) da trascinare per spostarla: il centro
 * si aggancia ai puntini dello sfondo (i vertici delle caselle); `release` dà la nuova posizione.
 */
export class AreaLabelView {
  readonly container = new Container();
  private readonly lines = new Graphics();
  private readonly nodes = new Map<string, Node>();
  private shown: ReadonlySet<string> | null = null;
  private drag: { id: string; dx: number; dy: number; x: number; y: number } | null = null;
  private handles = false;
  private tools = false;
  /** Quando è comparsa (la prima volta) ogni etichetta, per la dissolvenza. */
  private readonly born = new Map<string, number>();
  private raf = 0;
  private lastScale = 1;
  /** Come erano le linee l'ultima volta che le ho disegnate: se non è cambiato niente non si rifanno. */
  private linesKey = '';

  constructor(private readonly editable = false) {
    views.add(this);
    this.container.eventMode = 'none';
    this.container.addChild(this.lines);
    // Il carattere dei titoli è un font del sito: appena è pronto si rifanno i testi con quello vero.
    void document.fonts?.load(`${LABEL_FONT_PX}px Metamorphous`).then(() => {
      for (const n of this.nodes.values()) n.root.destroy({ children: true });
      this.nodes.clear();
      this.layout();
    });
  }

  /** Smette di seguire lo zoom (la grafica la distrugge chi distrugge la scena). */
  dispose() {
    views.delete(this);
    cancelAnimationFrame(this.raf);
  }

  private labels: LabelPlace[] = [];

  /** Cambia le etichette (e quali sono visibili: `null` = tutte). I testi già disegnati restano: si ricreano solo quelli nuovi o con un altro nome. */
  set(labels: LabelPlace[], shown: ReadonlySet<string> | null = null) {
    this.labels = labels;
    this.shown = shown;
    const live = new Set(labels.map((l) => l.id));
    for (const [id, n] of this.nodes) {
      const place = labels.find((l) => l.id === id);
      if (live.has(id) && place?.text === n.place.text) continue;
      n.root.destroy({ children: true });
      this.nodes.delete(id);
    }
    this.layout();
  }

  /** Solo le etichette delle aree già rivelate (in partita). */
  setShown(shown: ReadonlySet<string> | null) {
    this.shown = shown;
    this.layout();
  }

  /** Accende gli strumenti accanto a ogni etichetta (zoom sull'area e informazioni). I testi si rifanno una volta sola, qui. */
  setTools(on: boolean) {
    if (this.tools === on) return;
    this.tools = on;
    for (const n of this.nodes.values()) n.root.destroy({ children: true });
    this.nodes.clear();
    this.layout();
  }

  /** Le maniglie per spostarle si vedono solo con lo strumento delle aree. */
  setHandles(on: boolean) {
    if (this.handles === on) return;
    this.handles = on;
    this.layout();
  }

  /** Quanto si ingrandisce il testo con lo zoom di adesso, perché resti leggibile da lontano. */
  private scale(): number {
    return Math.min(MAX_SCALE, Math.max(1, MIN_SCREEN_FONT_PX / (LABEL_FONT_PX * currentZoom)));
  }

  /** Lo zoom è cambiato: se cambia l'ingrandimento si risistemano le etichette (solo posizione e scala, niente da ricreare). */
  applyZoom() {
    const s = this.scale();
    if (s === this.lastScale) return;
    this.lastScale = s;
    this.layout();
  }

  private create(place: LabelPlace): Node {
    const root = new Container();
    const text = new Text({
      text: place.text,
      style: { fontFamily: 'Metamorphous, Cinzel, Georgia, serif', fontSize: LABEL_FONT_PX, letterSpacing: 1.5, fill: theme.color.ui.text, stroke: { color: theme.color.token.fill, width: 5, join: 'round' } },
    });
    text.anchor.set(0.5);
    root.addChild(text);
    let handle: Container | null = null;
    if (this.editable) {
      handle = new Container();
      const hx = -(text.width / 2 + HANDLE_GAP_PX);
      const g = new Graphics().circle(hx, 0, HANDLE_RADIUS_PX).fill({ color: theme.color.token.fill, alpha: 0.85 }).stroke({ width: 1.5, color: theme.color.accentActive });
      const icon = createFilledIcon('open_with', 16, theme.color.accentActive);
      icon.position.set(hx, 0);
      handle.addChild(g, icon);
      root.addChild(handle);
    }
    let tools: Container | null = null;
    if (this.tools) {
      tools = new Container();
      TOOLS.forEach(({ icon }, i) => {
        const cx = text.width / 2 + HANDLE_GAP_PX + i * TOOL_STEP_PX;
        const glyph = createFilledIcon(icon, TOOL_ICON_PX, theme.color.danger);
        glyph.position.set(cx, 0);
        tools!.addChild(glyph);
      });
      root.addChild(tools);
    }
    this.container.addChild(root);
    const node = { place, root, text, handle, tools, width: text.width };
    this.nodes.set(place.id, node);
    return node;
  }

  /** Posizione, scala, trasparenza e linee di tutte le etichette (le cose leggere: si può chiamare spesso). */
  private layout() {
    const s = this.scale();
    const now = performance.now();
    const visibleIds = new Set<string>();
    for (const place of this.labels) {
      if (this.shown && !this.shown.has(place.id)) continue;
      visibleIds.add(place.id);
      if (!this.born.has(place.id)) this.born.set(place.id, now);
      const node = this.nodes.get(place.id) ?? this.create(place);
      node.place = place;
    }
    for (const [id, n] of this.nodes) {
      const on = visibleIds.has(id);
      n.root.visible = on;
      if (!on) continue;
      const pos = this.drag?.id === id ? this.drag : n.place;
      n.root.scale.set(s);
      n.root.position.set(pos.x * CELL_SIZE, pos.y * CELL_SIZE);
      if (n.handle) n.handle.visible = this.handles;
    }
    this.fade();
  }

  /** Trasparenza di testi e linee secondo la dissolvenza (continua finché c'è qualcosa che compare), e le linee per le etichette lontane. */
  private fade() {
    cancelAnimationFrame(this.raf);
    const now = performance.now();
    const s = this.scale();
    let more = false;
    let key = `${s}`;
    for (const [id, n] of this.nodes) {
      if (!n.root.visible) continue;
      const a = Math.min(1, (now - (this.born.get(id) ?? 0)) / FADE_MS);
      const pos = this.drag?.id === id ? this.drag : n.place;
      key += `|${id},${pos.x},${pos.y},${n.place.cells?.length ?? 0},${a < 1 ? a : 1}`;
    }
    const redraw = key !== this.linesKey;
    this.linesKey = key;
    const g = redraw ? this.lines.clear() : null;
    for (const [id, n] of this.nodes) {
      if (!n.root.visible) continue;
      const a = Math.min(1, (now - (this.born.get(id) ?? 0)) / FADE_MS);
      if (a < 1) more = true;
      n.text.alpha = TEXT_ALPHA * a;
      if (n.handle) n.handle.alpha = a;
      if (n.tools) n.tools.alpha = a;
      // La linea per le etichette lontane dall'area: del colore dei muri, sfumata verso l'etichetta.
      if (!g || !n.place.cells) continue;
      const pos = this.drag?.id === id ? this.drag : n.place;
      const rect = { x: pos.x, y: pos.y, w: (n.width * s) / CELL_SIZE, h: (LABEL_FONT_PX * 1.25 * s) / CELL_SIZE };
      const leader = labelLeader(n.place.cells, rect, n.place.tiles);
      if (!leader) continue;
      const { from, to } = leader;
      const p = (t: number) => ({ x: (from.x + (to.x - from.x) * t) * CELL_SIZE, y: (from.y + (to.y - from.y) * t) * CELL_SIZE });
      for (let i = 0; i < LEADER_STEPS; i++) {
        const k = i / LEADER_STEPS;
        const a0 = p(k);
        const a1 = p((i + 1) / LEADER_STEPS);
        g.moveTo(a0.x, a0.y).lineTo(a1.x, a1.y).stroke({ width: LEADER_WIDTH_PX, color: theme.color.linePrimary, alpha: 0.9 * (1 - k) * a });
      }
    }
    if (more) this.raf = requestAnimationFrame(() => this.fade());
  }

  /** La maniglia sotto questo punto (pixel del mondo)? Se sì comincia a trascinare quell'etichetta. `tol` allarga l'area (il dito è meno preciso del mouse). */
  grab(at: { x: number; y: number }, tol: number): boolean {
    if (!this.editable || !this.handles) return false;
    const s = this.scale();
    for (const n of this.nodes.values()) {
      if (!n.root.visible || !n.handle) continue;
      const hx = n.place.x * CELL_SIZE - (n.width / 2 + HANDLE_GAP_PX) * s;
      if (Math.hypot(at.x - hx, at.y - n.place.y * CELL_SIZE) > HANDLE_RADIUS_PX * s + tol) continue;
      // La maniglia e il centro dell'etichetta si muovono insieme: si ricorda lo scarto fra il punto preso e il centro.
      this.drag = { id: n.place.id, dx: n.place.x * CELL_SIZE - at.x, dy: n.place.y * CELL_SIZE - at.y, x: n.place.x, y: n.place.y };
      return true;
    }
    return false;
  }

  /** Lo strumento sotto questo punto (pixel del mondo)? `tol` allarga l'area, perché il dito è meno preciso del mouse. */
  hitTool(at: { x: number; y: number }, tol: number): { id: string; tool: AreaTool } | null {
    if (!this.tools) return null;
    const s = this.scale();
    for (const n of this.nodes.values()) {
      if (!n.root.visible || !n.tools) continue;
      for (let i = 0; i < TOOLS.length; i++) {
        const cx = n.place.x * CELL_SIZE + (n.width / 2 + HANDLE_GAP_PX + i * TOOL_STEP_PX) * s;
        if (Math.hypot(at.x - cx, at.y - n.place.y * CELL_SIZE) <= HANDLE_RADIUS_PX * s + tol) return { id: n.place.id, tool: TOOLS[i].tool };
      }
    }
    return null;
  }

  get dragging(): boolean {
    return !!this.drag;
  }

  /** L'etichetta presa segue il puntatore, agganciata ai puntini dello sfondo (i vertici delle caselle). */
  moveTo(at: { x: number; y: number }) {
    const d = this.drag;
    if (!d) return;
    const x = snapLabel((at.x + d.dx) / CELL_SIZE);
    const y = snapLabel((at.y + d.dy) / CELL_SIZE);
    if (x === d.x && y === d.y) return; // ancora sullo stesso puntino: niente da rifare
    d.x = x;
    d.y = y;
    this.layout();
  }

  /** Lascia l'etichetta: restituisce chi è e dove l'autore l'ha messa (su un puntino), o null se non si stava trascinando. */
  release(): { id: string; x: number; y: number } | null {
    const d = this.drag;
    this.drag = null;
    if (!d) return null;
    return { id: d.id, x: snapLabel(d.x), y: snapLabel(d.y) };
  }
}
