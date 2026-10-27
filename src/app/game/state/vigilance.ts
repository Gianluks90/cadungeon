import { Board } from '../board/board';
import { Piece, footprint } from '../pieces/piece';
import { AttackOption, controlledAttackOptions } from './combat';
import { Effect } from './effects';
import type { GameState } from './game-state';

/**
 * Vigilanza (docs/cards/skill-subterfuge.md): quando un nemico entra in una casella adiacente all'eroe, questi può spendere 2 fatica per attaccarlo subito
 * (una volta per ogni volta che un nemico entra). Qui si decide chi ne ha la possibilità dopo ogni passo di un mostro; la scena chiede al giocatore e svolge
 * l'attacco (fuori dal turno degli eroi, senza consumare i suoi attacchi).
 */
export interface VigilanceChance {
  hero: Piece;
  /** La fatica da spendere. */
  cost: number;
  /** Le armi (o i pugni) con cui può attaccare quel mostro adesso. */
  options: AttackOption[];
}

interface VigilanceEffect extends Effect {
  on?: string;
  cost?: { fatigue?: number };
}

/** La fatica che costa la Vigilanza a `hero`, o null se non ce l'ha. */
function vigilanceCost(state: GameState, hero: Piece): number | null {
  for (const cardId of hero.skillCards) {
    for (const e of state.skills.get(cardId)?.effects ?? []) {
      const t = e as VigilanceEffect;
      if (t.kind === 'trigger' && t.on === 'enemyEntersAdjacent') return t.cost?.fatigue ?? 0;
    }
  }
  return null;
}

const adjacent = (a: Pick<Piece, 'cell' | 'size'>, b: Pick<Piece, 'cell' | 'size'>) =>
  footprint(a).some((c) => footprint(b).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1));

/**
 * Gli eroi che possono usare la Vigilanza contro `monster`, che con l'ultimo passo è appena entrato in una casella adiacente a loro (prima, da `from`,
 * non lo era): hanno la carta, la fatica, e un'arma con cui colpirlo adesso.
 */
export function vigilanceChances(state: GameState, board: Board, monster: Piece, from: Pick<Piece, 'cell' | 'size'>): VigilanceChance[] {
  if (monster.team !== 'monster' || monster.city) return [];
  const out: VigilanceChance[] = [];
  for (const hero of state.pieces) {
    if (hero.team !== 'hero' || hero.city || hero.toad || hero.wounds <= 0) continue;
    const cost = vigilanceCost(state, hero);
    if (cost === null || hero.fatigue < cost) continue;
    if (!adjacent(hero, monster) || adjacent(hero, from)) continue; // deve essere appena entrato
    const options = controlledAttackOptions(state, board, hero, monster);
    if (options.length) out.push({ hero, cost, options });
  }
  return out;
}

/**
 * Guardia (ordine, docs/REGOLE.md): durante il turno dell'Overlord un eroe con l'ordine di Guardia può interrompere un mostro che può attaccare con un attacco,
 * gratis. Chi rifiuta (`declined`) non può ripensarci per la stessa attivazione del mostro.
 */
export function guardChances(state: GameState, board: Board, monster: Piece, declined: ReadonlySet<string>): VigilanceChance[] {
  if (monster.team !== 'monster' || monster.city || monster.wounds <= 0) return [];
  const out: VigilanceChance[] = [];
  for (const hero of state.pieces) {
    if (hero.team !== 'hero' || hero.city || hero.toad || hero.wounds <= 0 || hero.order !== 'guard' || declined.has(hero.id)) continue;
    const options = controlledAttackOptions(state, board, hero, monster).filter((o) => o.enabled);
    if (options.length) out.push({ hero, cost: 0, options });
  }
  return out;
}
