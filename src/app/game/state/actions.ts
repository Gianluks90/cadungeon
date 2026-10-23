import { Board, Cell, cellKey } from '../board/board';
import { Door, RuneColor } from '../board/door';
import { doorAction } from '../board/door-rules';
import { Marker } from '../board/marker';
import { Reach, reachable } from '../board/movement';
import { ADVANCE_ATTACKS, CHEST_OPEN_COST, FIGHT_ATTACKS, PIT_FALL_WOUNDS, RUN_SPEED_MULTIPLIER, STAIRS_MOVE_COST } from '../constants';
import { Reveal } from '../exploration';
import { MarkerEvent, collectLoot, enterCell } from '../markers/marker-rules';
import { HeroAction, Piece } from '../pieces/piece';
import { GameState } from './game-state';

/**
 * Le azioni di gioco come funzioni sullo stato: niente Pixi, niente animazioni, niente messaggi. Ognuna controlla le regole,
 * modifica lo stato e dice com'è andata; chi la chiama (la scena, un giocatore remoto, lo script dell'Overlord) decide come
 * mostrarlo. Sono le stesse per tutti: sarà l'host a eseguirle.
 * `board` sono le regole della mappa, costruite dallo stato e dai tile.
 */

/** Com'è andato l'uso di una porta. `cost` sono i punti movimento spesi (o che servirebbero, per 'cost'). */
export interface DoorResult {
  code: 'opened' | 'closed' | 'unlocked' | 'picked' | 'far' | 'cost' | 'busy' | 'needs-key' | 'needs-rune';
  cost: number;
  /** Il colore della chiave runica che serve, se `code` è 'needs-rune'. */
  color?: RuneColor;
}

/** Com'è andata l'apertura di uno scrigno. `found` è una frase per ogni premio, già dato al gruppo. */
export interface ChestResult {
  code: 'opened' | 'already' | 'cost' | 'busy' | 'none';
  cost: number;
  found?: string[];
}

/** Cosa è successo con un passo: la pedina è caduta in una buca, e/o ha toccato un segnalino. */
export interface StepOutcome {
  fell: boolean;
  marker: MarkerEvent | null;
}

/**
 * Usa la porta `index` con `piece`: serve una casella adiacente e abbastanza punti movimento, e per una porta bloccata
 * la chiave giusta (o scassinarla, se si può).
 */
export function useDoor(state: GameState, board: Board, piece: Piece, index: number): DoorResult {
  if (!canAct(state, piece)) return { code: 'busy', cost: 0 };
  if (!board.isAdjacentToDoor(piece.cell, index)) return { code: 'far', cost: 0 };
  const door = board.doors[index].door;
  const action = doorAction(door, state.party);
  if (action.kind === 'denied') return { code: action.needs === 'rune' ? 'needs-rune' : 'needs-key', cost: 0, color: action.color };
  if (piece.points < action.cost) return { code: 'cost', cost: action.cost };

  if (action.kind === 'unlock' || action.kind === 'pick') door.unlocked = true;
  board.toggleDoor(index, piece.cell);
  spendPoints(piece, action.cost);
  const code = action.kind === 'open' ? 'opened' : action.kind === 'close' ? 'closed' : action.kind === 'unlock' ? 'unlocked' : 'picked';
  return { code, cost: action.cost };
}

/**
 * `piece` apre lo scrigno su cui sta (non uno vicino): costa CHEST_OPEN_COST punti movimento. Un altro personaggio
 * nella stessa casella non c'è mai, perché due pedine non possono fermarsi sulla stessa casella. I premi vanno al gruppo.
 */
export function openChest(state: GameState, board: Board, piece: Piece): ChestResult {
  if (!canAct(state, piece)) return { code: 'busy', cost: 0 };
  const chest = board.markerAt(piece.cell);
  if (chest?.type !== 'chest') return { code: 'none', cost: 0 };
  if (chest.open) return { code: 'already', cost: 0 };
  if (piece.points < CHEST_OPEN_COST) return { code: 'cost', cost: CHEST_OPEN_COST };
  chest.open = true;
  spendPoints(piece, CHEST_OPEN_COST);
  return { code: 'opened', cost: CHEST_OPEN_COST, found: collectLoot(state, chest.contents ?? []) };
}

/**
 * `piece` compie un passo del percorso (`step`: dove arriva e quanto costa). Se entra in una buca cade (ferita che
 * l'armatura non riduce); un eroe che entra in una casella può accendere un glifo o raccogliere un oggetto.
 */
export function applyStep(state: GameState, board: Board, piece: Piece, step: Reach): StepOutcome {
  piece.cell = step.cell;
  spendPoints(piece, step.stepCost); // un passo costa 1, un salto o un'uscita da una buca di più
  let fell = false;
  if (step.kind !== 'climb' && board.isPit(piece.cell)) {
    piece.wounds = Math.max(0, piece.wounds - PIT_FALL_WOUNDS);
    fell = true;
  }
  return { fell, marker: enterCell(board, piece, state) };
}

/** Ricalcola cosa vede il gruppo e annota ciò che è nuovo. Restituisce le novità. */
export function explore(state: GameState, board: Board): Reveal {
  return state.exploration.update(board, state.pieces);
}

/** Dove può andare `piece` adesso, e verso quali glifi può viaggiare. */
export interface ReachResult {
  reach: Map<string, Reach>;
  travelTargets: Set<Marker>;
}

/**
 * Le caselle che `piece` può raggiungere, contando che i nemici bloccano.
 * `knownMarkers` sono i segnalini che gli eroi conoscono (null = tutti, per chi costruisce la mappa): si viaggia solo
 * verso glifi già scoperti. Su un glifo acceso si può viaggiare verso gli altri glifi accesi, scoperti e senza pedine
 * sopra, spendendo tutti i punti rimasti. Solo gli eroi viaggiano e usano le scale.
 */
export function reachFor(state: GameState, board: Board, piece: Piece, knownMarkers: ReadonlySet<Marker> | null): ReachResult {
  if (!canAct(state, piece)) return { reach: new Map(), travelTargets: new Set() };
  const enemies = new Set(state.pieces.filter((p) => p.team !== piece.team).map((p) => cellKey(p.cell)));
  const here = board.markerAt(piece.cell);
  const onActiveGlyph = here?.type === 'glyph' && here.active && piece.team === 'hero';
  const occupied = (c: Cell) => state.pieces.some((p) => p.cell.x === c.x && p.cell.y === c.y);
  const targets = onActiveGlyph && piece.points >= 1
    ? board.markers.filter(
        (m) =>
          m.type === 'glyph' && m.active && !(m.x === piece.cell.x && m.y === piece.cell.y) &&
          (!knownMarkers || knownMarkers.has(m)) && !occupied({ x: m.x, y: m.y }),
      )
    : [];
  const stairs = piece.team === 'hero' ? board.stairsLinks() : undefined;
  return {
    reach: reachable(board, piece.cell, piece.points, enemies, targets.map((m) => ({ x: m.x, y: m.y })), stairs),
    travelTargets: new Set(targets),
  };
}

// --- Turno e azioni dell'eroe (docs/REGOLE.md, sezioni 1 e 2) ---

/** Punti movimento che l'azione dà in un turno. */
export function movementBudget(piece: Piece, action: HeroAction = piece.action): number {
  return action === 'run' ? piece.speed * RUN_SPEED_MULTIPLIER : action === 'fight' ? 0 : piece.speed;
}

/** Attacchi che l'azione dà in un turno. */
export function attackBudget(action: HeroAction): number {
  return action === 'run' ? 0 : action === 'fight' ? FIGHT_ATTACKS : ADVANCE_ATTACKS;
}

/** Può agire adesso? Serve la partita in corso, il turno degli eroi e un eroe che non abbia ancora passato. */
export function canAct(state: GameState, piece: Piece): boolean {
  return state.status === 'playing' && state.phase === 'heroes' && piece.team === 'hero' && !piece.done;
}

/** Spende punti movimento (anche per aprire porte e scrigni): si ricorda quanto, per sapere se si può cambiare azione. */
export function spendPoints(piece: Piece, amount: number): void {
  piece.points -= amount;
  piece.pointsUsed += amount;
}

/** Spende un attacco. (Il combattimento non c'è ancora: lo useranno gli attacchi.) */
export function spendAttack(piece: Piece): void {
  piece.attacks -= 1;
  piece.attacksUsed += 1;
}

export type ActionChange = { ok: true; action: HeroAction } | { ok: false; reason: 'attacked' | 'moved' | 'turn' };

/**
 * Sceglie Correre o Combattere; ripetere lo stesso comando riporta ad Avanzare. Ogni azione cambia le due scorte
 * (punti movimento e attacchi) e annulla l'altra. Si può cambiare solo se non si è già speso più di quanto la nuova
 * azione dà: non si corre dopo aver attaccato, non si combatte dopo aver mosso.
 */
export function setAction(state: GameState, piece: Piece, requested: 'run' | 'fight'): ActionChange {
  if (!canAct(state, piece)) return { ok: false, reason: 'turn' };
  const next: HeroAction = piece.action === requested ? 'advance' : requested;
  const points = movementBudget(piece, next) - piece.pointsUsed;
  const attacks = attackBudget(next) - piece.attacksUsed;
  if (points < 0) return { ok: false, reason: 'moved' };
  if (attacks < 0) return { ok: false, reason: 'attacked' };
  piece.action = next;
  piece.points = points;
  piece.attacks = attacks;
  return { ok: true, action: next };
}

/** Com'è andato un passaggio di turno. */
export interface PassResult {
  /** L'eroe che agisce adesso (null se non ce ne sono). */
  nextActive: string | null;
  /** Tutti gli eroi hanno agito, l'Overlord ha giocato ed è cominciato un nuovo round. */
  roundStarted: boolean;
}

/**
 * L'eroe ha finito il suo turno. Se ce n'è un altro che non ha agito, tocca a lui (l'ordine è libero: poi si può
 * scegliere un altro con selectHero). Se hanno agito tutti, tocca all'Overlord e poi comincia un nuovo round.
 */
export function passTurn(state: GameState, piece: Piece): PassResult | null {
  if (!canAct(state, piece)) return null;
  piece.done = true;
  const next = state.pieces.find((p) => p.team === 'hero' && !p.done);
  if (next) {
    state.activeId = next.id;
    return { nextActive: next.id, roundStarted: false };
  }
  state.phase = 'overlord';
  overlordTurn(state);
  startRound(state);
  return { nextActive: state.activeId, roundStarted: true };
}

/** Il turno dell'Overlord. Per ora non fa nulla: lo script arriverà più avanti, con le stesse azioni dei giocatori. */
function overlordTurn(_state: GameState): void {}

/** Inizia un nuovo round: tutti ricaricano le scorte, Avanzare è di nuovo l'azione di partenza, tocca agli eroi. */
export function startRound(state: GameState): void {
  for (const p of state.pieces) {
    p.action = 'advance';
    p.points = p.speed;
    p.attacks = ADVANCE_ATTACKS;
    p.pointsUsed = 0;
    p.attacksUsed = 0;
    p.done = false;
  }
  state.round++;
  state.phase = 'heroes';
  state.activeId = state.pieces.find((p) => p.team === 'hero')?.id ?? null;
}

/** Sceglie l'eroe che agisce. Restituisce false se non è un eroe o ha già passato. */
export function selectHero(state: GameState, id: string): boolean {
  const piece = state.pieces.find((p) => p.id === id);
  if (!piece || !canAct(state, piece)) return false;
  state.activeId = id;
  return true;
}

// --- Azioni disponibili adesso (per il bottone contestuale) ---

/** Un'azione che l'eroe può fare dove si trova, e se è possibile adesso. */
export interface ContextAction {
  /** 'door:<numero>', 'chest' o 'stairs'. */
  id: string;
  kind: 'door' | 'chest' | 'stairs';
  /** Il nome dell'icona (public/icons/). */
  icon: string;
  label: string;
  /** Punti movimento che costa. */
  cost: number;
  enabled: boolean;
  /** Se non è possibile, perché. */
  reason?: string;
  doorIndex?: number;
}

const RUNE_NAMES: Record<RuneColor, string> = { red: 'rossa', blue: 'blu', green: 'verde' };

/**
 * Le azioni che `piece` può provare adesso, dove si trova: le porte accanto a lui (se già viste: `seenDoors`, null = tutte),
 * lo scrigno chiuso su cui sta, la scala su cui sta. Quelle impossibili restano nell'elenco, con il motivo.
 * (Il viaggio da glifo a glifo si sceglie ancora cliccando la destinazione.)
 */
export function contextActions(state: GameState, board: Board, piece: Piece, seenDoors: ReadonlySet<Door> | null): ContextAction[] {
  if (!canAct(state, piece)) return [];
  const out: ContextAction[] = [];
  const costReason = (cost: number) => (piece.points < cost ? `Servono ${cost} punti movimento` : undefined);

  board.doors.forEach((rd, index) => {
    if (!board.isAdjacentToDoor(piece.cell, index) || (seenDoors && !seenDoors.has(rd.door))) return;
    const action = doorAction(rd.door, state.party);
    const base = { id: `door:${index}`, kind: 'door' as const, doorIndex: index };
    if (action.kind === 'denied') {
      const reason = action.needs === 'rune' ? `Serve la chiave runica ${RUNE_NAMES[action.color!]}` : 'Serve la chiave giusta';
      out.push({ ...base, icon: 'lock', label: 'Porta chiusa a chiave', cost: 0, enabled: false, reason });
      return;
    }
    const reason = costReason(action.cost);
    const [icon, label] = {
      open: ['door_front', 'Apri la porta'], close: ['door_front', 'Chiudi la porta'],
      unlock: ['lock_open', 'Apri con la chiave'], pick: ['lock_open', 'Scassina la serratura'],
    }[action.kind];
    out.push({ ...base, icon, label, cost: action.cost, enabled: !reason, reason });
  });

  const here = board.markerAt(piece.cell);
  if (here?.type === 'chest' && !here.open) {
    const reason = costReason(CHEST_OPEN_COST);
    out.push({ id: 'chest', kind: 'chest', icon: 'inventory_2', label: 'Apri lo scrigno', cost: CHEST_OPEN_COST, enabled: !reason, reason });
  }

  const partner = piece.team === 'hero' ? board.stairsPartnerAt(piece.cell) : undefined;
  if (partner) {
    const taken = state.pieces.some((p) => p.cell.x === partner.x && p.cell.y === partner.y);
    const reason = taken ? "L'altro capo è occupato" : costReason(STAIRS_MOVE_COST);
    out.push({ id: 'stairs', kind: 'stairs', icon: 'stairs', label: 'Usa le scale', cost: STAIRS_MOVE_COST, enabled: !reason, reason });
  }
  return out;
}
