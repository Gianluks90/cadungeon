import { AttackType } from '../items/item';
import { Piece } from '../pieces/piece';
import { Effect, effectsOf } from './effects';
import type { GameState } from './game-state';

/**
 * Ripetere i dadi scegliendo (docs/cards/abilities.md, livello 3): un effetto `reroll` dà all'eroe di ripetere `count` dadi a sua scelta dopo aver tirato un attacco
 * dei tipi `on`. Le condizioni: `ifNotMoved` (non ha speso punti movimento in questo turno) e `firstOnly` (solo il primo attacco di quel tipo del round).
 * Così Occhio del cacciatore di Anarien e, in futuro, i comandi Mira e Schivata stanno nella stessa forma.
 */
interface RerollEffect extends Effect {
  name?: string;
  count?: number;
  ifNotMoved?: boolean;
  firstOnly?: boolean;
}

/** Quanti dadi può ripetere `hero` con questo attacco e chi glielo permette (vuoto se nessuno). */
export function rerollsFor(state: GameState, hero: Piece, attack: AttackType): { count: number; sources: string[] } {
  let count = 0;
  const sources: string[] = [];
  for (const { source, effect } of effectsOf(state, hero)) {
    const e = effect as RerollEffect;
    if (e.kind !== 'reroll') continue;
    const on = Array.isArray(e.on) ? e.on : e.on ? [e.on] : [];
    if (on.length && !on.includes(attack)) continue;
    if (e.ifNotMoved && hero.pointsUsed > 0) continue;
    if (e.firstOnly && (hero.attackTypesUsed ?? []).includes(attack)) continue;
    count += e.count ?? 1;
    sources.push(source);
  }
  return { count, sources };
}
