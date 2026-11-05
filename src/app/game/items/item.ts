import { tr } from '../../i18n/catalog-text';
import { localizeName } from '../../i18n/catalog-text';
import { ChestTier } from '../board/marker';
import type { SkillEffect } from '../skills/skill';
import { BACKPACK_LIMIT, EQUIP_ARMOR_LIMIT, EQUIP_HANDS, EQUIP_OTHER_LIMIT, ITEM_GIVE_COST } from '../constants';

/** Il tipo di un oggetto: arma o scudo (usano le mani), armatura, oppure altro (né mani né armatura); `event` è una carta del mazzo che non si tiene (vedi `instant`). Le pozioni non sono oggetti: hanno il loro set. */
export type ItemKind = 'weapon' | 'shield' | 'armor' | 'other' | 'event';

/** I colori dei dadi delle armi. */
export type DieColor = 'red' | 'green' | 'blue' | 'yellow' | 'white' | 'black';

export type AttackType = 'melee' | 'ranged' | 'magic';

/**
 * Una carta oggetto (public/items/<id>.json). Le regole stanno in docs/REGOLE.md, sezione 3c. I dadi e gli effetti restano dati finché non
 * c'è il combattimento.
 */
/** Un livello di un oggetto che cresce (`ItemDef.levels`): i valori che prende al posto di quelli base. Un campo assente lascia quello base; `spark: []` toglie le abilità a scintille. */
export interface ItemLevel {
  dice?: DieColor[];
  spark?: { cost: number; effect: string }[];
  rules?: string[];
}

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
  /**
   * Oggetto maledetto (la Divoratrice di anime): chi lo porta non può scartarlo, posarlo né metterlo nello zaino, e lo ha sempre equipaggiato. Si può solo cederlo a un eroe adiacente
   * (`giveCost`): chi lo riceve lo equipaggia subito, e ciò che gli fa posto va nello zaino (se nello zaino non c'è posto per quello, non si cede). Segue l'eroe anche in città e se muore.
   */
  cursed?: boolean;
  /**
   * Maledizione di fine turno (la Divoratrice di anime): al termine del turno di chi la porta equipaggiata, se **con questa arma** non ha ucciso almeno un mostro durante il turno, perde
   * una frazione delle sue ferite massime (`fraction` 4 = un quarto): l'armatura non le riduce. Può uccidere l'eroe.
   */
  curse?: { fraction: number };
  /** Punti movimento per cederlo a un eroe adiacente (se manca, `ITEM_GIVE_COST`): Zanna costa 2. */
  giveCost?: number;
  /** Non occupa nessun posto fra gli equipaggiamenti (né mani, né oggetti vari): Zanna. */
  slotless?: boolean;
  /** Finché è equipaggiato, chi lo porta non può viaggiare da un glifo all'altro. */
  blocksTravel?: boolean;
  /** Una carta evento dei mazzi: quando si pesca non entra nell'inventario, ha subito il suo effetto (monete e una pozione a chi la pesca, e quante carte in più pescare dallo stesso mazzo). La pozione non c'è se ne porta già il massimo. */
  instant?: { coins?: number; potion?: 'heal' | 'energy'; draw?: number };
  /** Quante copie ci sono nel mazzo `deck` (di solito 1). */
  copies?: number;
  /** Il prezzo in monete: nel negozio si compra per questa cifra. */
  price: number;
  /** I dadi che l'oggetto dà all'attacco, per colore: `red`, `green`, `blue`, `yellow` o `white` (le facce si decideranno con il combattimento). */
  dice?: DieColor[];
  /** Gli effetti a scintille: costo in scintille ed effetto, a parole. */
  spark?: { cost: number; effect: string }[];
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
  /**
   * Un oggetto che cresce (la Divoratrice di anime: più sigilli si spezzano, più è forte): `levels[n]` sono i valori al livello `n` (da 0) e l'**ultima riga è il livello finale**. Il livello
   * sta nello stato della partita e lo alza l'effetto degli eventi "Fai crescere un oggetto" (`GameState.addItemLevel`). Non è nel catalogo: lo scrive l'autore per la sua avventura (`ItemMod`).
   */
  levels?: ItemLevel[];
  /** Come si chiama ciò che fa crescere l'oggetto ("Sigilli spezzati"): compare sulla carta con il livello di adesso. */
  levelLabel?: string;
  /** Solo nello stato di gioco, per gli oggetti con `levels`: il livello di adesso e quello finale (la carta mostra "2/4"). */
  level?: number;
  levelMax?: number;
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

/**
 * Come un'avventura personalizza un oggetto del catalogo (`MapData.itemMods`, scritto nell'editor con "Oggetti personalizzati"): solo ciò che cambia. All'inizio della partita si sovrappone
 * alla carta del catalogo (`applyItemMods`), che non cambia mai.
 */
export interface ItemMod {
  /** L'id dell'oggetto del catalogo. */
  id: string;
  /** Come si chiama ciò che fa crescere l'oggetto ("Sigilli spezzati"). */
  levelLabel?: string;
  /** I livelli (da 0): ogni riga ha i dadi e le abilità a scintille di quel livello; l'ultima è il livello finale. */
  levels?: ItemLevel[];
  /** Senza livelli: i dadi e le abilità a scintille al posto di quelli della carta. */
  dice?: DieColor[];
  spark?: { cost: number; effect: string }[];
  /** Maledetto: vedi `ItemDef.cursed`. */
  cursed?: boolean;
  /** Maledizione di fine turno: vedi `ItemDef.curse`. */
  curse?: { fraction: number };
  /** Punti movimento per cederlo (di base `ITEM_GIVE_COST`). */
  giveCost?: number;
  /** Gli id delle armi di cui chi lo ha equipaggiato non subisce le scintille (regola `protectFrom`): la Corazza runica contro il Tocco della morte. */
  protectFrom?: string[];
}

/** Una copia dell'oggetto che mantiene i getter (il nome segue la lingua), da modificare. */
function cloneItem(def: ItemDef): ItemDef {
  return Object.create(Object.getPrototypeOf(def), Object.getOwnPropertyDescriptors(def)) as ItemDef;
}

/**
 * Il catalogo con le personalizzazioni dell'avventura: gli oggetti in `mods` sono copie con i valori cambiati e, per un oggetto maledetto o con la maledizione di fine turno, le righe di regole che
 * lo dicono (non si scrivono a mano). Gli altri oggetti restano gli stessi.
 */
export function applyItemMods(items: ReadonlyMap<string, ItemDef>, mods: readonly ItemMod[]): ReadonlyMap<string, ItemDef> {
  if (!mods.length) return items;
  const out = new Map(items);
  for (const m of mods) {
    const base = items.get(m.id);
    if (!base) continue;
    const copy = cloneItem(base);
    if (m.levels?.length) {
      copy.levels = m.levels.map((l) => ({ ...(l.dice ? { dice: [...l.dice] } : {}), ...('spark' in l ? { spark: (l.spark ?? []).map((x) => ({ ...x })) } : {}), ...(l.rules ? { rules: [...l.rules] } : {}) }));
      if (m.levelLabel?.trim()) copy.levelLabel = m.levelLabel.trim();
    } else {
      if (m.dice) copy.dice = [...m.dice];
      if (m.spark) copy.spark = m.spark.map((x) => ({ ...x }));
    }
    const rules = [...(base.rules ?? [])];
    if (m.cursed) {
      copy.cursed = true;
      copy.giveCost = m.giveCost ?? ITEM_GIVE_COST;
      rules.push(tr('Maledetto: non si può scartare, posare né mettere nello zaino. Si cede a un eroe adiacente per {mov:{cost}}: chi lo riceve lo equipaggia subito, e l\'oggetto che gli fa posto va nello zaino.', { cost: copy.giveCost }));
    } else if (m.giveCost !== undefined) copy.giveCost = m.giveCost;
    if (m.curse) {
      copy.curse = { fraction: m.curse.fraction };
      rules.push(tr('Al termine del tuo turno, se non hai ucciso un mostro con questo oggetto durante il turno, subisci ferite pari a 1/{n} delle tue ferite massime: l\'armatura non le riduce.', { n: m.curse.fraction }));
    }
    if (m.protectFrom?.length) {
      copy.effects = [...(base.effects ?? []), { kind: 'rule', rule: 'protectFrom', items: [...m.protectFrom] }];
      for (const id of m.protectFrom) rules.push(tr('Le scintille dell\'arma {weapon} non funzionano contro di te.', { weapon: items.get(id)?.name ?? id }));
    }
    if (rules.length !== (base.rules ?? []).length) copy.rules = rules;
    out.set(m.id, copy);
  }
  return out;
}

/**
 * L'oggetto com'è al livello `level` (0 … l'ultimo): i valori di quella riga di `levels` al posto di quelli base, più `level` e `levelMax` per la carta. Senza `levels` è l'oggetto stesso. È una copia
 * che mantiene i getter, quindi si può usare dove si usava l'oggetto del catalogo.
 */
export function itemAtLevel(base: ItemDef, level: number): ItemDef {
  const levels = base.levels;
  if (!levels?.length) return base;
  const max = levels.length - 1;
  const at = Math.max(0, Math.min(max, Math.floor(level)));
  const copy = cloneItem(base);
  const over = levels[at];
  if (over.dice) copy.dice = [...over.dice];
  if ('spark' in over) copy.spark = over.spark?.length ? over.spark.map((x) => ({ ...x })) : undefined;
  if (over.rules) copy.rules = [...over.rules];
  copy.level = at;
  copy.levelMax = max;
  return copy;
}
