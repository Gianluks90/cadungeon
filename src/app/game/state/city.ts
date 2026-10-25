import { Board, Cell } from '../board/board';
import { ChestTier, Marker, PotionKind } from '../board/marker';
import { CITY_TELEPORT_COST, POTION_LIMIT, POTION_PRICES, TEMPLE_HEAL_COST, TREASURE_PRICES, TREASURE_SELL_COINS } from '../constants';
import { ItemDef, itemDetail } from '../items/item';
import { POTION_NAMES } from '../markers/marker-rules';
import { CityService, Piece } from '../pieces/piece';
import { canAct, canActOnMap, canReceiveItem, receiveItem, spendPoints } from './actions';
import { GameState } from './game-state';

/**
 * La città (docs/REGOLE.md, sezione 3d). Un eroe su un glifo acceso ci va spendendo tutto il movimento (minimo 1); la sua pedina esce dalla mappa. Nel
 * turno dell'arrivo può scegliere un solo servizio (negozio, campo di addestramento o tempio), poi passa; al turno dopo deve tornare (anche se non ha
 * visitato niente) su un glifo acceso: quello da cui è partito è gratis, un altro costa CITY_TELEPORT_COST monete. Tutto è nello stato: le funzioni controllano le regole e dicono com'è andata.
 */

export interface CityResult {
  code:
    | 'ok' | 'busy' | 'no-glyph' | 'cost' | 'not-in-city' | 'wrong-service' | 'already' | 'late' | 'soon' | 'coins' | 'full' | 'sold-out' | 'stock' | 'none'
    | 'full-health' | 'not-yet' | 'occupied' | 'unknown';
  /** Una riga da dire al giocatore, se serve. */
  notice?: string;
}

/** Il costo del teletrasporto, come testo per i messaggi. */
export const CITY_TELEPORT_COST_TEXT = String(CITY_TELEPORT_COST);

const SERVICE_NAMES: Record<CityService, string> = { shop: 'Negozio', camp: 'Campo di addestramento', temple: 'Tempio' };
const TIER_NAMES: Record<ChestTier, string> = { copper: 'Tesoro di rame', silver: "Tesoro d'argento", gold: "Tesoro d'oro" };

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
  const taken = (c: Cell) => state.pieces.some((p) => !p.city && p.cell.x === c.x && p.cell.y === c.y);
  return board.markers.flatMap((m) =>
    m.type === 'glyph' && m.active && state.exploration.markers.has(m) && !taken(m)
      ? [{ marker: m, cell: { x: m.x, y: m.y }, coins: m.x === stay.from.x && m.y === stay.from.y ? 0 : CITY_TELEPORT_COST }]
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
  return { code: 'ok', notice: choice.coins ? `Teletrasporto: ${choice.coins} monete` : undefined };
}

/** Sceglie il servizio da visitare (uno solo per visita). Il campo di addestramento non c'è ancora. */
export function chooseService(state: GameState, piece: Piece, service: CityService): CityResult {
  if (!piece.city) return { code: 'not-in-city' };
  if (!canAct(state, piece)) return { code: 'busy' };
  if (piece.city.visited || piece.city.service) return { code: 'already' };
  if (state.round > piece.city.arrivedRound) return { code: 'late' }; // i servizi si usano solo nel turno dell'arrivo: poi si deve tornare
  if (service === 'camp') return { code: 'soon' };
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

/** Negozio: compra una pozione (50 la curativa, 25 la vitalità). */
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
  if (state.decks[tier].length === 0) return { code: 'sold-out' };
  if (piece.coins < TREASURE_PRICES[tier]) return { code: 'coins' };
  const id = state.decks[tier].shift()!;
  const item = state.items.get(id);
  piece.coins -= TREASURE_PRICES[tier];
  if (!item) return { code: 'unknown' };
  if (receiveItem(state, piece, id) === 'none') {
    piece.coins += TREASURE_SELL_COINS[tier];
    return { code: 'ok', notice: `${item.name} scartata per ${TREASURE_SELL_COINS[tier]} monete: non c'era posto` };
  }
  return { code: 'ok', notice: `${item.name} comprata` };
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

/** Quanto si ricava vendendo un oggetto: metà del prezzo, per difetto. */
export function sellPrice(item: ItemDef): number {
  return Math.floor(item.price / 2);
}

/** Negozio: vende un oggetto (equipaggiato o nello zaino) a metà prezzo; se è in vendita, torna sullo scaffale. */
export function sellItem(state: GameState, piece: Piece, id: string): CityResult {
  const bad = visiting(state, piece, 'shop');
  if (bad) return bad;
  const item = state.items.get(id);
  const list = piece.equipped.includes(id) ? piece.equipped : piece.backpack.includes(id) ? piece.backpack : null;
  if (!item || !list) return { code: 'none' };
  list.splice(list.indexOf(id), 1);
  piece.coins += sellPrice(item);
  if (id in state.shop) state.shop[id] = (state.shop[id] ?? 0) + 1;
  return { code: 'ok', notice: `${item.name} venduto per ${sellPrice(item)} monete` };
}

/** Tempio: ripristina tutta la salute (le ferite al massimo). Lo abbiamo inventato noi: costa TEMPLE_HEAL_COST monete. */
export function templeHeal(state: GameState, piece: Piece): CityResult {
  const bad = visiting(state, piece, 'temple');
  if (bad) return bad;
  if (piece.wounds >= piece.maxWounds) return { code: 'full-health' };
  if (piece.coins < TEMPLE_HEAL_COST) return { code: 'coins' };
  piece.coins -= TEMPLE_HEAL_COST;
  piece.wounds = piece.maxWounds;
  return { code: 'ok', notice: 'Salute ripristinata' };
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
  temple?: Offer;
}

/** Tutto ciò che il pannello della città deve mostrare per `piece` (che è in città). */
export function cityView(state: GameState, piece: Piece): CityView | null {
  const stay = piece.city;
  if (!stay) return null;
  const turn = canAct(state, piece);
  const choosing = turn && !stay.visited && !stay.service && state.round === stay.arrivedRound;
  const lock = (ok: boolean, reason: string) => (ok ? undefined : reason);
  const reasonLocked = state.round > stay.arrivedRound ? 'Devi tornare nel dungeon' : stay.visited ? 'La visita è finita' : 'Hai già scelto un servizio';
  const view: CityView = {
    service: stay.service,
    visited: stay.visited,
    services: [
      { id: 'shop', name: SERVICE_NAMES.shop, blurb: 'Pozioni, tesori e vendita degli oggetti', enabled: choosing, reason: lock(choosing, reasonLocked) },
      { id: 'camp', name: SERVICE_NAMES.camp, blurb: 'Abilità e miglioramenti', enabled: false, reason: 'Presto disponibile' },
      { id: 'temple', name: SERVICE_NAMES.temple, blurb: 'Ripristino della salute', enabled: choosing, reason: lock(choosing, reasonLocked) },
    ],
    mustReturn: canReturn(state, piece),
    teleportCost: CITY_TELEPORT_COST,
  };
  const coins = (price: number) => (piece.coins >= price ? undefined : 'Non hai abbastanza monete');
  if (stay.service === 'shop' && turn) {
    view.shop = {
      potions: (['heal', 'vital'] as PotionKind[]).map((k) => ({
        id: k, name: POTION_NAMES[k], price: POTION_PRICES[k],
        enabled: piece.potions.length < POTION_LIMIT && piece.coins >= POTION_PRICES[k],
        reason: piece.potions.length >= POTION_LIMIT ? `Porti già ${POTION_LIMIT} pozioni` : coins(POTION_PRICES[k]),
      })),
      treasures: (['copper', 'silver', 'gold'] as ChestTier[]).map((t) => ({
        id: t, name: TIER_NAMES[t], price: TREASURE_PRICES[t],
        enabled: state.decks[t].length > 0 && piece.coins >= TREASURE_PRICES[t],
        reason: state.decks[t].length === 0 ? 'Esaurito' : coins(TREASURE_PRICES[t]),
      })),
      items: [...state.items.values()].filter((i) => i.id in state.shop).map((i) => {
        const stock = state.shop[i.id] ?? 0;
        const reason = stock <= 0 ? 'Esaurito' : coins(i.price) ?? (canReceiveItem(state, piece, i.id) ? undefined : 'Non hai posto');
        return { id: i.id, name: i.name, price: i.price, enabled: !reason, reason, def: i, detail: itemDetail(i), stock };
      }).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      sell: [...piece.equipped, ...piece.backpack].flatMap((id) => {
        const item = state.items.get(id);
        return item ? [{ id, name: item.name, price: sellPrice(item), enabled: true }] : [];
      }),
    };
  }
  if (stay.service === 'temple' && turn) {
    const reason = piece.wounds >= piece.maxWounds ? 'Sei già in piena salute' : coins(TEMPLE_HEAL_COST);
    view.temple = { id: 'heal', name: 'Ripristina la salute', price: TEMPLE_HEAL_COST, enabled: !reason, reason };
  }
  return view;
}
