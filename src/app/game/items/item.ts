import { tr } from '../../i18n/catalog-text';
import { localizeName } from '../../i18n/catalog-text';
import { ChestTier } from '../board/marker';
import type { SkillEffect } from '../skills/skill';
import { BACKPACK_LIMIT, EQUIP_ARMOR_LIMIT, EQUIP_HANDS, EQUIP_OTHER_LIMIT } from '../constants';

/** Il tipo di un oggetto: arma o scudo (usano le mani), armatura, oppure altro (né mani né armatura); `event` è una carta del mazzo che non si tiene (vedi `instant`). Le pozioni non sono oggetti: hanno il loro set. */
export type ItemKind = 'weapon' | 'shield' | 'armor' | 'other' | 'event';

/** I colori dei dadi delle armi. */
export type DieColor = 'red' | 'green' | 'blue' | 'yellow' | 'white' | 'black';

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
  /** Passivo: finché è equipaggiato, la velocità dell'eroe non supera questo valore. */
  speedCap?: number;
  /** Passivo: le etichette (`tags`) degli oggetti che non si possono equipaggiare insieme a questo, in nessuno dei due sensi. */
  forbidsTags?: string[];
  /** Passivo: punti movimento in più a ogni turno, anche se l'azione ne dà zero (come Combattere). Può essere negativo (chi porta la Principessa ne ha uno in meno, mai sotto 0). */
  movementBonus?: number;
  /** Oggetto trasportato (la Principessa...): conta come un oggetto equipaggiato ma non va mai nello zaino e non si scarta, si posa a terra (azione "Posa"); chi lo porta lo lascia a terra se muore, e un mostro può prenderlo (comportamento globale `carry`). */
  carried?: boolean;
  /** Punti movimento per cederlo a un eroe adiacente (se manca, `ITEM_GIVE_COST`): Zanna costa 2. */
  giveCost?: number;
  /** Non occupa nessun posto fra gli equipaggiamenti (né mani, né oggetti vari): Zanna. */
  slotless?: boolean;
  /** Finché è equipaggiato, chi lo porta non può viaggiare da un glifo all'altro. */
  blocksTravel?: boolean;
  /** Una carta evento dei mazzi: quando si pesca non entra nell'inventario, ha subito il suo effetto (monete e una pozione a chi la pesca, e quante carte in più pescare dallo stesso mazzo). La pozione non c'è se ne porta già il massimo. */
  instant?: { coins?: number; potion?: 'heal' | 'vital'; draw?: number };
  /** Quante copie ci sono nel mazzo `deck` (di solito 1). */
  copies?: number;
  /** Il prezzo in monete: nel negozio si compra per questa cifra. */
  price: number;
  /** I dadi che l'oggetto dà all'attacco, per colore: `red`, `green`, `blue`, `yellow` o `white` (le facce si decideranno con il combattimento). */
  dice?: DieColor[];
  /** Gli effetti a Scariche: costo in Scariche ed effetto, a parole. */
  surge?: { cost: number; effect: string }[];
  /** Il bonus di supporto: lo dà all'altra arma quando l'eroe ha due armi da mischia a una mano e attacca con l'altra (docs/REGOLE.md, "Brandire due armi"). */
  offHand?: string;
  /** Il nome di un'icona (public/icons/). */
  icon?: string;
  /** Etichette di categoria, per esempio `rune` (un oggetto "Runa": certe armature non permettono di equipaggiarlo). */
  tags?: string[];
  /** Regole scritte a parole (parole chiave come "Perforare 1", limiti, abilità da attivare): per ora solo testo, senza effetto. */
  rules?: string[];
  /** Nascosto: l'oggetto resta nel file ma non viene caricato, quindi non esiste nel gioco (né nei mazzi, né nel negozio, né nel catalogo). */
  hide?: boolean;
  /** Gli effetti passivi dell'oggetto nel vocabolario delle carte abilità (`attack`, `stat`, `rule`...), attivi finché è equipaggiato (docs/cards/abilities.md, sezione 9). */
  effects?: SkillEffect[];
  /** Se è un tesoro, in quale mazzo degli scrigni sta (rame, argento o oro). Senza, non si trova negli scrigni. */
  deck?: ChestTier;
}

/** Carica il catalogo degli oggetti: un solo file, public/items/catalog.json (`{ items: [...] }`). Se manca, il catalogo è vuoto. */
export async function loadItemCatalog(): Promise<Map<string, ItemDef>> {
  const items = new Map<string, ItemDef>();
  try {
    const res = await fetch('items/catalog.json');
    if (!res.ok) return items;
    const file: { items: ItemDef[] } = await res.json();
    for (const item of file.items) if (!item.hide) items.set(item.id, localizeName('item', item));
  } catch {
    console.warn('Catalogo degli oggetti non trovato');
  }
  return items;
}

/**
 * Carica le scorte di un negozio: public/shops/<id>.json (`{ stock: { <id oggetto>: copie } }`). Solo gli oggetti elencati si vendono;
 * le scorte sono limitate e comuni a tutti gli eroi.
 */
export async function loadShopStock(shopId: string): Promise<Record<string, number>> {
  try {
    const res = await fetch(`shops/${shopId}.json`);
    if (!res.ok) return {};
    return (await res.json()).stock ?? {};
  } catch {
    console.warn(`Negozio "${shopId}" non trovato`);
    return {};
  }
}

/** `item` è incompatibile con qualcosa che è già equipaggiato (per i divieti delle etichette, in un senso o nell'altro)? */
export function conflictsWith(equipped: readonly ItemDef[], item: ItemDef): ItemDef | null {
  return (
    equipped.find(
      (e) => item.forbidsTags?.some((t) => e.tags?.includes(t)) || e.forbidsTags?.some((t) => item.tags?.includes(t)),
    ) ?? null
  );
}

/** Armatura totale: quella dell'eroe più quella degli oggetti equipaggiati. */
export function totalArmor(base: number, equipped: readonly ItemDef[]): number {
  return base + equipped.reduce((n, i) => n + (i.armor ?? 0), 0);
}

/** Punti movimento in più che gli oggetti equipaggiati danno a ogni turno. */
export function movementBonusOf(equipped: readonly ItemDef[]): number {
  return equipped.reduce((n, i) => n + (i.movementBonus ?? 0), 0);
}

/** Velocità effettiva: quella dell'eroe, ridotta dal limite più basso fra gli oggetti equipaggiati. */
export function cappedSpeed(base: number, equipped: readonly ItemDef[]): number {
  return equipped.reduce((s, i) => (i.speedCap !== undefined ? Math.min(s, i.speedCap) : s), base);
}

/** L'oggetto sta nell'equipaggiamento già pieno di `equipped`? Al massimo 2 mani, 1 armatura e 2 oggetti vari. */
export function fitsEquipment(equipped: readonly ItemDef[], item: ItemDef): boolean {
  if (conflictsWith(equipped, item)) return false;
  const hands = equipped.reduce((n, i) => n + i.hands, 0) + item.hands;
  if (hands > EQUIP_HANDS) return false;
  if (item.kind === 'armor' && equipped.filter((i) => i.kind === 'armor').length + 1 > EQUIP_ARMOR_LIMIT) return false;
  if (item.kind === 'other' && !item.slotless && equipped.filter((i) => i.kind === 'other' && !i.slotless).length + 1 > EQUIP_OTHER_LIMIT) return false;
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
  const kind = { weapon: tr('Arma'), shield: tr('Scudo'), armor: tr('Armatura'), other: tr('Oggetto'), event: tr('Evento') }[item.kind];
  const attack = item.attack ? { melee: tr('mischia'), ranged: tr('distanza'), magic: tr('magia') }[item.attack] : null;
  const hands = item.hands ? (item.hands === 1 ? tr('1 mano') : tr('{n} mani', { n: item.hands })) : null;
  const armor = item.armor ? tr('armatura +{n}', { n: item.armor }) : null;
  const relic = item.tags?.includes('relic') ? tr('Reliquia') : null;
  const rune = item.tags?.includes('rune') ? tr('Runa') : null;
  return [kind, relic, rune, attack, hands, armor].filter(Boolean).join(' · ');
}

export { BACKPACK_LIMIT };
