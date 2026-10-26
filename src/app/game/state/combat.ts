import { Board, cellKey } from '../board/board';
import { ENHANCED_KILL_COINS } from '../constants';
import { canSee } from '../board/sight';
import { FaceRoll } from '../dice/faces';
import { AttackType, DieColor, ItemDef } from '../items/item';
import { Piece, footprint } from '../pieces/piece';
import { armorOf, canActOnMap, killHero } from './actions';
import { GameState } from './game-state';

/**
 * Il combattimento (docs/REGOLE.md, sezioni 5-7). Le funzioni controllano le regole e lavorano solo sullo stato: chi le chiama (la finestra
 * dell'attacco, uno script) mostra e sceglie. Il tiro dei dadi arriva da fuori (`FaceRoll[]`: colore e faccia di ogni dado); nel multigiocatore lo deciderà l'host.
 */

/** Un modo di attaccare il bersaglio: un'arma equipaggiata o i pugni. */
export interface AttackOption {
  /** 'weapon:<id oggetto>' oppure 'fists'. */
  id: string;
  itemId?: string;
  name: string;
  icon: string;
  attack: AttackType;
  /** I dadi che tira: quelli dell'arma più i dadi potere neri dell'eroe per questo tipo di attacco. */
  dice: DieColor[];
  enabled: boolean;
  /** Se non è possibile, perché. */
  reason?: string;
}

/** Un effetto che si può comprare con le Scariche (le onde dell'arma). */
export interface SurgeEffect {
  /** Posizione nell'elenco delle onde dell'arma. */
  index: number;
  cost: number;
  text: string;
  damage: number;
  range: number;
  pierce: number;
  /** Se è già in gioco: gli altri (Esplosione, stordire...) si vedono ma non si possono ancora usare. */
  supported: boolean;
}

/** Tutto ciò che si sa di un attacco prima del tiro. */
export interface AttackPlan {
  option: AttackOption;
  /** Distanza in caselle dal bersaglio (la più corta fra le sue caselle). */
  distance: number;
  /** Per la mischia la gittata non conta. */
  needsRange: boolean;
  effects: SurgeEffect[];
  /** Scariche in più date dall'arma ("guadagni N onde di potere bonus"). */
  bonusSurges: number;
  /** Danno in più dal bonus di supporto (l'altra arma a una mano). */
  supportDamage: number;
  /** Perforare fisso dell'arma. */
  pierce: number;
  /** Gittata in più fissa (le abilità dei mostri, "+1 Gittata"). */
  bonusRange: number;
}

/** Il risultato di un attacco, dato il tiro e le scelte. */
export interface AttackOutcome {
  miss: boolean;
  inRange: boolean;
  hearts: number;
  surges: number;
  surgesSpent: number;
  range: number;
  bonusDamage: number;
  pierce: number;
  /** L'armatura del bersaglio (non si mostra ai giocatori). */
  armor: number;
  damage: number;
}

/** Distanza in caselle (le diagonali contano 1) fra due pezzi: la più corta fra le loro caselle. */
export function distanceTo(a: Piece, b: Piece): number {
  let best = Infinity;
  for (const ca of footprint(a)) for (const cb of footprint(b)) best = Math.min(best, Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y)));
  return best;
}

/** `attacker` vede `target`? Le altre creature bloccano la vista; il bersaglio si vede se se ne vede una qualunque delle sue caselle. */
export function canSeeTarget(state: GameState, board: Board, attacker: Piece, target: Piece): boolean {
  const blockers = new Set<string>();
  for (const p of state.pieces) {
    if (p.city || p.id === attacker.id || p.id === target.id) continue;
    for (const c of footprint(p)) blockers.add(cellKey(c));
  }
  // Chi sta in una buca non vede fuori; da fuori si vede chi è dentro.
  if (board.isPit(attacker.cell)) return footprint(target).some((c) => c.x === attacker.cell.x && c.y === attacker.cell.y);
  return footprint(target).some((c) => canSee(board, attacker.cell, c, blockers));
}

function equippedWeapons(state: GameState, piece: Piece): ItemDef[] {
  return piece.equipped.flatMap((id) => {
    const d = state.items.get(id);
    return d?.kind === 'weapon' && d.attack ? [d] : [];
  });
}

/** Interpreta il testo di un effetto delle onde o di una regola: danno, gittata e Perforare in più. */
export function parseEffect(text: string): { damage: number; range: number; pierce: number; supported: boolean } {
  let damage = 0;
  let range = 0;
  let pierce = 0;
  let known = 0;
  for (const part of text.split(/\s+e\s+/i)) {
    const d = part.match(/^\+(\d+)\s+dann[oi]$/i);
    const r = part.match(/^\+(\d+)\s+gittata$/i);
    const p = part.match(/^Perforare\s+(\d+)$/i);
    if (d) { damage += +d[1]; known++; }
    else if (r) { range += +r[1]; known++; }
    else if (p) { pierce += +p[1]; known++; }
  }
  return { damage, range, pierce, supported: known > 0 && known === text.split(/\s+e\s+/i).length };
}

/** Quanto danno dà il bonus di supporto dell'altra arma: solo con due armi da mischia a una mano. */
function supportBonus(state: GameState, attacker: Piece, weapon: ItemDef): number {
  if (weapon.attack !== 'melee' || weapon.hands !== 1) return 0;
  const other = equippedWeapons(state, attacker).find((w) => w.id !== weapon.id && w.attack === 'melee' && w.hands === 1 && w.offHand);
  return other?.offHand ? parseEffect(other.offHand).damage : 0;
}

/** I modi in cui `attacker` può attaccare `target` adesso. La mischia compare solo se è adiacente; le altre armi se c'è linea di vista. Vuoto se non c'è niente da proporre. */
export function attackOptions(state: GameState, board: Board, attacker: Piece, target: Piece): AttackOption[] {
  if (attacker.team === target.team || !canActOnMap(state, attacker) || target.city) return [];
  const distance = distanceTo(attacker, target);
  const sees = canSeeTarget(state, board, attacker, target);
  const blocked = attacker.attacks < 1 ? 'Non hai più attacchi in questo turno' : !sees ? 'Non hai linea di vista' : undefined;
  const extra = (type: AttackType) => Array.from({ length: attacker.dice[type] }, () => 'black' as DieColor);
  const out: AttackOption[] = [];
  for (const w of equippedWeapons(state, attacker)) {
    if (w.attack === 'melee' && distance > 1) continue;
    out.push({
      id: `weapon:${w.id}`, itemId: w.id, name: w.name, icon: w.icon ?? 'inventory_2', attack: w.attack!,
      dice: [...(w.dice ?? []), ...extra(w.attack!)], enabled: !blocked, reason: blocked,
    });
  }
  // I pugni (un dado rosso, nessuna abilità) se non c'è un'arma da mischia da usare.
  if (distance <= 1 && !out.some((o) => o.attack === 'melee')) {
    out.push({ id: 'fists', name: 'Pugni', icon: 'swords', attack: 'melee', dice: ['red', ...extra('melee')], enabled: !blocked, reason: blocked });
  }
  return out;
}

/**
 * Come un mostro può attaccare `target` adesso: il suo tipo di attacco e i suoi dadi. La mischia solo se il bersaglio è adiacente; distanza e magia se lo vede.
 * Null se non può (non ha un attacco, è troppo lontano per la mischia o non lo vede).
 */
export function monsterAttackOption(state: GameState, board: Board, monster: Piece, target: Piece): AttackOption | null {
  if (monster.team !== 'monster' || !monster.attackType || target.team !== 'hero' || target.city) return null;
  if (monster.attackType === 'melee' && distanceTo(monster, target) > 1) return null;
  const sees = canSeeTarget(state, board, monster, target);
  const reason = monster.attacks < 1 ? 'Ha già attaccato' : !sees ? 'Non vede il bersaglio' : undefined;
  return { id: 'monster', name: monster.name, icon: 'skull', attack: monster.attackType, dice: [...monster.attackDice], enabled: !reason, reason };
}

/** Il piano di un attacco con l'opzione scelta: distanza, onde disponibili e bonus fissi. */
export function planAttack(state: GameState, attacker: Piece, target: Piece, option: AttackOption): AttackPlan {
  if (attacker.team === 'monster') {
    // Un mostro non ha armi: le sue abilità speciali (solo quelle già in gioco: Perforare, +gittata, +danno) valgono sempre.
    let pierce = 0;
    let bonusRange = 0;
    let damage = 0;
    for (const t of attacker.traits) {
      const e = parseEffect(t);
      if (e.supported) { pierce += e.pierce; bonusRange += e.range; damage += e.damage; }
    }
    return { option, distance: distanceTo(attacker, target), needsRange: option.attack !== 'melee', effects: [], bonusSurges: 0, supportDamage: damage, pierce, bonusRange };
  }
  const weapon = option.itemId ? state.items.get(option.itemId) : undefined;
  const effects: SurgeEffect[] = (weapon?.surge ?? []).map((s, index) => ({ index, cost: s.cost, text: s.effect, ...parseEffect(s.effect) }));
  let bonusSurges = 0;
  let pierce = 0;
  for (const rule of weapon?.rules ?? []) {
    const bonus = rule.match(/guadagni\s+(\d+)\s+onde?\s+di\s+potere\s+bonus/i);
    const p = rule.match(/^Perforare\s+(\d+)$/i);
    if (bonus) bonusSurges += +bonus[1];
    if (p) pierce += +p[1];
  }
  return {
    option, distance: distanceTo(attacker, target), needsRange: option.attack !== 'melee',
    effects, bonusSurges, pierce, supportDamage: weapon ? supportBonus(state, attacker, weapon) : 0, bonusRange: 0,
  };
}

/**
 * Il risultato dell'attacco dato il tiro. `choices[i]` dice cosa tiene chi tira sulla faccia multivalente del dado `i` (gittata o cuore); `spent` sono gli indici
 * delle onde pagate (un'onda si può pagare più volte, finché ci sono Scariche). Non modifica niente: serve anche per l'anteprima mentre si sceglie.
 */
export function resolveAttack(
  state: GameState,
  target: Piece,
  plan: AttackPlan,
  rolls: readonly FaceRoll[],
  choices: Readonly<Record<number, 'range' | 'heart'>>,
  spent: readonly number[],
): AttackOutcome {
  let hearts = 0;
  let range = 0;
  let surges = plan.bonusSurges;
  let miss = false;
  rolls.forEach(({ face }, i) => {
    miss ||= face.miss;
    surges += face.surge;
    if (face.slash) {
      // Finché chi tira non sceglie, la faccia multivalente non conta niente.
      if (choices[i] === 'heart') hearts += face.hearts;
      else if (choices[i] === 'range') range += face.range;
    } else {
      hearts += face.hearts;
      range += face.range;
    }
  });
  // Le onde pagate non possono costare più delle Scariche ottenute.
  let surgesSpent = 0;
  let bonusDamage = plan.supportDamage;
  let pierce = plan.pierce;
  for (const idx of spent) {
    const e = plan.effects.find((x) => x.index === idx);
    if (!e || !e.supported || surgesSpent + e.cost > surges) continue;
    surgesSpent += e.cost;
    bonusDamage += e.damage;
    range += e.range;
    pierce += e.pierce;
  }
  range += plan.bonusRange;
  const inRange = !plan.needsRange || range >= plan.distance;
  const armor = target.team === 'hero' ? armorOf(state, target) : target.armor;
  const damage = !miss && inRange ? Math.max(0, hearts + bonusDamage - Math.max(0, armor - pierce)) : 0;
  return { miss, inRange, hearts, surges, surgesSpent, range, bonusDamage, pierce, armor, damage };
}

export interface AttackResult {
  killed: boolean;
  /** Monete date all'eroe per aver ucciso un mostro potenziato (0 negli altri casi). */
  reward: number;
  /** Il bersaglio ferito (o morto, se è un eroe che torna in città). */
  target: Piece;
}

/** Applica l'attacco: consuma un attacco dell'attaccante e toglie le ferite al bersaglio. Un mostro a zero ferite esce dalla mappa; un eroe muore come in `killHero`. */
export function applyAttack(state: GameState, attacker: Piece, target: Piece, outcome: AttackOutcome): AttackResult {
  attacker.attacks = Math.max(0, attacker.attacks - 1);
  attacker.attacksUsed += 1;
  target.wounds = Math.max(0, target.wounds - outcome.damage);
  if (target.wounds > 0) return { killed: false, reward: 0, target };
  if (target.team === 'hero') {
    killHero(state, target);
    return { killed: true, reward: 0, target };
  }
  const i = state.pieces.indexOf(target);
  if (i >= 0) state.pieces.splice(i, 1);
  // Il colpo fatale a un mostro potenziato vale monete per l'eroe che lo dà (il denaro è personale).
  const reward = target.enhanced && attacker.team === 'hero' ? ENHANCED_KILL_COINS : 0;
  attacker.coins += reward;
  return { killed: true, reward, target };
}
