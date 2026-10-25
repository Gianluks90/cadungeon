import { Board, Cell, cellKey } from '../board/board';
import { Door, RuneColor } from '../board/door';
import { doorAction } from '../board/door-rules';
import { ChestTier, Marker, PotionKind } from '../board/marker';
import { Reach, reachable } from '../board/movement';
import {
  ADVANCE_ATTACKS, BACKPACK_LIMIT, CHEST_OPEN_COST, ITEM_GIVE_COST, REEQUIP_COST, TREASURE_SELL_COINS, FIGHT_ATTACKS, PIT_FALL_WOUNDS, POTION_DRINK_COST, POTION_GIVE_COST, POTION_HEAL, POTION_LIMIT, RUN_SPEED_MULTIPLIER,
  STAIRS_MOVE_COST,
} from '../constants';
import { Reveal } from '../exploration';
import { MarkerEvent, POTION_NAMES, collectLoot, enterCell } from '../markers/marker-rules';
import { ItemDef, cappedSpeed, conflictsWith, fitsEquipment, itemDetail, itemsToDisplace, totalArmor } from '../items/item';
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
  if (!canActOnMap(state, piece)) return { code: 'busy', cost: 0 };
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
  if (!canActOnMap(state, piece)) return { code: 'busy', cost: 0 };
  const chest = board.markerAt(piece.cell);
  if (chest?.type !== 'chest') return { code: 'none', cost: 0 };
  if (chest.open) return { code: 'already', cost: 0 };
  if (piece.points < CHEST_OPEN_COST) return { code: 'cost', cost: CHEST_OPEN_COST };
  chest.open = true;
  spendPoints(piece, CHEST_OPEN_COST);
  const found = collectLoot(state, chest.contents ?? []);
  if (chest.random !== false) found.push(...drawTreasures(state, chest.tier));
  return { code: 'opened', cost: CHEST_OPEN_COST, found };
}

/**
 * Il bottino casuale di uno scrigno: ogni eroe pesca una carta dal mazzo del tipo dello scrigno. La tiene (equipaggiata se ci sta, altrimenti
 * nello zaino); se non ha posto la scarta subito per monete (250, 500 o 750 secondo il mazzo). Un mazzo vuoto non dà niente.
 */
function drawTreasures(state: GameState, tier: ChestTier): string[] {
  const lines: string[] = [];
  for (const hero of state.pieces) {
    if (hero.team !== 'hero') continue;
    const id = state.decks[tier].shift();
    const item = id ? state.items.get(id) : undefined;
    if (!id || !item) continue;
    const where = receiveItem(state, hero, id);
    if (where === 'none') {
      hero.coins += TREASURE_SELL_COINS[tier];
      lines.push(`${hero.name}: ${item.name} scartata per ${TREASURE_SELL_COINS[tier]} monete`);
    } else lines.push(`${hero.name}: ${item.name} (${where === 'equipped' ? 'equipaggiata' : 'nello zaino'})`);
  }
  return lines;
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
  if (!canActOnMap(state, piece)) return { reach: new Map(), travelTargets: new Set() };
  const enemies = new Set(state.pieces.filter((p) => p.team !== piece.team && onMap(p)).map((p) => cellKey(p.cell)));
  const here = board.markerAt(piece.cell);
  const onActiveGlyph = here?.type === 'glyph' && here.active && piece.team === 'hero';
  const occupied = (c: Cell) => state.pieces.some((p) => onMap(p) && p.cell.x === c.x && p.cell.y === c.y);
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
export function movementBudget(state: GameState, piece: Piece, action: HeroAction = piece.action): number {
  const speed = speedOf(state, piece);
  return action === 'run' ? speed * RUN_SPEED_MULTIPLIER : action === 'fight' ? 0 : speed;
}

/** La velocità effettiva: quella dell'eroe, con i limiti degli oggetti equipaggiati (la cotta di maglia la porta a 4). */
export function speedOf(state: GameState, piece: Piece): number {
  return cappedSpeed(piece.speed, equippedDefs(state, piece));
}

/** L'armatura effettiva: quella dell'eroe più quella degli oggetti equipaggiati. */
export function armorOf(state: GameState, piece: Piece): number {
  return totalArmor(piece.armor, equippedDefs(state, piece));
}

/** Attacchi che l'azione dà in un turno. */
export function attackBudget(action: HeroAction): number {
  return action === 'run' ? 0 : action === 'fight' ? FIGHT_ATTACKS : ADVANCE_ATTACKS;
}

/** Può agire adesso? Serve la partita in corso, il turno degli eroi e un eroe che non abbia ancora passato. */
export function canAct(state: GameState, piece: Piece): boolean {
  return state.status === 'playing' && state.phase === 'heroes' && piece.team === 'hero' && !piece.done;
}

/** La pedina è sulla mappa (non in città)? */
export function onMap(piece: Piece): boolean {
  return !piece.city;
}

/** Può fare azioni sulla mappa (muoversi, usare porte e scrigni, correre e combattere)? Serve il suo turno e non essere in città. */
export function canActOnMap(state: GameState, piece: Piece): boolean {
  return canAct(state, piece) && onMap(piece);
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
  if (!canActOnMap(state, piece)) return { ok: false, reason: 'turn' };
  const next: HeroAction = piece.action === requested ? 'advance' : requested;
  const points = movementBudget(state, piece, next) - piece.pointsUsed;
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
  if (piece.city?.service) piece.city.visited = true; // aver scelto un servizio e passare chiude la visita: poi si deve tornare
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
    p.points = speedOf(state, p);
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
  /** 'door:<numero>', 'chest', 'stairs', 'drink:<tipo>', 'give:<eroe>:<tipo>' o 'giveitem:<eroe>:<oggetto>' o 'city'. */
  id: string;
  kind: 'door' | 'chest' | 'stairs' | 'potion' | 'item' | 'city';
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

const POTION_KINDS: readonly PotionKind[] = ['heal', 'vital'];

const RUNE_NAMES: Record<RuneColor, string> = { red: 'rossa', blue: 'blu', green: 'verde' };

/**
 * Le azioni che `piece` può provare adesso, dove si trova: le porte accanto a lui (se già viste: `seenDoors`, null = tutte),
 * lo scrigno chiuso su cui sta, la scala su cui sta. Quelle impossibili restano nell'elenco, con il motivo.
 * (Il viaggio da glifo a glifo si sceglie ancora cliccando la destinazione.)
 */
export function contextActions(state: GameState, board: Board, piece: Piece, seenDoors: ReadonlySet<Door> | null): ContextAction[] {
  if (!canActOnMap(state, piece)) return [];
  const out: ContextAction[] = [];
  const costReason = (cost: number) => (piece.points < cost ? `Servono {mov:${cost}}` : undefined);

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

  // Su un glifo acceso si può viaggiare in città: costa tutto il movimento (almeno 1).
  if (here?.type === 'glyph' && here.active && piece.team === 'hero') {
    const reason = piece.points < 1 ? 'Serve almeno {mov:1}' : undefined;
    out.push({ id: 'city', kind: 'city', icon: 'castle', label: 'Viaggia in città (tutto il movimento)', cost: piece.points, enabled: !reason, reason });
  }

  const partner = piece.team === 'hero' ? board.stairsPartnerAt(piece.cell) : undefined;
  if (partner) {
    const taken = state.pieces.some((p) => onMap(p) && p.cell.x === partner.x && p.cell.y === partner.y);
    const reason = taken ? "L'altro capo è occupato" : costReason(STAIRS_MOVE_COST);
    out.push({ id: 'stairs', kind: 'stairs', icon: 'stairs', label: 'Usa le scale', cost: STAIRS_MOVE_COST, enabled: !reason, reason });
  }

  // Le pozioni che porta: berle, o darle a un eroe adiacente.
  if (piece.team === 'hero') {
    for (const kind of POTION_KINDS) {
      if (!piece.potions.includes(kind)) continue;
      const reason =
        kind === 'vital' ? 'La fatica non è ancora in gioco' : piece.wounds >= piece.maxWounds ? 'Sei già in piena salute' : costReason(POTION_DRINK_COST);
      out.push({ id: `drink:${kind}`, kind: 'potion', icon: 'tokens/potion', label: `Bevi: ${POTION_NAMES[kind].toLowerCase()}`, cost: POTION_DRINK_COST, enabled: !reason, reason });
    }
    for (const other of adjacentHeroes(state, board, piece)) {
      for (const kind of POTION_KINDS) {
        if (!piece.potions.includes(kind)) continue;
        const reason = !canCarryPotion(other) ? `${other.name} porta già ${POTION_LIMIT} pozioni` : costReason(POTION_GIVE_COST);
        out.push({ id: `give:${other.id}:${kind}`, kind: 'potion', icon: 'tokens/potion', label: `Dai a ${other.name}: ${POTION_NAMES[kind].toLowerCase()}`, cost: POTION_GIVE_COST, enabled: !reason, reason });
      }
      for (const id of [...piece.equipped, ...piece.backpack]) {
        const item = state.items.get(id);
        if (!item) continue;
        const reason = !canReceiveItem(state, other, id) ? `${other.name} non ha posto` : costReason(ITEM_GIVE_COST);
        out.push({ id: `giveitem:${other.id}:${id}`, kind: 'item', icon: item.icon ?? 'inventory_2', label: `Dai a ${other.name}: ${item.name.toLowerCase()}`, cost: ITEM_GIVE_COST, enabled: !reason, reason });
      }
    }
  }
  return out;
}

// --- Pozioni (docs/REGOLE.md): ogni eroe ne porta fino a POTION_LIMIT, le beve o le dà a un eroe adiacente ---

/** Può portare un'altra pozione? */
export function canCarryPotion(piece: Piece): boolean {
  return piece.potions.length < POTION_LIMIT;
}

/** Gli altri eroi vicini a `piece` (anche in diagonale, se in mezzo non c'è un muro). */
export function adjacentHeroes(state: GameState, board: Board, piece: Piece): Piece[] {
  return state.pieces.filter((p) => p.team === 'hero' && p.id !== piece.id && onMap(p) && board.canStep(piece.cell, p.cell));
}

export interface DrinkResult {
  code: 'drunk' | 'full-health' | 'vital' | 'none' | 'cost' | 'busy';
  /** Le ferite recuperate, se ha bevuto. */
  healed?: number;
}

/**
 * `piece` beve una pozione di quel tipo: costa POTION_DRINK_COST punti movimento. La curativa ridà POTION_HEAL ferite (mai oltre il massimo,
 * e non si beve se si è in piena salute). La pozione di vitalità si porta ma non si beve ancora: la fatica non è in gioco.
 */
export function drinkPotion(state: GameState, piece: Piece, kind: PotionKind): DrinkResult {
  if (!canAct(state, piece)) return { code: 'busy' };
  const i = piece.potions.indexOf(kind);
  if (i < 0) return { code: 'none' };
  if (kind === 'vital') return { code: 'vital' };
  if (piece.wounds >= piece.maxWounds) return { code: 'full-health' };
  if (piece.points < POTION_DRINK_COST) return { code: 'cost' };
  piece.potions.splice(i, 1);
  const healed = Math.min(POTION_HEAL, piece.maxWounds - piece.wounds);
  piece.wounds += healed;
  spendPoints(piece, POTION_DRINK_COST);
  return { code: 'drunk', healed };
}

export interface GiveResult {
  code: 'given' | 'far' | 'full' | 'none' | 'cost' | 'busy';
}

/** `giver` dà una pozione di quel tipo a `receiverId`, un eroe adiacente: costa POTION_GIVE_COST punti movimento, e chi riceve deve avere posto. */
export function givePotion(state: GameState, board: Board, giver: Piece, receiverId: string, kind: PotionKind): GiveResult {
  if (!canAct(state, giver)) return { code: 'busy' };
  const receiver = adjacentHeroes(state, board, giver).find((p) => p.id === receiverId);
  if (!receiver) return { code: 'far' };
  const i = giver.potions.indexOf(kind);
  if (i < 0) return { code: 'none' };
  if (!canCarryPotion(receiver)) return { code: 'full' };
  if (giver.points < POTION_GIVE_COST) return { code: 'cost' };
  giver.potions.splice(i, 1);
  receiver.potions.push(kind);
  spendPoints(giver, POTION_GIVE_COST);
  return { code: 'given' };
}

// --- Equipaggiamento (docs/REGOLE.md, sezione 3c) ---

/** Gli oggetti equipaggiati di un eroe, con la loro carta. */
function equippedDefs(state: GameState, piece: Piece): ItemDef[] {
  return piece.equipped.flatMap((id) => state.items.get(id) ?? []);
}

/** `piece` può ricevere questo oggetto (equipaggiandolo, o nello zaino)? */
export function canReceiveItem(state: GameState, piece: Piece, id: string): boolean {
  const item = state.items.get(id);
  if (!item) return false;
  return fitsEquipment(equippedDefs(state, piece), item) || piece.backpack.length < BACKPACK_LIMIT;
}

/** `piece` riceve un oggetto (da uno scrigno o da un compagno): lo equipaggia se ci sta, altrimenti lo mette nello zaino se c'è posto. */
export function receiveItem(state: GameState, piece: Piece, id: string): 'equipped' | 'backpack' | 'none' {
  const item = state.items.get(id);
  if (!item) return 'none';
  if (fitsEquipment(equippedDefs(state, piece), item)) {
    piece.equipped.push(id);
    return 'equipped';
  }
  if (piece.backpack.length < BACKPACK_LIMIT) {
    piece.backpack.push(id);
    return 'backpack';
  }
  return 'none';
}

export interface ItemResult {
  code: 'ok' | 'busy' | 'none' | 'cost' | 'full' | 'far' | 'conflict';
}

/** Controlla se si può equipaggiare un oggetto dello zaino: quali oggetti equipaggiati dovrebbero fare posto, e se nello zaino c'è posto per loro. */
function checkEquip(state: GameState, piece: Piece, id: string): { code: ItemResult['code']; displaced: string[] } {
  if (!canAct(state, piece)) return { code: 'busy', displaced: [] };
  const item = state.items.get(id);
  if (!item || !piece.backpack.includes(id)) return { code: 'none', displaced: [] };
  const eq = equippedDefs(state, piece);
  if (conflictsWith(eq, item)) return { code: 'conflict', displaced: [] };
  const out = fitsEquipment(eq, item) ? [] : itemsToDisplace(eq, item);
  if (!out || piece.backpack.length - 1 + out.length > BACKPACK_LIMIT) return { code: 'full', displaced: [] };
  if (piece.points < REEQUIP_COST) return { code: 'cost', displaced: [] };
  return { code: 'ok', displaced: out.map((d) => d.id) };
}

/** Equipaggia un oggetto dello zaino (ri-equipaggiarsi: REEQUIP_COST punti movimento). Chi occupa il posto va nello zaino. */
export function equipItem(state: GameState, piece: Piece, id: string): ItemResult {
  const check = checkEquip(state, piece, id);
  if (check.code !== 'ok') return { code: check.code };
  piece.backpack.splice(piece.backpack.indexOf(id), 1);
  for (const out of check.displaced) {
    piece.equipped.splice(piece.equipped.indexOf(out), 1);
    piece.backpack.push(out);
  }
  piece.equipped.push(id);
  spendPoints(piece, REEQUIP_COST);
  return { code: 'ok' };
}

/** Controlla se si può mettere nello zaino un oggetto equipaggiato. */
function checkStow(state: GameState, piece: Piece, id: string): ItemResult['code'] {
  if (!canAct(state, piece)) return 'busy';
  if (!piece.equipped.includes(id)) return 'none';
  if (piece.backpack.length >= BACKPACK_LIMIT) return 'full';
  if (piece.points < REEQUIP_COST) return 'cost';
  return 'ok';
}

/** Mette nello zaino un oggetto equipaggiato (ri-equipaggiarsi: REEQUIP_COST punti movimento). */
export function stowItem(state: GameState, piece: Piece, id: string): ItemResult {
  const code = checkStow(state, piece, id);
  if (code !== 'ok') return { code };
  piece.equipped.splice(piece.equipped.indexOf(id), 1);
  piece.backpack.push(id);
  spendPoints(piece, REEQUIP_COST);
  return { code: 'ok' };
}

/** Scarta un oggetto (equipaggiato o nello zaino): non costa niente e l'oggetto è perso. */
export function dropItem(state: GameState, piece: Piece, id: string): ItemResult {
  if (!canAct(state, piece)) return { code: 'busy' };
  for (const list of [piece.equipped, piece.backpack]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      return { code: 'ok' };
    }
  }
  return { code: 'none' };
}

/** `giver` dà un oggetto a un eroe adiacente: costa ITEM_GIVE_COST punti movimento; chi riceve lo equipaggia se ci sta, altrimenti lo mette nello zaino. */
export function giveItem(state: GameState, board: Board, giver: Piece, receiverId: string, id: string): ItemResult {
  if (!canAct(state, giver)) return { code: 'busy' };
  const receiver = adjacentHeroes(state, board, giver).find((p) => p.id === receiverId);
  if (!receiver) return { code: 'far' };
  const list = giver.equipped.includes(id) ? giver.equipped : giver.backpack.includes(id) ? giver.backpack : null;
  if (!list) return { code: 'none' };
  if (!canReceiveItem(state, receiver, id)) return { code: 'full' };
  if (giver.points < ITEM_GIVE_COST) return { code: 'cost' };
  list.splice(list.indexOf(id), 1);
  receiveItem(state, receiver, id);
  spendPoints(giver, ITEM_GIVE_COST);
  return { code: 'ok' };
}

/** Un oggetto nella scheda di un eroe, con ciò che si può fare: spostarlo (equipaggiare o mettere nello zaino) e, sempre, scartarlo. */
export interface ItemEntry {
  id: string;
  /** La carta intera: per mostrarla nel dettaglio. */
  def: ItemDef;
  name: string;
  icon: string;
  detail: string;
  where: 'equipped' | 'backpack';
  move: { label: string; cost: number; enabled: boolean; reason?: string };
  canDrop: boolean;
}

export interface InventoryView {
  equipped: ItemEntry[];
  backpack: ItemEntry[];
  /** Quanti posti occupano: mani, armature, oggetti vari. */
  hands: number;
  armors: number;
  others: number;
}

const ITEM_REASON: Record<ItemResult['code'], string> = {
  ok: '', busy: 'Ora non puoi', none: '', far: '', full: "Non c'è posto nello zaino", conflict: 'Incompatibile con un oggetto equipaggiato', cost: `Servono {mov:${REEQUIP_COST}}`,
};

/** L'inventario di un eroe com'è oggi, per la scheda completa. */
export function inventoryOf(state: GameState, piece: Piece): InventoryView {
  const entry = (id: string, where: 'equipped' | 'backpack'): ItemEntry | null => {
    const item = state.items.get(id);
    if (!item) return null;
    const code = where === 'backpack' ? checkEquip(state, piece, id).code : checkStow(state, piece, id);
    return {
      id, def: item, name: item.name, icon: item.icon ?? 'inventory_2', detail: itemDetail(item), where,
      move: { label: where === 'backpack' ? 'Equipaggia' : 'Nello zaino', cost: REEQUIP_COST, enabled: code === 'ok', reason: code === 'ok' ? undefined : ITEM_REASON[code] },
      canDrop: canAct(state, piece),
    };
  };
  const eq = equippedDefs(state, piece);
  return {
    equipped: piece.equipped.flatMap((id) => entry(id, 'equipped') ?? []),
    backpack: piece.backpack.flatMap((id) => entry(id, 'backpack') ?? []),
    hands: eq.reduce((n, i) => n + i.hands, 0),
    armors: eq.filter((i) => i.kind === 'armor').length,
    others: eq.filter((i) => i.kind === 'other').length,
  };
}
