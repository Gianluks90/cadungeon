import { ChestTier, PotionKind } from '../board/marker';
import { BACKPACK_LIMIT, POTION_LIMIT, POTION_PRICES, TREASURE_PRICES } from '../constants';
import type { AdventureSetup } from '../map/map-data';
import { SKILL_SCHOOLS, SkillSchool } from '../skills/skill';
import { StartingSkills } from './hero-sheet';
import { ItemDef, fitsEquipment, loadItemCatalog, loadShopStock } from '../items/item';

/** Ciò che un eroe ha comprato prima di partire: oggetti (id del catalogo) e pozioni. Le monete rimaste sono 300 meno il costo. */
export interface Loadout {
  items: string[];
  potions: PotionKind[];
  /** I tesori comprati (uno per carta, del tipo del mazzo): la carta si pesca dal mazzo vero quando la partita comincia. Solo se l'avventura li vende in preparazione. */
  treasures?: ChestTier[];
}

/** Le chiavi di traduzione dei nomi dei tesori comprabili in preparazione. */
export const TREASURE_KEYS = { copper: 'shop.treasureCopper', silver: 'shop.treasureSilver', gold: 'shop.treasureGold' } as const;

export const emptyLoadout = (): Loadout => ({ items: [], potions: [] });

/** Il negozio di prima della partita: il catalogo degli oggetti e le copie in vendita (comuni a tutti gli eroi della squadra). */
export interface ShopData {
  items: ReadonlyMap<string, ItemDef>;
  stock: Readonly<Record<string, number>>;
  /** I tipi di tesoro in vendita in preparazione (variante dell'avventura, `AdventureSetup.pregameTreasures`). */
  treasureTiers: readonly ChestTier[];
}

export async function loadPregameShop(setup?: AdventureSetup): Promise<ShopData> {
  const [items, stock] = await Promise.all([loadItemCatalog(), loadShopStock('city')]);
  return { items, stock, treasureTiers: setup?.pregameTreasures ?? [] };
}

/** La variante di preparazione di un'avventura, letta dal file della mappa (vuota se manca o non si legge). */
export async function loadAdventureSetup(map: string): Promise<AdventureSetup> {
  try {
    const res = await fetch(new URL(`maps/${map}.json`, document.baseURI));
    if (!res.ok) return {};
    return ((await res.json()) as { setup?: AdventureSetup }).setup ?? {};
  } catch {
    return {};
  }
}

/** Le monete di un eroe in preparazione: quelle della scheda più il bonus dell'avventura (anche negativo), mai sotto 0. */
export function coinsWithSetup(base: number, setup?: AdventureSetup): number {
  return Math.max(0, base + (setup?.extraCoins ?? 0));
}

/** Posti per i tesori: uno zaino ha BACKPACK_LIMIT posti e ogni tesoro, senza sapere quale carta uscirà, ne occupa uno nel caso peggiore. */
export function treasureRoom(l: Loadout, shop: ShopData): boolean {
  const placed = placeItems(l.items, shop);
  return !!placed && placed.backpack.length + (l.treasures?.length ?? 0) < BACKPACK_LIMIT;
}

/** Quanto costa tutto ciò che c'è nel `loadout`. */
export function loadoutCost(l: Loadout, shop: ShopData): number {
  return l.items.reduce((n, id) => n + (shop.items.get(id)?.price ?? 0), 0) + l.potions.reduce((n, k) => n + POTION_PRICES[k], 0) + (l.treasures ?? []).reduce((n, t) => n + TREASURE_PRICES[t], 0);
}

/** Le copie ancora in vendita, tolte quelle già comprate da tutti gli `loadouts`. */
export function stockLeft(shop: ShopData, loadouts: readonly Loadout[]): Record<string, number> {
  const left: Record<string, number> = { ...shop.stock };
  for (const l of loadouts) for (const id of l.items) if (id in left) left[id] -= 1;
  return left;
}

/** Le schede degli oggetti che l'eroe riesce a equipaggiare con questo `loadout`. */
export function equippedDefs(l: Loadout, shop: ShopData): ItemDef[] {
  return (placeItems(l.items, shop)?.equipped ?? []).flatMap((id) => shop.items.get(id) ?? []);
}

/** Dove va ogni oggetto: come in partita, si equipaggia finché ci sta, il resto va nello zaino (se c'è posto). Null se qualcosa non ha posto. */
export function placeItems(ids: readonly string[], shop: ShopData): { equipped: string[]; backpack: string[] } | null {
  const equipped: string[] = [];
  const backpack: string[] = [];
  for (const id of ids) {
    const def = shop.items.get(id);
    if (!def) return null;
    if (fitsEquipment(equipped.map((e) => shop.items.get(e)!), def)) equipped.push(id);
    else if (!def.carried && backpack.length < BACKPACK_LIMIT) backpack.push(id);
    else return null;
  }
  return { equipped, backpack };
}

/** Il `loadout` è valido? Oggetti in vendita, copie sufficienti (`others`: ciò che hanno già comprato gli altri eroi), pozioni nei limiti, posto per tutto e monete bastanti. */
export function validLoadout(l: Loadout, coins: number, shop: ShopData, others: readonly Loadout[]): boolean {
  if (!Array.isArray(l?.items) || !Array.isArray(l?.potions)) return false;
  if (l.potions.length > POTION_LIMIT || l.potions.some((k) => !(k in POTION_PRICES))) return false;
  const treasures = l.treasures ?? [];
  if (!Array.isArray(treasures) || treasures.some((t) => !shop.treasureTiers.includes(t))) return false;
  if (treasures.length && (placeItems(l.items, shop)?.backpack.length ?? BACKPACK_LIMIT) + treasures.length > BACKPACK_LIMIT) return false;
  const left = stockLeft(shop, others);
  for (const id of l.items) {
    if (!(id in left) || !shop.items.has(id) || left[id] <= 0) return false;
    left[id] -= 1;
  }
  return !!placeItems(l.items, shop) && loadoutCost(l, shop) <= coins;
}

/** I dati passati dalla scelta degli eroi alla partita: per ogni eroe ciò che ha comprato e le monete che gli restano. */
export type PartySetup = Record<string, Loadout & { coins: number; skillCards: string[] }>;

/** Una carta abilità del mazzo, per pescare. */
export interface SkillPoolCard {
  id: string;
  school: SkillSchool;
}

/** Assegna a un eroe le sue carte abilità secondarie: una a caso per ogni punto di attributo, dal mazzo del ramo, senza carte già date a `taken` (altri eroi della squadra). */
export function drawSkillCards(points: StartingSkills, pool: readonly SkillPoolCard[], taken: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (const school of SKILL_SCHOOLS) {
    const avail = pool.filter((c) => c.school === school && !taken.has(c.id));
    for (let i = avail.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [avail[i], avail[j]] = [avail[j], avail[i]];
    }
    out.push(...avail.slice(0, points[school]).map((c) => c.id));
  }
  return out;
}

const KEY = 'cad-party-setup';

/** Passa gli acquisti alla partita che sta per aprirsi (sessionStorage: valgono per questa scheda e una volta sola). */
export const partySetupStore = {
  save(setup: PartySetup) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(setup));
    } catch {
      /* senza archivio la partita parte con la dotazione di base */
    }
  },
  /** Legge e cancella gli acquisti: un refresh della partita non li rimette. */
  take(): PartySetup {
    try {
      const raw = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
      return raw ? (JSON.parse(raw) as PartySetup) : {};
    } catch {
      return {};
    }
  },
};
