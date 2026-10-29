import type { Obstacle } from '../board/obstacle';

/**
 * Un comportamento speciale di un nemico: un vincolo su dove può fermarsi, uguale per lo script e per il Signore supremo umano (`monsterMayStop` in `state/overlord.ts`).
 * - `stay`: non lascia la sua casella (attacca solo chi gli è a portata).
 * - `endNear`: finisce sempre il turno accanto all'ostacolo che ha come casella (`x`, `y`: quella da cui parte, come nell'avventura); può muoversi e attaccare, ma solo per fermarsi in una casella accanto.
 * Senza comportamento il nemico gioca come sempre.
 */
export type PawnBehavior = { kind: 'stay' } | { kind: 'endNear'; x: number; y: number };

export type BehaviorKind = PawnBehavior['kind'];

/** Le voci della select "Comportamento" ('' = normale). */
export const BEHAVIOR_OPTIONS: readonly { value: BehaviorKind | ''; label: string }[] = [
  { value: '', label: 'Normale' },
  { value: 'stay', label: 'Resta fermo' },
  { value: 'endNear', label: 'Termina il turno accanto a…' },
];

export const behaviorKind = (b: PawnBehavior | undefined): BehaviorKind | '' => b?.kind ?? '';
export const behaviorTarget = (b: PawnBehavior | undefined): string => (b?.kind === 'endNear' ? `${b.x},${b.y}` : '');

/** Il comportamento come lo scrive la dialog (tipo e, per `endNear`, l'ostacolo "x,y"); senza un ostacolo valido, `endNear` non è ancora un comportamento. */
export function behaviorFrom(kind: BehaviorKind | '', target: string): PawnBehavior | undefined {
  if (kind === 'stay') return { kind };
  if (kind === 'endNear') {
    const [x, y] = target.split(',').map(Number);
    return Number.isInteger(x) && Number.isInteger(y) ? { kind, x, y } : undefined;
  }
  return undefined;
}

export const sameBehavior = (a: PawnBehavior | undefined, b: PawnBehavior | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const TYPE_NAMES: Record<Obstacle['type'], string> = { rock: 'Macerie', pit: 'Buca', water: 'Acqua' };

/** L'ostacolo come si sceglie nelle select ("Macerie · casella x, y", con l'area se c'è); il valore è "x,y". */
export function obstacleOption(o: Obstacle, area?: string): { value: string; label: string } {
  return { value: `${o.x},${o.y}`, label: `${TYPE_NAMES[o.type]} · casella ${o.x}, ${o.y}${area ? ` · ${area}` : ''}` };
}
