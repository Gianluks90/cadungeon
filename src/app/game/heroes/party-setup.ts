import { PotionKind } from '../board/marker';
import { BACKPACK_LIMIT, POTION_LIMIT, POTION_PRICES } from '../constants';
import { SKILL_SCHOOLS, SkillSchool } from '../skills/skill';
import { StartingSkills } from './hero-sheet';
import { ItemDef, fitsEquipment, loadItemCatalog, loadShopStock } from '../items/item';

/** Ciò che un eroe ha comprato prima di partire: oggetti (id del catalogo) e pozioni. Le monete rimaste sono 300 meno il costo. */
export interface Loadout {
  items: string[];
  potions: PotionKind[];
}

export const emptyLoadout = (): Loadout => ({ items: [], potions: [] });

/** Il negozio di prima della partita: il catalogo degli oggetti e le copie in vendita (comuni a tutti gli eroi della squadra). */
export interface ShopData {
  items: ReadonlyMap<string, ItemDef>;
  stock: Readonly<Record<string, number>>;
}

export async function loadPregameShop(): Promise<ShopData> {
  const [items, stock] = await Promise.all([loadItemCatalog(), loadShopStock('city')]);
  return { items, stock };
}

/** Quanto costa tutto ciò che c'è nel `loadout`. */
export function loadoutCost(l: Loadout, shop: ShopData): number {
  return l.items.reduce((n, id) => n + (shop.items.get(id)?.price ?? 0), 0) + l.potions.reduce((n, k) => n + POTION_PRICES[k], 0);
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
