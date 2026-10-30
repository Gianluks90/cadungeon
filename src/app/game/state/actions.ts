import { dropCarriedItems, groundCells } from './ground';
import { Board, Cell, cellKey } from '../board/board';
import type { ItemUse } from './item-use';
import { interactionsOn, runEvents, runInteraction, tickRevivals } from './events';
import { ArmedTrap, armTrap, trapAtCell, trapAtChest, trapAtDoor } from './traps';
import { Door, RuneColor } from '../board/door';
import { doorAction } from '../board/door-rules';
import { CHEST_TIER_NAMES, Chest, ChestTier, Marker, PotionKind } from '../board/marker';
import { Reach, reachable } from '../board/movement';
import {
  ADVANCE_ATTACKS, BACKPACK_LIMIT, CHEST_OPEN_COST, INTERACT_COST, ITEM_GIVE_COST, REEQUIP_COST, TREASURE_SELL_COINS, FIGHT_ATTACKS, PIT_FALL_WOUNDS, POTION_DRINK_COST, POTION_GIVE_COST, POTION_HEAL, POTION_LIMIT, RUN_SPEED_MULTIPLIER,
  STAIRS_MOVE_COST, TOAD_SPEED, TOAD_TOKENS,
} from '../constants';
import { Reveal } from '../exploration';
import { MarkerEvent, POTION_NAMES, collectLoot, enterCell, pickupAt, pickupBlocked, pickupName } from '../markers/marker-rules';
import { AttackType, ItemDef, cappedSpeed, movementBonusOf, conflictsWith, fitsEquipment, itemDetail, itemsToDisplace, totalArmor } from '../items/item';
import { HeroAction, HeroOrder, Piece, footprint, occupies } from '../pieces/piece';
import { GameState } from './game-state';
import { effectsOf, hasRule, statBonus } from './effects';
import { clearStatus, healWounds, immuneTo, isGrappled, keywordLevel } from './status';
import { RemovalResult, removeMonster } from './loot';

/**
 * Le azioni di gioco come funzioni sullo stato: niente Pixi, niente animazioni, niente messaggi. Ognuna controlla le regole,
 * modifica lo stato e dice com'è andata; chi la chiama (la scena, un giocatore remoto, lo script dell'Overlord) decide come
 * mostrarlo. Sono le stesse per tutti: sarà l'host a eseguirle.
 * `board` sono le regole della mappa, costruite dallo stato e dai tile.
 */

/** Com'è andato l'uso di una porta. `cost` sono i punti movimento spesi (o che servirebbero, per 'cost'). */
export interface DoorResult {
  code: 'opened' | 'closed' | 'unlocked' | 'picked' | 'far' | 'cost' | 'busy' | 'needs-key' | 'needs-rune' | 'needs-event' | 'blocked';
  cost: number;
  /** Il colore della chiave runica che serve, se `code` è 'needs-rune'. */
  color?: RuneColor;
  /** La trappola armata su questa porta, scattata aprendola (la scena la risolve). */
  trap?: ArmedTrap;
}

/** Com'è andata l'apertura di uno scrigno. `found` è una frase per ogni premio, già dato al gruppo. */
export interface ChestResult {
  code: 'opened' | 'mimic' | 'already' | 'cost' | 'busy' | 'none' | 'full';
  cost: number;
  found?: string[];
  /** La ricompensa della tabella dei ritrovamenti uscita per questo scrigno ("Rame 2"), se l'avventura ne ha una. */
  ticket?: string;
  /** La trappola armata su questo scrigno, scattata aprendolo (la scena la risolve). */
  trap?: ArmedTrap;
}

/** Cosa è successo con un passo: la pedina è caduta in una buca, e/o ha toccato un segnalino. */
export interface StepOutcome {
  fell: boolean;
  /** Il passo è costato la vita a un eroe (vedi `killHero`). */
  died: boolean;
  marker: MarkerEvent | null;
  /** Le creature con Aura che hanno ferito chi è appena entrato accanto a loro (1 ferita che l'armatura non riduce). */
  auraHits: Piece[];
  /** I mostri uccisi da Giustizia divina dell'eroe che è morto in questo passo. */
  slain: Piece[];
  /** Il bottino di un mostro morto per strada (Aura). */
  drop: RemovalResult | null;
  /** La trappola armata su questa casella, scattata dall'ingresso di un eroe (la scena la risolve). */
  trap?: ArmedTrap;
  /** Le porte (numero d'ordine nella mappa) che un mostro ha aperto con questo passo. */
  opened?: number[];
}

/** La creatura che sta in mezzo a una porta aperta (con caselle da una parte e dall'altra) e quindi impedisce di chiuderla, se c'è. */
export function doorBlocker(state: GameState, board: Board, index: number): Piece | undefined {
  const d = board.doors[index];
  for (let u = d.from; u < d.to; u++) {
    const before = d.horizontal ? { x: u, y: d.line - 1 } : { x: d.line - 1, y: u };
    const after = d.horizontal ? { x: u, y: d.line } : { x: d.line, y: u };
    const p = state.pieces.find((q) => onMap(q) && occupies(q, before) && occupies(q, after));
    if (p) return p;
  }
  return undefined;
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
  if (action.kind === 'denied') return { code: action.needs === 'rune' ? 'needs-rune' : action.needs === 'event' ? 'needs-event' : 'needs-key', cost: 0, color: action.color };
  if (action.kind === 'close' && doorBlocker(state, board, index)) return { code: 'blocked', cost: 0 };
  if (piece.points < action.cost) return { code: 'cost', cost: action.cost };

  if (action.kind === 'unlock' || action.kind === 'pick') door.unlocked = true;
  board.toggleDoor(index, piece.cell);
  spendPoints(piece, action.cost);
  const code = action.kind === 'open' ? 'opened' : action.kind === 'close' ? 'closed' : action.kind === 'unlock' ? 'unlocked' : 'picked';
  const trap = piece.team === 'hero' && door.open && (action.kind === 'open' || action.kind === 'unlock' || action.kind === 'pick') ? trapAtDoor(state, door) : null;
  return trap ? { code, cost: action.cost, trap } : { code, cost: action.cost };
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
  assignChestReward(state, chest);
  const isHero = piece.team === 'hero';
  // Un Mimic già armato lascia lo scrigno chiuso comunque; altrimenti, se c'è una reliquia che non ci sta, resta chiuso e non succede niente.
  if (!(isHero && trapAtChest(state, chest)?.card === 'mimic') && chestItemsBlocked(state, piece, chest)) return { code: 'full', cost: 0 };
  // Prima di tutto le Maledizioni: danno Minaccia al Signore supremo, che può spenderla subito per armare una trappola su questo scrigno. Solo dopo gli eroi ricevono il resto.
  const found: string[] = [];
  const curses = (chest.contents ?? []).filter((l) => l.kind === 'curse');
  if (curses.length) {
    chest.contents = (chest.contents ?? []).filter((l) => l.kind !== 'curse'); // risolte una volta sola (anche se lo scrigno è un Mimic che poi muore)
    found.push(...collectLoot(state, curses, piece));
    if (isHero) armTrap(state, board, chest);
  }
  // Mostro mimetico: lo scrigno è vivo. Si pagano i punti, ma non si apre e non dà niente finché il Mimic non muore.
  const mimic = isHero ? trapAtChest(state, chest) : null;
  if (mimic?.card === 'mimic') {
    spendPoints(piece, CHEST_OPEN_COST);
    return { code: 'mimic', cost: CHEST_OPEN_COST, trap: mimic, ...(found.length ? { found } : {}) };
  }
  chest.open = true;
  if (!state.openedTiers.includes(chest.tier)) state.openedTiers.push(chest.tier);
  spendPoints(piece, CHEST_OPEN_COST);
  found.push(...collectLoot(state, chest.contents ?? [], piece));
  const area = board.areaAt(piece.cell);
  if (area && isHero) runEvents(state, { kind: 'chestOpened', area }); // gli eventi "scrigno aperto in quest'area", dopo che il contenuto è andato al gruppo
  if (chest.random !== false) for (let i = 0; i < (chest.treasures ?? 1); i++) found.push(...drawTreasures(state, chest.tier));
  const trap = isHero ? trapAtChest(state, chest) : null;
  const ticket = chest.ticket;
  return trap ? { code: 'opened', cost: CHEST_OPEN_COST, found, ...(ticket ? { ticket } : {}), trap } : { code: 'opened', cost: CHEST_OPEN_COST, found, ...(ticket ? { ticket } : {}) };
}

/**
 * La tabella dei ritrovamenti: la prima volta che si tocca uno scrigno senza un contenuto suo (`contents`) si gira il suo segnalino, cioè si pesca a caso una riga fra quelle non ancora
 * uscite per quel tipo di scrigno, e la ricompensa diventa il suo contenuto. Resta fissa (anche se lo scrigno non si apre perché l'oggetto non ci sta, o se è un Mimic).
 * Se l'avventura non ha righe per quel tipo, o sono finite, lo scrigno resta com'era (solo il tesoro del mazzo).
 */
function assignChestReward(state: GameState, chest: Chest): void {
  if (chest.ticket || (chest.contents && chest.contents.length)) return;
  const index = state.chestDeal[chest.tier].shift();
  const reward = index === undefined ? undefined : state.chestTable[chest.tier]?.[index];
  if (!reward) return;
  chest.contents = reward.contents.map((l) => ({ ...l }));
  chest.random = (reward.treasures ?? 0) > 0;
  chest.treasures = reward.treasures;
  chest.ticket = `${CHEST_TIER_NAMES[chest.tier]} ${(index ?? 0) + 1}`;
}

/** Lo scrigno contiene un oggetto (una reliquia) che chi lo apre non può portare? Allora resta chiuso, perché l'oggetto non vada perso. */
function chestItemsBlocked(state: GameState, piece: Piece, chest: Chest): boolean {
  return (chest.contents ?? []).some((l) => l.kind === 'item' && !canReceiveItem(state, piece, l.itemId));
}

/**
 * Il bottino casuale di uno scrigno: ogni eroe pesca una carta dal mazzo del tipo dello scrigno. La tiene (equipaggiata se ci sta, altrimenti
 * nello zaino); se non ha posto la scarta subito per monete (250, 500 o 750 secondo il mazzo). Un mazzo vuoto non dà niente.
 */
export function drawTreasures(state: GameState, tier: ChestTier): string[] {
  const lines: string[] = [];
  for (const hero of state.pieces) if (hero.team === 'hero') lines.push(...drawTreasureFor(state, hero, tier));
  return lines;
}

/**
 * Un eroe pesca dal mazzo `tier`: la carta, se è un oggetto, la tiene (equipaggiata se ci sta, altrimenti nello zaino) o la scarta per monete se non ha
 * posto. Una carta evento (`instant`) non si tiene: dà subito le sue monete e fa pescare ancora. Un mazzo vuoto non dà niente.
 */
export function drawTreasureFor(state: GameState, hero: Piece, tier: ChestTier): string[] {
  const lines: string[] = [];
  let toDraw = 1;
  for (let guard = 0; toDraw > 0 && guard < 50; guard++) {
    toDraw--;
    const id = state.decks[tier].shift();
    const item = id ? state.items.get(id) : undefined;
    if (!id || !item) break;
    if (item.instant) {
      hero.coins += item.instant.coins ?? 0;
      const potion = item.instant.potion;
      const gotPotion = !!potion && hero.potions.length < POTION_LIMIT && (hero.potions.push(potion), true);
      const gains = [item.instant.coins ? `+${item.instant.coins} monete` : '', gotPotion ? (potion === 'heal' ? '+1 pozione di cura' : '+1 pozione del vigore') : ''].filter(Boolean);
      lines.push(`${hero.name}: ${item.name}${gains.length ? ` (${gains.join(', ')})` : ''}`);
      toDraw += item.instant.draw ?? 0;
      continue;
    }
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
  if (step.stepCost > 0 && piece.order === 'aim') piece.order = null; // chi si sposta perde la Mira
  piece.cell = step.cell;
  if (step.size) piece.size = { ...step.size }; // un mostro grande che si piega (la Salamandra di fuoco) cambia forma
  spendPoints(piece, step.stepCost); // un passo costa 1, un salto o un'uscita da una buca di più
  // Un mostro che ha una porta chiusa davanti la apre prima di passare (il costo è già nel passo).
  const opened: number[] = [];
  for (const rd of step.opens ?? []) {
    const index = board.doors.indexOf(rd);
    if (index >= 0 && !rd.door.open) {
      board.toggleDoor(index, piece.cell);
      opened.push(index);
    }
  }
  let fell = false;
  // Un mostro grande subisce la buca solo se ci finisce interamente dentro. Acrobata attraversa le buche senza conseguenze (ma non ci si ferma: lo garantisce il clic).
  const crossing = step.stepCost > 0 && hasRule(state, piece, 'passThrough');
  if (step.kind !== 'climb' && !crossing && !piece.invincible && footprint(piece).every((c) => board.isPit(c))) {
    piece.wounds = Math.max(0, piece.wounds - PIT_FALL_WOUNDS);
    loseOrdersOnWounds(piece);
    fell = true;
  }
  // Aura: entrare accanto a un nemico con Aura costa 1 ferita (non ridotta dall'armatura), a meno che si sia immuni.
  const auraHits: Piece[] = [];
  if (!immuneTo(state, piece, 'aura')) {
    for (const other of state.pieces) {
      if (other.team === piece.team || other.city || keywordLevel(state, other, 'Aura') < 1) continue;
      if (!footprint(other).some((c) => footprint(piece).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1))) continue;
      piece.wounds = Math.max(0, piece.wounds - 1);
      auraHits.push(other);
    }
  }
  const died = piece.wounds <= 0;
  let slain: Piece[] = [];
  let drop: RemovalResult | null = null;
  if (died) {
    if (piece.team === 'hero') slain = killHero(state, piece);
    else drop = removeMonster(state, piece); // un mostro che muore per strada esce dalla mappa e lascia il suo bottino
  }
  const trap = !died && piece.team === 'hero' ? trapAtCell(state, piece.cell) : null;
  const outcome: StepOutcome = { fell, died, marker: died ? null : enterCell(board, piece, state), auraHits, slain, drop };
  if (trap) outcome.trap = trap;
  if (opened.length) outcome.opened = opened;
  return outcome;
}

/**
 * Un eroe muore (docs/REGOLE.md, sezioni 3d e 8): il gruppo perde Conquista pari al suo valore, lui perde metà del denaro, esce dalla mappa e va in città
 * (la sua pedina non c'è più), con ferite al massimo. Passa il turno da solo (lo fa chi lo chiama); al round dopo rientra su un glifo acceso senza pagare.
 */
export function killHero(state: GameState, piece: Piece): Piece[] {
  // Giustizia divina: quando muore uccide i mostri senza un nome entro 3 spazi (anche gli Immortali). Restituisce quelli uccisi, che la scena fa svanire.
  const slain: Piece[] = [];
  for (const { effect: e } of effectsOf(state, piece)) {
    if (e.kind !== 'trigger' || e.on !== 'death') continue;
    for (const op of (e['do'] as { op: string; range?: number }[]) ?? []) {
      if (op.op !== 'killNearby') continue;
      for (const m of [...state.pieces]) {
        if (m.team !== 'monster' || m.city || m.unique || m.invincible) continue;
        const d = Math.min(...footprint(m).flatMap((c) => footprint(piece).map((h) => Math.max(Math.abs(c.x - h.x), Math.abs(c.y - h.y)))));
        if (d <= (op.range ?? 3)) {
          state.pieces.splice(state.pieces.indexOf(m), 1);
          slain.push(m);
        }
      }
    }
  }
  dropCarriedItems(state, piece); // chi muore lascia a terra ciò che trasporta (la Principessa)
  piece.toad = undefined; // la morte toglie anche la trasformazione
  clearStatus(piece); // alla morte si tolgono tutti gli stati
  piece.wounds = piece.maxWounds;
  piece.coins = Math.floor(piece.coins / 2);
  piece.points = 0;
  piece.attacks = 0;
  piece.city = { from: { ...piece.cell }, service: null, visited: false, arrivedRound: state.round, dead: true };
  state.addProgress(-piece.value);
  return slain;
}

/** Ricalcola cosa vede il gruppo e annota ciò che è nuovo. Restituisce le novità. */
export function explore(state: GameState, board: Board): Reveal {
  const reveal = state.exploration.update(board, state.pieces, state.overlord.gust ? 5 : Infinity);
  for (const area of reveal.areas) runEvents(state, { kind: 'areaRevealed', area }); // gli eventi "area rivelata"
  return reveal;
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
  if (!canActOnMap(state, piece) || isGrappled(state, piece)) return { reach: new Map(), travelTargets: new Set() }; // afferrato: nessun movimento
  const enemies = new Set(state.pieces.filter((p) => p.team !== piece.team && onMap(p)).flatMap((p) => footprint(p).map(cellKey))); // un mostro grande blocca tutte le sue caselle
  const here = board.markerAt(piece.cell);
  const onActiveGlyph = here?.type === 'glyph' && here.active && piece.team === 'hero';
  const occupied = (c: Cell) => state.pieces.some((p) => onMap(p) && occupies(p, c));
  const targets = onActiveGlyph && piece.points >= 1 && !equippedDefs(state, piece).some((d) => d.blocksTravel) // chi porta la Principessa non viaggia da un glifo all'altro
    ? board.markers.filter(
        (m) =>
          m.type === 'glyph' && m.active && !(m.x === piece.cell.x && m.y === piece.cell.y) &&
          (!knownMarkers || knownMarkers.has(m)) && !occupied({ x: m.x, y: m.y }),
      )
    : [];
  const stairs = piece.team === 'hero' ? board.stairsLinks() : undefined;
  return {
    reach: reachable(board, piece.cell, piece.points, enemies, targets.map((m) => ({ x: m.x, y: m.y })), stairs, undefined, hasRule(state, piece, 'passThrough')),
    travelTargets: new Set(targets),
  };
}

/** Con Acrobata si attraversano ostacoli e buche ma non ci si ferma: una roccia, l'acqua o una buca non sono "uno spazio libero". Senza Acrobata nessun divieto in più. */
export function stopForbidden(state: GameState, board: Board, piece: Piece, cell: Cell): boolean {
  return hasRule(state, piece, 'passThrough') && (board.blocksMovement(cell) || board.isPit(cell));
}

// --- Turno e azioni dell'eroe (docs/REGOLE.md, sezioni 1 e 2) ---

/** Punti movimento che l'azione dà in un turno. */
export function movementBudget(state: GameState, piece: Piece, action: HeroAction = piece.action): number {
  const speed = speedOf(state, piece);
  const bonus = movementBonusOf(equippedDefs(state, piece));
  if (action === 'rest') return 0; // il Riposo rinuncia a muoversi
  return Math.max(0, (action === 'run' ? speed * RUN_SPEED_MULTIPLIER : action === 'fight' ? 0 : speed) + bonus); // un bonus negativo (chi porta la Principessa) non scende sotto 0
}

/** La velocità effettiva: quella dell'eroe, con i limiti degli oggetti equipaggiati (la cotta di maglia la porta a 4). */
export function speedOf(state: GameState, piece: Piece): number {
  if (piece.toad) return TOAD_SPEED; // il rospo si muove di 5 spazi, senza bonus
  // Con "l'armatura non riduce la velocità" (Supportare) i limiti delle armature non contano; i bonus "dopo i limiti" (Veloce) si sommano alla fine.
  const defs = equippedDefs(state, piece);
  const capped = cappedSpeed(piece.speed + statBonus(state, piece, 'speed'), hasRule(state, piece, 'armorNoSpeedPenalty') ? defs.filter((d) => d.kind !== 'armor') : defs);
  return capped + statBonus(state, piece, 'speed', { afterCaps: true });
}

/** L'armatura effettiva: quella dell'eroe più quella degli oggetti equipaggiati e dei bonus delle abilità; `vs` aggiunge quelli che valgono contro un tipo di attacco. */
export function armorOf(state: GameState, piece: Piece, vs?: AttackType): number {
  if (piece.toad) return 0; // il rospo non ha armatura
  return totalArmor(piece.armor, equippedDefs(state, piece)) + statBonus(state, piece, 'armor', { vs }) + (piece.tempArmor ?? 0);
}

/** Attacchi che l'azione dà in un turno. */
export function attackBudget(action: HeroAction): number {
  return action === 'run' || action === 'rest' ? 0 : action === 'fight' ? FIGHT_ATTACKS : ADVANCE_ATTACKS; // Prepararsi: come Avanzare, ma o ci si muove o si attacca (vedi `spendPoints`)
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
  if ((piece.stunned || piece.action === 'prepare') && amount > 0) piece.attacks = 0; // stordito o in preparazione: o ci si muove o si attacca
  piece.points -= amount;
  piece.pointsUsed += amount;
}

/** Spende un attacco. (Il combattimento non c'è ancora: lo useranno gli attacchi.) */
export function spendAttack(piece: Piece): void {
  piece.attacks -= 1;
  piece.attacksUsed += 1;
}

export type ActionChange = { ok: true; action: HeroAction } | { ok: false; reason: 'attacked' | 'moved' | 'turn' | 'stunned' | 'toad' | 'ordered' };

/**
 * Sceglie Correre o Combattere; ripetere lo stesso comando riporta ad Avanzare. Ogni azione cambia le due scorte
 * (punti movimento e attacchi) e annulla l'altra. Si può cambiare solo se non si è già speso più di quanto la nuova
 * azione dà: non si corre dopo aver attaccato, non si combatte dopo aver mosso.
 */
export function setAction(state: GameState, piece: Piece, requested: 'run' | 'fight' | 'rest' | 'prepare'): ActionChange {
  if (!canActOnMap(state, piece)) return { ok: false, reason: 'turn' };
  if (piece.toad) return { ok: false, reason: 'toad' }; // il rospo non ha azioni di movimento né di combattimento
  if (piece.stunned) return { ok: false, reason: 'stunned' }; // stordito: solo muoversi o attaccare
  if (piece.orderPlaced && (requested !== 'prepare' || piece.action === 'prepare')) return { ok: false, reason: 'ordered' }; // l'ordine è piazzato: Prepararsi non si cambia più
  const next: HeroAction = piece.action === requested ? 'advance' : requested;
  let points = movementBudget(state, piece, next) - piece.pointsUsed;
  let attacks = attackBudget(next) - piece.attacksUsed;
  // Prepararsi: o ci si muove o si attacca, non tutti e due.
  if (next === 'prepare') {
    if (piece.pointsUsed > 0) attacks = 0;
    if (piece.attacksUsed > 0) points = 0;
  }
  if (points < 0) return { ok: false, reason: 'moved' };
  if (attacks < 0) return { ok: false, reason: 'attacked' };
  piece.action = next;
  piece.points = points;
  piece.attacks = attacks;
  return { ok: true, action: next };
}

/** Com'è andato il piazzamento di un ordine. */
export type OrderChange = { ok: true; order: HeroOrder } | { ok: false; reason: 'turn' | 'action' | 'has' };

/**
 * Piazza un ordine (Mira, Schivata o Guardia): solo con l'azione Prepararsi, e uno solo alla volta (finché il primo non è usato o perso non se ne piazza un altro).
 * Il Riposo è un'azione a sé del gioco e non è fra questi.
 */
export function placeOrder(state: GameState, piece: Piece, order: HeroOrder): OrderChange {
  if (!canActOnMap(state, piece) || piece.toad) return { ok: false, reason: 'turn' };
  if (piece.action !== 'prepare') return { ok: false, reason: 'action' };
  if (piece.order) return { ok: false, reason: 'has' };
  piece.order = order;
  piece.orderPlaced = true;
  return { ok: true, order };
}

/** Subire ferite fa perdere la Mira e la Guardia (la Schivata resta fino all'inizio del turno dopo). */
export function loseOrdersOnWounds(piece: Piece): void {
  if (piece.order === 'aim' || piece.order === 'guard') piece.order = null;
}

/** Com'è andata la spesa di fatica per un punto movimento. */
export interface FatigueMoveResult {
  code: 'ok' | 'none' | 'busy' | 'blocked';
}

/** Spende 1 fatica per 1 punto movimento in più: si può in qualunque momento del turno, anche scegliendo Combattere, quante volte si vuole. */
export function fatigueForMovement(state: GameState, piece: Piece): FatigueMoveResult {
  if (!canActOnMap(state, piece)) return { code: 'busy' };
  if (piece.webbed || isGrappled(state, piece)) return { code: 'blocked' }; // la rete e la Presa tolgono ogni movimento
  if (piece.fatigue < 1) return { code: 'none' };
  piece.fatigue -= 1;
  piece.points += 1;
  return { code: 'ok' };
}

/** Com'è andato un passaggio di turno. */
export interface PassResult {
  /** L'eroe che agisce adesso (null se non ce ne sono). */
  nextActive: string | null;
  /** È cominciato un nuovo round (l'Overlord ha già giocato). */
  roundStarted: boolean;
  /** L'eroe era un rospo e con questo turno è tornato normale. */
  toadEnded?: boolean;
  /** Tutti gli eroi hanno agito: tocca all'Overlord, che gioca con il suo script (`state/overlord.ts`) e poi chiama `endOverlordTurn`. */
  overlord?: boolean;
}

/**
 * L'eroe ha finito il suo turno. Se ce n'è un altro che non ha agito, tocca a lui (l'ordine è libero: poi si può
 * scegliere un altro con selectHero). Se hanno agito tutti, tocca all'Overlord e poi comincia un nuovo round.
 */
export function passTurn(state: GameState, piece: Piece): PassResult | null {
  if (!canAct(state, piece)) return null;
  if (piece.city?.service) piece.city.visited = true; // aver scelto un servizio e passare chiude la visita: poi si deve tornare
  piece.done = true;
  // Rospo: a fine turno si scarta un segnalino (non in quello della trasformazione); scartato l'ultimo si torna normali.
  let toadEnded = false;
  if (piece.toad) {
    if (piece.toad.fresh) piece.toad.fresh = false;
    else if (--piece.toad.tokens <= 0) {
      piece.toad = undefined;
      toadEnded = true;
    }
  }
  const next = state.pieces.find((p) => p.team === 'hero' && !p.done);
  if (next) {
    state.activeId = next.id;
    return { nextActive: next.id, roundStarted: false, ...(toadEnded ? { toadEnded } : {}) };
  }
  state.phase = 'overlord';
  return { nextActive: null, roundStarted: false, overlord: true, ...(toadEnded ? { toadEnded } : {}) };
}

/** Finito il turno dell'Overlord (lo gioca la scena, un mostro alla volta) comincia un nuovo round. */
export function endOverlordTurn(state: GameState): Piece[] {
  const revived = tickRevivals(state); // chi aspettava di tornare in vita perde un turno, e a zero riappare
  startRound(state);
  return revived;
}

/** Inizia un nuovo round: tutti ricaricano le scorte, Avanzare è di nuovo l'azione di partenza, tocca agli eroi. */
export function startRound(state: GameState): void {
  for (const p of state.pieces) {
    // Chi ha riposato (senza subire ferite) riparte con la fatica al massimo.
    if (p.team === 'hero' && p.action === 'rest' && !p.hurtWhileResting) p.fatigue = p.maxFatigue;
    p.hurtWhileResting = false;
    p.action = 'advance';
    p.points = Math.max(0, speedOf(state, p) + (p.toad ? 0 : movementBonusOf(equippedDefs(state, p))));
    p.attacks = p.toad ? 0 : ADVANCE_ATTACKS + (p.team === 'monster' && keywordLevel(state, p, 'Colpo veloce') > 0 ? 1 : 0); // Colpo veloce: due attacchi per attivazione
    p.pointsUsed = 0;
    p.attacksUsed = 0;
    p.done = false;
    p.stunned = false;
    p.webbed = false;
    p.usedSkills = [];
    p.orderPlaced = false;
    p.exhausted = [];
    p.attackTypesUsed = [];
    if (p.order === 'dodge' || p.order === 'guard') p.order = null; // la Schivata e la Guardia durano fino all'inizio del turno dopo; la Mira resta finché non si usa o si perde
    p.lastAttack = null;
    p.lastKill = null;
    p.lockedWeapon = null;
    p.tempArmor = 0;
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
  /** 'door:<numero>', 'chest', 'pickup', 'stairs', 'drink:<tipo>', 'give:<eroe>:<tipo>' o 'giveitem:<eroe>:<oggetto>' o 'city' o 'interact:<pedina>'. */
  id: string;
  kind: 'door' | 'chest' | 'stairs' | 'potion' | 'item' | 'city' | 'attack' | 'interact' | 'pickup' | 'encounter';
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
      const reason = action.needs === 'rune' ? `Serve la chiave runica ${RUNE_NAMES[action.color!]}` : action.needs === 'event' ? 'La porta è sigillata: si aprirà quando succederà qualcosa' : 'Serve la chiave giusta';
      out.push({ ...base, icon: 'lock', label: action.needs === 'event' ? 'Porta sigillata' : 'Porta chiusa a chiave', cost: 0, enabled: false, reason });
      return;
    }
    const reason = (action.kind === 'close' && doorBlocker(state, board, index) ? "Una creatura grande è nel varco: non si chiude" : undefined) ?? costReason(action.cost);
    const [icon, label] = {
      open: ['door_front', 'Apri la porta'], close: ['door_front', 'Chiudi la porta'],
      unlock: ['lock_open', 'Apri con la chiave'], pick: ['lock_open', 'Scassina la serratura'],
    }[action.kind];
    out.push({ ...base, icon, label, cost: action.cost, enabled: !reason, reason });
  });

  const here = board.markerAt(piece.cell);
  if (here?.type === 'chest' && !here.open) {
    const reason = costReason(CHEST_OPEN_COST) ?? (chestItemsBlocked(state, piece, here) ? 'Non hai posto per ciò che contiene' : undefined);
    out.push({ id: 'chest', kind: 'chest', icon: 'inventory_2', label: 'Apri lo scrigno', cost: CHEST_OPEN_COST, enabled: !reason, reason });
  }

  // Un oggetto a terra nella sua casella: raccoglierlo è un'azione, senza costo (così un eroe può anche lasciarlo lì).
  const loot = piece.team === 'hero' ? pickupAt(board, piece) : null;
  if (loot) {
    const reason = pickupBlocked(state, piece, loot) ?? undefined;
    const icon = loot.type === 'item' ? state.items.get(loot.itemId)?.icon ?? 'inventory_2' : { potion: 'tokens/potion', coins: 'tokens/gold_pile', key: 'tokens/little_key', rune: 'tokens/rune_key' }[loot.type];
    out.push({ id: 'pickup', kind: 'pickup', icon, label: `Raccogli: ${pickupName(state, loot).toLowerCase()}`, cost: 0, enabled: !reason, reason });
  }

  // Un segnalino Incontro nella sua casella: l'azione la sceglie l'autore ("Suona la campana"), con il suo costo.
  if (here?.type === 'encounter' && !here.collected && piece.team === 'hero') {
    const cost = here.cost ?? 0;
    const reason = costReason(cost);
    out.push({ id: 'encounter', kind: 'encounter', icon: 'lightning_stand', label: here.label?.trim() || 'Usa', cost, enabled: !reason, reason });
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

  // Le pedine con cui può interagire (evento "interagisce"): una voce "?" per ognuna, se è adiacente.
  if (piece.team === 'hero') {
    for (const target of interactablePieces(state, board, piece)) {
      const cost = interactCost(state, target.id);
      const reason = costReason(cost);
      out.push({ id: `interact:${target.id}`, kind: 'interact', icon: 'help', label: `Interagisci con ${target.name}`, cost, enabled: !reason, reason });
    }
  }

  // Le pozioni che porta: berle, o darle a un eroe adiacente.
  if (piece.team === 'hero') {
    for (const kind of POTION_KINDS) {
      if (!piece.potions.includes(kind)) continue;
      const reason =
        kind === 'vital' ? (piece.fatigue >= piece.maxFatigue ? 'Hai già la fatica al massimo' : costReason(POTION_DRINK_COST)) : piece.wounds >= piece.maxWounds ? 'Sei già in piena salute' : costReason(POTION_DRINK_COST);
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

// --- Segnalino Incontro ---

export interface EncounterResult {
  code: 'used' | 'none' | 'cost' | 'busy';
}

/** piece usa il segnalino Incontro della sua casella: paga il costo, il segnalino sparisce dalla mappa e scattano gli eventi "usa un incontro" (poi la scena guarda quelli "non ci sono più" con checkCleared). */
export function useEncounter(state: GameState, board: Board, piece: Piece): EncounterResult {
  if (!canActOnMap(state, piece) || piece.team !== 'hero') return { code: 'busy' };
  const marker = board.markerAt(piece.cell);
  if (marker?.type !== 'encounter' || marker.collected) return { code: 'none' };
  const cost = marker.cost ?? 0;
  if (piece.points < cost) return { code: 'cost' };
  spendPoints(piece, cost);
  marker.collected = true;
  board.removeMarker(marker);
  if (marker.id) runEvents(state, { kind: 'encounterUsed', markerId: marker.id }, undefined, { actor: piece.id });
  return { code: 'used' };
}

// --- Interazione con una pedina (evento `interact`) ---

/** Quanto costa interagire con la pedina: il costo scritto nell'evento (il più basso, se ce n'è più d'uno) o `INTERACT_COST`. */
export function interactCost(state: GameState, pieceId: string): number {
  const costs = interactionsOn(state, pieceId).map((t) => t.cost ?? INTERACT_COST);
  return costs.length ? Math.min(...costs) : INTERACT_COST;
}

/** Le pedine con cui `piece` può interagire adesso: hanno un evento "interagisce" non ancora usato e una loro casella è adiacente (senza un muro in mezzo). */
export function interactablePieces(state: GameState, board: Board, piece: Piece): Piece[] {
  return state.pieces.filter((p) => p.id !== piece.id && onMap(p) && interactionsOn(state, p.id).length > 0 && footprint(p).some((c) => board.canStep(piece.cell, c)));
}

export interface InteractResult {
  code: 'ok' | 'far' | 'cost' | 'busy' | 'none';
  /** Pedine che l'evento ha cambiato (la scena le ridisegna). */
  modified?: Piece[];
}

/** `piece` interagisce con la pedina `targetId`: costa i punti movimento dell'evento, scattano gli eventi e l'interazione sparisce. */
export function interact(state: GameState, board: Board, piece: Piece, targetId: string): InteractResult {
  if (!canActOnMap(state, piece) || piece.team !== 'hero') return { code: 'busy' };
  if (!interactionsOn(state, targetId).length) return { code: 'none' };
  if (!interactablePieces(state, board, piece).some((p) => p.id === targetId)) return { code: 'far' };
  const cost = interactCost(state, targetId);
  if (piece.points < cost) return { code: 'cost' };
  const before = { points: piece.points, pointsUsed: piece.pointsUsed, attacks: piece.attacks };
  spendPoints(piece, cost);
  const report = runInteraction(state, targetId, piece, before);
  return { code: 'ok', ...(report.modified.length ? { modified: report.modified } : {}) };
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
  code: 'drunk' | 'full-health' | 'full-fatigue' | 'none' | 'cost' | 'busy';
  /** Le ferite recuperate, se ha bevuto. */
  healed?: number;
}

/**
 * `piece` beve una pozione di quel tipo: costa POTION_DRINK_COST punti movimento. La curativa ridà POTION_HEAL ferite (mai oltre il massimo,
 * e non si beve se si è in piena salute). La pozione del vigore riporta la fatica al massimo (e non si beve se è già al massimo).
 */
export function drinkPotion(state: GameState, piece: Piece, kind: PotionKind): DrinkResult {
  if (!canAct(state, piece) || piece.toad) return { code: 'busy' };
  const i = piece.potions.indexOf(kind);
  if (i < 0) return { code: 'none' };
  if (kind === 'vital' ? piece.fatigue >= piece.maxFatigue : piece.wounds >= piece.maxWounds) return { code: kind === 'vital' ? 'full-fatigue' : 'full-health' };
  if (piece.points < POTION_DRINK_COST) return { code: 'cost' };
  piece.potions.splice(i, 1);
  spendPoints(piece, POTION_DRINK_COST);
  if (kind === 'vital') {
    piece.fatigue = piece.maxFatigue; // il vigore riporta la fatica al massimo
    return { code: 'drunk', healed: 0 };
  }
  const { healed } = healWounds(piece, POTION_HEAL); // il veleno si cura per primo
  return { code: 'drunk', healed };
}

export interface GiveResult {
  code: 'given' | 'far' | 'full' | 'none' | 'cost' | 'busy';
}

/** `giver` dà una pozione di quel tipo a `receiverId`, un eroe adiacente: costa POTION_GIVE_COST punti movimento, e chi riceve deve avere posto. */
export function givePotion(state: GameState, board: Board, giver: Piece, receiverId: string, kind: PotionKind): GiveResult {
  if (!canAct(state, giver) || giver.toad) return { code: 'busy' };
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
  return fitsEquipment(equippedDefs(state, piece), item) || (!item.carried && piece.backpack.length < BACKPACK_LIMIT); // un oggetto trasportato non va nello zaino
}

/** `piece` riceve un oggetto (da uno scrigno o da un compagno): lo equipaggia se ci sta, altrimenti lo mette nello zaino se c'è posto. */
export function receiveItem(state: GameState, piece: Piece, id: string): 'equipped' | 'backpack' | 'none' {
  const item = state.items.get(id);
  if (!item) return 'none';
  if (fitsEquipment(equippedDefs(state, piece), item)) {
    piece.equipped.push(id);
    return 'equipped';
  }
  if (!item.carried && piece.backpack.length < BACKPACK_LIMIT) {
    piece.backpack.push(id);
    return 'backpack';
  }
  return 'none';
}

export interface ItemResult {
  code: 'ok' | 'busy' | 'none' | 'cost' | 'full' | 'far' | 'conflict' | 'carried';
}

/** Controlla se si può equipaggiare un oggetto dello zaino: quali oggetti equipaggiati dovrebbero fare posto, e se nello zaino c'è posto per loro. */
function checkEquip(state: GameState, piece: Piece, id: string): { code: ItemResult['code']; displaced: string[] } {
  if (!canAct(state, piece) || piece.toad) return { code: 'busy', displaced: [] };
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
  if (piece.order === 'aim') piece.order = null; // cambiare l'equipaggiamento fa perdere la Mira
  return { code: 'ok' };
}

/** Controlla se si può mettere nello zaino un oggetto equipaggiato. */
function checkStow(state: GameState, piece: Piece, id: string): ItemResult['code'] {
  if (!canAct(state, piece)) return 'busy';
  if (!piece.equipped.includes(id)) return 'none';
  if (state.items.get(id)?.carried) return 'carried'; // si porta in braccio: si posa, non va nello zaino
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
  if (piece.order === 'aim') piece.order = null;
  return { code: 'ok' };
}

/** Scarta un oggetto (equipaggiato o nello zaino): non costa niente e l'oggetto è perso. Un oggetto trasportato (la Principessa) non si perde: si posa a terra nella casella (o la più vicina libera) e chiunque lo raggiunge lo può prendere. */
export function dropItem(state: GameState, piece: Piece, id: string): ItemResult {
  if (!canAct(state, piece)) return { code: 'busy' };
  if (state.items.get(id)?.carried) {
    const i = piece.equipped.indexOf(id);
    if (i < 0) return { code: 'none' };
    const [spot] = groundCells(state, footprint(piece), piece.cell, 1, piece);
    piece.equipped.splice(i, 1);
    state.markers.push({ type: 'item', itemId: id, x: spot.x, y: spot.y });
    state.events.groundItems = true;
    return { code: 'ok' };
  }
  for (const list of [piece.equipped, piece.backpack]) {
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      if (piece.order === 'aim') piece.order = null; // cambiare l'equipaggiamento fa perdere la Mira
      return { code: 'ok' };
    }
  }
  return { code: 'none' };
}

/** `giver` dà un oggetto a un eroe adiacente: costa ITEM_GIVE_COST punti movimento; chi riceve lo equipaggia se ci sta, altrimenti lo mette nello zaino. */
export function giveItem(state: GameState, board: Board, giver: Piece, receiverId: string, id: string): ItemResult {
  if (!canAct(state, giver) || giver.toad) return { code: 'busy' };
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
  /** Oggetto trasportato: il bottone dice "Posa" e l'oggetto resta a terra. */
  carried: boolean;
  /** Se l'oggetto si può usare (Cura minore, Cristallo di Tival...): il costo, e se si può adesso (lo aggiunge chi costruisce la scheda, con `itemUse`). */
  use?: ItemUse;
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
  ok: '', busy: 'Ora non puoi', none: '', far: '', full: "Non c'è posto nello zaino", conflict: 'Incompatibile con un oggetto equipaggiato', cost: `Servono {mov:${REEQUIP_COST}}`, carried: 'Si porta in braccio: si posa a terra',
};

/** L'inventario di un eroe com'è oggi, per la scheda completa. */
export function inventoryOf(state: GameState, piece: Piece): InventoryView {
  const entry = (id: string, where: 'equipped' | 'backpack'): ItemEntry | null => {
    const item = state.items.get(id);
    if (!item) return null;
    const code = where === 'backpack' ? checkEquip(state, piece, id).code : checkStow(state, piece, id);
    const carried = !!item.carried;
    return {
      id, def: item, name: item.name, icon: item.icon ?? 'inventory_2', detail: itemDetail(item), where,
      move: { label: where === 'backpack' ? 'Equipaggia' : 'Nello zaino', cost: REEQUIP_COST, enabled: code === 'ok', reason: code === 'ok' ? undefined : ITEM_REASON[code] },
      canDrop: canAct(state, piece),
      carried,
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

/** Trasforma un eroe in rospo (Maledizione del Rospo): ha 2 segnalini e il suo turno finisce subito (chi chiama passa il turno). */
export function transformToad(piece: Piece): void {
  piece.toad = { tokens: TOAD_TOKENS, fresh: true };
  piece.action = 'advance';
  piece.points = 0;
  piece.attacks = 0;
}
