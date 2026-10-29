import type { Board, Cell } from '../board/board';
import type { Door } from '../board/door';
import { cellKey } from '../board/board';
import type { AdventureEvent, EventEffect, EventTrigger, MapData } from '../map/map-data';
import { Piece, emptyStatus, footprint } from '../pieces/piece';import type { GameState } from './game-state';
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

/** Una prova (effetto `check`) che aspetta di essere giocata: la scena la mostra, tira i dadi e chiama `resolveCheck` (o `refuseCheck`). */
export interface PendingCheck {
  title?: string;
  text: string;
  dice: 'melee' | 'ranged' | 'magic';
  needs: number;
  refusable: boolean;
  onSuccess: EventEffect[];
  onFail: EventEffect[];
  /** L'eroe che la tira (quello che ha fatto scattare l'evento). */
  heroId: string | null;
  /** Se viene da un'interazione: con cosa, e i punti dell'eroe com'erano prima di pagarla (si restituiscono se rinuncia). */
  interaction?: { pieceId: string; before: { points: number; pointsUsed: number; attacks: number } };
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
  /** Le prove in coda da giocare (la scena le svuota una alla volta, dopo i messaggi). */
  checks: PendingCheck[];
  /** Pedine che un evento ha attivato o tolto dalla mappa: la scena le ridisegna o le fa svanire, poi svuota l'elenco. */
  pieceChanges: { piece: Piece; kind: 'activated' | 'removed' }[];
  /** Le porte evento che un evento ha appena aperto: la scena le ridisegna (parte l'animazione dell'anta) e ricalcola cosa si vede. */
  doorsOpened: Door[];
  /** Le pedine con cui un eroe ha già interagito: l'interazione è monouso. */
  interacted: string[];
  /** Per ogni evento "non c'è più nessuno" (per id): il gruppo c'era l'ultima volta che si è guardato? */
  cleared: Record<string, boolean>;
}

export const emptyEvents = (): EventState => ({ defs: [], variables: {}, revivals: [], messages: [], notices: [], checks: [], pieceChanges: [], doorsOpened: [], interacted: [], cleared: {} });

/** Gli eventi "interagisci" ancora disponibili su questa pedina (nessuno se ci si è già interagito). */
export function interactionsOn(state: GameState, pieceId: string): Extract<EventTrigger, { kind: 'interact' }>[] {
  if (state.events.interacted?.includes(pieceId)) return [];
  return state.events.defs.flatMap((e) => (e.when.kind === 'interact' && e.when.pieceId === pieceId ? [e.when] : []));
}

/**
 * Un eroe interagisce con la pedina: scattano i suoi eventi e l'interazione non c'è più. `before` sono i punti dell'eroe prima di pagare il costo: se l'evento è una prova a cui
 * l'eroe rinuncia (`refuseCheck`) gli vengono restituiti.
 */
export function runInteraction(state: GameState, pieceId: string, hero: Piece, before: { points: number; pointsUsed: number; attacks: number }): EventReport {
  (state.events.interacted ??= []).push(pieceId);
  return runEvents(state, { kind: 'interact', pieceId }, undefined, { actor: hero.id, interaction: { pieceId, before } });
}

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
  /** Chi ha fatto scattare l'evento (per le prove) e, se è un'interazione, i dati per restituire il costo. */
  actor?: string;
  interaction?: PendingCheck['interaction'];
}

const same = (a: EventTrigger, b: EventTrigger): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'defeated' || a.kind === 'interact') return a.pieceId === (b as typeof a).pieceId;
  if (a.kind === 'pickedUp') return a.markerId === (b as typeof a).markerId;
  if (a.kind === 'cleared') return false; // scatta solo da `checkCleared`, guardando com'è la mappa
  return a.area === (b as { area: string }).area;
};

const runEvent = (state: GameState, event: AdventureEvent, report: EventReport, subject?: Piece): void => {
  const holds = (event.if ?? []).every((c) => variableOn(state, c.variable) === c.is);
  for (const effect of holds ? event.then : (event.else ?? [])) apply(state, effect, report, subject);
};

export function variableOn(state: GameState, name: string): boolean {
  return !!state.events.variables[name];
}

/**
 * Fa scattare gli eventi di questo tipo, nell'ordine in cui sono scritti. `subject` è la pedina sconfitta (per `revive`). Ogni evento sceglie `then` o `else` guardando le variabili
 * come sono in quel momento, quindi un evento può cambiare ciò che vede il successivo.
 */
export function runEvents(state: GameState, trigger: EventTrigger, subject?: Piece, ctx?: Pick<EventReport, 'actor' | 'interaction'>): EventReport {
  const report: EventReport = { revive: null, modified: [], ...ctx };
  for (const event of state.events.defs) {
    if (same(event.when, trigger)) runEvent(state, event, report, subject);
  }
  return report;
}

/** Quanti nemici di questo evento "non c'è più nessuno" ci sono adesso: nella mappa (o nell'area) e, se la lista è scritta, fra quelli scelti. Chi aspetta di tornare in vita conta come presente. */
function presentCount(state: GameState, when: Extract<EventTrigger, { kind: 'cleared' }>): number {
  const chosen = (p: Piece) => p.team === 'monster' && (!when.pieceIds?.length || when.pieceIds.includes(p.id));
  const inArea = (p: Piece) => !when.area || footprint(p).some((c) => state.board?.areaAt(c) === when.area);
  const onMap = state.pieces.filter((p) => !p.city && chosen(p) && inArea(p)).length;
  const waiting = when.area ? 0 : state.events.revivals.filter((r) => chosen(r.piece)).length;
  return onMap + waiting;
}

/** All'inizio della partita (appena la mappa è pronta): ricorda quali eventi "non c'è più nessuno" hanno qualcuno da aspettare, così non scattano per un gruppo che non c'è mai stato. */
export function armCleared(state: GameState): void {
  const ev = state.events;
  const seen = (ev.cleared ??= {});
  for (const e of ev.defs) if (e.when.kind === 'cleared' && seen[e.id] === undefined) seen[e.id] = presentCount(state, e.when) > 0;
}

/**
 * Guarda gli eventi "non c'è più nessuno": se il gruppo c'era e adesso non c'è più, l'evento scatta. Va chiamata dopo ciò che può svuotare un gruppo (una sconfitta, una rimozione,
 * un mostro che esce camminando): la scena lo fa a ogni aggiornamento. Un evento può svuotare un altro gruppo, quindi si ripete finché non cambia più niente.
 */
export function checkCleared(state: GameState): EventReport {
  const report: EventReport = { revive: null, modified: [] };
  const seen = (state.events.cleared ??= {});
  for (let round = 0; round < 8; round++) {
    let fired = false;
    for (const event of state.events.defs) {
      if (event.when.kind !== 'cleared') continue;
      const here = presentCount(state, event.when) > 0;
      const was = seen[event.id];
      seen[event.id] = here;
      if (was && !here) {
        runEvent(state, event, report);
        fired = true;
      }
    }
    if (!fired) break;
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
    case 'check': {
      const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
      (ev.checks ??= []).push({
        ...(effect.title ? { title: effect.title } : {}),
        text: effect.text,
        dice: effect.dice,
        needs: Math.max(1, effect.needs ?? 1),
        refusable: !!effect.refusable,
        onSuccess: copy(effect.onSuccess),
        onFail: copy(effect.onFail),
        heroId: report.actor ?? state.activeId,
        ...(report.interaction ? { interaction: report.interaction } : {}),
      });
      return;
    }
    case 'openDoor': {
      for (const door of state.doors) {
        if (door.lock?.kind !== 'event' || door.lock.id !== effect.doorId || door.unlocked) continue;
        door.unlocked = true;
        door.open = true;
        ev.doorsOpened.push(door);
      }
      return;
    }
    case 'activate': {
      const piece = state.pieces.find((p) => p.id === effect.pieceId);
      if (!piece?.inactive) return;
      piece.inactive = undefined;
      ev.pieceChanges.push({ piece, kind: 'activated' });
      return;
    }
    case 'removePiece': {
      const i = state.pieces.findIndex((p) => p.id === effect.pieceId);
      if (i < 0) return;
      const [piece] = state.pieces.splice(i, 1);
      ev.pieceChanges.push({ piece, kind: 'removed' });
      return;
    }
    case 'win':
      state.win();
      return;
  }
}

/** I dadi che l'eroe tira per una prova: i dadi in più del suo attacco scelto (nessuno se non ne ha). */
export function checkDiceCount(state: GameState, check: PendingCheck): number {
  const hero = state.pieces.find((p) => p.id === check.heroId);
  return Math.max(0, hero?.dice[check.dice] ?? 0);
}

/** La prova è stata giocata: con almeno `needs` onde valgono gli effetti di `onSuccess`, altrimenti quelli di `onFail`. Restituisce l'esito e ciò che gli effetti hanno cambiato. */
export function resolveCheck(state: GameState, check: PendingCheck, waves: number): { success: boolean; report: EventReport } {
  const success = waves >= check.needs;
  const report: EventReport = { revive: null, modified: [], ...(check.heroId ? { actor: check.heroId } : {}) };
  for (const effect of success ? check.onSuccess : check.onFail) apply(state, effect, report);
  return { success, report };
}

/** L'eroe rinuncia alla prova: non succede niente. Se veniva da un'interazione, i punti spesi tornano all'eroe e l'interazione resta disponibile. Restituisce la pedina interagibile, se c'è. */
export function refuseCheck(state: GameState, check: PendingCheck): Piece | undefined {
  const it = check.interaction;
  if (!it) return undefined;
  const hero = state.pieces.find((p) => p.id === check.heroId);
  if (hero) {
    hero.points = it.before.points;
    hero.pointsUsed = it.before.pointsUsed;
    hero.attacks = it.before.attacks;
  }
  state.events.interacted = (state.events.interacted ?? []).filter((id) => id !== it.pieceId);
  return state.pieces.find((p) => p.id === it.pieceId);
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
