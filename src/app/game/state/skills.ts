import { tr } from '../../i18n/catalog-text';
import { Piece, footprint } from '../pieces/piece';
import { canActOnMap, speedOf } from './actions';
import { Effect } from './effects';
import type { GameState } from './game-state';

/**
 * Le abilità da usare (docs/cards/abilities.md, sezione 9): le carte con un `trigger` opzionale. Si usano dal bottone sulla carta nella scheda dell'eroe; ognuna ha
 * le sue condizioni (per esempio "quando scegli Combattere": prima di muoversi e attaccare) e il suo costo (fatica, la carta che si esaurisce). I loro effetti (`do`)
 * sono azioni semplici: recuperare fatica, attacchi o movimento in più, armatura fino al turno dopo.
 */

export interface SkillAction {
  /** `<id carta>:<posizione dell'effetto>`. */
  id: string;
  cardId: string;
  /** `active`: la sceglie l'eroe e poi indica altro (Telecinesi: il modello e dove spostarlo); `trigger`: si usa subito. */
  kind: 'trigger' | 'active';
  /** Il costo a parole ("2 fatica", "2 fatica · esaurisci"), vuoto se non costa. */
  cost: string;
  enabled: boolean;
  /** Se non si può, perché. */
  reason?: string;
}

interface Trigger extends Effect {
  cost?: { fatigue?: number; exhaust?: boolean };
  action?: string;
  attack?: string;
  limit?: string;
  repeatable?: boolean;
  optional?: boolean;
  do?: { op: string; amount?: number | string; who?: string }[];
}

/** Le abilità con un bottone, per i trigger che sappiamo gestire. */
function triggersOf(state: GameState, piece: Piece): { id: string; cardId: string; effect: Trigger }[] {
  const out: { id: string; cardId: string; effect: Trigger }[] = [];
  for (const cardId of piece.skillCards) {
    (state.skills.get(cardId)?.effects ?? []).forEach((e, i) => {
      const t = e as Trigger;
      if (t.kind === 'trigger' && t.optional && ['chooseAction', 'attackDone', 'kill'].includes(String(t.on))) out.push({ id: `${cardId}:${i}`, cardId, effect: t });
    });
  }
  return out;
}

/** Le abilità attive (si avviano dal bottone e chiedono altro): per ora la Telecinesi. */
function activesOf(state: GameState, piece: Piece): { id: string; cardId: string; effect: Trigger }[] {
  const out: { id: string; cardId: string; effect: Trigger }[] = [];
  for (const cardId of piece.skillCards) {
    (state.skills.get(cardId)?.effects ?? []).forEach((e, i) => {
      const t = e as Trigger;
      if (t.kind === 'active' && (t.do ?? []).some((d) => d.op === 'moveModel')) out.push({ id: `${cardId}:${i}`, cardId, effect: t });
    });
  }
  return out;
}

const ACTION_NAMES: Record<string, string> = { get advance() { return tr('Avanzare'); }, get fight() { return tr('Combattere'); } };

/** Le abilità che l'eroe ha con il bottone, e se si possono usare adesso. */
export function skillActions(state: GameState, piece: Piece): SkillAction[] {
  const actives: SkillAction[] = activesOf(state, piece).map(({ id, cardId, effect: t }) => {
    const fatigue = t.cost?.fatigue ?? 0;
    let reason: string | undefined;
    if (!canActOnMap(state, piece)) reason = tr('Ora non puoi');
    else if (piece.toad) reason = tr('Un rospo non usa abilità');
    else if (piece.fatigue < fatigue) reason = tr('Non hai abbastanza fatica');
    return { id, cardId, kind: 'active' as const, cost: fatigue ? `{fat:${fatigue}}` : '', enabled: !reason, reason };
  });
  return [...actives, ...triggersOf(state, piece).map(({ id, cardId, effect: t }) => {
    const fatigue = t.cost?.fatigue ?? 0;
    const cost = [fatigue ? `{fat:${fatigue}}` : '', t.cost?.exhaust ? tr('esaurisci la carta') : ''].filter(Boolean).join(' · ');
    let reason: string | undefined;
    if (!canActOnMap(state, piece)) reason = tr('Ora non puoi');
    else if (piece.toad) reason = tr('Un rospo non usa abilità');
    else if (t.on === 'chooseAction') {
      if (piece.action !== t.action) reason = tr('Solo se scegli {action}', { action: ACTION_NAMES[String(t.action)] ?? t.action });
      else if (piece.pointsUsed > 0 || piece.attacksUsed > 0) reason = tr('Va usata prima di muoverti o attaccare');
      else if (piece.usedSkills?.includes(id)) reason = tr('Già usata in questo turno');
    } else if (t.on === 'attackDone') {
      if (!piece.lastAttack || (t.attack && piece.lastAttack.type !== t.attack)) reason = tr('Serve un attacco {kind} appena fatto', { kind: ({ ranged: tr('a distanza'), magic: tr('magico'), melee: tr('in mischia') } as Record<string, string>)[String(t.attack)] ?? '' });
    } else if (t.on === 'kill') {
      if (!piece.lastKill) reason = tr('Serve un nemico appena ucciso in mischia');
    }
    if (!reason && t.cost?.exhaust && piece.exhausted?.includes(cardId)) reason = tr('La carta è esaurita fino al prossimo round');
    if (!reason && piece.fatigue < fatigue) reason = tr('Non hai abbastanza fatica');
    return { id, cardId, kind: 'trigger' as const, cost, enabled: !reason, reason };
  })];
}

/** Cosa è successo usando un'abilità. */
export type SkillResult = { ok: true; notice: string } | { ok: false; reason: string };

/** Usa l'abilità: paga il costo e fa i suoi effetti. */
export function useSkill(state: GameState, piece: Piece, id: string): SkillResult {
  const found = triggersOf(state, piece).find((x) => x.id === id);
  const action = skillActions(state, piece).find((x) => x.id === id);
  if (action?.kind === 'active') return { ok: false, reason: tr('Questa abilità si avvia dal bottone e chiede altro') };
  if (!found || !action) return { ok: false, reason: tr('Non hai questa abilità') };
  if (!action.enabled) return { ok: false, reason: action.reason ?? tr('Non è possibile') };
  const t = found.effect;
  const card = state.skills.get(found.cardId)!;
  piece.fatigue -= t.cost?.fatigue ?? 0;
  if (t.cost?.exhaust) (piece.exhausted ??= []).push(found.cardId);
  const lastWeapon = t.on === 'kill' ? piece.lastKill?.weaponId : piece.lastAttack?.weaponId;
  const notes: string[] = [];
  for (const op of t.do ?? []) {
    if (op.op === 'recoverFatigue') {
      const heroes = op.who === 'selfAndAdjacent'
        ? state.pieces.filter((p) => p.team === 'hero' && !p.city && (p.id === piece.id || footprint(p).some((c) => footprint(piece).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1))))
        : [piece];
      for (const h of heroes) h.fatigue = Math.min(h.maxFatigue, h.fatigue + Number(op.amount ?? 1));
      notes.push(heroes.length > 1 ? `+{fat:${op.amount}} a ${heroes.map((h) => h.name).join(', ')}` : `+{fat:${op.amount}}`);
    } else if (op.op === 'extraAttack') {
      piece.attacks += Number(op.amount ?? 1);
      if ((op as { sameWeapon?: boolean }).sameWeapon && lastWeapon) piece.lockedWeapon = lastWeapon; // l'attacco in più si fa con la stessa arma
      notes.push(tr('+{amount} attacco', { amount: op.amount }));
    } else if (op.op === 'gainMovement') {
      const n = Math.ceil(speedOf(state, piece) / 2); // metà della velocità, per eccesso
      piece.points += n;
      notes.push(`+{mov:${n}}`);
    } else if (op.op === 'tempArmor') {
      piece.tempArmor = (piece.tempArmor ?? 0) + Number(op.amount ?? 1);
      notes.push(tr('armatura +{amount} fino al prossimo turno', { amount: op.amount }));
    } else if (op.op === 'guardOrder') {
      if (piece.order) notes.push(tr('ha già un ordine'));
      else {
        piece.order = 'guard';
        notes.push(tr('ordine di Guardia'));
      }
    }
  }
  if (t.on === 'chooseAction') (piece.usedSkills ??= []).push(found.id);
  if (t.on === 'kill') piece.lastKill = null; // una volta per nemico ucciso
  return { ok: true, notice: `${card.name}: ${notes.join(', ')}` };
}

/** Le abilità automatiche quando si uccide un nemico (Sangue vampirico: +1 fatica). Restituisce quanta fatica ha dato. */
export function onKillBonuses(state: GameState, piece: Piece): number {
  let gained = 0;
  for (const cardId of piece.skillCards) {
    for (const e of state.skills.get(cardId)?.effects ?? []) {
      const t = e as Trigger;
      if (t.kind !== 'trigger' || t.on !== 'kill' || t.optional) continue;
      for (const op of t.do ?? []) {
        if (op.op === 'recoverFatigue') {
          const n = Math.min(piece.maxFatigue - piece.fatigue, Number(op.amount ?? 1));
          piece.fatigue += n;
          gained += n;
        }
      }
    }
  }
  return gained;
}
