import type { GlobalBehavior } from '../pieces/pawn-behavior';
import type { Wall } from '../board/wall';
import { DEFAULT_PROGRESS, OVERLORD_START_HAND } from '../constants';
import { Door, RuneColor } from '../board/door';
import { CHEST_TABLE_MAX, ChestTable, ChestTier, Marker } from '../board/marker';
import { Obstacle } from '../board/obstacle';
import { Exploration, ExplorationData } from '../exploration';
import { AdventureObjective, MapData } from '../map/map-data';
import { Party, PartyData } from '../party';
import { HeroSheet } from '../heroes/hero-sheet';
import { ItemDef } from '../items/item';
import { MonsterDef } from '../monsters/monster';
import { OverlordCardDef } from '../overlord/card';
import type { ArmedTrap } from './traps';
import type { Setup } from './setup';
import type { Board, Cell } from '../board/board';
import { SKILL_SCHOOLS, SkillDef, SkillSchool } from '../skills/skill';
import { applyPermanentStats } from './effects';
import { EventState, buildEvents, emptyEvents, isWaitingToRevive } from './events';
import { Piece, PieceData, createPieces } from '../pieces/piece';
import type { Familiar, FamiliarDef } from '../familiars/familiar';

/**
 * Lo stato di una partita come dati puri: si può copiare, salvare in JSON e ricostruire. È la fonte unica di verità:
 * chi disegna (Pixi) o decide (le regole) legge e modifica questi oggetti, e non tiene copie per conto suo.
 * Sarà lo stato dell'host: gli altri giocatori ne riceveranno solo le parti che possono vedere.
 *
 * Non ci sono i tile: la mappa si ricarica dal suo file (`public/maps/`). Porte, ostacoli e segnalini invece sono qui perché
 * durante la partita cambiano (porte aperte, glifi accesi, oggetti raccolti).
 */
export class GameState {
  /** Il quadro della mappa di adesso (muri, ostacoli, porte): lo mette la scena a ogni ricostruzione. Serve alle regole che cercano caselle libere (il bottino che cade a terra). Non si salva. */
  board: Board | null = null;
  /** Il round in corso, da 1. */
  round = 1;
  /** Di chi è il turno: gli eroi (ordine libero) oppure l'Overlord. */
  phase: Phase = 'heroes';
  /** La Conquista: contatore comunitario degli eroi. Se arriva a zero, gli eroi perdono. */
  progress = DEFAULT_PROGRESS;
  /** Come sta andando la partita. */
  status: Status = 'playing';
  /** L'eroe che sta agendo adesso. */
  activeId: string | null;
  /** Il catalogo degli oggetti (si ricarica dai file: non si salva). */
  items: ReadonlyMap<string, ItemDef> = new Map();
  /** I tre mazzi dei tesori degli scrigni (id degli oggetti, in ordine di pesca). Una carta pescata non torna, e un mazzo finito non si rimescola. */
  decks: Record<ChestTier, string[]> = { copper: [], silver: [], gold: [] };
  /** La tabella dei ritrovamenti dell'avventura e, per ogni tipo di scrigno, l'ordine (mescolato) in cui escono le sue righe: aprendo uno scrigno si pesca la prossima. */
  chestTable: ChestTable = {};
  chestDeal: Record<ChestTier, number[]> = { copper: [], silver: [], gold: [] };
  /** I tipi di scrigno che il gruppo ha già aperto almeno una volta: finché non se ne apre uno, i tesori di quel tipo non si comprano in città. */
  openedTiers: ChestTier[] = [];
  /** Il catalogo delle carte abilità (si ricarica dai file: non si salva). */
  skills: ReadonlyMap<string, SkillDef> = new Map();
  /** I tre mazzi delle carte abilità (id, in ordine di pesca): una carta in mano a un eroe non torna e un mazzo finito non si rimescola. */
  skillDecks: Record<SkillSchool, string[]> = { combat: [], cunning: [], magic: [] };
  /** Le scorte del negozio della città: quante copie restano di ogni oggetto in vendita (id -> numero). */
  shop: Record<string, number> = {};
  /** Il catalogo dei mostri (si ricarica dai file: non si salva): serve a far apparire mostri durante la partita. */
  monsters: ReadonlyMap<string, MonsterDef> = new Map();
  /** Il catalogo delle carte dell'Overlord (si ricarica dai file: non si salva). */
  overlordCards: ReadonlyMap<string, OverlordCardDef> = new Map();
  /** Il mazzo dell'Overlord: mazzo (in ordine di pesca), mano, scarti, carte Potere in gioco e Minaccia. I giocatori ne vedono solo quante carte restano nel mazzo. */
  overlord: OverlordState = { deck: [], hand: [], discard: [], inPlay: [], traps: [], threat: 0, gust: false };
  /** I muri dell'avventura (vedi `board/wall.ts`). */
  walls: Wall[] = [];
  /** I comportamenti globali dei mostri (vedi `state/behaviors.ts`). */
  behaviors: GlobalBehavior[] = [];
  /** Gli eventi dell'avventura: definizioni, variabili, chi aspetta di tornare in vita e i messaggi da mostrare (vedi `state/events.ts`). */
  events: EventState = emptyEvents();
  /** Lo stato del generatore di numeri casuali: sta nello stato, così l'host decide ogni estrazione e si può ripetere. */
  rngState = 0;

  constructor(
    readonly seed: number,
    readonly doors: Door[],
    readonly obstacles: Obstacle[],
    /** Tutti i segnalini, anche quelli già raccolti (`collected`): così gli indici restano stabili. */
    readonly markers: Marker[],
    readonly pieces: Piece[],
    readonly party: Party,
    readonly exploration: Exploration,
    activeId?: string | null,
  ) {
    this.activeId = activeId === undefined ? (pieces.find((p) => p.team === 'hero')?.id ?? null) : activeId;
  }

  /** Il prossimo numero casuale da 0 a 1. Lo decide lo stato (l'host), mai il client. */
  random(): number {
    this.rngState = (this.rngState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.rngState ^ (this.rngState >>> 15), 1 | this.rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Riempie le scorte del negozio dal suo file (`stock`): si vendono solo gli oggetti elencati che esistono nel catalogo. */
  buildShop(stock: Readonly<Record<string, number>>): void {
    const shop: Record<string, number> = {};
    for (const [id, copies] of Object.entries(stock)) if (this.items.has(id)) shop[id] = copies;
    this.shop = shop;
  }

  /** Mescola i mazzi dei tesori: ogni oggetto del catalogo che ha un `deck` finisce nel mazzo di quel tipo, in ordine casuale. */
  buildDecks(): void {
    const decks: Record<ChestTier, string[]> = { copper: [], silver: [], gold: [] };
    for (const item of this.items.values()) if (item.deck) for (let n = 0; n < (item.copies ?? 1); n++) decks[item.deck].push(item.id);
    for (const tier of Object.keys(decks) as ChestTier[]) {
      const cards = decks[tier];
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    this.decks = decks;
  }

  /** Mescola le righe della tabella dei ritrovamenti, un mazzetto per tipo di scrigno. */
  buildChestDeal(): void {
    const deal: Record<ChestTier, number[]> = { copper: [], silver: [], gold: [] };
    for (const tier of Object.keys(deal) as ChestTier[]) {
      const rows = (this.chestTable[tier] ?? []).slice(0, CHEST_TABLE_MAX[tier]);
      const order = rows.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      deal[tier] = order;
    }
    this.chestDeal = deal;
  }

  /** Mescola il mazzo dell'Overlord (una copia per carta pronta, vedi `ready`) e pesca la mano di partenza. */
  buildOverlordDeck(): void {
    const deck: string[] = [];
    for (const c of this.overlordCards.values()) if (c.ready) for (let n = 0; n < c.copies; n++) deck.push(c.id);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    this.overlord = { deck, hand: deck.splice(0, OVERLORD_START_HAND), discard: [], inPlay: [], traps: [], threat: 0, gust: false };
  }

  /** Mescola i mazzi delle carte abilità (una copia per carta) e dà a ogni eroe le sue abilità secondarie: tante per ramo quante dice la sua scheda. */
  buildSkillDecks(): void {
    const decks: Record<SkillSchool, string[]> = { combat: [], cunning: [], magic: [] };
    for (const s of this.skills.values()) decks[s.school].push(s.id);
    for (const school of SKILL_SCHOOLS) {
      const cards = decks[school];
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
    }
    // Le carte già assegnate prima di partire (nella fase Equipaggiamento) escono dai mazzi e danno subito i loro bonus permanenti.
    for (const hero of this.pieces) {
      if (hero.team !== 'hero') continue;
      for (const id of hero.skillCards) {
        const card = this.skills.get(id);
        if (!card) continue;
        const k = decks[card.school].indexOf(id);
        if (k >= 0) decks[card.school].splice(k, 1);
        applyPermanentStats(hero, card.effects);
      }
    }
    this.skillDecks = decks;
    for (const hero of this.pieces) {
      if (hero.team !== 'hero' || hero.skillCards.length) continue;
      for (const school of SKILL_SCHOOLS) for (let n = 0; n < hero.skills[school]; n++) this.drawSkill(hero, school);
    }
  }

  /** `hero` pesca una carta abilità dal mazzo del ramo `school`. Restituisce la carta, o null se il mazzo è finito. */
  drawSkill(hero: Piece, school: SkillSchool): SkillDef | null {
    const id = this.skillDecks[school].shift();
    const card = id ? this.skills.get(id) : undefined;
    if (!card) return null;
    hero.skillCards.push(card.id);
    applyPermanentStats(hero, card.effects); // per esempio Resistente: +4 ferite massime
    return card;
  }

  /** L'obiettivo dell'avventura (dalla mappa): per ora sconfiggere una pedina (il boss). */
  objective: AdventureObjective | null = null;
  /** Titolo e introduzione dell'avventura, e le caselle fra cui gli eroi scelgono la partenza (dalla mappa). */
  title?: string;
  intro?: string;
  /** Le regole speciali dell'avventura (markdown), se ce ne sono: si leggono dopo l'obiettivo. */
  rules?: string;
  /** L'immagine che accompagna le regole speciali (id della raccolta dei gettoni). */
  rulesImage?: string;
  startCells: Cell[] = [];
  /** La preparazione prima del primo round (lettura dell'introduzione e dell'obiettivo, scelta delle caselle di partenza): null se non c'è o è finita. Vedi `state/setup.ts`. */
  setup: Setup | null = null;

  /** Se l'obiettivo è sconfiggere una pedina e non c'è più, la partita è vinta. */
  checkVictory(): void {
    const goal = this.objective;
    if (goal?.kind === 'defeat' && !this.pieces.some((p) => p.id === goal.pieceId) && !isWaitingToRevive(this, goal.pieceId)) this.win();
  }

  /** I pezzi di finale aggiunti dagli eventi (`addEnding`): testo (markdown) e punti Conquista in più o in meno, in ordine; si usano quando la partita si vince. */
  endingExtras: { text: string; points: number }[] = [];
  /** I famigli in partita (non sono pedine: vedi `state/familiars.ts`) e le loro schede (messe dalla scena, non si salvano). */
  familiars: Familiar[] = [];
  familiarDefs: ReadonlyMap<string, FamiliarDef> = new Map();

  /** Un evento aggiunge un pezzo al finale (solo finché si sta giocando: dopo la vittoria non conta più). */
  addEnding(text: string, points: number): void {
    if (this.status === 'playing') this.endingExtras.push({ text, points });
  }

  /** Gli eroi vincono (una volta sola): la partita finisce e si sommano i punti Conquista dell'obiettivo completato e quelli dei pezzi di finale aggiunti dagli eventi. */
  win(): void {
    if (this.status !== 'playing') return;
    this.status = 'victory';
    this.addProgress((this.objective?.reward ?? 0) + this.endingExtras.reduce((sum, e) => sum + e.points, 0));
  }

  /** Cambia la Conquista (in positivo o in negativo, mai sotto zero). A zero gli eroi perdono. */
  addProgress(amount: number): void {
    this.progress = Math.max(0, this.progress + amount);
    if (this.progress === 0 && this.status === 'playing') this.status = 'defeat';
  }

  /**
   * Le chiavi runiche che ci sono in questa partita (al massimo 3, sempre nello stesso ordine): quelle che il gruppo ha già,
   * quelle che aprono una porta, quelle a terra o dentro uno scrigno.
   */
  runesInPlay(): RuneColor[] {
    const found = new Set<RuneColor>(this.party.runeKeys);
    for (const d of this.doors) if (d.lock?.kind === 'rune') found.add(d.lock.color);
    for (const m of this.markers) {
      if (m.type === 'rune') found.add(m.color);
      else if (m.type === 'chest') for (const l of m.contents ?? []) if (l.kind === 'rune') found.add(l.color);
    }
    return RUNE_ORDER.filter((c) => found.has(c));
  }

  /** Uno stato vuoto, per quando la mappa non è ancora caricata. */
  static empty(): GameState {
    return new GameState(0, [], [], [], [], new Party(), new Exploration());
  }

  /** L'inizio di una partita dai dati della mappa. `fallbackPieces` serve se la mappa non ha pedine; `sheets` sono le schede degli eroi. */
  static fromMap(data: MapData, fallbackPieces: PieceData[], sheets: ReadonlyMap<string, HeroSheet> = new Map(), items: ReadonlyMap<string, ItemDef> = new Map(), shopStock: Readonly<Record<string, number>> = {}, skills: ReadonlyMap<string, SkillDef> = new Map(), monsters: ReadonlyMap<string, MonsterDef> = new Map(), overlordCards: ReadonlyMap<string, OverlordCardDef> = new Map()): GameState {
    const state = new GameState(
      data.seed,
      data.doors ?? [],
      data.obstacles ?? [],
      data.markers ?? [],
      createPieces(data.pieces ?? fallbackPieces, sheets, items, monsters),
      new Party(data.party),
      new Exploration(),
    );
    state.walls = (data.walls ?? []).map((w) => ({ ...w }));
    state.behaviors = (data.behaviors ?? []).map((b) => ({ behavior: { ...b.behavior }, ...(b.monsters?.length ? { monsters: [...b.monsters] } : {}) }));
    state.progress = data.progress ?? DEFAULT_PROGRESS;
    state.objective = data.objective ?? null;
    state.events = buildEvents(data);
    state.title = data.title;
    state.intro = data.intro;
    state.rules = data.rules?.trim() ? data.rules : undefined;
    state.rulesImage = data.rulesImage;
    state.startCells = (data.start ?? []).map((c) => ({ x: c.x, y: c.y }));
    state.items = items;
    state.rngState = data.seed;
    state.skills = skills;
    state.monsters = monsters;
    state.overlordCards = overlordCards;
    state.chestTable = data.chestTable ?? {};
    state.buildDecks();
    state.buildChestDeal();
    state.buildOverlordDeck();
    state.buildSkillDecks();
    state.buildShop(shopStock);
    return state;
  }

  /** Una copia in dati puri (solo JSON), staccata dallo stato vivo. */
  snapshot(): GameSnapshot {
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    return {
      version: SNAPSHOT_VERSION,
      seed: this.seed,
      round: this.round,
      phase: this.phase,
      progress: this.progress,
      status: this.status,
      objective: this.objective,
      events: copy(this.events),
      decks: copy(this.decks),
      chestTable: copy(this.chestTable),
      chestDeal: copy(this.chestDeal),
      skillDecks: copy(this.skillDecks),
      overlord: copy(this.overlord),
      openedTiers: [...this.openedTiers],
      shop: { ...this.shop },
      rngState: this.rngState,
      activeId: this.activeId,
      doors: copy(this.doors),
      obstacles: copy(this.obstacles),
      walls: copy(this.walls),
      behaviors: copy(this.behaviors),
      endingExtras: copy(this.endingExtras),
      familiars: copy(this.familiars),
      markers: copy(this.markers),
      pieces: copy(this.pieces),
      party: this.party.toData(),
      exploration: this.exploration.toData(this.obstacles, this.doors, this.markers),
    };
  }

  /** Ricostruisce lo stato da una copia. */
  static restore(s: GameSnapshot, items: ReadonlyMap<string, ItemDef> = new Map(), skills: ReadonlyMap<string, SkillDef> = new Map(), monsters: ReadonlyMap<string, MonsterDef> = new Map(), overlordCards: ReadonlyMap<string, OverlordCardDef> = new Map()): GameState {
    if (s.version !== SNAPSHOT_VERSION) throw new Error(`Salvataggio di versione ${s.version}: non supportato`);
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    const doors: Door[] = copy(s.doors);
    const obstacles: Obstacle[] = copy(s.obstacles);
    const markers: Marker[] = copy(s.markers);
    const state = new GameState(
      s.seed, doors, obstacles, markers, copy(s.pieces), new Party(s.party),
      Exploration.fromData(s.exploration, obstacles, doors, markers), s.activeId,
    );
    state.walls = s.walls ? copy(s.walls) : [];
    state.behaviors = s.behaviors ? copy(s.behaviors) : [];
    state.endingExtras = s.endingExtras ? copy(s.endingExtras) : [];
    state.familiars = s.familiars ? copy(s.familiars) : [];
    state.round = s.round;
    state.phase = s.phase;
    state.progress = s.progress;
    state.status = s.status;
    state.objective = s.objective ?? null;
    state.events = s.events ? copy(s.events) : emptyEvents();
    state.items = items;
    state.skills = skills;
    state.monsters = monsters;
    state.overlordCards = overlordCards;
    if (s.overlord) state.overlord = { ...copy(s.overlord), traps: copy(s.overlord.traps ?? []), gust: s.overlord.gust ?? false };
    state.openedTiers = [...(s.openedTiers ?? [])];
    state.decks = copy(s.decks);
    state.chestTable = copy(s.chestTable ?? {});
    state.chestDeal = copy(s.chestDeal ?? { copper: [], silver: [], gold: [] });
    state.skillDecks = copy(s.skillDecks ?? { combat: [], cunning: [], magic: [] });
    state.shop = { ...s.shop };
    state.rngState = s.rngState;
    return state;
  }
}

const SNAPSHOT_VERSION = 1;

const RUNE_ORDER: readonly RuneColor[] = ['red', 'blue', 'green'];

/** Il mazzo dell'Overlord: id delle carte. */
export interface OverlordState {
  deck: string[];
  hand: string[];
  discard: string[];
  /** Le carte Potere giocate: restano a faccia in su finché dura la partita. */
  inPlay: string[];
  /** Le trappole armate e nascoste ai giocatori (vedi `state/traps.ts`). */
  traps: ArmedTrap[];
  threat: number;
  /** Raffica di vento in corso: fino al prossimo turno dell'Overlord gli eroi non vedono oltre 5 spazi. */
  gust: boolean;
}

export type Phase = 'heroes' | 'overlord';

/** In corso, persa (la Conquista è arrivata a zero) o vinta (l'obiettivo dell'avventura è raggiunto). */
export type Status = 'playing' | 'defeat' | 'victory';

/** Com'è fatto lo stato salvato: solo numeri, testi, liste e oggetti. */
export interface GameSnapshot {
  version: number;
  familiars?: Familiar[];
  seed: number;
  round: number;
  phase: Phase;
  progress: number;
  status: Status;
  decks: Record<ChestTier, string[]>;
  chestTable?: ChestTable;
  chestDeal?: Record<ChestTier, number[]>;
  skillDecks?: Record<SkillSchool, string[]>;
  overlord?: OverlordState;
  objective?: AdventureObjective | null;
  events?: EventState;
  openedTiers?: ChestTier[];
  shop: Record<string, number>;
  rngState: number;
  activeId: string | null;
  doors: Door[];
  obstacles: Obstacle[];
  walls?: Wall[];
  behaviors?: GlobalBehavior[];
  endingExtras?: { text: string; points: number }[];
  markers: Marker[];
  pieces: Piece[];
  party: PartyData;
  exploration: ExplorationData;
}
