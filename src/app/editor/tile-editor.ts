import { Door, DoorLock, RuneColor } from '../game/board/door';
import { Obstacle, ObstacleType, obstacleCells } from '../game/board/obstacle';
import { placeRock, splitObstacle } from './rocks';
import type { PieceData } from '../game/pieces/piece';
import type { MonsterDef } from '../game/monsters/monster';
import type { PlacedMonster } from './monster-view';
import { CHEST_TABLE_MAX } from '../game/board/marker';
import { HERO_START_CELLS } from '../game/constants';
import type { ChestTier, Loot, Marker, PotionKind } from '../game/board/marker';
import type { DieColor } from '../game/items/item';

/** Un segnalino che si può piazzare dall'editor: pozione, pila di monete, baule (per tipo) o chiave runica (per colore). */
export type MarkerSpec = { type: 'potion'; kind: PotionKind } | { type: 'coins' } | { type: 'chest'; tier: ChestTier } | { type: 'rune'; color: RuneColor } | { type: 'glyph'; active?: boolean } | { type: 'start' } | { type: 'stairs' } | { type: 'encounter' };

/** Quanti se ne possono mettere: i bauli al massimo 3 per tipo (2 d'oro, come le ricompense della tabella dei ritrovamenti), le chiavi runiche 1 per colore; pozioni e monete senza limite. */
export const MARKER_LIMITS = { rune: 1, activeGlyph: 1, start: HERO_START_CELLS } as const;

/** La chiave con cui si conta un segnalino (`potion:heal`, `coins`, `chest:gold`, `rune:red`). */
export const markerKey = (m: { type: string; kind?: string; tier?: string; color?: string; active?: boolean }): string =>
  m.type === 'coins' || m.type === 'start' || m.type === 'stairs' || m.type === 'encounter' ? m.type : m.type === 'glyph' ? (m.active ? 'glyph:active' : 'glyph') : `${m.type}:${m.kind ?? m.tier ?? m.color}`;

/** Le modifiche a un nemico: nome (se è unico), quanto cambiano i valori della carta, abilità in più e bottino. */
export interface MonsterEdits {
  unique: boolean;
  name: string;
  bonus: { wounds: number; speed: number; armor: number; dice: DieColor[] };
  traits: string[];
  /** Abilità della carta tolte a questo nemico. */
  removedTraits: string[];
  drop: Loot[];
  /** Parte inattivo (non agisce finché un evento non lo attiva) e, a parte, se ha l'aspetto di pietra (immagine e bordo desaturati). */
  inactive: boolean;
  stone: boolean;
  /** Invincibile: ogni ferita è 0 finché un evento non lo rende vulnerabile. */
  invincible: boolean;
  /** A cosa è immune (voci di Piece.immune, e ll per tutti gli stati): parte da quelle della carta. */
  immune: string[];
}
import { MapTileRef, PlacedTile } from '../game/map/map-data';
import { overlaps, positionFor } from '../game/map/snap';
import { Rotation, TileDef, rotateTile, tileCells } from '../game/map/tile';
import { OPPOSITE, freeOpenings } from '../game/map/walls';
import { EditorMapLayer } from './map-layer';

interface Cell {
  x: number;
  y: number;
}

/** Quali porte si possono mettere: la normale, quella a chiave, o una a chiusura runica di un colore (una sola per colore). */
export type DoorKind = 'normal' | 'key' | 'event' | RuneColor;
export const RUNE_COLORS: RuneColor[] = ['blue', 'red', 'green'];

/** Il tile che chiude un'uscita libera. */
const DEAD_END = 'dead-end-2x1';
const HISTORY_LIMIT = 100;

/** Un'area: un gruppo di caselle (stanze, tratti di corridoio...), una sola può essere la zona di partenza. */
export interface AreaDef {
  id: string;
  start?: boolean;
  name?: string;
  /** Una riga sotto il nome e la descrizione che compare a schermo quando l'area viene rivelata (le aree diverse da quella di partenza). */
  subtitle?: string;
  text?: string;
  cells: Cell[];
}

/** Lo stato che l'annulla ricorda: i pezzi, le porte e le aree. */
interface Snap {
  tiles: MapTileRef[];
  doors: Door[];
  areas: AreaDef[];
  obstacles: Obstacle[];
  monsters: PieceData[];
  markers: Marker[];
  start: Cell[];
}

const sameObstacle = (a: Obstacle, b: Obstacle) => a.type === b.type && a.x === b.x && a.y === b.y && a.length === b.length && !!a.vertical === !!b.vertical && !!a.big === !!b.big && !!a.alone === !!b.alone;

const kindOf = (d: Door): DoorKind => (d.lock?.kind === 'rune' ? d.lock.color : d.lock?.kind === 'key' ? 'key' : d.lock?.kind === 'event' ? 'event' : 'normal');

/**
 * L'editing di tile e porte della mappa, senza interfaccia: l'elenco dei pezzi piazzati (`tiles`, nel formato salvato) e delle porte (`doors`), ciò che si porta in mano (una
 * tessera o una porta), la modalità elimina, i punti morti automatici e annulla/rifai. Ogni modifica avvisa con `notify` (chi lo usa ridisegna, riconta e salva la bozza).
 * L'annulla ricorda lo stato di prima di ogni azione: piazzare, spostare, eliminare (anche un'area intera) e chiudere le uscite sono un solo passo ciascuno.
 * Le porte stanno sui lati fra le celle, da muro a muro: quando un tile cambia, le porte che restano senza muri ai lati spariscono con lui.
 */
export class TileEditor {
  private list: MapTileRef[] = [];
  private placed: PlacedTile[] = [];
  private doorList: Door[] = [];
  private areaList: AreaDef[] = [];
  private obstacleList: Obstacle[] = [];
  private monsterList: PieceData[] = [];
  private markerList: Marker[] = [];
  /** Le caselle di partenza degli eroi (`start` della mappa). */
  private startList: Cell[] = [];
  private history: Snap[] = [];
  /** Gli stati annullati, per rifarli (si svuota a ogni nuova azione). */
  private future: Snap[] = [];
  /** La tessera in mano (id del catalogo), o null. */
  carrying: string | null = null;
  /** L'ostacolo in mano (macerie, buca o acqua), o null. Si piazza una casella per clic. */
  carryingObstacle: ObstacleType | null = null;
  /** Il mostro in mano (id del catalogo e se è potenziato), o null; `monsterRotated` lo gira (1×2 diventa 2×1, 2×3 diventa 3×2). */
  carryingMonster: { id: string; enhanced: boolean } | null = null;
  /** Il segnalino in mano (pozione, monete, baule, chiave runica), o null. R gira i bauli. */
  carryingMarker: MarkerSpec | null = null;
  private markerRotation: 0 | 90 | 180 | 270 = 0;
  /** Se la scala in mano era già in mappa: la sua coppia, così rimessa si ricollega a quella e non a un'altra scala rimasta sola. */
  private heldStairsLink: string | null = null;
  private monsterRotated = false;
  /** La porta in mano, o null. Una cosa alla volta: o una tessera o una porta. */
  carryingDoor: DoorKind | null = null;
  /** La serratura della porta ripresa per spostarla: rimessa, la porta la ritrova com'era (chiave o id evento compresi). */
  private carriedLock: DoorLock | null = null;
  /** L'id dell'oggetto a terra ripreso per spostarlo: lo tiene quando lo si rimette. */
  private carriedPickupId: string | null = null;
  /** Il testo e il costo dell'azione di un segnalino Incontro ripreso per spostarlo: li tiene quando lo si rimette. */
  private carriedEncounter: { label?: string; cost?: number } = {};
  /** La modalità personalizza dello strumento Glifi e altro: un clic su un segnalino Incontro apre la dialog (onEditEncounter). */
  onEditEncounter?: (index: number) => void;
  /** Se ciò che è in mano era già in mappa: com'era tutto prima, per rimetterlo al suo posto. */
  private pickedFrom: { before: Snap } | null = null;
  /** Modalità elimina: ogni clic, o area tracciata, toglie gli elementi toccati; ogni strumento toglie solo i suoi (`deleteScope`: le tessere, le porte o gli ostacoli). */
  deleting = false;
  deleteScope: 'tiles' | 'doors' | 'obstacles' | 'monsters' | 'markers' | 'specials' = 'tiles';
  /** Lo strumento Tessere è aperto: solo allora un clic su una tessera già messa la riprende per spostarla. */
  tilesToolOpen = false;
  /** Modalità personalizza (strumento Nemici): un clic su un nemico apre la dialog delle sue modifiche (`onEditMonster`). */
  customizing = false;
  onEditMonster?: (index: number) => void;
  /** Modalità separa (strumento Ostacoli): un clic su una macerie la stacca dal suo gruppo. */
  separating = false;

  constructor(
    private readonly layer: EditorMapLayer,
    private readonly defs: ReadonlyMap<string, TileDef>,
    private readonly monsterDefs: ReadonlyMap<string, MonsterDef>,
    private readonly notify: () => void,
  ) {
    layer.onStairsRoute = (a, route, phase) => this.stairsRouteEdit(a, route, phase);
  }

  /** Com'era tutto prima che l'autore prendesse una maniglia del filo delle scale: per l'annulla. */
  private routeBefore: Snap | null = null;

  /** L'autore sceglie il percorso del filo di una coppia (maniglie): si aggiorna al volo, e al rilascio, se è cambiato, diventa un passo dell'annulla e si salva la bozza. */
  private stairsRouteEdit(a: Extract<Marker, { type: 'stairs' }>, route: { x: number; y: number }[] | null, phase: 'start' | 'move' | 'end') {
    if (phase === 'start') {
      this.routeBefore = this.snapshot();
    } else if (phase === 'move' && route) {
      a.route = route;
      this.refreshMissing(); // ridisegna le scale e il filo
    } else if (phase === 'end') {
      const before = this.routeBefore;
      this.routeBefore = null;
      if (before && JSON.stringify(before.markers) !== JSON.stringify(this.markerList)) {
        this.remember(before);
        this.changed();
      }
    }
  }

  /** Una scala si è spostata o è cambiata la coppia: il percorso scelto per il suo filo non vale più, torna quello automatico. */
  private clearStairsRoutes(link: string) {
    for (const m of this.markerList) if (m.type === 'stairs' && m.link === link) delete m.route;
  }

  get tiles(): readonly MapTileRef[] {
    return this.list;
  }

  get markers(): readonly Marker[] {
    return this.markerList;
  }

  get startCells(): readonly Cell[] {
    return this.startList;
  }

  /** Quanti segnalini per tipo (chiave `markerKey`). */
  markerCounts(): Record<string, number> {
    const c: Record<string, number> = {};
    for (const m of this.markerList) {
      if (m.type === 'potion' || m.type === 'coins' || m.type === 'chest' || m.type === 'rune' || m.type === 'glyph' || m.type === 'stairs' || m.type === 'encounter') c[markerKey(m)] = (c[markerKey(m)] ?? 0) + 1;
    }
    if (this.startList.length) c['start'] = this.startList.length;
    return c;
  }

  /** Si può ancora mettere questo segnalino (i bauli sono al massimo 3 per tipo, le chiavi runiche una per colore)? */
  markerAvailable(spec: MarkerSpec): boolean {
    const limit = spec.type === 'start' ? MARKER_LIMITS.start : spec.type === 'chest' ? CHEST_TABLE_MAX[spec.tier] : spec.type === 'rune' ? MARKER_LIMITS.rune : spec.type === 'glyph' && spec.active ? MARKER_LIMITS.activeGlyph : Infinity;
    return (this.markerCounts()[markerKey(spec)] ?? 0) < limit;
  }

  get monsters(): readonly PieceData[] {
    return this.monsterList;
  }

  /** Quanti mostri in mappa per tipo e versione (chiave `id` per i normali, `id+` per i potenziati). */
  monsterCounts(): Record<string, number> {
    const c: Record<string, number> = {};
    for (const m of this.monsterList) {
      const key = `${m.monster}${m.enhanced ? '+' : ''}`;
      c[key] = (c[key] ?? 0) + 1;
    }
    return c;
  }

  /** Gli id degli oggetti del catalogo (per riconoscere quelli messi a terra dall'avventura); finché non si conoscono, nessun oggetto risulta sconosciuto. */
  private knownItems: ReadonlySet<string> | null = null;

  /** Da chiamare prima di `load` (che ridisegna tutto): non avvisa e non salva, perché a quel punto le liste sono ancora vuote. */
  setKnownItems(ids: ReadonlySet<string>) {
    this.knownItems = ids;
  }

  /** Un nemico di un tipo che il catalogo non ha (un contenuto che qui non c'è): resta in mappa come segnaposto, 1×1 se non ha una dimensione scritta. */
  private isMissingMonster(m: PieceData): boolean {
    return !!m.monster && !this.monsterDefs.has(m.monster);
  }

  /** Un oggetto a terra (reliquia o altro) che il catalogo non conosce. */
  private isMissingMarker(m: Marker): boolean {
    return m.type === 'item' && !!this.knownItems && !this.knownItems.has(m.itemId);
  }

  /** Quanti elementi non riconosciuti ci sono in mappa: finché ce ne sono l'avventura non è giocabile (la Verifica lo dice). */
  missingCount(): number {
    return this.monsterList.filter((m) => this.isMissingMonster(m)).length + this.markerList.filter((m) => this.isMissingMarker(m)).length;
  }

  /** Ridisegna i segnaposto e i segnalini noti (quelli sconosciuti non si disegnano come oggetti veri). */
  private refreshMissing() {
    this.layer.setMarkers(this.markerList.filter((m) => !this.isMissingMarker(m)));
    this.layer.setMissing([
      ...this.monsterList.filter((m) => this.isMissingMonster(m)).map((m) => ({ kind: 'monster' as const, x: m.x, y: m.y, w: (m.size ?? { w: 1, h: 1 }).w, h: (m.size ?? { w: 1, h: 1 }).h })),
      ...this.markerList.filter((m) => this.isMissingMarker(m)).map((m) => ({ kind: 'object' as const, x: m.x, y: m.y, w: 1, h: 1 })),
    ]);
  }

  /** Un mostro piazzato com'è disegnato: il suo tipo, dove sta e quanto occupa. */
  private placedMonster(p: PieceData): PlacedMonster | null {
    const def = p.monster ? this.monsterDefs.get(p.monster) : undefined;
    const custom = !!p.unique || !!p.bonus || !!p.traits?.length || !!p.removedTraits?.length || !!p.drop?.length || !!p.inactive || !!p.invincible || !!p.immune;
    return def ? { def, x: p.x, y: p.y, w: (p.size ?? def.size).w, h: (p.size ?? def.size).h, enhanced: !!p.enhanced, custom, stone: !!p.stone, events: this.eventPieces.has(p.id) } : null;
  }

  /** Gli id dei nemici su cui c'è un evento (per il badge del fulmine sulla miniatura). */
  private eventPieces: ReadonlySet<string> = new Set();

  /** Dice quali nemici hanno un evento; se è cambiato, le miniature si ridisegnano. */
  setEventPieces(ids: ReadonlySet<string>) {
    if (ids.size === this.eventPieces.size && [...ids].every((id) => this.eventPieces.has(id))) return;
    this.eventPieces = ids;
    this.layer.setMonsters(this.monsterList.flatMap((m) => this.placedMonster(m) ?? []));
  }

  get obstacles(): readonly Obstacle[] {
    return this.obstacleList;
  }

  /** Quante caselle occupa ogni tipo di ostacolo. */
  obstacleCounts(): Record<ObstacleType, number> {
    const c: Record<ObstacleType, number> = { rock: 0, pit: 0, water: 0 };
    for (const o of this.obstacleList) c[o.type] += obstacleCells(o).length;
    return c;
  }

  get doors(): readonly Door[] {
    return this.doorList;
  }

  /** Le aree, con il nome mostrato (quella di partenza si chiama così, le altre Area 1, Area 2... in ordine di creazione) e quante caselle hanno. */
  areas(): { id: string; name: string; start: boolean; cells: number; def: AreaDef }[] {
    let n = 0;
    // In elenco l'area di partenza è sempre la prima; le altre seguono l'ordine scelto (e si numerano da 1).
    const ordered = [...this.areaList.filter((a) => a.start), ...this.areaList.filter((a) => !a.start)];
    return ordered.map((a) => ({ id: a.id, name: a.start ? 'Area di partenza' : `Area ${++n}`, start: !!a.start, cells: a.cells.length, def: a }));
  }

  get areaDefs(): readonly AreaDef[] {
    return this.areaList;
  }

  get pieces(): readonly PlacedTile[] {
    return this.placed;
  }

  /** Quanti pezzi in mappa per tipo. */
  counts(): Record<string, number> {
    const c: Record<string, number> = {};
    for (const t of this.list) c[t.tile] = (c[t.tile] ?? 0) + 1;
    return c;
  }

  /** Quante porte ci sono per tipo (le runiche al massimo una per colore). */
  doorCounts(): Record<DoorKind, number> {
    const c: Record<DoorKind, number> = { normal: 0, key: 0, event: 0, blue: 0, red: 0, green: 0 };
    for (const d of this.doorList) c[kindOf(d)]++;
    return c;
  }

  /** Quante tessere hanno almeno una casella fuori da ogni area (una tessera divisa da una porta conta se anche solo una metà non ha area). */
  unassignedTiles(): number {
    const taken = new Set(this.areaList.flatMap((a) => a.cells.map((c) => `${c.x},${c.y}`)));
    return this.placed.filter((t) => [...tileCells(t.def)].some((k) => { const [cx, cy] = k.split(',').map(Number); return !taken.has(`${t.x + cx},${t.y + cy}`); })).length;
  }

  /** Quante uscite dei pezzi piazzati non sono collegate a niente. */
  openExits(): number {
    return freeOpenings(this.placed).length;
  }

  /** Mette in mappa pezzi e porte (la bozza ritrovata, o un annulla); i tile di cui non si conosce il tipo si saltano. */
  load(tiles: readonly MapTileRef[], doors: readonly Door[] = this.doorList, areas: readonly Partial<AreaDef>[] = this.areaList, obstacles: readonly Obstacle[] = this.obstacleList, monsters: readonly PieceData[] = this.monsterList, markers: readonly Marker[] = this.markerList, start: readonly Cell[] = this.startList) {
    this.list = tiles.filter((t) => this.defs.has(t.tile)).map((t) => ({ ...t }));
    this.placed = this.list.map((t) => ({ def: rotateTile(this.defs.get(t.tile)!, t.rot), x: t.x, y: t.y }));
    this.doorList = doors.map((d) => ({ ...d }));
    this.areaList = areas.filter((a): a is Partial<AreaDef> & { id: string } => !!a.id).map((a) => ({ ...a, id: a.id, cells: (a.cells ?? []).map((c) => ({ ...c })) }));
    this.obstacleList = obstacles.map((o) => ({ ...o }));
    this.monsterList = monsters.filter((m) => m.team === 'monster').map((m) => ({ ...m }));
    this.markerList = markers.map((m) => ({ ...m }));
    // Gli oggetti a terra di avventure fatte prima (o a mano) non hanno un id: gli si dà, così gli eventi possono sceglierli.
    const carried = this.carriedPickupId;
    this.carriedPickupId = null;
    for (const m of this.markerList) if ((m.type === 'potion' || m.type === 'coins' || m.type === 'rune' || m.type === 'key' || m.type === 'item') && !m.id) m.id = this.nextPickupId();
    for (const m of this.markerList) if (m.type === 'encounter' && !m.id) m.id = this.nextPickupId('incontro');
    this.carriedPickupId = carried;
    this.startList = start.map((c) => ({ x: c.x, y: c.y }));
    this.layer.setStartCells(this.startList);
    this.layer.setTiles(this.placed);
    this.layer.setDoors(this.doorList);
    this.layer.setObstacles(this.obstacleList);
    this.layer.setMonsters(this.monsterList.flatMap((m) => this.placedMonster(m) ?? []));
    this.refreshMissing();
  }

  private snapshot(): Snap {
    return { tiles: this.list.map((t) => ({ ...t })), doors: this.doorList.map((d) => ({ ...d })), areas: this.areaList.map((a) => ({ ...a, cells: a.cells.map((c) => ({ ...c })) })), obstacles: this.obstacleList.map((o) => ({ ...o })), monsters: this.monsterList.map((m) => ({ ...m })), markers: this.markerList.map((m) => ({ ...m })), start: this.startList.map((c) => ({ ...c })) };
  }

  private restore(s: Snap) {
    this.load(s.tiles, s.doors, s.areas, s.obstacles, s.monsters, s.markers, s.start);
  }

  private remember(before: Snap) {
    this.future = [];
    this.history.push(before);
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
  }

  /** Dopo una modifica ai tile: le porte rimaste senza muri ai lati spariscono; poi si ridisegna e si avvisa. */
  private changed() {
    this.layer.setTiles(this.placed);
    const doors = this.doorList.filter((d) => this.layer.doorHasWalls(d));
    this.doorList = doors;
    // Le caselle delle aree seguono i tile: se un tile sparisce, le sue caselle escono dalle aree e un'area vuota sparisce (non mentre se ne tiene in mano uno ripreso: potrebbe tornare).
    if (!this.pickedFrom) {
      const exists = new Set(this.placed.flatMap((t) => [...tileCells(t.def)].map((k) => { const [cx, cy] = k.split(',').map(Number); return `${t.x + cx},${t.y + cy}`; })));
      this.areaList = this.areaList.map((a) => ({ ...a, cells: a.cells.filter((c) => exists.has(`${c.x},${c.y}`)) })).filter((a) => a.cells.length);
    }
    this.layer.setDoors(doors);
    // Gli ostacoli seguono i tile: se un tile sparisce, spariscono gli ostacoli che restano (anche in parte) fuori dai tile.
    if (!this.pickedFrom) this.obstacleList = this.obstacleList.filter((o) => obstacleCells(o).every((c) => this.layer.isWalkable(c)));
    // Gli oggetti a terra e gli scrigni seguono i tile come gli ostacoli.
    if (!this.pickedFrom) this.markerList = this.markerList.filter((m) => this.layer.isWalkable(m));
    if (!this.pickedFrom) this.startList = this.startList.filter((c) => this.layer.isWalkable(c));
    this.layer.setStartCells(this.startList);
    // I mostri seguono i tile come gli ostacoli.
    if (!this.pickedFrom) this.monsterList = this.monsterList.filter((m) => this.monsterCellsOk(m));
    this.layer.setObstacles(this.obstacleList);
    this.layer.setMonsters(this.monsterList.flatMap((m) => this.placedMonster(m) ?? []));
    this.refreshMissing();
    this.notify();
  }

  private monsterCells(m: PieceData): Cell[] {
    const size = m.size ?? (m.monster ? this.monsterDefs.get(m.monster)?.size : undefined) ?? { w: 1, h: 1 };
    return Array.from({ length: size.w * size.h }, (_, i) => ({ x: m.x + (i % size.w), y: m.y + Math.floor(i / size.w) }));
  }

  private monsterCellsOk(m: PieceData): boolean {
    return this.monsterCells(m).every((c) => this.layer.isWalkable(c));
  }

  private clearHand() {
    this.carrying = null;
    this.carryingDoor = null;
    this.carryingObstacle = null;
    this.layer.setCarry(null);
    this.layer.setCarryDoor(false);
    this.layer.setObstacleProvider(null);
    this.carryingMonster = null;
    this.monsterRotated = false;
    this.layer.setMonsterProvider(null);
    this.carryingMarker = null;
    this.markerRotation = 0;
    this.heldStairsLink = null;
    this.carriedPickupId = null;
    this.carriedEncounter = {};
    this.layer.setMarkerProvider(null);
  }

  // --- Ciò che si ha in mano ---

  /** Prende una tessera dalla cassetta; la stessa di nuovo la lascia. */
  pick(id: string) {
    if (this.carrying === id && !this.pickedFrom) {
      this.drop();
      return;
    }
    if (this.pickedFrom || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker) this.drop(); // una ripresa dalla mappa torna dov'era prima di prendere altro
    this.deleting = false;
    this.carrying = id;
    this.layer.setCarry(this.defs.get(id) ?? null, this.layer.rotation);
    this.notify();
  }

  /** Prende una porta; la stessa di nuovo la lascia. Una runica già in mappa non si prende (se ne sposta quella che c'è, con un clic). */
  pickDoor(kind: DoorKind) {
    if (this.carryingDoor === kind && !this.pickedFrom) {
      this.drop();
      return;
    }
    if (RUNE_COLORS.includes(kind as RuneColor) && this.doorCounts()[kind] > 0 && this.carryingDoor !== kind) return;
    if (this.pickedFrom || this.carrying || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker) this.drop();
    this.deleting = false;
    this.carryingDoor = kind;
    this.carriedLock = null;
    this.layer.setCarryDoor(true);
    this.notify();
  }

  /** Prende un tipo di ostacolo; lo stesso di nuovo lo lascia. Ogni clic ne mette una casella: le macerie si uniscono in linea (fino a 3) o formano un masso 2×2 (vedi `placeRock`), buche e acqua si fondono da sole nel disegno. */
  pickObstacle(type: ObstacleType) {
    if (this.carryingObstacle === type) {
      this.drop();
      return;
    }
    if (this.pickedFrom || this.carrying || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker) this.drop();
    this.deleting = false;
    this.separating = false;
    this.carryingObstacle = type;
    this.layer.setObstacleProvider((cell) => {
      const next = this.withObstacle(type, cell);
      if (!next) return { shown: [{ type, x: cell.x, y: cell.y, length: 1 }], valid: false };
      return { shown: next.filter((o) => !this.obstacleList.some((p) => sameObstacle(p, o))), valid: true };
    });
    this.notify();
  }

  /** Prende un segnalino (pozione, monete, baule o chiave runica); lo stesso di nuovo lo lascia. Ogni clic ne mette uno (resta in mano finché non si raggiunge il limite). */
  pickMarker(spec: MarkerSpec) {
    if (this.carryingMarker && markerKey(this.carryingMarker) === markerKey(spec) && !this.pickedFrom) {
      this.drop();
      return;
    }
    if (!this.markerAvailable(spec)) return;
    if (this.pickedFrom || this.carrying || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker) this.drop();
    this.deleting = false;
    this.separating = false;
    this.customizing = false;
    this.carryingMarker = spec;
    this.layer.setMarkerProvider((cell) => this.markerTarget(cell));
    this.notify();
  }

  /** Il segnalino in mano nella casella indicata (con la rotazione se è un baule) e se lì si può metterlo: su un tile, senza ostacoli, nemici o altri segnalini, e entro il limite. Una casella di partenza si può mettere anche su un glifo, e si toglie rimettendola. */
  private markerTarget(cell: Cell): { marker?: Marker; startCell?: Cell; valid: boolean } | null {
    const spec = this.carryingMarker;
    if (!spec) return null;
    const blocked = this.obstacleList.some((o) => obstacleCells(o).some((c) => c.x === cell.x && c.y === cell.y)) || this.monsterList.some((m) => this.monsterCells(m).some((c) => c.x === cell.x && c.y === cell.y));
    if (spec.type === 'start') {
      const there = this.markerList.some((m) => m.x === cell.x && m.y === cell.y && m.type !== 'glyph');
      const already = this.startList.some((c) => c.x === cell.x && c.y === cell.y); // rimetterla la toglie: sempre possibile
      return { startCell: cell, valid: already || (this.layer.isWalkable(cell) && !blocked && !there && this.startList.length < MARKER_LIMITS.start) };
    }
    const at = { x: cell.x, y: cell.y };
    const marker: Marker =
      spec.type === 'potion' ? { type: 'potion', kind: spec.kind, id: this.nextPickupId(), ...at }
      : spec.type === 'coins' ? { type: 'coins', id: this.nextPickupId(), ...at }
      : spec.type === 'encounter' ? { type: 'encounter', id: this.nextPickupId('incontro'), ...this.carriedEncounter, ...at }
      : spec.type === 'rune' ? { type: 'rune', color: spec.color, id: this.nextPickupId(), ...at }
      : spec.type === 'glyph' ? { type: 'glyph', ...at, ...(spec.active ? { active: true } : {}) }
      : spec.type === 'stairs' ? { type: 'stairs', ...at, link: this.stairsLinkForNext(), ...(this.markerRotation ? { rotation: this.markerRotation } : {}) }
      : { type: 'chest', tier: spec.tier, ...at, ...(this.markerRotation ? { rotation: this.markerRotation } : {}) };
    // Un oggetto non riconosciuto si sostituisce mettendoci sopra un oggetto vero: non conta come casella occupata.
    const occupied = blocked || this.markerList.some((m) => m.x === cell.x && m.y === cell.y && !this.isMissingMarker(m));
    return { marker, valid: this.layer.isWalkable(cell) && !occupied && this.markerAvailable(spec) };
  }

  private placeMarker(at: Cell) {
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    const spec = this.carryingMarker;
    if (spec?.type === 'start') {
      // Le caselle di partenza si accendono e si spengono: rimettere una casella già segnata la toglie.
      const has = this.startList.findIndex((c) => c.x === cell.x && c.y === cell.y);
      if (has < 0 && !this.markerTarget(cell)?.valid) return;
      this.remember(this.pickedFrom?.before ?? this.snapshot());
      this.pickedFrom = null;
      if (has >= 0) this.startList.splice(has, 1);
      else this.startList.push(cell);
      this.changed();
      // Raggiunte le 4 caselle non se ne ha più in mano (come i bauli e le chiavi al limite).
      if (this.startList.length >= MARKER_LIMITS.start) {
        this.clearHand();
        this.notify();
      }
      return;
    }
    const t = this.markerTarget(cell);
    if (!t || !t.valid || !t.marker) return;
    this.remember(this.pickedFrom?.before ?? this.snapshot());
    this.pickedFrom = null;
    this.markerList = this.markerList.filter((m) => !(m.x === cell.x && m.y === cell.y && this.isMissingMarker(m))); // sostituisce il segnaposto che c'era
    this.markerList.push(t.marker);
    this.carriedPickupId = null; // l'id di un oggetto ripreso vale solo per quel pezzo: i prossimi ne prendono uno nuovo
    this.carriedEncounter = {};
    this.heldStairsLink = null; // la prossima scala si accoppia con quella rimasta sola, o ne comincia una nuova
    if (t.marker.type === 'stairs') this.clearStairsRoutes(t.marker.link);
    this.changed();
    // Raggiunto il limite (un baule dopo il terzo, una chiave runica dopo la prima, il glifo iniziale) non se ne ha più in mano.
    if (this.carryingMarker && !this.markerAvailable(this.carryingMarker)) {
      this.clearHand();
      this.notify();
    }
  }

  /** L'id del prossimo oggetto a terra: quello dell'oggetto ripreso, altrimenti il primo libero (oggetto-1, oggetto-2…). */
  private nextPickupId(prefix: 'oggetto' | 'incontro' = 'oggetto'): string {
    if (this.carriedPickupId?.startsWith(prefix)) return this.carriedPickupId;
    const used = new Set(this.markerList.flatMap((m) => ('id' in m && m.id ? [m.id] : [])));
    let n = 1;
    while (used.has(`-${n}`)) n++;
    return `-${n}`;
  }

  /** Gli oggetti a terra che gli eventi possono aspettare (hanno un id), con il loro nome. */
  pickups(): { id: string; marker: Marker }[] {
    return this.markerList.flatMap((m) => (('id' in m && m.id && !this.isMissingMarker(m)) ? [{ id: m.id, marker: m }] : []));
  }

  /** La coppia della prossima scala: quella che ha già un capo solo (la si completa), altrimenti una nuova (scala-1, scala-2...). Una scala ripresa dalla mappa mantiene la sua. */
  private stairsLinkForNext(): string {
    if (this.heldStairsLink) return this.heldStairsLink;
    const count = new Map<string, number>();
    for (const m of this.markerList) if (m.type === 'stairs') count.set(m.link, (count.get(m.link) ?? 0) + 1);
    const alone = [...count].find(([, n]) => n === 1);
    if (alone) return alone[0];
    let n = 1;
    while (count.has(`scala-${n}`)) n++;
    return `scala-${n}`;
  }

  /** Quante scale sono rimaste senza il loro capo opposto: la Verifica lo segnala. */
  unpairedStairs(): number {
    const count = new Map<string, number>();
    for (const m of this.markerList) if (m.type === 'stairs') count.set(m.link, (count.get(m.link) ?? 0) + 1);
    return [...count.values()].filter((n) => n !== 2).length;
  }

  /** Riprende una scala già in mappa (con lo strumento Porte e passaggi aperto): si sposta e si rimette, e resta collegata alla sua coppia. */
  private pickUpStairs(at: Cell): boolean {
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    const i = this.markerList.findIndex((m) => m.type === 'stairs' && m.x === cell.x && m.y === cell.y);
    if (i < 0) return false;
    const m = this.markerList[i] as Extract<Marker, { type: 'stairs' }>;
    this.pickedFrom = { before: this.snapshot() };
    this.markerList.splice(i, 1);
    this.clearStairsRoutes(m.link); // la coppia cambia: il percorso scelto non vale più (annullando torna com'era)
    this.carryingMarker = { type: 'stairs' };
    this.markerRotation = m.rotation ?? 0;
    this.heldStairsLink = m.link;
    this.layer.setMarkerProvider((c) => this.markerTarget(c));
    this.changed();
    return true;
  }

  private pickUpMarker(at: Cell): boolean {
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    const special = this.deleteScope === 'specials';
    const i = this.markerList.findIndex((m) => m.x === cell.x && m.y === cell.y && (special ? m.type === 'glyph' || m.type === 'encounter' : m.type === 'potion' || m.type === 'coins' || m.type === 'chest' || m.type === 'rune'));
    if (i < 0) return false;
    const m = this.markerList[i];
    this.pickedFrom = { before: this.snapshot() };
    this.markerList.splice(i, 1);
    this.carriedPickupId = 'id' in m && m.id ? m.id : null; // un oggetto spostato tiene il suo id (gli eventi lo cercano per quello)
    this.carriedEncounter = m.type === 'encounter' ? { ...(m.label ? { label: m.label } : {}), ...(m.cost ? { cost: m.cost } : {}) } : {};
    this.carryingMarker = m.type === 'encounter' ? { type: 'encounter' } : m.type === 'potion' ? { type: 'potion', kind: m.kind } : m.type === 'coins' ? { type: 'coins' } : m.type === 'chest' ? { type: 'chest', tier: m.tier } : m.type === 'glyph' ? { type: 'glyph', ...(m.active ? { active: true } : {}) } : { type: 'rune', color: (m as { color: RuneColor }).color };
    this.markerRotation = m.type === 'chest' ? (m.rotation ?? 0) : 0;
    this.layer.setMarkerProvider((c) => this.markerTarget(c));
    this.changed();
    return true;
  }

  /** Prende un mostro (normale o potenziato); lo stesso di nuovo lo lascia. Ogni clic ne piazza uno (resta in mano per metterne altri); R lo gira. */
  pickMonster(id: string, enhanced: boolean) {
    if (this.carryingMonster?.id === id && this.carryingMonster.enhanced === enhanced && !this.pickedFrom) {
      this.drop();
      return;
    }
    if (this.pickedFrom || this.carrying || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker) this.drop();
    this.deleting = false;
    this.separating = false;
    this.customizing = false;
    this.carryingMonster = { id, enhanced };
    this.layer.setMonsterProvider((at) => this.monsterTarget(at));
    this.notify();
  }

  /** Dove andrebbe il mostro in mano con il puntatore in `at` (celle con la parte decimale), e se lì si può: serve che stia tutto su caselle dei tile, senza ostacoli né altri mostri. */
  private monsterTarget(at: Cell): { shown: PlacedMonster; valid: boolean; upgrade?: number; replace?: number[] } | null {
    const hand = this.carryingMonster;
    const def = hand ? this.monsterDefs.get(hand.id) : undefined;
    if (!hand || !def) return null;
    // Un nemico normale messo sopra uno identico già piazzato lo rende potenziato (l'anteprima mostra già il potenziato).
    if (!hand.enhanced) {
      const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
      const i = this.monsterList.findIndex((m) => m.monster === hand.id && !m.enhanced && this.monsterCells(m).some((c) => c.x === cell.x && c.y === cell.y));
      const existing = i >= 0 ? this.placedMonster(this.monsterList[i]) : null;
      if (existing) return { shown: { ...existing, enhanced: true }, valid: true, upgrade: i };
    }
    const rotated = this.monsterRotated && def.size.w !== def.size.h;
    const w = rotated ? def.size.h : def.size.w;
    const h = rotated ? def.size.w : def.size.h;
    const x = Math.round(at.x - w / 2);
    const y = Math.round(at.y - h / 2);
    const cells = Array.from({ length: w * h }, (_, i) => ({ x: x + (i % w), y: y + Math.floor(i / w) }));
    // Un nemico non riconosciuto si sostituisce mettendoci sopra un nemico vero: le sue caselle non contano come occupate.
    const taken = new Set([...this.obstacleList.flatMap((o) => obstacleCells(o)), ...this.monsterList.filter((m) => !this.isMissingMonster(m)).flatMap((m) => this.monsterCells(m)), ...this.markerList].map((c) => `${c.x},${c.y}`));
    const valid = cells.every((c) => this.layer.isWalkable(c) && !taken.has(`${c.x},${c.y}`));
    return { shown: { def, x, y, w, h, enhanced: hand.enhanced }, valid, replace: valid ? this.missingMonstersIn(cells) : [] };
  }

  /** Gli indici dei nemici non riconosciuti che occupano almeno una di queste caselle (quelli che un nemico vero sostituirebbe). */
  private missingMonstersIn(cells: Cell[]): number[] {
    const set = new Set(cells.map((c) => `${c.x},${c.y}`));
    return this.monsterList.flatMap((m, i) => (this.isMissingMonster(m) && this.monsterCells(m).some((c) => set.has(`${c.x},${c.y}`)) ? [i] : []));
  }

  private placeMonster(at: Cell) {
    const hand = this.carryingMonster;
    const t = hand ? this.monsterTarget(at) : null;
    if (!hand || !t || !t.valid) return;
    this.remember(this.pickedFrom?.before ?? this.snapshot());
    this.pickedFrom = null;
    if (t.upgrade !== undefined) {
      this.monsterList[t.upgrade] = { ...this.monsterList[t.upgrade], enhanced: true };
      this.changed();
      return;
    }
    const replaced = new Set(t.replace ?? []);
    if (replaced.size) this.monsterList = this.monsterList.filter((_, i) => !replaced.has(i)); // toglie i segnaposto che sostituisce
    const next = this.monsterList.reduce((m, p) => Math.max(m, Number(/^m(\d+)$/.exec(p.id)?.[1] ?? 0)), 0) + 1;
    const rotated = t.shown.w !== t.shown.def.size.w || t.shown.h !== t.shown.def.size.h;
    this.monsterList.push({ id: `m${next}`, team: 'monster', monster: hand.id, x: t.shown.x, y: t.shown.y, ...(hand.enhanced ? { enhanced: true } : {}), ...(rotated ? { size: { w: t.shown.w, h: t.shown.h } } : {}) });
    this.changed();
  }

  private pickUpMonster(at: Cell): boolean {
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    const i = this.monsterList.findIndex((m) => this.monsterCells(m).some((c) => c.x === cell.x && c.y === cell.y));
    if (i < 0) return false;
    const m = this.monsterList[i];
    const def = m.monster ? this.monsterDefs.get(m.monster) : undefined;
    if (!def) return false;
    this.pickedFrom = { before: this.snapshot() };
    this.monsterList.splice(i, 1);
    this.carryingMonster = { id: def.id, enhanced: !!m.enhanced };
    this.monsterRotated = !!m.size && (m.size.w !== def.size.w || m.size.h !== def.size.h);
    this.layer.setMonsterProvider((p) => this.monsterTarget(p));
    this.changed();
    return true;
  }

  /** L'elenco degli ostacoli dopo aver messo `type` nella casella, o null se lì non si può (fuori dai tile o già occupata). */
  private withObstacle(type: ObstacleType, cell: Cell): Obstacle[] | null {
    if (!this.layer.isWalkable(cell) || this.markerList.some((m) => m.x === cell.x && m.y === cell.y) || this.obstacleList.some((o) => obstacleCells(o).some((c) => c.x === cell.x && c.y === cell.y))) return null;
    return type === 'rock' ? placeRock(this.obstacleList, cell) : [...this.obstacleList, { type, x: cell.x, y: cell.y, length: 1 }];
  }

  private placeObstacle(at: Cell) {
    const type = this.carryingObstacle;
    if (!type) return;
    const next = this.withObstacle(type, { x: Math.floor(at.x), y: Math.floor(at.y) });
    if (!next) return;
    this.remember(this.snapshot());
    this.obstacleList = next;
    this.changed();
  }

  /** Lascia ciò che è in mano; se era stato ripreso dalla mappa torna al suo posto. */
  drop() {
    const from = this.pickedFrom;
    this.pickedFrom = null;
    if (from) this.restore(from.before);
    this.clearHand();
    this.notify();
  }

  /** Elimina ciò che era stato ripreso dalla mappa: non torna al suo posto. */
  discard() {
    if (!this.pickedFrom) return;
    this.remember(this.pickedFrom.before);
    this.pickedFrom = null;
    this.clearHand();
    this.changed();
  }

  rotate() {
    if (this.carryingMarker?.type === 'chest' || this.carryingMarker?.type === 'stairs') {
      this.markerRotation = ((this.markerRotation + 90) % 360) as 0 | 90 | 180 | 270;
      this.layer.setMarkerProvider((c) => this.markerTarget(c)); // ridisegna l'anteprima
      this.notify();
      return;
    }
    if (this.carryingMonster) {
      this.monsterRotated = !this.monsterRotated;
      this.layer.setMonsterProvider((at) => this.monsterTarget(at)); // ridisegna l'anteprima
      this.notify();
      return;
    }
    if (!this.carrying) return;
    this.layer.setRotation(((this.layer.rotation + 90) % 360) as Rotation);
    this.notify();
  }

  /** Il clic sulla mappa, in celle con la parte decimale: con qualcosa in mano lo piazza (se ha un posto), senza riprende il pezzo (o la porta) toccato. */
  click(at: Cell) {
    if (this.deleting) return; // in modalità elimina lavora l'area tracciata
    if (this.separating) {
      this.separateAt(at);
      return;
    }
    if (this.customizing) {
      const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
      if (this.deleteScope === 'specials') {
        const k = this.markerList.findIndex((m) => m.type === 'encounter' && m.x === cell.x && m.y === cell.y);
        if (k >= 0) this.onEditEncounter?.(k);
        return;
      }
      const i = this.monsterList.findIndex((m) => this.monsterCells(m).some((c) => c.x === cell.x && c.y === cell.y));
      if (i >= 0 && !this.isMissingMonster(this.monsterList[i])) this.onEditMonster?.(i); // un segnaposto non si personalizza: si sostituisce o si toglie
      return;
    }
    if (this.carryingDoor) {
      this.placeDoor();
      return;
    }
    if (this.carryingObstacle) {
      this.placeObstacle(at);
      return;
    }
    if (this.carryingMonster) {
      this.placeMonster(at);
      return;
    }
    if (this.carryingMarker) {
      this.placeMarker(at);
      return;
    }
    if (!this.carrying) {
      // Ogni strumento riprende solo i suoi elementi: le porte con lo strumento Porte, i mostri con Nemici, le tessere con Tessere.
      if (this.deleteScope === 'monsters') {
        this.pickUpMonster(at);
        return;
      }
      if (this.deleteScope === 'specials') {
        // Una casella di partenza già segnata si toglie con un clic (anche a scheda spenta, quando sono tutte e 4).
        const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
        const s = this.startList.findIndex((c) => c.x === cell.x && c.y === cell.y);
        if (s >= 0) {
          this.remember(this.snapshot());
          this.startList.splice(s, 1);
          this.changed();
          return;
        }
      }
      if (this.deleteScope === 'markers' || this.deleteScope === 'specials') {
        this.pickUpMarker(at);
        return;
      }
      if (this.deleteScope === 'doors') {
        if (this.pickUpStairs(at)) return;
        const d = this.layer.doorIndexNear(at, 0.3);
        if (d >= 0) this.pickUpDoor(d);
        return;
      }
      if (this.deleteScope !== 'tiles' || !this.tilesToolOpen) return; // le tessere si riprendono solo con il loro strumento aperto
      const i = this.layer.tileIndexAt({ x: Math.floor(at.x), y: Math.floor(at.y) });
      if (i >= 0) this.pickUp(i);
      return;
    }
    const target = this.layer.target();
    if (!target) return;
    this.remember(this.pickedFrom?.before ?? this.snapshot());
    this.pickedFrom = null;
    this.list.push({ tile: this.carrying, x: target.x, y: target.y, rot: this.layer.rotation });
    this.placed.push(target);
    this.changed();
  }

  private placeDoor() {
    const kind = this.carryingDoor;
    const t = this.layer.doorTarget();
    if (!kind || !t) return;
    this.remember(this.pickedFrom?.before ?? this.snapshot());
    this.pickedFrom = null;
    // La porta a chiave prende un id di chiave nuovo (chiave-1, chiave-2...): l'autore lo collegherà alla chiave che la apre.
    const keyId = `chiave-${this.doorList.filter((d) => d.lock?.kind === 'key').length + 1}`;
    // La porta evento prende un id libero (evento-1, evento-2...): gli eventi la apriranno con quello. Una porta ripresa per spostarla tiene la serratura (e l'id) che aveva.
    const used = new Set(this.doorList.flatMap((d) => (d.lock?.kind === 'event' ? [d.lock.id] : [])));
    let n = 1;
    while (used.has(`evento-${n}`)) n++;
    const kept = this.carriedLock;
    this.carriedLock = null;
    const lock: DoorLock | undefined =
      kept && kindOf({ x: 0, y: 0, horizontal: true, open: false, lock: kept }) === kind ? kept
      : kind === 'normal' ? undefined : kind === 'key' ? { kind: 'key', keyId, pickable: true } : kind === 'event' ? { kind: 'event', id: `evento-${n}` } : { kind: 'rune', color: kind };
    const door: Door = { x: t.x, y: t.y, horizontal: t.horizontal, open: false, ...(lock ? { lock } : {}) };
    this.doorList.push(door);
    this.layer.setDoors(this.doorList);
    if (RUNE_COLORS.includes(kind as RuneColor)) this.clearHand(); // una runica per colore: messa questa non se ne ha più in mano
    this.notify();
  }

  private pickUp(index: number) {
    const ref = this.list[index];
    if (!ref) return;
    this.pickedFrom = { before: this.snapshot() };
    this.list.splice(index, 1);
    this.placed.splice(index, 1);
    this.carrying = ref.tile;
    this.layer.setCarry(this.defs.get(ref.tile) ?? null, ref.rot);
    this.changed();
  }

  private pickUpDoor(index: number) {
    const door = this.doorList[index];
    if (!door) return;
    this.pickedFrom = { before: this.snapshot() };
    this.doorList.splice(index, 1);
    this.carryingDoor = kindOf(door);
    this.carriedLock = door.lock ?? null;
    this.layer.setDoors(this.doorList);
    this.layer.setCarryDoor(true);
    this.notify();
  }

  // --- Eliminare ---

  /** Accende o spegne la modalità personalizza (esclude le altre cose in mano e le altre modalità). */
  setCustomizing(on: boolean) {
    if (on === this.customizing) return;
    if (on) {
      this.drop();
      this.deleting = false;
      this.separating = false;
    }
    this.customizing = on;
    this.notify();
  }

  /** L'indice del nemico che copre il punto (in celle con la parte decimale), o -1. */
  monsterIndexAt(at: Cell): number {
    const cell = { x: Math.floor(at.x), y: Math.floor(at.y) };
    return this.monsterList.findIndex((m) => this.monsterCells(m).some((c) => c.x === cell.x && c.y === cell.y));
  }

  /** Il tasto destro su un nemico: accende la modalità personalizza e apre subito le sue modifiche. */
  editMonsterAt(at: Cell) {
    const i = this.monsterIndexAt(at);
    if (i < 0 || this.isMissingMonster(this.monsterList[i])) return;
    this.setCustomizing(true);
    this.onEditMonster?.(i);
  }

  /** Il testo dell'azione e il costo di un segnalino Incontro, nel formato della dialog. */
  encounterEdits(index: number): { label: string; cost: number } | null {
    const m = this.markerList[index];
    return m?.type === 'encounter' ? { label: m.label ?? '', cost: m.cost ?? 0 } : null;
  }

  /** Scrive il testo e il costo di un segnalino Incontro; vuoto e zero non finiscono nel file (valgono "Usa" e 0). */
  updateEncounter(index: number, e: { label: string; cost: number }) {
    const m = this.markerList[index];
    if (m?.type !== 'encounter') return;
    this.remember(this.snapshot());
    const { label: _l, cost: _c, ...rest } = m;
    this.markerList[index] = { ...rest, ...(e.label.trim() ? { label: e.label.trim() } : {}), ...(e.cost > 0 ? { cost: e.cost } : {}) };
    this.changed();
  }

  /** Le modifiche attuali di un nemico, nel formato della dialog. */
  monsterEdits(index: number): MonsterEdits | null {
    const m = this.monsterList[index];
    if (!m) return null;
    return { unique: !!m.unique, name: m.unique ? (m.name ?? '') : '', bonus: { wounds: m.bonus?.wounds ?? 0, speed: m.bonus?.speed ?? 0, armor: m.bonus?.armor ?? 0, dice: [...(m.bonus?.dice ?? [])] }, traits: [...(m.traits ?? [])], removedTraits: [...(m.removedTraits ?? [])], drop: (m.drop ?? []).map((l) => ({ ...l })), inactive: !!m.inactive, stone: !!m.stone, invincible: !!m.invincible, immune: [...(m.immune ?? this.cardImmune(m))] };
  }

  /** Le immunità che la carta del catalogo dà a questo nemico (nella sua versione normale o potenziata). */
  private cardImmune(m: PieceData): string[] {
    const def = m.monster ? this.monsterDefs.get(m.monster) : undefined;
    return [...((m.enhanced ? def?.enhanced : def?.normal)?.immune ?? [])];
  }

  private sameSet(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((x) => b.includes(x));
  }

  /** Scrive le modifiche di un nemico; ciò che è a zero o vuoto non finisce nel file, così il nemico torna quello della carta. */
  updateMonster(index: number, e: MonsterEdits) {
    const m = this.monsterList[index];
    if (!m) return;
    this.remember(this.snapshot());
    const { unique: _u, name: _n, bonus: _b, traits: _t, removedTraits: _rt, drop: _d, inactive: _i, stone: _s, invincible: _v, immune: _im, ...base } = m;
    const bonus = { ...(e.bonus.wounds ? { wounds: e.bonus.wounds } : {}), ...(e.bonus.speed ? { speed: e.bonus.speed } : {}), ...(e.bonus.armor ? { armor: e.bonus.armor } : {}), ...(e.bonus.dice.length ? { dice: [...e.bonus.dice] } : {}) };
    this.monsterList[index] = {
      ...base,
      ...(e.unique && e.name.trim() ? { unique: true, name: e.name.trim() } : {}),
      ...(e.inactive ? { inactive: true } : {}),
      ...(e.stone ? { stone: true } : {}),
      ...(e.invincible ? { invincible: true } : {}),
      ...(this.sameSet(e.immune, this.cardImmune(base)) ? {} : { immune: [...e.immune] }), // solo se diversa dalla carta: così il nemico segue il catalogo
      ...(Object.keys(bonus).length ? { bonus } : {}),
      ...(e.traits.length ? { traits: [...e.traits] } : {}),
      ...(e.removedTraits.length ? { removedTraits: [...e.removedTraits] } : {}),
      ...(e.drop.length ? { drop: e.drop.map((l) => ({ ...l })) } : {}),
    };
    this.changed();
  }

  /** Accende o spegne la modalità separa (esclude le altre cose in mano e l'elimina). */
  setSeparating(on: boolean) {
    if (on === this.separating) return;
    if (on) {
      this.drop();
      this.deleting = false;
      this.customizing = false;
    }
    this.separating = on;
    this.notify();
  }

  private separateAt(at: Cell) {
    const next = splitObstacle(this.obstacleList, { x: Math.floor(at.x), y: Math.floor(at.y) });
    if (!next) return;
    this.remember(this.snapshot());
    this.obstacleList = next;
    this.changed();
  }

  setDeleting(on: boolean) {
    if (on === this.deleting) return;
    if (on) {
      this.separating = false;
      this.customizing = false;
    }
    if (on && (this.carrying || this.carryingDoor || this.carryingObstacle || this.carryingMonster || this.carryingMarker)) this.drop();
    this.deleting = on;
    this.notify();
  }

  /**
   * Elimina i pezzi e le porte che toccano l'area (in celle, con la parte decimale): un solo passo dell'annulla. `doorTolerance` allarga l'area per le porte, che sono
   * linee sottili (serve per il clic). Restituisce quanti ne ha tolti.
   */
  deleteIn(area: { x0: number; y0: number; x1: number; y1: number }, doorTolerance = 0): number {
    if (!this.deleting) return 0;
    const scope = this.deleteScope;
    const tiles = new Set<number>();
    if (scope === 'tiles') {
      this.placed.forEach((t, i) => {
        for (const key of tileCells(t.def)) {
          const [cx, cy] = key.split(',').map(Number);
          const x = t.x + cx;
          const y = t.y + cy;
          if (x < area.x1 && x + 1 > area.x0 && y < area.y1 && y + 1 > area.y0) {
            tiles.add(i);
            break;
          }
        }
      });
    }
    const doors = new Set<number>();
    if (scope === 'doors') {
      const tol = doorTolerance;
      this.doorList.forEach((d, i) => {
        const [x0, x1, y0, y1] = d.horizontal ? [d.x, d.x + 1, d.y, d.y] : [d.x, d.x, d.y, d.y + 1];
        if (x0 <= area.x1 + tol && x1 >= area.x0 - tol && y0 <= area.y1 + tol && y1 >= area.y0 - tol) doors.add(i);
      });
    }
    const obstacles = new Set<number>();
    if (scope === 'obstacles') {
      this.obstacleList.forEach((o, i) => {
        if (obstacleCells(o).some((c) => c.x < area.x1 && c.x + 1 > area.x0 && c.y < area.y1 && c.y + 1 > area.y0)) obstacles.add(i);
      });
    }
    const monsters = new Set<number>();
    if (scope === 'monsters') {
      this.monsterList.forEach((m, i) => {
        if (this.monsterCells(m).some((c) => c.x < area.x1 && c.x + 1 > area.x0 && c.y < area.y1 && c.y + 1 > area.y0)) monsters.add(i);
      });
    }
    const markers = new Set<number>();
    const starts = new Set<number>();
    if (scope === 'markers' || scope === 'specials' || scope === 'doors') {
      this.markerList.forEach((m, i) => {
        const mine = scope === 'doors' ? m.type === 'stairs' : scope === 'specials' ? m.type === 'glyph' || m.type === 'encounter' : m.type !== 'glyph' && m.type !== 'stairs' && m.type !== 'encounter';
        if (mine && m.x < area.x1 && m.x + 1 > area.x0 && m.y < area.y1 && m.y + 1 > area.y0) markers.add(i);
      });
    }
    if (scope === 'specials') {
      this.startList.forEach((c, i) => {
        if (c.x < area.x1 && c.x + 1 > area.x0 && c.y < area.y1 && c.y + 1 > area.y0) starts.add(i);
      });
    }
    if (!tiles.size && !doors.size && !obstacles.size && !monsters.size && !markers.size && !starts.size) return 0;
    this.remember(this.snapshot());
    this.list = this.list.filter((_, i) => !tiles.has(i));
    this.placed = this.placed.filter((_, i) => !tiles.has(i));
    this.doorList = this.doorList.filter((_, i) => !doors.has(i));
    this.obstacleList = this.obstacleList.filter((_, i) => !obstacles.has(i));
    this.monsterList = this.monsterList.filter((_, i) => !monsters.has(i));
    this.markerList = this.markerList.filter((_, i) => !markers.has(i));
    this.startList = this.startList.filter((_, i) => !starts.has(i));
    this.changed();
    return tiles.size + doors.size + obstacles.size + monsters.size + markers.size + starts.size;
  }

  // --- Aree ---

  /** Crea un'area con le caselle indicate (quelle già in un'altra area si saltano: una casella sta in una sola area). Restituisce l'id. */
  createArea(cells: readonly Cell[]): string | null {
    const taken = new Set(this.areaList.flatMap((a) => a.cells.map((c) => `${c.x},${c.y}`)));
    const free = cells.filter((c) => !taken.has(`${c.x},${c.y}`));
    if (!free.length) return null;
    this.remember(this.snapshot());
    const next = this.areaList.reduce((m, a) => Math.max(m, Number(/(\d+)$/.exec(a.id)?.[1] ?? 0)), 0) + 1;
    const id = `area-${next}`;
    this.areaList.push({ id, cells: free.map((c) => ({ ...c })) });
    this.changed();
    return id;
  }

  /** Cancella l'area: le sue tessere restano in mappa, senza area. */
  deleteArea(id: string) {
    if (!this.areaList.some((a) => a.id === id)) return;
    this.remember(this.snapshot());
    this.areaList = this.areaList.filter((a) => a.id !== id);
    this.changed();
  }

  /** Scrive sottotitolo e descrizione di un'area (un campo vuoto si toglie). */
  updateArea(id: string, data: { subtitle: string; text: string }) {
    const area = this.areaList.find((a) => a.id === id);
    if (!area) return;
    this.remember(this.snapshot());
    for (const key of ['subtitle', 'text'] as const) {
      const v = data[key].trim();
      if (v) area[key] = v;
      else delete area[key];
    }
    this.changed();
  }

  /** Sposta un'area (non quella di partenza, che resta prima) nella posizione `to` dell'elenco; i numeri delle aree si ricalcolano. */
  moveArea(id: string, to: number) {
    const shown = this.areas().map((a) => a.def);
    const from = shown.findIndex((a) => a.id === id);
    if (from < 0 || shown[from].start) return;
    const hasStart = shown.some((a) => a.start);
    const target = Math.max(hasStart ? 1 : 0, Math.min(shown.length - 1, to));
    if (target === from) return;
    this.remember(this.snapshot());
    const [moved] = shown.splice(from, 1);
    shown.splice(target, 0, moved);
    this.areaList = shown;
    this.changed();
  }

  /** Designa l'area di partenza (una sola: la nuova toglie la precedente); lo stesso comando su quella di partenza la toglie. */
  toggleStart(id: string) {
    const area = this.areaList.find((a) => a.id === id);
    if (!area) return;
    this.remember(this.snapshot());
    const was = !!area.start;
    for (const a of this.areaList) delete a.start;
    if (!was) area.start = true;
    this.changed();
  }

  // --- Punti morti, annulla e rifai ---

  /** Chiude con un punto morto ogni uscita rimasta libera (dove ci sta); restituisce quanti ne ha messi. */
  closeExits(): number {
    const base = this.defs.get(DEAD_END);
    if (!base) return 0;
    const before = this.snapshot();
    const all = [...this.placed];
    const added: MapTileRef[] = [];
    for (const f of freeOpenings(this.placed)) {
      search: for (const rot of [0, 90, 180, 270] as Rotation[]) {
        const def = rotateTile(base, rot);
        for (const o of def.openings) {
          if (o.side !== OPPOSITE[f.side] || o.width !== f.to - f.from) continue;
          const pos = positionFor(f.side, f.line, f.from, def, o.offset);
          const cand: PlacedTile = { def, x: pos.x, y: pos.y };
          if (all.some((t) => overlaps(cand, t))) continue;
          all.push(cand);
          added.push({ tile: DEAD_END, x: pos.x, y: pos.y, rot });
          break search;
        }
      }
    }
    if (!added.length) return 0;
    this.remember(before);
    this.list.push(...added);
    this.placed = all;
    this.changed();
    return added.length;
  }

  get canUndo(): boolean {
    return this.history.length > 0 && !this.pickedFrom;
  }

  get canRedo(): boolean {
    return this.future.length > 0 && !this.pickedFrom;
  }

  /** Torna allo stato prima dell'ultima azione. */
  undo() {
    if (!this.canUndo) return; // con qualcosa ripreso in mano prima lo si posa (Esc) o lo si elimina (Canc)
    this.future.push(this.snapshot());
    this.restore(this.history.pop()!);
    this.notify();
  }

  /** Rifà l'azione annullata. */
  redo() {
    if (!this.canRedo) return;
    this.history.push(this.snapshot());
    this.restore(this.future.pop()!);
    this.notify();
  }
}
