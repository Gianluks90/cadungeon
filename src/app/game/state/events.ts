import { catalogText, tr } from '../../i18n/catalog-text';
import { drawEvilCards } from './evil-deck';
import { groundCells, isGroundFree } from './ground';
import { collectLoot } from '../markers/marker-rules';
import { canReceiveItem } from './actions';
import { sameBehavior } from '../pieces/pawn-behavior';
import type { PawnLook } from '../pieces/pawn-look';
import type { Board, Cell } from '../board/board';
import type { Door } from '../board/door';
import { obstacleCells } from '../board/obstacle';
import type { Obstacle } from '../board/obstacle';
import type { Encounter, Glyph, Stairs } from '../board/marker';
import { cellKey } from '../board/board';
import { THIS_PIECE, isItemCondition, targetsOf, triggersOf } from '../map/map-data';
import type { AdventureEvent, EventEffect, EventTrigger, MapData, Zone } from '../map/map-data';
import { Piece, emptyStatus, footprint } from '../pieces/piece';
import type { GameState } from './game-state';
import { settleRemoval } from './loot';
import { freeAdjacentCell, freeCellAround } from './traps';

/**
 * Gli eventi dell'avventura (`MapData.events`): quando succede qualcosa (una pedina è sconfitta, uno scrigno si apre in un'area, un'area si rivela) scattano gli eventi di quel tipo,
 * ognuno con le sue condizioni sulle variabili e i suoi effetti. Qui ci sono solo le regole sullo stato: i messaggi si mettono in coda (`messages`) e li mostra la scena.
 */

/** Un messaggio da mostrare con "Ho letto". */
export interface EventMessage {
  /** L'etichetta sopra il titolo della dialog (di base "Evento"; per la descrizione di un'area "Area"). */
  kicker?: string;
  title?: string;
  text: string;
}

/** Una pedina sconfitta che aspetta di tornare in vita (effetto `revive`): ha già lasciato la mappa e non conta come viva né come morta. */
export interface PendingRevival {
  piece: Piece;
  /** Turni del Maligno che mancano. */
  turns: number;
  /** La distanza minima dagli eroi, in caselle, a cui riappare. */
  distance: number;
  /** È stata sconfitta durante il turno del Maligno: la fine di quel turno non conta. */
  skipNext?: boolean;
}

/** Una prova (effetto `check`) che aspetta di essere giocata: la scena la mostra, tira i dadi e chiama `resolveCheck` (o `refuseCheck`). */
export interface PendingCheck {
  title?: string;
  text: string;
  dice: 'melee' | 'ranged' | 'magic';
  needs: number;
  refusable: boolean;
  /** L'eroe non può spendere energia per tirare dadi competenza in più. */
  noEnergy: boolean;
  onSuccess: EventEffect[];
  onFail: EventEffect[];
  /** L'eroe che la tira (quello che ha fatto scattare l'evento). */
  heroId: string | null;
  /** Il nemico dell'evento (sconfitto o con cui si interagisce): è ciò che "il nemico dell'evento" indica negli effetti dei rami. */
  thisId?: string;
  /** L'evento da cui viene: se l'eroe rinuncia, un evento "una sola volta" torna disponibile. */
  eventId?: string;
  /** Se viene da un'interazione: con cosa, e i punti dell'eroe com'erano prima di pagarla (si restituiscono se rinuncia). */
  interaction?: { pieceId: string; before: { points: number; pointsUsed: number; attacks: number } };
}

export interface EventState {
  defs: AdventureEvent[];
  /** Nome della variabile -> acceso. Una variabile non scritta è spenta. */
  variables: Record<string, boolean>;
  revivals: PendingRevival[];
  /** Le pedine che entrano in gioco più tardi (`PieceData.delayed`): fuori dalla mappa finché un evento `enterPiece` non le fa entrare. */
  delayed: Piece[];
  /** Gli ostacoli che un evento ha appena tolto (`seen`: gli eroi li avevano già scoperti): la scena li fa svanire e svuota l'elenco. */
  removedObstacles?: { obstacle: Obstacle; seen: boolean }[];
  /** Le pedine appena entrate in gioco da un evento: la scena le presenta (camera, comparsa) e svuota l'elenco. */
  entered: Piece[];
  /** Gli eroi che un evento ha fatto morire (effetto `killActor`, gli id): chi sta camminando lo chiude `applyStep`, gli altri la scena. */
  killHeroes?: string[];
  /** Gli oggetti (id) che un evento (`giveChosen`) deve consegnare a un eroe scelto dal gruppo: la scena chiede chi, uno alla volta. */
  pendingGifts?: string[];
  /** Un oggetto è cresciuto (effetto `levelItem`): la scena rifà l'inventario e le carte. */
  itemsChanged?: boolean;
  /** Un evento ha chiesto di finire il turno degli eroi (effetto `endHeroesTurn`): la scena lo fa dopo aver mostrato i messaggi e svuota il flag. */
  endHeroesTurn?: boolean;
  /** I messaggi in coda da mostrare (la scena li svuota uno alla volta). */
  messages: EventMessage[];
  /** Frasi brevi in coda (il bottino di una sconfitta decisa da un evento), da mostrare come notifiche. */
  notices: string[];
  /** Un evento ha cambiato la mappa (un oggetto a terra, una scalinata crollata, un glifo sigillato): la scena ridisegna la mappa. */
  groundItems?: boolean;
  /** La morte permanente è accesa (effetto `permadeath`): un eroe che muore è eliminato. */
  permadeath?: boolean;
  /** Le prove in coda da giocare (la scena le svuota una alla volta, dopo i messaggi). */
  checks: PendingCheck[];
  /** Pedine che un evento ha attivato o tolto dalla mappa: la scena le ridisegna o le fa svanire, poi svuota l'elenco. */
  pieceChanges: { piece: Piece; kind: 'activated' | 'removed' | 'modified' | 'restyled'; /** Per `restyled`: l'aspetto che aveva prima, per la dissolvenza. */ from?: PawnLook }[];
  /** Le porte evento che un evento ha appena aperto: la scena le ridisegna (parte l'animazione dell'anta) e ricalcola cosa si vede. */
  doorsOpened: Door[];
  /** Le pedine con cui un eroe ha già interagito: l'interazione è monouso. */
  interacted: string[];
  /** Per ogni evento "non c'è più nessuno" (per id): il gruppo c'era l'ultima volta che si è guardato? */
  cleared: Record<string, boolean>;
  /** Gli id degli eventi "una sola volta" che sono già scattati. */
  fired: string[];
}

export const emptyEvents = (): EventState => ({ defs: [], variables: {}, revivals: [], delayed: [], entered: [], messages: [], notices: [], checks: [], pieceChanges: [], doorsOpened: [], interacted: [], cleared: {}, fired: [] });

/** Un evento "una sola volta" che è già scattato non parte più. */
const spent = (state: GameState, e: AdventureEvent): boolean => !!e.once && !!state.events.fired?.includes(e.id);

/** Gli eventi "interagisci" ancora disponibili su questa pedina (nessuno se ci si è già interagito, o se l'evento "una sola volta" è già scattato). */
export function interactionsOn(state: GameState, pieceId: string): Extract<EventTrigger, { kind: 'interact' }>[] {
  if (state.events.interacted?.includes(pieceId)) return [];
  const inactive = !!state.pieces.find((p) => p.id === pieceId)?.inactive;
  // Un innesco "solo finché il nemico è inattivo" sparisce (con il "?" e la voce del menu) quando il nemico si attiva.
  return state.events.defs.flatMap((e) => (spent(state, e) ? [] : triggersOf(e).flatMap((t) => (t.kind === 'interact' && t.pieceId === pieceId && (!t.onlyInactive || inactive) ? [t] : []))));
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
  /** Il nemico dell'evento (sconfitto, o con cui si interagisce): `$this` negli effetti. */
  thisId?: string;
  /** L'evento che sta girando (una prova se lo ricorda). */
  eventId?: string;
}

const same = (a: EventTrigger, b: EventTrigger, round: number): boolean => {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'defeated' || a.kind === 'interact') return a.pieceId === (b as typeof a).pieceId;
  if (a.kind === 'pickedUp') return a.markerId === (b as typeof a).markerId;
  if (a.kind === 'encounterUsed') return a.markerId === (b as typeof a).markerId;
  if (a.kind === 'zoneUsed') return a.zoneId === (b as typeof a).zoneId;
  if (a.kind === 'zoneEntered') return a.zoneId === (b as typeof a).zoneId && (!!a.everyStep || !!(b as typeof a).fromOutside);
  if (a.kind === 'cleared' || a.kind === 'encountersGone') return false; // scatta solo da `checkCleared`, guardando com'è la mappa
  if (a.kind === 'evilTurnEnd' || a.kind === 'evilTurnStart') return a.round === undefined || a.round === round;
  return a.area === (b as { area: string }).area;
};

const TARGETED = ['activate', 'removePiece', 'modifyMonster', 'finishRevival', 'makeVulnerable', 'removeImmunity', 'setLook', 'setBehavior', 'heal'];

/** I nemici su cui un effetto con bersagli può ancora agire adesso (`$this` è il nemico dell'evento). */
function liveTargets(state: GameState, effect: Extract<EventEffect, { pieceId: string }>, thisId?: string): string[] {
  return targetsOf(effect)
    .map((id) => (id === THIS_PIECE ? thisId : id))
    .filter((id): id is string => {
      if (!id) return false;
      const piece = state.pieces.find((p) => p.id === id);
      if (effect.kind === 'activate') return !!piece?.inactive; // un nemico già attivo non ha niente da attivare
      if (effect.kind === 'makeVulnerable') return !!piece?.invincible;
      if (effect.kind === 'setBehavior') return !!piece && !sameBehavior(piece.behavior, effect.behavior); // già con quel comportamento: niente da cambiare
      if (effect.kind === 'setLook') return !!piece && piece.look !== effect.look; // già con quell'aspetto: niente da cambiare
      if (effect.kind === 'removeImmunity') return !!piece?.immune?.includes(effect.immunity);
      if (effect.kind === 'finishRevival') return state.events.revivals.some((r) => r.piece.id === id);
      if (effect.kind === 'modifyMonster') return !!piece || state.events.revivals.some((r) => r.piece.id === id);
      return !!piece;
    });
}

/**
 * Un evento fatto solo di messaggi ed effetti con bersagli (attiva, rimuovi, modifica, chiudi il ritorno in vita) a cui non è rimasto nessun bersaglio si conclude da solo, senza
 * nemmeno il messaggio. Se ha anche altri effetti (Conquista, variabili, porte, prove, vittoria) invece va avanti: ogni effetto con bersaglio senza bersaglio non fa niente.
 */
function nothingToDo(state: GameState, effects: EventEffect[], thisId?: string): boolean {
  const targeted = effects.filter((e): e is Extract<EventEffect, { pieceId: string }> => TARGETED.includes(e.kind));
  if (!targeted.length || !effects.every((e) => e.kind === 'message' || TARGETED.includes(e.kind))) return false;
  return targeted.every((e) => liveTargets(state, e, thisId).length === 0);
}

/** Dove si trova un oggetto: con un eroe, con un mostro, a terra (un segnalino non raccolto) o da nessuna parte (`none`). */
export function itemLocation(state: GameState, itemId: string): 'hero' | 'monster' | 'ground' | 'none' {
  if (state.pieces.some((p) => p.team === 'hero' && (p.equipped?.includes(itemId) || p.backpack?.includes(itemId)))) return 'hero';
  if (state.pieces.some((p) => p.team === 'monster' && p.equipped?.includes(itemId))) return 'monster';
  if (state.markers.some((m) => m.type === 'item' && m.itemId === itemId && !m.collected)) return 'ground';
  return 'none';
}

/** Una casella libera a caso accanto a una casella di partenza (non le caselle di partenza stesse, che servono agli eroi); se non ce n'è nessuna, la più vicina libera. Null se non ci sono caselle di partenza. */
function spotNearStart(state: GameState): Cell | null {
  const starts = state.startCells ?? [];
  const own = new Set(starts.map((c) => cellKey(c)));
  const around = new Map<string, Cell>();
  for (const s of starts) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const c = { x: s.x + dx, y: s.y + dy };
    if (!own.has(cellKey(c)) && isGroundFree(state, c)) around.set(cellKey(c), c);
  }
  const options = [...around.values()];
  if (options.length) return options[Math.floor(state.random() * options.length)];
  return starts.length ? groundCells(state, starts, starts[0], 1)[0] : null;
}

/** Le condizioni dell'evento valgono adesso? (Senza condizioni sì.) */
const eventHolds = (state: GameState, event: AdventureEvent): boolean => (event.if ?? []).every((c) => (isItemCondition(c) ? (itemLocation(state, c.item) === c.at) !== !!c.not : variableOn(state, c.variable) === c.is));

const runEvent = (state: GameState, event: AdventureEvent, report: EventReport, subject?: Piece): void => {
  if (spent(state, event)) return;
  const holds = eventHolds(state, event);
  const effects = holds ? event.then : (event.else ?? []);
  if (!effects.length) return; // niente da fare: non conta come scatto
  report.eventId = event.id;
  if (event.once) (state.events.fired ??= []).push(event.id);
  if (nothingToDo(state, effects, report.thisId)) return;
  for (const effect of effects) apply(state, effect, report, subject);
};

export function variableOn(state: GameState, name: string): boolean {
  return !!state.events.variables[name];
}

/**
 * Fa scattare gli eventi di questo tipo, nell'ordine in cui sono scritti. `subject` è la pedina sconfitta (per `revive`). Ogni evento sceglie `then` o `else` guardando le variabili
 * come sono in quel momento, quindi un evento può cambiare ciò che vede il successivo.
 */
export function runEvents(state: GameState, trigger: EventTrigger, subject?: Piece, ctx?: Pick<EventReport, 'actor' | 'interaction'>): EventReport {
  const thisId = trigger.kind === 'defeated' || trigger.kind === 'interact' ? trigger.pieceId : undefined;
  const report: EventReport = { revive: null, modified: [], ...ctx, ...(thisId ? { thisId } : {}) };
  for (const event of state.events.defs) {
    if (triggersOf(event).some((t) => same(t, trigger, state.round))) runEvent(state, event, report, subject);
  }
  return report;
}

/** Quanti nemici di questo evento "non c'è più nessuno" ci sono adesso: nella mappa (o nell'area) e, se la lista è scritta, fra quelli scelti. Chi aspetta di tornare in vita conta come presente. */
function presentCount(state: GameState, when: Extract<EventTrigger, { kind: 'cleared' }>): number {
  const chosen = (p: Piece) => p.team === 'monster' && (!when.pieceIds?.length || when.pieceIds.includes(p.id));
  const inArea = (p: Piece) => !when.area || footprint(p).some((c) => state.board?.areaAt(c) === when.area);
  const onMap = state.pieces.filter((p) => !p.city && chosen(p) && inArea(p)).length;
  const waiting = when.area ? 0 : state.events.revivals.filter((r) => chosen(r.piece)).length + (state.events.delayed ?? []).filter(chosen).length;
  return onMap + waiting;
}

/** Quanti segnalini Incontro di questo innesco ci sono ancora: quelli scelti (senza lista, tutti), in quell'area se c'è. */
function encountersLeft(state: GameState, when: Extract<EventTrigger, { kind: 'encountersGone' }>): number {
  const board = state.board;
  if (!board) return 0;
  return board.markers.filter((m) => m.type === 'encounter' && !m.collected && (!when.markerIds?.length || (!!m.id && when.markerIds.includes(m.id))) && (!when.area || board.areaAt({ x: m.x, y: m.y }) === when.area)).length;
}

/** Quanti ce ne sono adesso per un innesco "non c'è più nessuno" (nemici) o "gli incontri non ci sono più" (segnalini). */
const presentFor = (state: GameState, t: EventTrigger): number | null => (t.kind === 'cleared' ? presentCount(state, t) : t.kind === 'encountersGone' ? encountersLeft(state, t) : null);

/** All'inizio della partita (appena la mappa è pronta): ricorda quali eventi "non c'è più nessuno" hanno qualcuno da aspettare, così non scattano per un gruppo che non c'è mai stato. */
export function armCleared(state: GameState): void {
  const ev = state.events;
  const seen = (ev.cleared ??= {});
  for (const e of ev.defs) triggersOf(e).forEach((t, i) => {
    const key = clearedKey(e, i);
    const n = presentFor(state, t);
    if (n !== null && seen[key] === undefined) seen[key] = n > 0;
  });
}

/** La chiave con cui si ricorda se il gruppo di un innesco "non c'è più nessuno" c'era: l'id dell'evento, e per gli inneschi aggiuntivi anche la posizione. */
const clearedKey = (e: AdventureEvent, index: number): string => (index === 0 ? e.id : `${e.id}#${index}`);

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
      let trips = false;
      triggersOf(event).forEach((t, i) => {
        const n = presentFor(state, t);
        if (n === null) return;
        const key = clearedKey(event, i);
        const here = n > 0;
        const was = seen[key];
        seen[key] = here;
        if (was && !here) trips = true;
      });
      if (trips) {
        runEvent(state, event, report);
        fired = true;
      }
    }
    if (!fired) break;
  }
  return report;
}

/** I nemici su cui agisce l'effetto, con $this sostituito dal nemico dell'evento (se non c'è, viene tolto). */
const targetIds = (effect: { pieceId: string; pieceIds?: string[] }, report: EventReport): string[] =>
  targetsOf(effect).flatMap((id) => (id === THIS_PIECE ? (report.thisId ? [report.thisId] : []) : [id]));

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
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id) ?? ev.revivals.find((r) => r.piece.id === id)?.piece;
        if (!piece) continue;
        piece.maxWounds = Math.max(1, piece.maxWounds + (effect.wounds ?? 0));
        piece.wounds = Math.max(1, Math.min(piece.maxWounds, piece.wounds + (effect.wounds ?? 0)));
        piece.speed = Math.max(1, piece.speed + (effect.speed ?? 0));
        piece.armor = Math.max(0, piece.armor + (effect.armor ?? 0));
        if (!report.modified.includes(piece)) report.modified.push(piece);
        ev.pieceChanges.push({ piece, kind: 'modified' }); // anche i "Quando" che non restituiscono il report (baule, area, oggetto raccolto): la scena ridisegna la pedina
      }
      return;
    }
    case 'revive':
      if (subject && !report.revive) report.revive = { turns: Math.max(1, effect.turns), distance: Math.max(0, effect.distance) };
      return;
    case 'finishRevival': {
      for (const id of targetIds(effect, report)) {
        const i = ev.revivals.findIndex((r) => r.piece.id === id);
        if (i < 0) continue;
        const [pending] = ev.revivals.splice(i, 1);
        const again = runEvents(state, { kind: 'defeated', pieceId: pending.piece.id }, pending.piece);
        if (again.revive) ev.revivals.push({ ...pending, turns: again.revive.turns, distance: again.revive.distance });
        else ev.notices.push(...settleRemoval(state, pending.piece).lines);
      }
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
        noEnergy: !!effect.noEnergy,
        onSuccess: copy(effect.onSuccess),
        onFail: copy(effect.onFail),
        heroId: report.actor ?? state.activeId,
        ...(report.thisId ? { thisId: report.thisId } : {}),
        ...(report.eventId ? { eventId: report.eventId } : {}),
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
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece?.inactive) continue;
        piece.inactive = undefined;
        ev.pieceChanges.push({ piece, kind: 'activated' });
      }
      return;
    }
    case 'makeVulnerable': {
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece?.invincible) continue;
        piece.invincible = undefined;
        ev.pieceChanges.push({ piece, kind: 'modified' });
      }
      return;
    }
    case 'setLook': {
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece || piece.look === effect.look) continue;
        const from = piece.look;
        piece.look = effect.look;
        ev.pieceChanges.push({ piece, kind: 'restyled', from });
      }
      return;
    }
    case 'setBehavior': {
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece || sameBehavior(piece.behavior, effect.behavior)) continue;
        piece.behavior = effect.behavior ? { ...effect.behavior } : undefined;
        ev.pieceChanges.push({ piece, kind: 'modified' });
      }
      return;
    }
    case 'give': {
      const hero = state.pieces.find((p) => p.id === (report.actor ?? state.activeId));
      const reward = effect.reward;
      if (reward.kind === 'item' && hero) handItem(state, hero, reward.itemId);
      else ev.notices.push(...collectLoot(state, [reward], hero));
      return;
    }
    case 'giveChosen':
      (ev.pendingGifts ??= []).push(effect.itemId);
      return;
    case 'removeObstacles': {
      const board = state.board;
      if (!board) return;
      const gone = state.obstacles.filter((o) => (effect.obstacle === 'all' || o.type === effect.obstacle) && obstacleCells(o).some((c) => board.areaAt(c) === effect.area));
      if (!gone.length) return;
      for (const o of gone) {
        state.obstacles.splice(state.obstacles.indexOf(o), 1);
        (ev.removedObstacles ??= []).push({ obstacle: o, seen: state.exploration.obstacles.has(o) });
        state.exploration.obstacles.delete(o);
      }
      ev.groundItems = true; // la scena ridisegna la mappa (e fa svanire gli ostacoli tolti)
      return;
    }
    case 'enterPiece': {
      const i = (ev.delayed ??= []).findIndex((p) => p.id === effect.pieceId);
      if (i < 0) return;
      const piece = ev.delayed[i];
      const board = state.board;
      const marker = effect.markerId ? state.markers.find((m): m is Encounter => m.type === 'encounter' && m.id === effect.markerId && !m.collected) : undefined;
      if (marker) {
        piece.cell = { x: marker.x, y: marker.y };
        marker.collected = true; // il segnalino lascia il posto alla pedina
        board?.removeMarker(marker);
        ev.groundItems = true;
      }
      const overlaps = (p: Piece) => !p.city && footprint(p).some((c) => footprint(piece).some((f) => f.x === c.x && f.y === c.y));
      if (board) {
        // Un eroe che si trova dove compare il nemico (anche su una sola delle sue caselle) si sposta sulla casella libera più vicina, fuori dalla sagoma.
        for (const hero of state.pieces.filter((p) => p.team === 'hero' && overlaps(p))) {
          const out = freeCellAround(state, board, piece, hero.cell);
          if (!out) continue;
          hero.cell = out;
          ev.notices.push(tr('{name} è sbalzato su una casella vicina', { name: hero.name }));
          ev.pieceChanges.push({ piece: hero, kind: 'modified' }); // la scena ridisegna la pedina nella nuova casella
        }
        // Se resta qualcun altro sotto di lui (un altro nemico, o nessun posto per l'eroe), è il nuovo arrivato a spostarsi.
        if (state.pieces.some(overlaps)) piece.cell = freeAdjacentCell(state, board, piece.cell) ?? piece.cell;
      }
      ev.delayed.splice(i, 1);
      state.pieces.push(piece);
      (ev.entered ??= []).push(piece);
      return;
    }
    case 'moveItem': {
      const marker = state.markers.find((m) => m.type === 'item' && m.id === effect.markerId && !m.collected);
      const spot = marker ? spotNearStart(state) : null;
      if (!marker || !spot) return;
      marker.x = spot.x;
      marker.y = spot.y;
      ev.groundItems = true;
      return;
    }
    case 'placeItem': {
      const spot = spotNearStart(state);
      if (!spot) return;
      state.markers.push({ type: 'item', itemId: effect.itemId, x: spot.x, y: spot.y });
      ev.groundItems = true;
      return;
    }
    case 'removeImmunity': {
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece?.immune?.includes(effect.immunity)) continue;
        piece.immune = piece.immune.filter((x) => x !== effect.immunity); // solo quella voce: le altre immunità della carta restano
        ev.pieceChanges.push({ piece, kind: 'modified' });
      }
      return;
    }
    case 'heal': {
      for (const id of targetIds(effect, report)) {
        const piece = state.pieces.find((p) => p.id === id);
        if (!piece || piece.wounds >= piece.maxWounds) continue;
        piece.wounds = Math.min(piece.maxWounds, piece.wounds + Math.max(0, effect.amount));
        ev.pieceChanges.push({ piece, kind: 'modified' });
      }
      return;
    }
    case 'setStairs': {
      const end = state.markers.find((m): m is Stairs => m.type === 'stairs' && m.x === effect.x && m.y === effect.y);
      if (!end) return;
      const collapsed = effect.state === 'collapsed';
      const pair = state.markers.filter((m): m is Stairs => m.type === 'stairs' && m.link === end.link);
      if (pair.every((m) => !!m.collapsed === collapsed)) return; // già così
      for (const stairs of pair) {
        stairs.collapsed = collapsed || undefined;
        if (!collapsed || stairs.leaves === 'none') continue; // senza ostacolo al posto non c'è nessuno da spostare
        // Chi stava sulla scala si ritrova su una casella vicina libera.
        for (const hero of state.pieces.filter((p) => p.team === 'hero' && !p.city && p.cell.x === stairs.x && p.cell.y === stairs.y)) {
          const out = state.board ? freeAdjacentCell(state, state.board, hero.cell) : null;
          if (!out) continue;
          hero.cell = out;
          ev.notices.push(tr('{name} è sbalzato su una casella vicina', { name: hero.name }));
        }
      }
      ev.groundItems = true;
      ev.notices.push(collapsed ? tr('La scalinata crolla') : tr('Una scalinata compare'));
      return;
    }
    case 'setGlyph': {
      const glyph = state.markers.find((m): m is Glyph => m.type === 'glyph' && m.x === effect.x && m.y === effect.y);
      if (!glyph) return;
      // Un glifo gemello fa la stessa cosa del suo compagno.
      const pair = glyph.twin ? state.markers.filter((m): m is Glyph => m.type === 'glyph' && m.twin === glyph.twin) : [glyph];
      for (const g of pair) {
        g.active = effect.state === 'on';
        g.sealed = effect.state === 'blocked' || undefined;
      }
      ev.groundItems = true;
      if (effect.state === 'blocked') ev.notices.push(tr('Il glifo si sigilla'));
      return;
    }
    case 'setZone': {
      const zone = (state.zones ?? []).find((z) => z.id === effect.zoneId);
      if (zone) zone.off = effect.state === 'off' || undefined;
      return;
    }
    case 'levelItem': {
      const n = state.addItemLevel(effect.itemId, effect.amount ?? 1);
      const def = state.items.get(effect.itemId);
      if (n === null || !def) return;
      ev.itemsChanged = true;
      ev.notices.push(def.levelLabel ? tr('{name} cresce: {label} {level}/{max}', { name: def.name, label: catalogText(def.levelLabel), level: n, max: def.levelMax ?? n }) : tr('{name} cresce', { name: def.name }));
      return;
    }
    case 'killActor':
      {
        const id = report.actor ?? (state.phase === 'heroes' ? state.activeId : null); // senza un eroe che l'ha causato, quello di turno
        if (id) (ev.killHeroes ??= []).push(id);
      }
      return;
    case 'endHeroesTurn':
      if (state.phase === 'heroes' && state.status === 'playing') ev.endHeroesTurn = true; // fuori dal turno degli eroi non c'è niente da finire
      return;
    case 'permadeath':
      if (!!ev.permadeath !== effect.on) ev.notices.push(effect.on ? tr('Da ora la morte degli eroi è permanente') : tr('La morte degli eroi non è più permanente'));
      ev.permadeath = effect.on;
      return;
    case 'removePiece': {
      for (const id of targetIds(effect, report)) {
        const i = state.pieces.findIndex((p) => p.id === id);
        if (i < 0) continue;
        const [piece] = state.pieces.splice(i, 1);
        ev.pieceChanges.push({ piece, kind: 'removed' });
      }
      return;
    }
    case 'hatred': {
      const o = state.evil;
      const before = o.hatred;
      o.hatred = Math.max(0, o.hatred + effect.amount);
      if (o.hatred !== before) ev.notices.push(o.hatred > before ? tr('Il Maligno guadagna {n} Odio', { n: Math.abs(o.hatred - before) }) : tr('Il Maligno perde {n} Odio', { n: Math.abs(o.hatred - before) }));
      return;
    }
    case 'drawCard': {
      const n = drawEvilCards(state, Math.max(1, effect.count ?? 1));
      if (n > 0) ev.notices.push(n === 1 ? tr('Il Maligno pesca 1 carta') : tr('Il Maligno pesca {n} carte', { n }));
      return;
    }
    case 'addEnding':
      state.addEnding(effect.text ?? '', effect.points ?? 0);
      return;
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

/** La prova è stata giocata: con almeno `needs` scintille valgono gli effetti di `onSuccess`, altrimenti quelli di `onFail`. Restituisce l'esito e ciò che gli effetti hanno cambiato. */
export function resolveCheck(state: GameState, check: PendingCheck, sparks: number): { success: boolean; report: EventReport } {
  const success = sparks >= check.needs;
  const report: EventReport = { revive: null, modified: [], ...(check.heroId ? { actor: check.heroId } : {}), ...(check.thisId ? { thisId: check.thisId } : {}) };
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
  if (check.eventId) state.events.fired = (state.events.fired ?? []).filter((id) => id !== check.eventId); // un evento "una sola volta" a cui si è rinunciato non è scattato davvero
  return state.pieces.find((p) => p.id === it.pieceId);
}

/** Mette da parte una pedina sconfitta che deve tornare in vita. */
export function scheduleRevival(state: GameState, piece: Piece, revive: { turns: number; distance: number }): void {
  state.events.revivals.push({ piece, turns: revive.turns, distance: revive.distance, ...(state.phase === 'evil' ? { skipNext: true } : {}) });
}

/** La pedina sconfitta che aspetta di tornare in vita ha ancora il diritto di contare come viva (per l'obiettivo "sconfiggi"). */
export function isWaitingToRevive(state: GameState, pieceId: string): boolean {
  return state.events.revivals.some((r) => r.piece.id === pieceId) || (state.events.delayed ?? []).some((p) => p.id === pieceId); // chi entra più tardi non è ancora in gioco: non conta come sconfitto
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
    return board.isWalkable(c) && revealed && !occupied.has(cellKey(c)) && !board.obstacleAt(c) && (!marker || !['glyph', 'chest', 'stairs', 'encounter'].includes(marker.type));
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
 * Fine di un turno del Maligno: chi aspetta di tornare in vita perde un turno; a zero riappare a piena salute (senza stati) nella casella scelta da `revivalCell`
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

// --- Zone d'azione ---

/**
 * Cosa farebbe adesso un uso della zona: `then` se almeno un evento "usa una zona" per quella zona ha le condizioni valide (e ha effetti "Allora"), `else` se non c'è nessun `then` ma almeno
 * un evento ha un ramo "Altrimenti", `none` se non farebbe niente (la voce del menu non compare). Una zona disattivata non fa niente.
 */
export function zoneOutcome(state: GameState, zone: Zone): 'then' | 'else' | 'none' {
  if (zone.off) return 'none';
  let result: 'then' | 'else' | 'none' = 'none';
  for (const e of state.events.defs) {
    if (spent(state, e) || !triggersOf(e).some((t) => t.kind === 'zoneUsed' && t.zoneId === zone.id)) continue;
    if (eventHolds(state, e)) {
      if (e.then.length) return 'then';
    } else if (e.else?.length) result = 'else';
  }
  return result;
}

/** Quanto costa usare la zona adesso: il suo costo se scatta un "Allora", niente se scatta solo l'"Altrimenti" (un messaggio di aiuto non si paga). */
export const zoneCost = (state: GameState, zone: Zone): number => (zoneOutcome(state, zone) === 'then' ? (zone.cost ?? 0) : 0);

/**
 * Le zone che `piece` può usare adesso: un evento "usa una zona" farebbe qualcosa (vedi `zoneOutcome`) e una loro casella è quella dell'eroe o gli è adiacente (senza un muro in mezzo). Solo gli eroi.
 */
export function usableZones(state: GameState, board: Board, piece: Piece): Zone[] {
  if (piece.team !== 'hero') return [];
  return (state.zones ?? []).filter(
    (z) => zoneOutcome(state, z) !== 'none' && z.cells.some((c) => (c.x === piece.cell.x && c.y === piece.cell.y) || board.canStep(piece.cell, c)),
  );
}

/** L'eroe usa la zona (il costo lo paga chi chiama): scattano gli eventi. La zona non si consuma: resta usabile finché un evento non la disattiva. */
export function runZoneUsed(state: GameState, zone: Zone, hero: Piece): EventReport {
  return runEvents(state, { kind: 'zoneUsed', zoneId: zone.id }, undefined, { actor: hero.id });
}

/** Un eroe è appena entrato in `to` venendo da `from`: scattano gli eventi delle zone attive in cui è entrato (da fuori, o a ogni passo se l'evento lo chiede). */
export function runZonesEntered(state: GameState, hero: Piece, from: Cell, to: Cell): void {
  const inside = (z: Zone, c: Cell) => z.cells.some((k) => k.x === c.x && k.y === c.y);
  for (const zone of state.zones ?? []) {
    if (zone.off || !inside(zone, to)) continue;
    runEvents(state, { kind: 'zoneEntered', zoneId: zone.id, fromOutside: !inside(zone, from) }, undefined, { actor: hero.id });
  }
}

/**
 * Consegna un oggetto a un eroe (da un evento): lo riceve se ha posto (un oggetto maledetto si autoequipaggia), altrimenti l'oggetto non si perde: cade a terra nella sua casella, o in una vicina
 * libera se lì c'è già qualcosa (una scala, un glifo…), dove lo può raccogliere. Le notizie vanno in `events.notices`.
 */
export function handItem(state: GameState, hero: Piece, itemId: string): void {
  const ev = state.events;
  if (!canReceiveItem(state, hero, itemId)) {
    const [spot] = groundCells(state, footprint(hero), hero.cell, 1, hero);
    state.markers.push({ type: 'item', itemId, x: spot.x, y: spot.y });
    ev.groundItems = true;
    ev.notices.push(tr('{item}: {name} non ha posto, cade a terra', { item: state.items.get(itemId)?.name ?? tr('Un oggetto'), name: hero.name }));
  } else ev.notices.push(...collectLoot(state, [{ kind: 'item', itemId }], hero));
}
