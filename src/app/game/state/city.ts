import { tr } from '../../i18n/catalog-text';
import { Board, Cell } from '../board/board';
import { ChestTier, Marker, PotionKind } from '../board/marker';
import { ATTACK_DICE_MAX, ATTACK_DICE_PRICE, CITY_TELEPORT_COST, POTION_LIMIT, POTION_PRICES, SELL_STEP_COINS, SKILL_CARD_PRICE, TEMPLE_HEAL_COST, TREASURE_PRICES } from '../constants';
import { AttackDice } from '../heroes/hero-sheet';
import { SKILL_SCHOOLS, SKILL_SCHOOL_NAMES, SkillSchool } from '../skills/skill';
import { ItemDef, itemDetail } from '../items/item';
import { POTION_NAMES } from '../markers/marker-rules';
import { CityService, Piece, occupies } from '../pieces/piece';
import { canAct, canActOnMap, canReceiveItem, drawTreasureFor, receiveItem, spendPoints } from './actions';
import { GameState } from './game-state';

/**
 * La città (docs/REGOLE.md, sezione 3d). Un eroe su un glifo acceso ci va spendendo tutto il movimento (minimo 1); la sua pedina esce dalla mappa. Nel
 * turno dell'arrivo può scegliere un solo servizio (negozio, campo di addestramento o tempio), poi passa; al turno dopo deve tornare (anche se non ha
 * visitato niente) su un glifo acceso: quello da cui è partito è gratis, un altro costa CITY_TELEPORT_COST monete. Tutto è nello stato: le funzioni controllano le regole e dicono com'è andata.
 */

export interface CityResult {
  code:
    | 'ok' | 'busy' | 'no-glyph' | 'cost' | 'not-in-city' | 'wrong-service' | 'already' | 'late' | 'soon' | 'coins' | 'full' | 'sold-out' | 'stock' | 'none'
    | 'full-health' | 'not-yet' | 'occupied' | 'unknown' | 'maxed' | 'locked';
  /** Una riga da dire al giocatore, se serve. */
  notice?: string;
}

/** Il costo del teletrasporto, come testo per i messaggi. */
export const CITY_TELEPORT_COST_TEXT = String(CITY_TELEPORT_COST);

const SERVICE_NAMES: Record<CityService, string> = { get shop() { return tr('Negozio'); }, get camp() { return tr('Campo di addestramento'); }, get temple() { return tr('Tempio'); } };
const TIER_NAMES: Record<ChestTier, string> = { get copper() { return tr('Tesoro di rame'); }, get silver() { return tr('Tesoro d\'argento'); }, get gold() { return tr('Tesoro d\'oro'); } };

const TIER_ADJ: Record<ChestTier, string> = { get copper() { return tr('di rame'); }, get silver() { return tr('d\'argento'); }, get gold() { return tr('d\'oro'); } };

/** Va in città dal glifo acceso su cui si trova: spende tutto il movimento (almeno 1). */
export function travelToCity(state: GameState, board: Board, piece: Piece): CityResult {
  if (!canActOnMap(state, piece)) return { code: 'busy' };
  const here = board.markerAt(piece.cell);
  if (here?.type !== 'glyph' || !here.active) return { code: 'no-glyph' };
  if (piece.points < 1) return { code: 'cost' };
  piece.city = { from: { ...piece.cell }, service: null, visited: false, arrivedRound: state.round };
  spendPoints(piece, piece.points);
  piece.attacks = 0; // in città non si combatte
  return { code: 'ok' };
}

/** Un glifo su cui si può tornare, e quanto costa. */
export interface ReturnChoice {
  marker: Marker;
  cell: Cell;
  /** Monete da pagare: 0 se è il glifo da cui si è partiti. */
  coins: number;
}

/** I glifi su cui `piece` può tornare: accesi, già scoperti dagli eroi e senza nessuna pedina sopra. Vuoto se non è in città. */
export function returnChoices(state: GameState, board: Board, piece: Piece): ReturnChoice[] {
  const stay = piece.city;
  if (!stay) return [];
  const taken = (c: Cell) => state.pieces.some((p) => !p.city && occupies(p, c));
  return board.markers.flatMap((m) =>
    m.type === 'glyph' && m.active && state.exploration.markers.has(m) && !taken(m)
      ? [{ marker: m, cell: { x: m.x, y: m.y }, coins: stay.dead || (m.x === stay.from.x && m.y === stay.from.y) ? 0 : CITY_TELEPORT_COST }]
      : [],
  );
}

/** Si può tornare adesso? Non nel round in cui si è arrivati (si va e si torna una volta per turno). */
export function canReturn(state: GameState, piece: Piece): boolean {
  return !!piece.city && canAct(state, piece) && state.round > piece.city.arrivedRound;
}

/** Torna dalla città sul glifo `cell`: riprende il suo turno sulla mappa con tutto il movimento. */
export function returnFromCity(state: GameState, board: Board, piece: Piece, cell: Cell): CityResult {
  if (!piece.city) return { code: 'not-in-city' };
  if (!canAct(state, piece)) return { code: 'busy' };
  if (!canReturn(state, piece)) return { code: 'not-yet' };
  const choice = returnChoices(state, board, piece).find((c) => c.cell.x === cell.x && c.cell.y === cell.y);
  if (!choice) return { code: 'occupied' };
  if (piece.coins < choice.coins) return { code: 'coins' };
  piece.coins -= choice.coins;
  piece.cell = { ...choice.cell };
  piece.city = null;
  return { code: 'ok', notice: choice.coins ? tr('Teletrasporto: {coins} monete', { coins: choice.coins }) : undefined };
}

/** Sceglie il servizio da visitare (uno solo per visita). */
export function chooseService(state: GameState, piece: Piece, service: CityService): CityResult {
  if (!piece.city) return { code: 'not-in-city' };
  if (!canAct(state, piece)) return { code: 'busy' };
  if (piece.city.visited || piece.city.service) return { code: 'already' };
  if (state.round > piece.city.arrivedRound) return { code: 'late' }; // i servizi si usano solo nel turno dell'arrivo: poi si deve tornare
  piece.city.service = service;
  return { code: 'ok' };
}

/** Controlla che `piece` stia visitando proprio questo servizio. */
function visiting(state: GameState, piece: Piece, service: CityService): CityResult | null {
  if (!piece.city) return { code: 'not-in-city' };
  if (!canAct(state, piece)) return { code: 'busy' };
  if (piece.city.service !== service) return { code: 'wrong-service' };
  return null;
}

/** Negozio: compra una pozione (50 la curativa, 25 il vigore). */
export function buyPotion(state: GameState, piece: Piece, kind: PotionKind): CityResult {
  const bad = visiting(state, piece, 'shop');
  if (bad) return bad;
  if (piece.potions.length >= POTION_LIMIT) return { code: 'full' };
  if (piece.coins < POTION_PRICES[kind]) return { code: 'coins' };
  piece.coins -= POTION_PRICES[kind];
  piece.potions.push(kind);
  return { code: 'ok', notice: `${POTION_NAMES[kind]} comprata` };
}

/** Negozio: compra un tesoro pescato dal mazzo. Se l'eroe non ha posto, la carta è scartata subito per monete (come negli scrigni). */
export function buyTreasure(state: GameState, piece: Piece, tier: ChestTier): CityResult {
  const bad = visiting(state, piece, 'shop');
  if (bad) return bad;
  if (!state.openedTiers.includes(tier)) return { code: 'locked' };
  if (state.decks[tier].length === 0) return { code: 'sold-out' };
  if (piece.coins < TREASURE_PRICES[tier]) return { code: 'coins' };
  piece.coins -= TREASURE_PRICES[tier];
  const lines = drawTreasureFor(state, piece, tier);
  return { code: 'ok', notice: lines.length ? lines.map((l) => l.replace(`${piece.name}: `, '')).join(' · ') : tr('Il mazzo è finito') };
}

/** Negozio: compra un oggetto in vendita (le scorte sono limitate e comuni a tutti gli eroi). */
export function buyItem(state: GameState, piece: Piece, id: string): CityResult {
  const bad = visiting(state, piece, 'shop');
  if (bad) return bad;
  const item = state.items.get(id);
  if (!item || !(id in state.shop)) return { code: 'unknown' };
  if ((state.shop[id] ?? 0) <= 0) return { code: 'stock' };
  if (piece.coins < item.price) return { code: 'coins' };
  if (!canReceiveItem(state, piece, id)) return { code: 'full' };
  piece.coins -= item.price;
  state.shop[id] -= 1;
  receiveItem(state, piece, id);
  return { code: 'ok', notice: `${item.name} comprato` };
}

/** Quanto si ricava vendendo un oggetto: metà del prezzo, arrotondata per difetto a un multiplo di SELL_STEP_COINS (25), ma mai meno di 25. */
export function sellPrice(item: ItemDef): number {
  return Math.max(SELL_STEP_COINS, Math.floor(item.price / 2 / SELL_STEP_COINS) * SELL_STEP_COINS);
}

/** Negozio: vende un oggetto (equipaggiato o nello zaino) a metà prezzo; se è in vendita, torna sullo scaffale. */
export function sellItem(state: GameState, piece: Piece, id: string): CityResult {
  const bad = visiting(state, piece, 'shop');
  if (bad) return bad;
  const item = state.items.get(id);
  const list = piece.equipped.includes(id) ? piece.equipped : piece.backpack.includes(id) ? piece.backpack : null;
  if (!item || !list || item.tags?.includes('relic')) return { code: 'none' }; // le reliquie non si vendono
  list.splice(list.indexOf(id), 1);
  piece.coins += sellPrice(item);
  if (id in state.shop) state.shop[id] = (state.shop[id] ?? 0) + 1;
  return { code: 'ok', notice: tr('{name} venduto per {sellPrice} monete', { name: item.name, sellPrice: sellPrice(item) }) };
}

/** I tre attacchi, con il nome per l'interfaccia. */
export const ATTACK_NAMES: Record<keyof AttackDice, string> = { get melee() { return tr('Mischia'); }, get ranged() { return tr('Distanza'); }, get magic() { return tr('Magia'); } };

/** Campo di addestramento: compra una nuova carta abilità del ramo `school` (pescata a caso dal mazzo). */
export function buySkill(state: GameState, piece: Piece, school: SkillSchool): CityResult {
  const bad = visiting(state, piece, 'camp');
  if (bad) return bad;
  if (state.skillDecks[school].length === 0) return { code: 'sold-out' };
  if (piece.coins < SKILL_CARD_PRICE) return { code: 'coins' };
  piece.coins -= SKILL_CARD_PRICE;
  const card = state.drawSkill(piece, school);
  return { code: 'ok', notice: card ? tr('Nuova abilità: {name}', { name: card.name }) : tr('Il mazzo è finito') };
}

/** Campo di addestramento: un dado in più per un tipo di attacco (fino a ATTACK_DICE_MAX). */
export function trainDice(state: GameState, piece: Piece, kind: keyof AttackDice): CityResult {
  const bad = visiting(state, piece, 'camp');
  if (bad) return bad;
  if (piece.dice[kind] >= ATTACK_DICE_MAX) return { code: 'maxed' };
  if (piece.coins < ATTACK_DICE_PRICE) return { code: 'coins' };
  piece.coins -= ATTACK_DICE_PRICE;
  piece.dice[kind] += 1;
  return { code: 'ok', notice: tr('Attacco {kind}: {kind2} dadi', { kind: ATTACK_NAMES[kind].toLowerCase(), kind2: piece.dice[kind] }) };
}

/** Tempio: ripristina tutta la salute (le ferite al massimo). Lo abbiamo inventato noi: costa TEMPLE_HEAL_COST monete. */
export function templeHeal(state: GameState, piece: Piece): CityResult {
  const bad = visiting(state, piece, 'temple');
  if (bad) return bad;
  if (piece.wounds >= piece.maxWounds) return { code: 'full-health' };
  if (piece.coins < TEMPLE_HEAL_COST) return { code: 'coins' };
  piece.coins -= TEMPLE_HEAL_COST;
  piece.wounds = piece.maxWounds;
  return { code: 'ok', notice: tr('Salute ripristinata') };
}

// --- La vista per l'interfaccia ---

/** Un'offerta con il suo prezzo, e se si può accettare adesso (o il motivo). */
export interface Offer {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
  reason?: string;
}

export interface ShopItemOffer extends Offer {
  def: ItemDef;
  detail: string;
  stock: number;
}

export interface CityView {
  /** Quale servizio sta visitando adesso (null = non ancora scelto), e se la visita è finita. */
  service: CityService | null;
  visited: boolean;
  /** I tre servizi, e se si possono scegliere ora. */
  services: { id: CityService; name: string; blurb: string; enabled: boolean; reason?: string }[];
  /** È il suo turno e deve tornare nel dungeon (dal turno dopo l'arrivo): il pannello Città non c'è più e si sceglie il glifo. */
  mustReturn: boolean;
  teleportCost: number;
  shop?: { potions: Offer[]; treasures: Offer[]; items: ShopItemOffer[]; sell: Offer[] };
  camp?: { skills: Offer[]; dice: Offer[] };
  temple?: Offer;
}

/** Tutto ciò che il pannello della città deve mostrare per `piece` (che è in città). */
export function cityView(state: GameState, piece: Piece): CityView | null {
  const stay = piece.city;
  if (!stay) return null;
  const turn = canAct(state, piece);
  const choosing = turn && !stay.visited && !stay.service && state.round === stay.arrivedRound;
  const lock = (ok: boolean, reason: string) => (ok ? undefined : reason);
  const reasonLocked = state.round > stay.arrivedRound ? tr('Devi tornare nel dungeon') : stay.visited ? tr('La visita è finita') : tr('Hai già scelto un servizio');
  const view: CityView = {
    service: stay.service,
    visited: stay.visited,
    services: [
      { id: 'shop', name: SERVICE_NAMES.shop, blurb: tr('Pozioni, tesori e vendita degli oggetti'), enabled: choosing, reason: lock(choosing, reasonLocked) },
      { id: 'camp', name: SERVICE_NAMES.camp, blurb: tr('Nuove abilità e dadi d\'attacco'), enabled: choosing, reason: lock(choosing, reasonLocked) },
      { id: 'temple', name: SERVICE_NAMES.temple, blurb: tr('Ripristino della salute'), enabled: choosing, reason: lock(choosing, reasonLocked) },
    ],
    mustReturn: canReturn(state, piece),
    teleportCost: CITY_TELEPORT_COST,
  };
  const coins = (price: number) => (piece.coins >= price ? undefined : tr('Non hai abbastanza monete'));
  if (stay.service === 'shop' && turn) {
    view.shop = {
      potions: (['heal', 'vital'] as PotionKind[]).map((k) => ({
        id: k, name: POTION_NAMES[k], price: POTION_PRICES[k],
        enabled: piece.potions.length < POTION_LIMIT && piece.coins >= POTION_PRICES[k],
        reason: piece.potions.length >= POTION_LIMIT ? tr('Porti già {potionLimit} pozioni', { potionLimit: POTION_LIMIT }) : coins(POTION_PRICES[k]),
      })),
      treasures: (['copper', 'silver', 'gold'] as ChestTier[]).map((t) => ({
        id: t, name: TIER_NAMES[t], price: TREASURE_PRICES[t],
        enabled: state.openedTiers.includes(t) && state.decks[t].length > 0 && piece.coins >= TREASURE_PRICES[t],
        reason: !state.openedTiers.includes(t) ? tr('Apri prima uno scrigno {t}', { t: TIER_ADJ[t] }) : state.decks[t].length === 0 ? tr('Esaurito') : coins(TREASURE_PRICES[t]),
      })),
      items: [...state.items.values()].filter((i) => i.id in state.shop).map((i) => {
        const stock = state.shop[i.id] ?? 0;
        const reason = stock <= 0 ? tr('Esaurito') : coins(i.price) ?? (canReceiveItem(state, piece, i.id) ? undefined : tr('Non hai posto'));
        return { id: i.id, name: i.name, price: i.price, enabled: !reason, reason, def: i, detail: itemDetail(i), stock };
      }).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      sell: [...piece.equipped, ...piece.backpack].flatMap((id) => {
        const item = state.items.get(id);
        return item && !item.tags?.includes('relic') ? [{ id, name: item.name, price: sellPrice(item), enabled: true }] : [];
      }),
    };
  }
  if (stay.service === 'camp' && turn) {
    view.camp = {
      skills: SKILL_SCHOOLS.map((school) => {
        const empty = state.skillDecks[school].length === 0;
        return { id: school, name: tr('Abilità di {school}', { school: SKILL_SCHOOL_NAMES[school].toLowerCase() }), price: SKILL_CARD_PRICE, enabled: !empty && piece.coins >= SKILL_CARD_PRICE, reason: empty ? tr('Esaurito') : coins(SKILL_CARD_PRICE) };
      }),
      dice: (Object.keys(ATTACK_NAMES) as (keyof AttackDice)[]).map((kind) => {
        const maxed = piece.dice[kind] >= ATTACK_DICE_MAX;
        return { id: kind, name: tr('Attacco {kind}: {kind2} → {min}', { kind: ATTACK_NAMES[kind].toLowerCase(), kind2: piece.dice[kind], min: Math.min(ATTACK_DICE_MAX, piece.dice[kind] + 1) }), price: ATTACK_DICE_PRICE, enabled: !maxed && piece.coins >= ATTACK_DICE_PRICE, reason: maxed ? tr('Hai già {attackDiceMax} dadi', { attackDiceMax: ATTACK_DICE_MAX }) : coins(ATTACK_DICE_PRICE) };
      }),
    };
  }
  if (stay.service === 'temple' && turn) {
    const reason = piece.wounds >= piece.maxWounds ? tr('Sei già in piena salute') : coins(TEMPLE_HEAL_COST);
    view.temple = { id: 'heal', name: tr('Ripristina la salute'), price: TEMPLE_HEAL_COST, enabled: !reason, reason };
  }
  return view;
}
