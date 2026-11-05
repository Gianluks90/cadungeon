import { translate as t } from '../../i18n/i18n.service';
import type { Obstacle } from '../board/obstacle';

/**
 * Un comportamento speciale di un nemico: un vincolo su dove può fermarsi, uguale per lo script e per il Maligno umano (`monsterMayStop` in `state/evil.ts`).
 * - `stay`: non lascia la sua casella (attacca solo chi gli è a portata).
 * - `endNear`: finisce sempre il turno accanto all'ostacolo che ha come casella (`x`, `y`: quella da cui parte, come nell'avventura); può muoversi e attaccare, ma solo per fermarsi in una casella accanto.
 * - `carry`: raccoglie gli oggetti trasportabili (`ItemDef.carried`): si ferma sulla loro casella e li prende (non è un vincolo ma una capacità, vedi `state/behaviors.ts`); con `itemId` solo quell'oggetto, senza qualsiasi oggetto trasportabile.
 * - `useItem`: attacca come un eroe con quell'oggetto (arma del catalogo, che non va nel suo equipaggiamento): i suoi dadi e le sue scintille, più `melee`/`ranged`/`magic` dadi competenza (neri) per quel tipo di attacco, che i mostri normalmente non hanno. Non è un vincolo sulle caselle.
 * Senza comportamento il nemico gioca come sempre.
 */
export interface UseItemDice { melee?: number; ranged?: number; magic?: number }
/** Quando usa l'oggetto: sempre (assente), a round alterni con il suo attacco normale (`alternate`: round dispari l'oggetto, pari l'attacco normale) o a caso (`random`: ogni round 50%, lo stesso per tutto il round). */
export type UseItemMode = 'alternate' | 'random';
export type PawnBehavior = { kind: 'stay' } | { kind: 'endNear'; x: number; y: number } | { kind: 'carry'; itemId?: string } | ({ kind: 'useItem'; itemId: string; mode?: UseItemMode } & UseItemDice);

/** Un comportamento valido per tutta l'avventura (`MapData.behaviors`): per i mostri dei tipi elencati (id del catalogo) o, senza elenco, per tutti; un mostro può ignorarlo (Personalizza). */
export interface GlobalBehavior {
  behavior: PawnBehavior;
  monsters?: string[];
}

export type BehaviorKind = PawnBehavior['kind'];

/** Le voci della select "Comportamento" ('' = normale). */
export const BEHAVIOR_OPTIONS: readonly { value: BehaviorKind | ''; label: string }[] = [
  { value: '', get label() { return t('behavior.normal'); } },
  { value: 'stay', get label() { return t('behavior.stay'); } },
  { value: 'endNear', get label() { return t('behavior.endNear'); } },
  { value: 'carry', get label() { return t('behavior.carry'); } },
  { value: 'useItem', get label() { return t('behavior.useItem'); } },
];

export const behaviorKind = (b: PawnBehavior | undefined): BehaviorKind | '' => b?.kind ?? '';
export const behaviorTarget = (b: PawnBehavior | undefined): string => (b?.kind === 'endNear' ? `${b.x},${b.y}` : '');
/** L'oggetto scelto per `carry` (vuoto = qualsiasi oggetto trasportabile). */
export const behaviorItem = (b: PawnBehavior | undefined): string => (b?.kind === 'carry' || b?.kind === 'useItem' ? (b.itemId ?? '') : '');
/** Il modo di `useItem` come lo scrive la select ('' = sempre). */
export const behaviorMode = (b: PawnBehavior | undefined): UseItemMode | '' => (b?.kind === 'useItem' ? (b.mode ?? '') : '');
/** I dadi competenza di `useItem` come si digitano ('' = 0). */
export const behaviorDice = (b: PawnBehavior | undefined): Record<keyof UseItemDice, string> =>
  b?.kind === 'useItem' ? { melee: b.melee ? String(b.melee) : '', ranged: b.ranged ? String(b.ranged) : '', magic: b.magic ? String(b.magic) : '' } : { melee: '', ranged: '', magic: '' };

/** Il comportamento come lo scrive la dialog (tipo e, per `endNear`, l'ostacolo "x,y"); senza un ostacolo valido, `endNear` non è ancora un comportamento. */
export function behaviorFrom(kind: BehaviorKind | '', target: string, itemId = '', dice: Partial<Record<keyof UseItemDice, string>> = {}, mode = ''): PawnBehavior | undefined {
  if (kind === 'stay') return { kind };
  if (kind === 'useItem') {
    if (!itemId) return undefined; // serve l'oggetto
    const n = (s?: string) => Math.max(0, Math.floor(Number(s) || 0));
    return { kind, itemId, ...(mode === 'alternate' || mode === 'random' ? { mode } : {}), ...(n(dice.melee) ? { melee: n(dice.melee) } : {}), ...(n(dice.ranged) ? { ranged: n(dice.ranged) } : {}), ...(n(dice.magic) ? { magic: n(dice.magic) } : {}) };
  }
  if (kind === 'carry') return { kind, ...(itemId ? { itemId } : {}) };
  if (kind === 'endNear') {
    const [x, y] = target.split(',').map(Number);
    return Number.isInteger(x) && Number.isInteger(y) ? { kind, x, y } : undefined;
  }
  return undefined;
}

export const sameBehavior = (a: PawnBehavior | undefined, b: PawnBehavior | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);


/** L'ostacolo come si sceglie nelle select ("Macerie · casella x, y", con l'area se c'è); il valore è "x,y". */
export function obstacleOption(o: Obstacle, area?: string): { value: string; label: string } {
  return { value: `${o.x},${o.y}`, label: `${t(`obstacle.${o.type}`)} · ${t('pickup.cell', { x: o.x, y: o.y })}${area ? ` · ${area}` : ''}` };
}
