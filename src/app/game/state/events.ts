import type { Board, Cell } from '../board/board';
import { cellKey } from '../board/board';
import type { AdventureEvent, EventEffect, EventTrigger, MapData } from '../map/map-data';
import { Piece, emptyStatus, footprint } from '../pieces/piece';
import type { GameState } from './game-state';
import { settleRemoval } from './loot';

/**
 * Gli eventi dell'avventura (`MapData.events`): quando succede qualcosa (una pedina è sconfitta, uno scrigno si apre in un'area, un'area si rivela) scattano gli eventi di quel tipo,
 * ognuno con le sue condizioni sulle variabili e i suoi effetti. Qui ci sono solo le regole sullo stato: i messaggi si mettono in coda (`messages`) e li mostra la scena.
 */

/** Un messaggio da mostrare con "Ho letto". */
export interface EventMessage {
  title?: string;
  text: string;
}

/** Una pedina sconfitta che aspetta di tornare in vita (effetto `revive`): ha già lasciato la mappa e non conta come viva né come morta. */
export interface PendingRevival {
  piece: Piece;
  /** Turni del Signore supremo che mancano. */
  turns: number;
  /** La distanza minima dagli eroi, in caselle, a cui riappare. */
  distance: number;
  /** È stata sconfitta durante il turno del Signore supremo: la fine di quel turno non conta. */
  skipNext?: boolean;
}

export interface EventState {
  defs: AdventureEvent[];
  /** Nome della variabile -> acceso. Una variabile non scritta è spenta. */
  variables: Record<string, boolean>;
  revivals: PendingRevival[];
  /** I messaggi in coda da mostrare (la scena li svuota uno alla volta). */
  messages: EventMessage[];
  /** Frasi brevi in coda (il bottino di una sconfitta decisa da un evento), da mostrare come notifiche. */
  notices: string[];
}

export const emptyEvents = (): EventState => ({ defs: [], variables: {}, revivals: [], messages: [], notices: [] });

/** Gli eventi di una mappa: le definizioni e tutte le variabili spente. */
export function buildEvents(data: Pick<MapData, 'variables' | 'events'>): EventState {
  const events = emptyEvents();
  events.defs = JSON.parse(JSON.stringify(data.events ?? []));
  for (const name of data.variables ?? []) events.variables[name] = false;
  return events;
}

/** Com'è andata: se la pedina sconfitta deve tornare in vita (e fra quanto) e quali pedine hanno cambiato i valori (la scena le ridisegna). */
export interface EventReport {
  revive: { turns: number; distance: number } | null;
  modified: Piece[];
}

const same = (a: EventTrigger, b: EventTrigger): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'defeated') return a.pieceId === (b as typeof a).pieceId;
  return a.area === (b as { area: string }).area;
};

export function variableOn(state: GameState, name: string): boolean {
  return !!state.events.variables[name];
}

/**
 * Fa scattare gli eventi di questo tipo, nell'ordine in cui sono scritti. `subject` è la pedina sconfitta (per `revive`). Ogni evento sceglie `then` o `else` guardando le variabili
 * come sono in quel momento, quindi un evento può cambiare ciò che vede il successivo.
 */
export function runEvents(state: GameState, trigger: EventTrigger, subject?: Piece): EventReport {
  const report: EventReport = { revive: null, modified: [] };
  for (const event of state.events.defs) {
    if (!same(event.when, trigger)) continue;
    const holds = (event.if ?? []).every((c) => variableOn(state, c.variable) === c.is);
    for (const effect of holds ? event.then : (event.else ?? [])) apply(state, effect, report, subject);
  }
  return report;
}

function apply(state: GameState, effect: EventEffect, report: EventReport, subject?: Piece): void {
  const ev = state.events;
  switch (effect.kind) {
    case 'message':
      ev.messages.push({ ...(effect.title ? { title: effect.title } : {}), text: effect.text });
      return;
    case 'progress':
      state.addProgress(effect.amount);
      return;
    case 'setVariable':
      ev.variables[effect.variable] = effect.value;
      return;
    case 'modifyMonster': {
      const piece = state.pieces.find((p) => p.id === effect.pieceId) ?? ev.revivals.find((r) => r.piece.id === effect.pieceId)?.piece;
      if (!piece) return;
      piece.maxWounds = Math.max(1, piece.maxWounds + (effect.wounds ?? 0));
      piece.wounds = Math.max(1, Math.min(piece.maxWounds, piece.wounds + (effect.wounds ?? 0)));
      piece.speed = Math.max(1, piece.speed + (effect.speed ?? 0));
      piece.armor = Math.max(0, piece.armor + (effect.armor ?? 0));
      if (!report.modified.includes(piece)) report.modified.push(piece);
      return;
    }
    case 'revive':
      if (subject && !report.revive) report.revive = { turns: Math.max(1, effect.turns), distance: Math.max(0, effect.distance) };
      return;
    case 'finishRevival': {
      const i = ev.revivals.findIndex((r) => r.piece.id === effect.pieceId);
      if (i < 0) return;
      const [pending] = ev.revivals.splice(i, 1);
      const again = runEvents(state, { kind: 'defeated', pieceId: pending.piece.id }, pending.piece);
      if (again.revive) ev.revivals.push({ ...pending, turns: again.revive.turns, distance: again.revive.distance });
      else ev.notices.push(...settleRemoval(state, pending.piece).lines);
      return;
    }
    case 'win':
      state.win();
      return;
  }
}

/** Mette da parte una pedina sconfitta che deve tornare in vita. */
export function scheduleRevival(state: GameState, piece: Piece, revive: { turns: number; distance: number }): void {
  state.events.revivals.push({ piece, turns: revive.turns, distance: revive.distance, ...(state.phase === 'overlord' ? { skipNext: true } : {}) });
}

/** La pedina sconfitta che aspetta di tornare in vita ha ancora il diritto di contare come viva (per l'obiettivo "sconfiggi"). */
export function isWaitingToRevive(state: GameState, pieceId: string): boolean {
  return state.events.revivals.some((r) => r.piece.id === pieceId);
}

/**
 * Dove può riapparire `piece`: caselle già scoperte (così agisce subito), libere, senza ostacoli e senza glifi, scrigni o scale, con tutta la sagoma sulla mappa. Sceglie a caso fra quelle
 * lontane almeno `distance` caselle da ogni eroe; se non ce n'è nessuna, la più lontana possibile. Null se non c'è nessuno spazio libero.
 */
export function revivalCell(state: GameState, board: Board, piece: Piece, distance: number): Cell | null {
  const heroes = state.pieces.filter((p) => p.team === 'hero' && !p.city);
  const occupied = new Set(state.pieces.filter((p) => !p.city).flatMap((p) => footprint(p).map(cellKey)));
  const ok = (c: Cell) => {
    const area = board.areaAt(c);
    const revealed = area ? state.exploration.areas.has(area) : state.exploration.cells.has(cellKey(c));
    const marker = board.markerAt(c);
    return board.isWalkable(c) && revealed && !occupied.has(cellKey(c)) && !board.obstacleAt(c) && (!marker || !['glyph', 'chest', 'stairs'].includes(marker.type));
  };
  const away = (cells: Cell[]) => Math.min(...heroes.flatMap((h) => cells.map((c) => Math.max(Math.abs(c.x - h.cell.x), Math.abs(c.y - h.cell.y)))), Infinity);
  const spots = board
    .walkableCells()
    .map((c) => ({ c, far: away(footprint({ cell: c, size: piece.size })) }))
    .filter(({ c }) => footprint({ cell: c, size: piece.size }).every(ok));
  if (!spots.length) return null;
  const enough = spots.filter((s) => s.far >= distance);
  if (enough.length) return enough[Math.floor(state.random() * enough.length)].c;
  const best = Math.max(...spots.map((s) => s.far));
  const farthest = spots.filter((s) => s.far === best);
  return farthest[Math.floor(state.random() * farthest.length)].c;
}

/**
 * Fine di un turno del Signore supremo: chi aspetta di tornare in vita perde un turno; a zero riappare a piena salute (senza stati) nella casella scelta da `revivalCell`
 * (se non c'è posto riprova al turno dopo). Restituisce le pedine tornate, che la scena mostra.
 */
export function tickRevivals(state: GameState): Piece[] {
  const board = state.board;
  const back: Piece[] = [];
  state.events.revivals = state.events.revivals.filter((r) => {
    if (r.skipNext) {
      r.skipNext = undefined;
      return true;
    }
    if (r.turns > 0) r.turns--;
    if (r.turns > 0 || !board) return true;
    const cell = revivalCell(state, board, r.piece, r.distance);
    if (!cell) return true;
    r.piece.cell = cell;
    r.piece.wounds = r.piece.maxWounds;
    r.piece.status = emptyStatus();
    r.piece.stunned = false;
    r.piece.webbed = false;
    state.pieces.push(r.piece);
    back.push(r.piece);
    return false;
  });
  return back;
}
