import { Board, Cell, cellKey } from '../board/board';
import { ENHANCED_KILL_COINS, SHOOTER_DISTANCE_CAP } from '../constants';
import { canSee } from '../board/sight';
import { FaceRoll } from '../dice/faces';
import { AttackType, DieColor, ItemDef } from '../items/item';
import { StatusKind } from '../pieces/piece';
import { Piece, footprint } from '../pieces/piece';
import { armorOf, canActOnMap, killHero } from './actions';
import { attackBonus, hasRule, ruleAmount } from './effects';
import { onKillBonuses } from './skills';
import { RemovalResult, removeMonster } from './loot';
import { immuneTo, inflictStatus, keywordLevel } from './status';
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
  /** Gli stati che piazza (per ogni uso). */
  stun: number;
  burn: number;
  web: number;
  /** Esplosione: i raggi in più (spazi dal bersaglio) quando si paga questa onda. */
  blast: number;
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
  /** Gli stati che l'attacco piazza di base (le onde ne aggiungono altri). */
  inflictions: Infliction[];
  /** Chi attacca è immune alla Paura. */
  fearless: boolean;
  /** L'attacco ha l'abilità Contraccolpo. */
  knockback: boolean;
  /** Attacchi ad area: Spazzata (tutti i nemici adiacenti), Esplosione N (tutto ciò che è a N spazi dal bersaglio, amici compresi) e Soffio (un cono davanti a chi attacca). */
  area: { sweep: boolean; blast: number; breath: boolean };
  /** Livello di Stregoneria di chi attacca: dopo il tiro si aggiunge fino a questo totale alla gittata o al danno. */
  sorcery: number;
  /** Chi dà i bonus fissi e cosa (carte abilità, oggetti), da mostrare nella finestra. */
  sources: { source: string; text: string }[];
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
  /** Contraccolpo: se l'attacco infligge almeno 1 danno lordo, chi attacca può spostare il bersaglio di fino a 3 spazi. */
  knockback: boolean;
  /** Paura del bersaglio: le Scariche da pagare, e se non bastavano (l'attacco fallisce). */
  fear: number;
  feared: boolean;
  /** Gli stati che l'attacco piazza (se il bersaglio non è immune). */
  statuses: { kind: StatusKind; n: number }[];
  /** Segnalini veleno da piazzare (pari alle ferite perse), 0 se l'attacco non è velenoso. */
  poison: number;
}

/** Distanza in caselle (le diagonali contano 1) fra due pezzi: la più corta fra le loro caselle. */
/** Con la Raffica di vento gli eroi non vedono oltre questa distanza. */
export const GUST_SIGHT = 5;

export function distanceTo(a: Piece, b: Piece): number {
  let best = Infinity;
  for (const ca of footprint(a)) for (const cb of footprint(b)) best = Math.min(best, Math.max(Math.abs(ca.x - cb.x), Math.abs(ca.y - cb.y)));
  return best;
}

/** `attacker` vede `target`? Le altre creature bloccano la vista; il bersaglio si vede se se ne vede una qualunque delle sue caselle. */
export function canSeeTarget(state: GameState, board: Board, attacker: Piece, target: Piece, opts: { fromAdjacent?: boolean; ignore?: number } = {}): boolean {
  if (state.overlord.gust && attacker.team === 'hero' && distanceTo(attacker, target) > GUST_SIGHT) return false; // Raffica di vento
  const blockers = new Set<string>();
  for (const p of state.pieces) {
    if (p.city || p.id === attacker.id || p.id === target.id) continue;
    for (const c of footprint(p)) blockers.add(cellKey(c));
  }
  // Chi sta in una buca non vede fuori; da fuori si vede chi è dentro.
  // (un mostro grande solo se è interamente in una buca)
  if (footprint(attacker).every((c) => board.isPit(c))) return footprint(target).some((t) => footprint(attacker).some((c) => c.x === t.x && c.y === t.y));
  const seesFrom = (from: Cell, skip: ReadonlySet<string>) => {
    const b = skip.size ? new Set([...blockers].filter((k) => !skip.has(k))) : blockers;
    return footprint(target).some((c) => canSee(board, from, c, b));
  };
  // La linea di vista parte dal centro di una qualunque delle caselle di chi guarda (un mostro grande ne ha più d'una).
  if (footprint(attacker).some((c) => seesFrom(c, new Set()))) return true;
  // Precisione: si può ignorare 1 creatura che sta in mezzo (gli ostacoli ancora no).
  if ((opts.ignore ?? 0) >= 1) {
    for (const k of blockers) if (footprint(attacker).some((c) => seesFrom(c, new Set([k])))) return true;
  }
  // Tiratore scelto: si può tracciare la linea da una casella libera adiacente.
  if (opts.fromAdjacent) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const from = { x: attacker.cell.x + dx, y: attacker.cell.y + dy };
        if ((dx || dy) && board.isWalkable(from) && !board.blocksMovement(from) && !blockers.has(cellKey(from)) && seesFrom(from, new Set())) return true;
      }
    }
  }
  return false;
}

function equippedWeapons(state: GameState, piece: Piece): ItemDef[] {
  return piece.equipped.flatMap((id) => {
    const d = state.items.get(id);
    return d?.kind === 'weapon' && d.attack ? [d] : [];
  });
}

/** Interpreta il testo di un effetto delle onde o di una regola: danno, gittata e Perforare in più. */
export function parseEffect(text: string): { damage: number; range: number; pierce: number; stun: number; burn: number; web: number; blast: number; supported: boolean } {
  let blast = 0;
  let damage = 0;
  let range = 0;
  let pierce = 0;
  let stun = 0;
  let burn = 0;
  let web = 0;
  let known = 0;
  for (const part of text.split(/\s+e\s+/i)) {
    const d = part.match(/^\+(\d+)\s+dann[oi]$/i);
    const r = part.match(/^\+(\d+)\s+gittata$/i);
    const p = part.match(/^Perforare\s+(\d+)$/i);
    const bl = part.match(/^Esplosione\s+(\d+)$/i);
    const s = part.match(/^\+(\d+)\s+segnalin[oi]\s+(stordit[oi]|bruciare|rete|ragnatela)$/i);
    if (d) { damage += +d[1]; known++; }
    else if (r) { range += +r[1]; known++; }
    else if (p) { pierce += +p[1]; known++; }
    else if (bl) { blast += +bl[1]; known++; }
    else if (s) {
      const kind = s[2].toLowerCase();
      if (kind.startsWith('stordit')) stun += +s[1];
      else if (kind === 'bruciare') burn += +s[1];
      else web += +s[1];
      known++;
    }
  }
  return { damage, range, pierce, stun, burn, web, blast, supported: known > 0 && known === text.split(/\s+e\s+/i).length };
}

/** Uno stato che l'attacco può piazzare sul bersaglio e quando: `before` = se ha inflitto almeno 1 danno prima dell'armatura, `after` = dopo l'armatura. */
export interface Infliction {
  kind: StatusKind;
  n: number;
  when: 'before' | 'after';
}

/** Gli stati che una regola scritta a parole (di un'arma o di un mostro) fa piazzare: Bruciare, Veleno, Ragnatela, Stordire e le frasi di Placare, Pietrificare, Parola di Vaal. */
export function inflictionsFrom(texts: readonly string[]): Infliction[] {
  const out: Infliction[] = [];
  for (const t of texts) {
    if (/^Bruciare$/i.test(t)) out.push({ kind: 'burn', n: 1, when: 'before' });
    else if (/^Veleno$/i.test(t)) out.push({ kind: 'poison', n: 1, when: 'before' });
    else if (/^(Ragnatela|Rete)$/i.test(t)) out.push({ kind: 'web', n: 1, when: 'before' });
    else if (/^Stordire$/i.test(t)) out.push({ kind: 'stun', n: 1, when: 'before' });
    else if (/dopo sottratta l'armatura\)?,? piazza (\d+) segnalin[oi] stordit/i.test(t) || /sottratta l'armatura\) piazza (\d+) segnalin[oi] stordit/i.test(t)) {
      out.push({ kind: 'stun', n: +(t.match(/piazza (\d+)/i)?.[1] ?? 1), when: 'after' });
    }
  }
  return out;
}

/** Quanto danno dà il bonus di supporto dell'altra arma: solo con due armi da mischia a una mano. */
function supportBonus(state: GameState, attacker: Piece, weapon: ItemDef): number {
  if (weapon.attack !== 'melee' || weapon.hands !== 1) return 0;
  const other = equippedWeapons(state, attacker).find((w) => w.id !== weapon.id && w.attack === 'melee' && w.hands === 1 && w.offHand);
  const base = other?.offHand ? parseEffect(other.offHand).damage : 0;
  return base > 0 ? base + ruleAmount(state, attacker, 'supportDamage') : 0; // Ambidestro: +1 danno quando si riceve un bonus di supporto
}

/** I modi in cui `attacker` può attaccare `target` adesso. La mischia compare solo se è adiacente; le altre armi se c'è linea di vista. Vuoto se non c'è niente da proporre. */
export function attackOptions(state: GameState, board: Board, attacker: Piece, target: Piece): AttackOption[] {
  if (attacker.team === target.team || !canActOnMap(state, attacker) || target.city || attacker.toad) return []; // il rospo non attacca
  const distance = distanceTo(attacker, target);
  // Tiratore scelto e Precisione cambiano come si traccia la linea di vista, ma solo per distanza e magia.
  const sees = canSeeTarget(state, board, attacker, target);
  const seesAtRange = sees || canSeeTarget(state, board, attacker, target, { fromAdjacent: hasRule(state, attacker, 'sightFromAdjacent'), ignore: ruleAmount(state, attacker, 'sightIgnore') });
  const noAttacks = attacker.attacks < 1 ? 'Non hai più attacchi in questo turno' : undefined;
  // Un attacco a distanza non si fa a una creatura adiacente (tendere un arco a chi è vicinissimo non ha senso); la magia sì.
  const tooClose = (type: AttackType) => (type === 'ranged' && distance <= 1 ? 'Troppo vicino per un attacco a distanza' : undefined);
  const blockedFor = (type: AttackType) => noAttacks ?? tooClose(type) ?? ((type === 'melee' ? sees : seesAtRange) ? undefined : 'Non hai linea di vista');
  const extra = (type: AttackType) => Array.from({ length: attacker.dice[type] }, () => 'black' as DieColor);
  const out: AttackOption[] = [];
  for (const w of equippedWeapons(state, attacker)) {
    if (attacker.lockedWeapon && w.id !== attacker.lockedWeapon) continue; // un attacco in più "con la stessa arma"
    if (w.attack === 'melee' && distance > ((w.rules ?? []).some((r) => /^Raggiung/i.test(r)) ? 2 : 1)) continue; // Raggiungimento: la mischia arriva a distanza 2
    out.push({
      id: `weapon:${w.id}`, itemId: w.id, name: w.name, icon: w.icon ?? 'inventory_2', attack: w.attack!,
      dice: [...(w.dice ?? []), ...extra(w.attack!)], enabled: !blockedFor(w.attack!), reason: blockedFor(w.attack!),
    });
  }
  // I pugni (un dado rosso, nessuna abilità) se non c'è un'arma da mischia da usare.
  if (distance <= 1 && !out.some((o) => o.attack === 'melee') && !attacker.lockedWeapon) {
    out.push({ id: 'fists', name: 'Pugni', icon: 'swords', attack: 'melee', dice: ['red', ...extra('melee')], enabled: !blockedFor('melee'), reason: blockedFor('melee') });
  }
  return out;
}

/**
 * Come un mostro può attaccare `target` adesso: il suo tipo di attacco e i suoi dadi. La mischia solo se il bersaglio è adiacente; distanza e magia se lo vede.
 * Null se non può (non ha un attacco, è troppo lontano per la mischia o non lo vede).
 */
export function monsterAttackOption(state: GameState, board: Board, monster: Piece, target: Piece): AttackOption | null {
  if (monster.team !== 'monster' || !monster.attackType || target.team !== 'hero' || target.city) return null;
  // Il Soffio colpisce chi sta nel suo cono (niente gittata, niente linea di vista verso il bersaglio: solo i muri).
  if (keywordLevel(state, monster, 'Soffio') > 0) {
    const dir = breathDirTo(state, board, monster, target);
    const reasonB = monster.attacks < 1 ? 'Ha già attaccato' : dir ? undefined : 'Il bersaglio non è nel cono';
    return reasonB === 'Il bersaglio non è nel cono' ? null : { id: 'monster', name: monster.name, icon: 'skull', attack: monster.attackType, dice: monsterDice(state, monster), enabled: !reasonB, reason: reasonB };
  }
  // La mischia vuole l'adiacenza, o la distanza 2 con Raggiungimento (serve la vista, come sempre).
  if (monster.attackType === 'melee' && distanceTo(monster, target) > (keywordLevel(state, monster, 'Raggiungimento') > 0 ? 2 : 1)) return null;
  // Stessa regola degli eroi: un mostro con un attacco a distanza non spara a chi gli è adiacente. E non annuncia un tiro impossibile: oltre la gittata massima dei suoi dadi non attacca.
  if (monster.attackType === 'ranged' && distanceTo(monster, target) <= 1) return null;
  if ((monster.attackType === 'ranged' || monster.attackType === 'magic') && distanceTo(monster, target) > monsterRange(state, monster).max) return null;
  const sees = canSeeTarget(state, board, monster, target);
  const reason = monster.attacks < 1 ? 'Ha già attaccato' : !sees ? 'Non vede il bersaglio' : undefined;
  return { id: 'monster', name: monster.name, icon: 'skull', attack: monster.attackType, dice: monsterDice(state, monster), enabled: !reason, reason };
}

/**
 * Le opzioni d'attacco di un eroe controllato dall'Overlord (Seduzione oscura) anche se non è il turno degli eroi: solo quelle possibili adesso.
 * Per calcolarle si finge per un attimo che sia il suo turno e che abbia un attacco.
 */
export function controlledAttackOptions(state: GameState, board: Board, attacker: Piece, target: Piece): AttackOption[] {
  const saved = { phase: state.phase, done: attacker.done, attacks: attacker.attacks };
  state.phase = 'heroes';
  attacker.done = false;
  attacker.attacks = Math.max(1, attacker.attacks);
  try {
    return attackOptions(state, board, attacker, target).filter((o) => o.enabled);
  } finally {
    state.phase = saved.phase;
    attacker.done = saved.done;
    attacker.attacks = saved.attacks;
  }
}

/** Cosa fanno i dadi di attacco per la gittata (da `public/dice/faces.json`: la media e il massimo di ogni colore; da tenere allineati se le facce cambiano). */
const DIE_RANGE: Record<DieColor, { avg: number; max: number }> = {
  red: { avg: 1, max: 2 }, green: { avg: 0.33, max: 1 }, blue: { avg: 2.17, max: 4 },
  yellow: { avg: 2.17, max: 3 }, white: { avg: 1.67, max: 3 }, black: { avg: 0.5, max: 1 },
};

/**
 * Quanto lontano può colpire un mostro con un attacco a distanza o magico: `likely` è la gittata che i suoi dadi danno di solito (la media, arrotondata
 * per eccesso, fra 2 e `SHOOTER_DISTANCE_CAP`): è la distanza a cui lo script cerca di stare; `max` è il massimo possibile (la somma delle facce migliori
 * e del Comando): oltre non attacca, perché il tiro sarebbe impossibile.
 */
export function monsterRange(state: GameState, monster: Piece): { likely: number; max: number } {
  const dice = monsterDice(state, monster);
  const avg = dice.reduce((n, d) => n + DIE_RANGE[d].avg, 0);
  const max = dice.reduce((n, d) => n + DIE_RANGE[d].max, 0) + commandBonus(state, monster);
  return { likely: Math.min(SHOOTER_DISTANCE_CAP, Math.max(2, Math.ceil(avg))), max };
}

/** I dadi d'attacco di un mostro: con Distruzione ne tira uno potere in più. */
export function monsterDice(state: GameState, monster: Piece): DieColor[] {
  return state.overlord.inPlay.includes('destruction') ? [...monster.attackDice, 'black'] : [...monster.attackDice];
}

/** Gli attacchi ad area scritti a parole (le abilità di un mostro o le regole di un'arma). */
export function areaFrom(texts: readonly string[]): { sweep: boolean; blast: number; breath: boolean } {
  let blast = 0;
  for (const t of texts) {
    const m = t.trim().match(/^Esplosione\s+(\d+)$/i);
    if (m) blast += +m[1];
  }
  return { sweep: texts.some((t) => /^(Spazzata|Spazzamento)$/i.test(t.trim())), blast, breath: texts.some((t) => /^Soffio$/i.test(t.trim())) };
}

/** Comando: ogni creatura amica entro 3 spazi (anche l'attaccante) con questa abilità dà +1 al danno e alla gittata dell'attacco; si sommano. */
export function commandBonus(state: GameState, attacker: Piece): number {
  let n = 0;
  for (const p of state.pieces) {
    if (p.team !== attacker.team || p.city) continue;
    const near = footprint(p).some((c) => footprint(attacker).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 3));
    if (near) n += keywordLevel(state, p, 'Comando');
  }
  return n;
}

export type Dir = 'N' | 'E' | 'S' | 'W';

/** Il cono del Soffio davanti a chi attacca: 3 caselle di profondità, che si allargano di una per lato a ogni passo (per un 1×1: 1, 3 e 5 caselle). */
export function breathCells(attacker: Piece, dir: Dir): Cell[] {
  const x0 = attacker.cell.x;
  const y0 = attacker.cell.y;
  const x1 = x0 + attacker.size.w - 1;
  const y1 = y0 + attacker.size.h - 1;
  const out: Cell[] = [];
  for (let k = 1; k <= 3; k++) {
    const spread = k - 1;
    if (dir === 'E' || dir === 'W') for (let y = y0 - spread; y <= y1 + spread; y++) out.push({ x: dir === 'E' ? x1 + k : x0 - k, y });
    else for (let x = x0 - spread; x <= x1 + spread; x++) out.push({ x, y: dir === 'S' ? y1 + k : y0 - k });
  }
  return out;
}

/** Le caselle del cono che chi attacca vede (i muri lo fermano, le creature no). */
function breathReach(board: Board, attacker: Piece, dir: Dir): Cell[] {
  const none = new Set<string>();
  return breathCells(attacker, dir).filter((c) => board.isWalkable(c) && footprint(attacker).some((f) => canSee(board, f, c, none)));
}

/** In quale direzione il Soffio colpirebbe `target` (la migliore: più eroi e meno mostri colpiti)? Null se in nessuna. */
export function breathDirTo(state: GameState, board: Board, attacker: Piece, target: Piece): Dir | null {
  let best: { dir: Dir; score: number } | null = null;
  for (const dir of ['N', 'E', 'S', 'W'] as const) {
    const cells = new Set(breathReach(board, attacker, dir).map(cellKey));
    if (!footprint(target).some((c) => cells.has(cellKey(c)))) continue;
    const score = state.pieces.filter((p) => !p.city && p.id !== attacker.id && footprint(p).some((c) => cells.has(cellKey(c)))).reduce((n, p) => n + (p.team === attacker.team ? -1 : 1), 0);
    if (!best || score > best.score) best = { dir, score };
  }
  return best?.dir ?? null;
}

/**
 * Chi altro viene colpito dall'attacco (oltre al bersaglio), con lo stesso tiro e danno pieno (l'armatura di ciascuno si sottrae a parte):
 * Spazzata (tutti i nemici adiacenti a chi attacca), Esplosione N (tutto ciò che sta a N spazi dal bersaglio e lo vede, amici e chi attacca compresi; le onde pagate
 * ne aggiungono) e Soffio (tutto ciò che sta nel cono in direzione `dir`, amici compresi).
 */
export function areaVictims(state: GameState, board: Board, attacker: Piece, target: Piece, plan: AttackPlan, spent: readonly number[], dir?: Dir | null): Piece[] {
  const out = new Map<string, Piece>();
  const live = state.pieces.filter((p) => !p.city);
  const add = (p: Piece) => {
    if (p.id !== target.id) out.set(p.id, p);
  };
  const near = (a: Piece, b: Piece, n: number) => footprint(a).some((c) => footprint(b).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= n));
  const none = new Set<string>();
  if (plan.area.sweep && plan.option.attack === 'melee') {
    for (const p of live) if (p.team !== attacker.team && near(attacker, p, 1)) add(p);
  }
  const blast = plan.area.blast + spent.reduce((n, i) => n + (plan.effects.find((e) => e.index === i)?.blast ?? 0), 0);
  if (blast > 0) {
    for (const p of live) {
      if (p.id === target.id || !near(target, p, blast)) continue;
      if (footprint(p).some((c) => footprint(target).some((t) => canSee(board, t, c, none)))) add(p);
    }
  }
  if (plan.area.breath && dir) {
    const cells = new Set(breathReach(board, attacker, dir).map(cellKey));
    for (const p of live) if (p.id !== attacker.id && footprint(p).some((c) => cells.has(cellKey(c)))) add(p);
  }
  return [...out.values()];
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
    const cmd = commandBonus(state, attacker);
    return { option, distance: distanceTo(attacker, target), needsRange: option.attack !== 'melee' && !areaFrom(attacker.traits).breath, effects: [], bonusSurges: 0, supportDamage: damage + cmd, pierce, bonusRange: bonusRange + cmd, sources: cmd ? [{ source: 'Comando', text: `+${cmd} danno e +${cmd} gittata` }] : [], inflictions: inflictionsFrom(attacker.traits), fearless: immuneTo(state, attacker, 'fear'), area: areaFrom(attacker.traits), knockback: attacker.traits.some((t) => /^Contraccolpo$/i.test(t)), sorcery: keywordLevel(state, attacker, 'Stregoneria') };
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
  // I bonus delle carte abilità e degli oggetti equipaggiati per questo tipo di attacco, e di Comando.
  const bonus = attackBonus(state, attacker, option.attack);
  const cmd = commandBonus(state, attacker);
  const support = weapon ? supportBonus(state, attacker, weapon) : 0;
  return {
    option, distance: distanceTo(attacker, target), needsRange: option.attack !== 'melee',
    effects, bonusSurges: bonusSurges + bonus.surges, pierce, supportDamage: support + bonus.damage + cmd, bonusRange: bonus.range + cmd,
    sources: [...bonus.sources, ...(support ? [{ source: 'Bonus di supporto', text: `+${support} danno` }] : []), ...(cmd ? [{ source: 'Comando', text: `+${cmd} danno e +${cmd} gittata` }] : [])],
    inflictions: inflictionsFrom(weapon?.rules ?? []), fearless: immuneTo(state, attacker, 'fear'), area: areaFrom(weapon?.rules ?? []), knockback: (weapon?.rules ?? []).some((t) => /^Contraccolpo$/i.test(t)), sorcery: keywordLevel(state, attacker, 'Stregoneria'),
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
  sorcery: { range: number; damage: number } = { range: 0, damage: 0 },
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
  // Paura: chi attacca una creatura con Paura paga 1 Scarica per livello (perse); se non ne ha abbastanza l'attacco fallisce.
  const fear = keywordLevel(state, target, 'Paura') > 0 && !plan.fearless ? keywordLevel(state, target, 'Paura') : 0;
  const feared = fear > surges;
  // Le onde pagate non possono costare più delle Scariche ottenute.
  let surgesSpent = feared ? 0 : fear;
  let extraStun = 0;
  let extraBurn = 0;
  let extraWeb = 0;
  let bonusDamage = plan.supportDamage;
  let pierce = plan.pierce;
  for (const idx of spent) {
    const e = plan.effects.find((x) => x.index === idx);
    if (!e || !e.supported || surgesSpent + e.cost > surges) continue;
    surgesSpent += e.cost;
    bonusDamage += e.damage;
    range += e.range;
    pierce += e.pierce;
    extraStun += e.stun;
    extraBurn += e.burn;
    extraWeb += e.web;
  }
  range += plan.bonusRange;
  // Stregoneria: i punti scelti dopo il tiro (al massimo il livello) vanno alla gittata o al danno.
  const points = Math.max(0, Math.min(plan.sorcery - 0, sorcery.range + sorcery.damage));
  const sRange = Math.min(sorcery.range, points);
  range += sRange;
  bonusDamage += Math.min(sorcery.damage, points - sRange);
  const inRange = !plan.needsRange || range >= plan.distance;
  const armor = target.team === 'hero' ? armorOf(state, target, plan.option.attack) : target.armor;
  const hit = !miss && inRange && !feared;
  const raw = hearts + bonusDamage;
  const damage = hit ? Math.max(0, raw - Math.max(0, armor - pierce)) : 0;
  // Gli stati: "prima dell'armatura" vuol dire almeno 1 danno lordo, "dopo" almeno 1 ferita vera.
  const counts = new Map<StatusKind, { n: number; when: 'before' | 'after' }>();
  for (const f of plan.inflictions) if (f.kind !== 'poison') counts.set(f.kind, { n: (counts.get(f.kind)?.n ?? 0) + f.n, when: f.when });
  for (const [kind, n] of [['stun', extraStun], ['burn', extraBurn], ['web', extraWeb]] as const) if (n) counts.set(kind, { n: (counts.get(kind)?.n ?? 0) + n, when: counts.get(kind)?.when ?? 'before' });
  const statuses = hit ? [...counts].filter(([, v]) => (v.when === 'before' ? raw >= 1 : damage >= 1)).map(([kind, v]) => ({ kind, n: v.n })) : [];
  const poison = hit && plan.inflictions.some((f) => f.kind === 'poison') ? damage : 0;
  const knockback = hit && plan.knockback && raw >= 1;
  return { miss, inRange, hearts, surges, surgesSpent, range, bonusDamage, pierce, armor, damage, fear, feared, statuses, poison, knockback };
}

export interface AttackResult {
  killed: boolean;
  /** Monete date all'eroe per aver ucciso un mostro potenziato (0 negli altri casi). */
  reward: number;
  /** Il bersaglio ferito (o morto, se è un eroe che torna in città). */
  target: Piece;
  /** Gli stati che ha davvero ricevuto (quelli a cui è immune non ci sono). */
  applied: { kind: StatusKind; n: number }[];
  /** Un mostro Immortale che si è rialzato. */
  undying: boolean;
  /** I mostri uccisi da Giustizia divina dell'eroe che è appena morto. */
  slain: Piece[];
  /** Il bottino del mostro ucciso (e se è comparso un oggetto a terra), se ne aveva. */
  drop: RemovalResult | null;
  /** Il bersaglio può essere spostato di fino a 3 spazi (Contraccolpo). */
  knockback: boolean;
}

/** Applica l'attacco: consuma un attacco dell'attaccante e toglie le ferite al bersaglio. Un mostro a zero ferite esce dalla mappa; un eroe muore come in `killHero`. */
export function applyAttack(state: GameState, attacker: Piece, target: Piece, outcome: AttackOutcome, opts: { undying?: boolean; option?: AttackOption; extra?: boolean } = {}): AttackResult {
  if (!opts.extra) {
    attacker.attacks = Math.max(0, attacker.attacks - 1);
    attacker.attacksUsed += 1;
  }
  if (!opts.extra && attacker.team === 'hero' && opts.option) {
    attacker.lastAttack = { type: opts.option.attack, weaponId: opts.option.itemId }; // per le abilità "dopo un attacco"
    if (attacker.attacks <= 0) attacker.lockedWeapon = null; // l'attacco in più con la stessa arma è stato fatto
  }
  if (!opts.extra && attacker.stunned) attacker.points = 0; // stordito: o ci si muove o si attacca
  const before = target.wounds;
  target.wounds = Math.max(0, target.wounds - outcome.damage);
  if (outcome.damage > 0 && target.team === 'hero') target.hurtWhileResting = true; // un eroe che riposa e viene ferito non recupera la fatica
  // Immortale: se il dado potere ha dato una Scarica il mostro si rialza a salute piena, meno i danni in più del colpo mortale.
  if (target.wounds <= 0 && opts.undying) {
    const excess = outcome.damage - before;
    target.wounds = Math.max(1, target.maxWounds - excess);
    return { killed: false, reward: 0, target, applied: [], undying: true, slain: [], drop: null, knockback: false };
  }
  if (target.wounds > 0) {
    // Gli stati: quelli a cui il bersaglio è immune non vengono piazzati; il veleno vale tanti segnalini quante le ferite perse.
    const applied: { kind: StatusKind; n: number }[] = [];
    for (const s of outcome.statuses) {
      const n = inflictStatus(state, target, s.kind, s.n);
      if (n) applied.push({ kind: s.kind, n });
    }
    if (outcome.poison > 0) {
      const n = inflictStatus(state, target, 'poison', outcome.poison);
      if (n) applied.push({ kind: 'poison', n });
    }
    return { killed: false, reward: 0, target, applied, undying: false, slain: [], drop: null, knockback: !opts.extra && outcome.knockback && !immuneTo(state, target, 'knockback') && target.size.w === 1 && target.size.h === 1 };
  }
  if (target.team === 'hero') {
    const slain = killHero(state, target);
    return { killed: true, reward: 0, target, applied: [], undying: false, slain, drop: null, knockback: false };
  }
  const drop = removeMonster(state, target, attacker.team === 'hero' ? attacker : undefined);
  if (attacker.team === 'hero') {
    if (opts.option?.attack === 'melee') attacker.lastKill = { weaponId: opts.option.itemId }; // Fendente
    onKillBonuses(state, attacker); // Sangue vampirico
  }
  // Il colpo fatale a un mostro potenziato vale monete per l'eroe che lo dà (il denaro è personale).
  const reward = target.enhanced && attacker.team === 'hero' ? ENHANCED_KILL_COINS : 0;
  attacker.coins += reward;
  return { killed: true, reward, target, applied: [], undying: false, slain: [], drop, knockback: false };
}
