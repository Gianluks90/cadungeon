import { AttackType, ItemDef } from '../items/item';
import { Piece } from '../pieces/piece';
import { SkillEffect } from '../skills/skill';
import type { GameState } from './game-state';

/**
 * Gli effetti attivi di un eroe (docs/cards/abilities.md, sezione 9): quelli delle sue carte abilità e degli oggetti equipaggiati, nello stesso vocabolario
 * (`stat`, `attack`, `rule`...). Le regole chiedono qui i numeri che le riguardano: velocità, armatura, bonus di attacco, eccezioni.
 * Per ora sono attivi `stat`, `attack` e alcune `rule`; `trigger`, `active` e `grant` aspettano fatica, stati e altro (vedi abilities.md).
 */

/** Un effetto con i campi che le regole leggono, tipati (il catalogo li scrive come dati liberi). */
export interface Effect extends SkillEffect {
  rule?: string;
  amount?: number;
  stat?: string;
  vs?: AttackType;
  when?: string;
  afterCaps?: boolean;
  /** Per un effetto `attack`: i tipi di attacco; per un `trigger`: quando scatta (chooseAction, kill, death...). */
  on?: AttackType[] | string;
  damage?: number;
  range?: number;
  surges?: number;
}

/** Un effetto con il nome di chi lo dà (la carta o l'oggetto), per mostrarlo nelle finestre. */
export interface SourcedEffect {
  source: string;
  effect: Effect;
}

function equippedDefs(state: GameState, piece: Piece): ItemDef[] {
  return piece.equipped.flatMap((id) => {
    const d = state.items.get(id);
    return d ? [d] : [];
  });
}

/** Tutti gli effetti di carte abilità e oggetti equipaggiati. */
export function effectsOf(state: GameState, piece: Piece): SourcedEffect[] {
  const out: SourcedEffect[] = [];
  for (const id of piece.skillCards) {
    const card = state.skills.get(id);
    for (const effect of card?.effects ?? []) out.push({ source: card!.name, effect });
  }
  for (const d of equippedDefs(state, piece)) for (const effect of d.effects ?? []) out.push({ source: d.name, effect });
  return out;
}

/** Ha questa eccezione di regola? */
export function hasRule(state: GameState, piece: Piece, rule: string): boolean {
  return effectsOf(state, piece).some((x) => x.effect.kind === 'rule' && x.effect.rule === rule);
}

/** Il valore (`amount`) di una regola con un numero, sommato se ci sono più fonti (0 se non c'è). */
export function ruleAmount(state: GameState, piece: Piece, rule: string): number {
  return effectsOf(state, piece).reduce((n, x) => (x.effect.kind === 'rule' && x.effect.rule === rule ? n + (Number(x.effect.amount) || 1) : n), 0);
}

export interface StatContext {
  /** Contro che tipo di attacco si chiede il valore (per i bonus che valgono solo contro un tipo). */
  vs?: AttackType;
  /** Per la velocità: i bonus che si sommano dopo i limiti dell'armatura (`afterCaps`) oppure prima. */
  afterCaps?: boolean;
}

/** Somma dei bonus `stat` per `stat` (wounds, fatigue, speed, armor): quelli con `vs` valgono solo contro quel tipo, quelli con `when: noArmorWorn` solo senza armatura. */
export function statBonus(state: GameState, piece: Piece, stat: string, ctx: StatContext = {}): number {
  const wearsArmor = equippedDefs(state, piece).some((d) => d.kind === 'armor');
  return effectsOf(state, piece).reduce((n, { effect: e }) => {
    if (e.kind !== 'stat' || e.stat !== stat) return n;
    if (e.vs && e.vs !== ctx.vs) return n;
    if (e.when === 'noArmorWorn' && wearsArmor) return n;
    if (stat === 'speed' && !!e.afterCaps !== !!ctx.afterCaps) return n;
    return n + Number(e.amount);
  }, 0);
}

export interface AttackBonus {
  damage: number;
  range: number;
  surges: number;
  /** Chi li dà e cosa, per mostrarlo ("Possente: +2 danno"). */
  sources: { source: string; text: string }[];
}

/** I bonus agli attacchi di questo tipo: danno, gittata e onde di potere bonus. */
export function attackBonus(state: GameState, piece: Piece, type: AttackType): AttackBonus {
  const out: AttackBonus = { damage: 0, range: 0, surges: 0, sources: [] };
  for (const { source, effect: e } of effectsOf(state, piece)) {
    if (e.kind !== 'attack' || !((e.on as AttackType[] | undefined) ?? []).includes(type)) continue;
    const parts: string[] = [];
    if (e.damage) { out.damage += Number(e.damage); parts.push(`+${e.damage} danno`); }
    if (e.range) { out.range += Number(e.range); parts.push(`+${e.range} gittata`); }
    if (e.surges) { out.surges += Number(e.surges); parts.push(`+${e.surges} ${Number(e.surges) === 1 ? 'onda' : 'onde'} di potere`); }
    if (parts.length) out.sources.push({ source, text: parts.join(', ') });
  }
  return out;
}

/** Quando un eroe prende una carta, i suoi bonus permanenti ai massimi (ferite e fatica) si sommano subito, anche a ciò che ha adesso. */
export function applyPermanentStats(hero: Piece, effects: readonly SkillEffect[]): void {
  for (const e of effects as readonly Effect[]) {
    if (e.kind !== 'stat' || e.vs || e.when) continue;
    const n = Number(e.amount);
    if (e.stat === 'wounds') {
      hero.maxWounds += n;
      hero.wounds += n;
    } else if (e.stat === 'fatigue') {
      hero.maxFatigue += n;
      hero.fatigue += n;
    }
  }
}
