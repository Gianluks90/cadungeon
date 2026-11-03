import { EVIL_DECK_END_PENALTY, EVIL_DRAW, EVIL_HAND_MAX } from '../constants';
import { Board, Cell, cellKey } from '../board/board';
import { visibleCells } from '../board/sight';
import { EvilCardDef } from '../evil/card';
import { Piece, createPieces, footprint } from '../pieces/piece';
import { familiarSightCells } from './familiars';
import { GUST_SIGHT } from './combat';
import { ruleAmount } from './effects';
import { GameState } from './game-state';

/**
 * Il Mazzo del Male (docs/REGOLE.md, sezione 9): all'inizio del turno raccoglie Minaccia (1 per eroe) e pesca, poi lo script
 * gioca una carta Evocazione. Le regole stanno qui, senza animazioni né finestre: la scena le chiama e racconta cosa è successo.
 */

/** La carta con questo id (null se non è nel catalogo). */
export function cardOf(state: GameState, id: string): EvilCardDef | null {
  return state.evilCards.get(id) ?? null;
}

/** Quanta Minaccia costa giocare la carta: quella stampata più ciò che aggiungono gli eroi in campo (Protezione dal male di Thael: +1). */
export function cardCost(state: GameState, card: EvilCardDef): number {
  const extra = state.pieces.filter((p) => p.team === 'hero' && !p.city).reduce((n, h) => n + ruleAmount(state, h, 'evilCardCost'), 0);
  return Math.max(0, card.cost + extra);
}

/** Quante carte restano nel mazzo: è l'unica cosa del mazzo che i giocatori sanno. */
export function cardsLeft(state: GameState): number {
  return state.evil.deck.length;
}

export interface UpkeepResult {
  /** La Minaccia guadagnata. */
  threat: number;
  /** Le carte pescate. */
  drawn: number;
  /** Il mazzo è finito: gli eroi hanno perso Conquista e gli scarti sono tornati nel mazzo. */
  deckEnded: boolean;
  /** Le carte scartate perché la mano era piena, e la Minaccia che hanno dato. */
  discarded: number;
}

/** Inizio del turno del Maligno: 1 Minaccia per eroe, pesca (di più con Genio del Male), scarta oltre il limite della mano. */
/** Quanta Minaccia riceve il Maligno a ogni turno: 1 per eroe, meno ciò che tolgono le carte degli eroi (Prudente: −1), mai meno di 0. */
export function threatPerTurn(state: GameState): number {
  const heroes = state.pieces.filter((p) => p.team === 'hero');
  const cut = heroes.reduce((n, h) => n + ruleAmount(state, h, 'evilThreat'), 0);
  return Math.max(0, heroes.length + cut);
}

/** Il Maligno pesca fino a `want` carte (se il mazzo finisce rimescola gli scarti e la Conquista cala: `EVIL_DECK_END_PENALTY`). */
function drawFromDeck(state: GameState, want: number): { drawn: number; deckEnded: boolean } {
  const o = state.evil;
  let drawn = 0;
  let deckEnded = false;
  for (let n = 0; n < want; n++) {
    if (!o.deck.length) {
      if (!o.discard.length) break;
      deckEnded = true;
      state.addProgress(-EVIL_DECK_END_PENALTY);
      o.deck = shuffled(state, o.discard);
      o.discard = [];
    }
    o.hand.push(o.deck.shift()!);
    drawn++;
  }
  return { drawn, deckEnded };
}

/** Mano oltre il limite: si scartano le carte che costano di più (le meno giocabili), e si prende la loro Minaccia. Restituisce quante se ne scartano. */
function trimHand(state: GameState): number {
  const o = state.evil;
  let discarded = 0;
  while (o.hand.length > EVIL_HAND_MAX) {
    const worst = o.hand.map((id, i) => ({ i, c: cardOf(state, id)?.cost ?? 0 })).sort((a, b) => b.c - a.c)[0];
    const [id] = o.hand.splice(worst.i, 1);
    o.discard.push(id);
    o.threat += cardOf(state, id)?.value ?? 0;
    discarded++;
  }
  return discarded;
}

export function evilUpkeep(state: GameState): UpkeepResult {
  const o = state.evil;
  const threat = threatPerTurn(state);
  o.threat += threat;
  const { drawn, deckEnded } = drawFromDeck(state, EVIL_DRAW + o.inPlay.filter((id) => id === 'evil-genius').length);
  const discarded = trimHand(state);
  return { threat, drawn, deckEnded, discarded };
}

/** Un evento fa pescare `count` carte al Maligno (come a inizio turno, ma fuori dal suo turno). Restituisce quante ne ha pescate. */
export function drawEvilCards(state: GameState, count: number): number {
  const { drawn } = drawFromDeck(state, count);
  trimHand(state);
  return drawn;
}

function shuffled(state: GameState, ids: readonly string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(state.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** La carta è nella mano del Maligno? */
export function inHand(state: GameState, id: string): boolean {
  return state.evil.hand.includes(id);
}

/** Una carta Potere è in gioco? */
export function inPlay(state: GameState, id: string): boolean {
  return state.evil.inPlay.includes(id);
}

/** Gioca una carta Evento dalla mano se c'è e la Minaccia basta: la paga e la scarta. Restituisce se l'ha giocata. */
export function playEvent(state: GameState, id: string): boolean {
  const o = state.evil;
  const card = cardOf(state, id);
  if (!card || !o.hand.includes(id) || cardCost(state, card) > o.threat) return false;
  o.threat -= cardCost(state, card);
  o.hand.splice(o.hand.indexOf(id), 1);
  o.discard.push(id);
  return true;
}

/** Lo script gioca una carta Potere pronta che non è già in gioco (una per turno): resta a faccia in su davanti al Maligno. Restituisce la carta. */
export function playPowerCard(state: GameState): EvilCardDef | null {
  const o = state.evil;
  const card = o.hand
    .map((id) => cardOf(state, id))
    .filter((c): c is EvilCardDef => !!c && c.kind === 'power' && c.ready === true && cardCost(state, c) <= o.threat && !o.inPlay.includes(c.id))
    .sort((a, b) => b.cost - a.cost)[0];
  if (!card) return null;
  o.threat -= cardCost(state, card);
  o.hand.splice(o.hand.indexOf(card.id), 1);
  o.inPlay.push(card.id);
  return card;
}

const distance = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Dove possono apparire i mostri evocati (manuale, "Creare i mostri"): caselle libere da personaggi e ostacoli (roccia, buca, acqua), in un'area già rivelata
 * (o, nei tile senza area, già esplorate) e che nessun eroe vede. Per il piazzamento gli altri mostri NON interrompono il campo visivo degli eroi
 * (gli altri eroi sì). Si può evocare sopra oggetti a terra, ma non su glifi, scrigni e scale. L'elenco è ordinato dalla più vicina agli eroi.
 */
function summonCells(state: GameState, board: Board): Cell[] {
  const heroes = state.pieces.filter((p) => p.team === 'hero' && !p.city);
  const occupied = new Set(state.pieces.filter((p) => !p.city).flatMap((p) => footprint(p).map(cellKey)));
  const heroCells = new Set(heroes.map((h) => cellKey(h.cell)));
  const reach = state.evil.gust ? GUST_SIGHT : Infinity; // la Raffica di vento accorcia anche questa vista
  const seen = new Set<string>();
  for (const h of heroes) {
    const blockers = new Set(heroCells); // solo gli altri eroi fanno da schermo
    blockers.delete(cellKey(h.cell));
    for (const k of visibleCells(board, h.cell, blockers)) {
      const [x, y] = k.split(',').map(Number);
      if (Math.max(Math.abs(x - h.cell.x), Math.abs(y - h.cell.y)) <= reach) seen.add(k);
    }
  }
  // Anche la vista di un famiglio che "vede come un eroe" (Francor) conta: lì il Maligno non può evocare.
  const heroBlockers = new Set(heroCells);
  for (const k of familiarSightCells(state, board, (b, from) => [...visibleCells(b, from, heroBlockers)].filter((key) => { const [x, y] = key.split(',').map(Number); return Math.max(Math.abs(x - from.x), Math.abs(y - from.y)) <= reach; }))) seen.add(k);
  const near = (c: Cell) => Math.min(...heroes.map((h) => distance(c, h.cell)));
  return board
    .walkableCells()
    .filter((c) => {
      const k = cellKey(c);
      const area = board.areaAt(c);
      const revealed = area ? state.exploration.areas.has(area) : state.exploration.cells.has(k);
      const marker = board.markerAt(c);
      return revealed && !seen.has(k) && !occupied.has(k) && !board.obstacleAt(c) && (!marker || !['glyph', 'chest', 'stairs', 'encounter'].includes(marker.type));
    })
    .sort((a, b) => near(a) - near(b));
}

/** Una evocazione pronta: quale mostro e dove. */
export interface SummonPlan {
  monster: string;
  enhanced: boolean;
  cell: Cell;
}

/** Quante miniature di questo tipo (normali o potenziate) restano nella scatola: il limite meno quelle in mappa. Infinito se il tipo non ha limite. */
export function miniaturesLeft(state: GameState, monster: string, enhanced: boolean): number {
  const limit = state.monsters.get(monster)?.limit;
  if (!limit) return Infinity;
  const onMap = state.pieces.filter((p) => p.team === 'monster' && p.monster === monster && !!p.enhanced === enhanced).length;
  return Math.max(0, (enhanced ? limit.enhanced : limit.normal) - onMap);
}

/**
 * Dove piazzare i mostri della carta. Può essere meno del dovuto: se manca posto, o se le miniature nella scatola non bastano (`miniaturesLeft`: la carta si gioca
 * lo stesso e costa uguale, ma ne arrivano meno). Vuoto se non c'è nessuna casella valida o nessuna miniatura.
 */
export function planSummon(state: GameState, board: Board, card: EvilCardDef): SummonPlan[] {
  const free = summonCells(state, board);
  const taken = new Set<string>();
  const plans: SummonPlan[] = [];
  const used = new Map<string, number>(); // le miniature già prese da questa carta, per tipo e versione
  for (const group of card.summon ?? []) {
    const def = state.monsters.get(group.monster);
    if (!def) continue;
    const key = `${def.id}|${!!group.enhanced}`;
    for (let n = 0; n < group.count; n++) {
      if ((used.get(key) ?? 0) >= miniaturesLeft(state, def.id, !!group.enhanced)) break; // finite le miniature
      const cell = free.find((c) => {
        const cells = footprint({ cell: c, size: def.size });
        return cells.every((f) => !taken.has(cellKey(f)) && free.some((o) => o.x === f.x && o.y === f.y));
      });
      if (!cell) continue;
      footprint({ cell, size: def.size }).forEach((f) => taken.add(cellKey(f)));
      plans.push({ monster: def.id, enhanced: !!group.enhanced, cell });
      used.set(key, (used.get(key) ?? 0) + 1);
    }
  }
  return plans;
}

export interface PlayResult {
  card: EvilCardDef;
  spawned: Piece[];
}

/**
 * Lo script gioca una carta Evocazione: la più cara che può pagare e per cui c'è posto. Paga la Minaccia, mette la carta negli scarti e
 * aggiunge i mostri allo stato. Null se non gioca niente.
 */
export function playSummonCard(state: GameState, board: Board): PlayResult | null {
  const o = state.evil;
  const playable = o.hand
    .map((id) => cardOf(state, id))
    .filter((c): c is EvilCardDef => !!c && c.kind === 'summon' && cardCost(state, c) <= o.threat)
    .sort((a, b) => b.cost - a.cost);
  for (const card of playable) {
    const plans = planSummon(state, board, card);
    if (!plans.length) continue;
    const heroes = state.pieces.filter((p) => p.team === 'hero').length;
    const spawned = plans.flatMap((plan) => {
      const [piece] = createPieces([{ id: newMonsterId(state, plan.monster), team: 'monster', monster: plan.monster, enhanced: plan.enhanced, x: plan.cell.x, y: plan.cell.y }], new Map(), state.items, state.monsters, heroes);
      state.pieces.push(piece);
      return [piece];
    });
    o.threat -= cardCost(state, card);
    o.hand.splice(o.hand.indexOf(card.id), 1);
    o.discard.push(card.id);
    return { card, spawned };
  }
  return null;
}

export function newMonsterId(state: GameState, monster: string): string {
  let n = state.pieces.length;
  while (state.pieces.some((p) => p.id === `${monster}-${n}`)) n++;
  return `${monster}-${n}`;
}
