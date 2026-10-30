import { tr } from '../../i18n/catalog-text';
import { Piece } from '../pieces/piece';
import type { GameState } from './game-state';
import { ruleAmount } from './effects';

/**
 * Le reazioni alle ferite ricevute (docs/cards/abilities.md, sezione 8, livello 2): effetti `react` con `on: "wounds"` degli oggetti equipaggiati e dell'abilità
 * dell'eroe. Quando un attacco sta per togliere ferite a un eroe si applicano prima di toglierle: quelle automatiche tirano dei dadi (i Mantelli: un dado potere per
 * ogni ferita, ne annullano una per faccia vuota o per onda), quelle a scelta (gli Scudi che si esauriscono, Pelle di corteccia di Ferdinand) vengono proposte al giocatore.
 * Valgono per le ferite degli attacchi (che l'armatura può ridurre); le ferite che la ignorano (buche, fiamme, trappole) non si possono annullare così.
 */
export interface WoundReaction {
  /** Un nome stabile: `<id oggetto>:<posizione>` o `hero:<posizione>` (serve per ricordare che è esaurita). */
  id: string;
  name: string;
  /** Automatica (i dadi) o a scelta. */
  auto: boolean;
  /** Cosa annulla: un numero di ferite, oppure una per faccia `blank` (vuota) o `surge` (onda) dei dadi. */
  cancel: number | 'blank' | 'surge';
  /** Si esaurisce (fino al round dopo) quando si usa. */
  exhaust: boolean;
  /** È lo scudo di un oggetto (Ambidestro ne annulla 1 in più). */
  shield: boolean;
}

interface ReactEffect {
  kind?: string;
  on?: string;
  name?: string;
  auto?: boolean;
  cancel?: number | 'blank' | 'surge';
  cost?: { exhaust?: boolean };
}

/** Le reazioni alle ferite dell'eroe (di oggetti equipaggiati e dell'abilità dell'eroe). */
export function woundReactions(state: GameState, hero: Piece): WoundReaction[] {
  const out: WoundReaction[] = [];
  for (const itemId of hero.equipped) {
    const def = state.items.get(itemId);
    ((def?.effects ?? []) as ReactEffect[]).forEach((e, i) => {
      if (e.kind === 'react' && e.on === 'wounds') out.push({ id: `${itemId}:${i}`, name: def!.name, auto: !!e.auto, cancel: e.cancel ?? 1, exhaust: !!e.cost?.exhaust, shield: def!.kind === 'shield' });
    });
  }
  (hero.heroEffects as ReactEffect[] | undefined)?.forEach((e, i) => {
    if (e.kind === 'react' && e.on === 'wounds') out.push({ id: `hero:${i}`, name: e.name ?? tr('Abilità'), auto: !!e.auto, cancel: e.cancel ?? 1, exhaust: !!e.cost?.exhaust, shield: false });
  });
  return out;
}

/** Perché una reazione non si può usare adesso (esaurita), o undefined. */
export function reactionBlock(hero: Piece, r: WoundReaction): string | undefined {
  return r.exhaust && hero.exhausted?.includes(r.id) ? tr('esaurita fino al prossimo round') : undefined;
}

/** Quante ferite annulla una reazione a numero fisso: quelle scritte, più 1 con Ambidestro se è uno scudo. */
export function cancelAmount(state: GameState, hero: Piece, r: WoundReaction): number {
  if (typeof r.cancel !== 'number') return 0;
  return r.cancel + (r.shield ? ruleAmount(state, hero, 'shieldBlock') : 0);
}

/** La reazione è stata usata: se si esaurisce, resta tale fino al round dopo. */
export function markReactionUsed(hero: Piece, r: WoundReaction): void {
  if (r.exhaust) (hero.exhausted ??= []).push(r.id);
}
