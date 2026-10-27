import { Board } from '../board/board';
import { Piece } from '../pieces/piece';
import { ItemDef } from '../items/item';
import { adjacentHeroes, canActOnMap, spendPoints } from './actions';
import { Effect } from './effects';
import type { GameState } from './game-state';
import { healWounds } from './status';

/**
 * Gli oggetti che si usano (docs/cards/abilities.md, sezione 4): un effetto `use` nei dati dell'oggetto, con un costo (fatica, punti movimento, scartare l'oggetto,
 * esaurirlo), una condizione (`when: 'turnStart'` = prima di muoversi e di attaccare), cosa fa (`do`: curare ferite, recuperare fatica, a sé, a sé o a un adiacente,
 * a sé e agli adiacenti) e se si può ripetere. Funzionano solo se l'oggetto è equipaggiato. Sono regole sullo stato, senza interfaccia.
 */
interface UseEffect extends Effect {
  when?: string;
  cost?: { fatigue?: number; movement?: number; discard?: boolean; exhaust?: boolean };
  repeatable?: boolean;
  do?: { op: string; amount?: number | 'full'; who?: 'self' | 'selfOrAdjacent' | 'selfAndAdjacent' }[];
}

/** Come si presenta un uso nella card dell'oggetto. */
export interface ItemUse {
  itemId: string;
  /** I costi con le icone ("{mov:1} {fat:1}"), prima del testo del bottone. */
  cost: string;
  /** Una parola dopo il testo ("scarta") se l'uso consuma l'oggetto o lo esaurisce. */
  extra: string;
  enabled: boolean;
  /** Se non si può, perché. */
  reason?: string;
  /** Chi può scegliere un altro eroe come bersaglio (la Cura maggiore). */
  pickTarget: boolean;
}

function effectOf(def: ItemDef | undefined): UseEffect | null {
  return ((def?.effects ?? []) as UseEffect[]).find((e) => e.kind === 'use') ?? null;
}

const full = (v: number | 'full' | undefined, max: number) => (v === 'full' ? max : Number(v ?? 1));

/** I bersagli possibili: l'eroe stesso e, a seconda dell'oggetto, gli adiacenti. */
function targetsFor(state: GameState, board: Board | null, piece: Piece, who: string): Piece[] {
  const near = board ? adjacentHeroes(state, board, piece) : [];
  return who === 'self' ? [piece] : [piece, ...near];
}

/** C'è qualcosa da guarire o recuperare fra questi? (Per non sprecare un oggetto che si scarta o la fatica.) */
function worthUsing(e: UseEffect, targets: Piece[]): boolean {
  return (e.do ?? []).some((op) => targets.some((t) => (op.op === 'heal' ? t.wounds < t.maxWounds || t.status.poison > 0 : op.op === 'recoverFatigue' ? t.fatigue < t.maxFatigue : false)));
}

/** L'uso dell'oggetto `itemId` dell'eroe, o null se non ne ha uno (o non è equipaggiato). */
export function itemUse(state: GameState, board: Board | null, piece: Piece, itemId: string): ItemUse | null {
  const def = state.items.get(itemId);
  const e = effectOf(def);
  if (!def || !e || !piece.equipped.includes(itemId)) return null;
  const c = e.cost ?? {};
  const cost = [c.movement ? `{mov:${c.movement}}` : '', c.fatigue ? `{fat:${c.fatigue}}` : ''].filter(Boolean).join(' ');
  const extra = c.discard ? 'scarta' : c.exhaust ? 'esaurisci' : '';
  const who = e.do?.find((op) => op.who)?.who ?? 'self';
  let reason: string | undefined;
  if (!canActOnMap(state, piece)) reason = 'Ora non puoi';
  else if (piece.toad) reason = 'Un rospo non usa oggetti';
  else if (e.when === 'turnStart' && (piece.pointsUsed > 0 || piece.attacksUsed > 0)) reason = "Solo all'inizio del tuo turno, prima di muoverti o attaccare";
  else if (c.exhaust && piece.exhausted?.includes(itemId)) reason = "L'oggetto è esaurito fino al prossimo round";
  else if (c.movement && piece.points < c.movement) reason = `Servono {mov:${c.movement}}`;
  else if (c.fatigue && piece.fatigue < c.fatigue) reason = 'Non hai abbastanza fatica';
  else if (!worthUsing(e, targetsFor(state, board, piece, who))) reason = who === 'self' ? 'Sei già in piena salute' : 'Nessuno ha bisogno di cure';
  return { itemId, cost, extra, enabled: !reason, reason, pickTarget: who === 'selfOrAdjacent' };
}

/** Cosa è successo usando un oggetto. */
export type ItemUseResult = { ok: true; notice: string; healed: Piece[] } | { ok: false; reason: string };

/** Usa l'oggetto: paga il costo e fa i suoi effetti. `targetId` sceglie l'eroe da curare (la Cura maggiore: sé o un adiacente). */
export function useItem(state: GameState, board: Board | null, piece: Piece, itemId: string, targetId?: string): ItemUseResult {
  const use = itemUse(state, board, piece, itemId);
  const def = state.items.get(itemId);
  const e = effectOf(def);
  if (!use || !def || !e) return { ok: false, reason: 'Non puoi usarlo' };
  if (!use.enabled) return { ok: false, reason: use.reason ?? 'Non è possibile' };
  const c = e.cost ?? {};
  const notes: string[] = [];
  const touched = new Set<Piece>();
  for (const op of e.do ?? []) {
    const who = op.who ?? 'self';
    let targets: Piece[];
    if (who === 'selfOrAdjacent') {
      const choice = targetsFor(state, board, piece, who).find((t) => t.id === (targetId ?? piece.id));
      targets = [choice ?? piece];
    } else targets = targetsFor(state, board, piece, who);
    for (const t of targets) {
      if (op.op === 'heal') {
        const r = healWounds(t, full(op.amount, t.maxWounds));
        notes.push(`${t.name}: +${r.healed} ${r.healed === 1 ? 'ferita' : 'ferite'}${r.curedPoison ? `, −${r.curedPoison} veleno` : ''}`);
      } else if (op.op === 'recoverFatigue') {
        const n = Math.min(t.maxFatigue - t.fatigue, full(op.amount, t.maxFatigue));
        t.fatigue += n;
        if (n) notes.push(`${t.name}: +{fat:${n}}`);
      }
      touched.add(t);
    }
  }
  if (c.fatigue) piece.fatigue -= c.fatigue;
  if (c.movement) spendPoints(piece, c.movement);
  if (c.exhaust) (piece.exhausted ??= []).push(itemId);
  if (c.discard) {
    for (const list of [piece.equipped, piece.backpack]) {
      const i = list.indexOf(itemId);
      if (i >= 0) {
        list.splice(i, 1);
        break;
      }
    }
  }
  return { ok: true, notice: `${def.name}: ${notes.join(' · ') || 'nessun effetto'}`, healed: [...touched] };
}
