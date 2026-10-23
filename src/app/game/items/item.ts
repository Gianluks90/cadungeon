import { ChestTier } from '../board/marker';
import { BACKPACK_LIMIT, EQUIP_ARMOR_LIMIT, EQUIP_HANDS, EQUIP_OTHER_LIMIT } from '../constants';

/** Il tipo di un oggetto: arma o scudo (usano le mani), armatura, oppure altro (né mani né armatura). Le pozioni non sono oggetti: hanno il loro set. */
export type ItemKind = 'weapon' | 'shield' | 'armor' | 'other';

export type AttackType = 'melee' | 'ranged' | 'magic';

/**
 * Una carta oggetto (public/items/<id>.json). Le regole stanno in docs/REGOLE.md, sezione 3c. I dadi e gli effetti restano dati finché non
 * c'è il combattimento.
 */
export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** Per le armi: il tipo di attacco. */
  attack?: AttackType;
  /** Quante mani servono (0, 1 o 2). */
  hands: number;
  /** Per le armature: quanta armatura aggiungono a quella dell'eroe. */
  armor?: number;
  /** Il prezzo in monete: nel negozio si compra per questa cifra. */
  price: number;
  /** I dadi che l'oggetto dà all'attacco, per nome (`base` è il dado che ha la faccia Mancato). */
  dice?: string[];
  /** Gli effetti a Scariche: costo in Scariche ed effetto, a parole. */
  surge?: { cost: number; effect: string }[];
  /** Il bonus che dà a un'altra arma a una mano quando sta nella mano secondaria. */
  offHand?: string;
  /** Il nome di un'icona (public/icons/). */
  icon?: string;
  /** Se è un tesoro, in quale mazzo degli scrigni sta (rame, argento o oro). Senza, non si trova negli scrigni. */
  deck?: ChestTier;
  text?: string;
}

/** Carica il catalogo degli oggetti: l'elenco in public/items/index.json e poi ogni carta. Quelle che mancano si saltano. */
export async function loadItemCatalog(): Promise<Map<string, ItemDef>> {
  const items = new Map<string, ItemDef>();
  try {
    const res = await fetch('items/index.json');
    if (!res.ok) return items;
    const ids: string[] = await res.json();
    await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`items/${id}.json`);
          if (r.ok) items.set(id, await r.json());
        } catch {
          console.warn(`Oggetto "${id}" non trovato`);
        }
      }),
    );
  } catch {
    console.warn('Catalogo degli oggetti non trovato');
  }
  return items;
}

/** L'oggetto sta nell'equipaggiamento già pieno di `equipped`? Al massimo 2 mani, 1 armatura e 2 oggetti vari. */
export function fitsEquipment(equipped: readonly ItemDef[], item: ItemDef): boolean {
  const hands = equipped.reduce((n, i) => n + i.hands, 0) + item.hands;
  if (hands > EQUIP_HANDS) return false;
  if (item.kind === 'armor' && equipped.filter((i) => i.kind === 'armor').length + 1 > EQUIP_ARMOR_LIMIT) return false;
  if (item.kind === 'other' && equipped.filter((i) => i.kind === 'other').length + 1 > EQUIP_OTHER_LIMIT) return false;
  return true;
}

/**
 * Per equipaggiare `item` quando non c'è posto: quali oggetti già equipaggiati vanno messi da parte (nello zaino), togliendo per primi quelli
 * che occupano ciò che serve. Null se non c'è modo (non dovrebbe succedere).
 */
export function itemsToDisplace(equipped: readonly ItemDef[], item: ItemDef): ItemDef[] | null {
  const keep = [...equipped];
  const out: ItemDef[] = [];
  while (!fitsEquipment(keep, item)) {
    const needsHands = keep.reduce((n, i) => n + i.hands, 0) + item.hands > EQUIP_HANDS;
    const victim = keep.find((i) => (needsHands && i.hands > 0) || (item.kind === 'armor' && i.kind === 'armor') || (item.kind === 'other' && i.kind === 'other'));
    if (!victim) return null;
    keep.splice(keep.indexOf(victim), 1);
    out.push(victim);
  }
  return out;
}

/** Una riga che descrive l'oggetto: il tipo e le mani, per esempio "Arma · mischia · 1 mano". */
export function itemDetail(item: ItemDef): string {
  const kind = { weapon: 'Arma', shield: 'Scudo', armor: 'Armatura', other: 'Oggetto' }[item.kind];
  const attack = item.attack ? { melee: 'mischia', ranged: 'distanza', magic: 'magia' }[item.attack] : null;
  const hands = item.hands ? `${item.hands} ${item.hands === 1 ? 'mano' : 'mani'}` : null;
  const armor = item.armor ? `armatura +${item.armor}` : null;
  return [kind, attack, hands, armor].filter(Boolean).join(' · ');
}

export { BACKPACK_LIMIT };
