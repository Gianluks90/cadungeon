import { DEFAULT_PROGRESS } from '../constants';
import { Door, RuneColor } from '../board/door';
import { ChestTier, Marker } from '../board/marker';
import { Obstacle } from '../board/obstacle';
import { Exploration, ExplorationData } from '../exploration';
import { MapData } from '../map/map-data';
import { Party, PartyData } from '../party';
import { HeroSheet } from '../heroes/hero-sheet';
import { ItemDef } from '../items/item';
import { MonsterDef } from '../monsters/monster';
import { SKILL_SCHOOLS, SkillDef, SkillSchool } from '../skills/skill';
import { applyPermanentStats } from './effects';
import { Piece, PieceData, createPieces } from '../pieces/piece';

/**
 * Lo stato di una partita come dati puri: si può copiare, salvare in JSON e ricostruire. È la fonte unica di verità:
 * chi disegna (Pixi) o decide (le regole) legge e modifica questi oggetti, e non tiene copie per conto suo.
 * Sarà lo stato dell'host: gli altri giocatori ne riceveranno solo le parti che possono vedere.
 *
 * Non ci sono i tile: la mappa si ricarica dal suo file (`public/maps/`). Porte, ostacoli e segnalini invece sono qui perché
 * durante la partita cambiano (porte aperte, glifi accesi, oggetti raccolti).
 */
export class GameState {
  /** Il round in corso, da 1. */
  round = 1;
  /** Di chi è il turno: gli eroi (ordine libero) oppure l'Overlord. */
  phase: Phase = 'heroes';
  /** Il Progresso: contatore comunitario degli eroi. Se arriva a zero, gli eroi perdono. */
  progress = DEFAULT_PROGRESS;
  /** Come sta andando la partita. */
  status: Status = 'playing';
  /** L'eroe che sta agendo adesso. */
  activeId: string | null;
  /** Il catalogo degli oggetti (si ricarica dai file: non si salva). */
  items: ReadonlyMap<string, ItemDef> = new Map();
  /** I tre mazzi dei tesori degli scrigni (id degli oggetti, in ordine di pesca). Una carta pescata non torna, e un mazzo finito non si rimescola. */
  decks: Record<ChestTier, string[]> = { copper: [], silver: [], gold: [] };
  /** I tipi di scrigno che il gruppo ha già aperto almeno una volta: finché non se ne apre uno, i tesori di quel tipo non si comprano in città. */
  openedTiers: ChestTier[] = [];
  /** Il catalogo delle carte abilità (si ricarica dai file: non si salva). */
  skills: ReadonlyMap<string, SkillDef> = new Map();
  /** I tre mazzi delle carte abilità (id, in ordine di pesca): una carta in mano a un eroe non torna e un mazzo finito non si rimescola. */
  skillDecks: Record<SkillSchool, string[]> = { combat: [], cunning: [], magic: [] };
  /** Le scorte del negozio della città: quante copie restano di ogni oggetto in vendita (id -> numero). */
  shop: Record<string, number> = {};
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
  objective: { kind: 'defeat'; pieceId: string; text?: string } | null = null;

  /** Se l'obiettivo è sconfiggere una pedina e non c'è più, la partita è vinta. */
  checkVictory(): void {
    if (this.status === 'playing' && this.objective?.kind === 'defeat' && !this.pieces.some((p) => p.id === this.objective!.pieceId)) this.status = 'victory';
  }

  /** Cambia il Progresso (in positivo o in negativo, mai sotto zero). A zero gli eroi perdono. */
  addProgress(amount: number): void {
    this.progress = Math.max(0, this.progress + amount);
    if (this.progress === 0) this.status = 'defeat';
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
  static fromMap(data: MapData, fallbackPieces: PieceData[], sheets: ReadonlyMap<string, HeroSheet> = new Map(), items: ReadonlyMap<string, ItemDef> = new Map(), shopStock: Readonly<Record<string, number>> = {}, skills: ReadonlyMap<string, SkillDef> = new Map(), monsters: ReadonlyMap<string, MonsterDef> = new Map()): GameState {
    const state = new GameState(
      data.seed,
      data.doors ?? [],
      data.obstacles ?? [],
      data.markers ?? [],
      createPieces(data.pieces ?? fallbackPieces, sheets, items, monsters),
      new Party(data.party),
      new Exploration(),
    );
    state.progress = data.progress ?? DEFAULT_PROGRESS;
    state.objective = data.objective ?? null;
    state.items = items;
    state.rngState = data.seed;
    state.skills = skills;
    state.buildDecks();
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
      decks: copy(this.decks),
      skillDecks: copy(this.skillDecks),
      openedTiers: [...this.openedTiers],
      shop: { ...this.shop },
      rngState: this.rngState,
      activeId: this.activeId,
      doors: copy(this.doors),
      obstacles: copy(this.obstacles),
      markers: copy(this.markers),
      pieces: copy(this.pieces),
      party: this.party.toData(),
      exploration: this.exploration.toData(this.obstacles, this.doors, this.markers),
    };
  }

  /** Ricostruisce lo stato da una copia. */
  static restore(s: GameSnapshot, items: ReadonlyMap<string, ItemDef> = new Map(), skills: ReadonlyMap<string, SkillDef> = new Map()): GameState {
    if (s.version !== SNAPSHOT_VERSION) throw new Error(`Salvataggio di versione ${s.version}: non supportato`);
    const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    const doors: Door[] = copy(s.doors);
    const obstacles: Obstacle[] = copy(s.obstacles);
    const markers: Marker[] = copy(s.markers);
    const state = new GameState(
      s.seed, doors, obstacles, markers, copy(s.pieces), new Party(s.party),
      Exploration.fromData(s.exploration, obstacles, doors, markers), s.activeId,
    );
    state.round = s.round;
    state.phase = s.phase;
    state.progress = s.progress;
    state.status = s.status;
    state.objective = s.objective ?? null;
    state.items = items;
    state.skills = skills;
    state.openedTiers = [...(s.openedTiers ?? [])];
    state.decks = copy(s.decks);
    state.skillDecks = copy(s.skillDecks ?? { combat: [], cunning: [], magic: [] });
    state.shop = { ...s.shop };
    state.rngState = s.rngState;
    return state;
  }
}

const SNAPSHOT_VERSION = 1;

const RUNE_ORDER: readonly RuneColor[] = ['red', 'blue', 'green'];

export type Phase = 'heroes' | 'overlord';

/** In corso, persa (il Progresso è arrivato a zero) o vinta (l'obiettivo dell'avventura è raggiunto). */
export type Status = 'playing' | 'defeat' | 'victory';

/** Com'è fatto lo stato salvato: solo numeri, testi, liste e oggetti. */
export interface GameSnapshot {
  version: number;
  seed: number;
  round: number;
  phase: Phase;
  progress: number;
  status: Status;
  decks: Record<ChestTier, string[]>;
  skillDecks?: Record<SkillSchool, string[]>;
  objective?: { kind: 'defeat'; pieceId: string; text?: string } | null;
  openedTiers?: ChestTier[];
  shop: Record<string, number>;
  rngState: number;
  activeId: string | null;
  doors: Door[];
  obstacles: Obstacle[];
  markers: Marker[];
  pieces: Piece[];
  party: PartyData;
  exploration: ExplorationData;
}
