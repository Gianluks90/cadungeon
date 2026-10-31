import { Board, Cell, cellKey } from '../board/board';
import { Reach, pathTo, reachable } from '../board/movement';
import type { Familiar, FamiliarDef } from '../familiars/familiar';
import { Piece, footprint } from '../pieces/piece';
import type { GameState } from './game-state';

/**
 * I famigli (docs/REGOLE.md, sezione 2g). Non sono pedine ma una lista a parte (`GameState.familiars`): così, senza altro codice, non occupano caselle, non bloccano la vista, non si possono
 * attaccare né colpire con le aree, e non contano come eroi per gli scaglioni dei mostri e per l'evocazione. Sono dell'eroe che li possiede (`owner`), che li sposta a mano dopo il suo turno.
 */

/** Gli id dei famigli che questo eroe ha: quelli della sua scheda (effetto `familiar` in `effects`) e quelli delle sue carte abilità. */
export function familiarIdsOf(state: GameState, hero: Piece): string[] {
  const out: string[] = [];
  const read = (effects: readonly { kind: string; ids?: unknown }[]) => {
    for (const e of effects) if (e.kind === 'familiar' && Array.isArray(e.ids)) out.push(...(e.ids as string[]));
  };
  read((hero.heroEffects ?? []) as { kind: string; ids?: unknown }[]);
  for (const id of hero.skillCards) read((state.skills.get(id)?.effects ?? []) as { kind: string; ids?: unknown }[]);
  return out;
}

/** Dà a ogni eroe i suoi famigli che ancora non ci sono: compaiono nella casella del padrone. Si chiama a inizio partita e quando un eroe prende una carta con un famiglio. */
export function spawnFamiliars(state: GameState): Familiar[] {
  const added: Familiar[] = [];
  for (const hero of state.pieces) {
    if (hero.team !== 'hero') continue;
    for (const id of familiarIdsOf(state, hero)) {
      if (state.familiars.some((f) => f.id === id) || !state.familiarDefs.has(id)) continue;
      const f: Familiar = { id, owner: hero.id, cell: { ...hero.cell } };
      state.familiars.push(f);
      added.push(f);
    }
  }
  return added;
}

/** Il famiglio ha questa eccezione scritta nella sua scheda? */
export function familiarHas(def: FamiliarDef | undefined, kind: string): boolean {
  return !!def?.effects?.some((e) => e.kind === kind);
}

export const familiarsOf = (state: GameState, heroId: string): Familiar[] => state.familiars.filter((f) => f.owner === heroId);

/**
 * Dove può andare un famiglio: fino alla sua velocità, con le regole degli eroi ma attraversando i modelli (anche i nemici) e potendosi fermare su una casella occupata. Non salta le buche
 * e non ci entra, non apre porte, non usa i glifi del viaggio; le scale sono solo un ponte fra due caselle (non costano). Le caselle sono quelle dove può fermarsi, senza quella di adesso.
 */
export function familiarReach(state: GameState, board: Board, def: FamiliarDef, fam: Familiar, points = def.speed): Map<string, Reach> {
  const flies = familiarHas(def, 'fly');
  // Chi vola sorvola ostacoli, acqua e buche e può fermarsi su qualunque casella; gli altri non entrano nelle buche.
  const reach = reachable(board, fam.cell, points, new Set(), [], board.stairsLinks(), undefined, flies, 0, false);
  for (const [key, r] of [...reach]) {
    if (key === cellKey(fam.cell) || (!flies && board.isPit(r.cell))) reach.delete(key); // nessun limite di famigli per casella
  }
  return reach;
}

/** Quanti punti costa il percorso fino a `target` (i punti che il famiglio ha speso muovendosi). */
export const familiarCost = (reach: Map<string, Reach>, target: Cell): number => reach.get(cellKey(target))?.cost ?? 0;

/** Gli effetti dei famigli sui mostri vicini: i nemici nello spazio di un famiglio con `weaken` e in quelli adiacenti hanno meno armatura e non schivano né mirano. */
export function weakening(state: GameState, monster: Piece): { armor: number; noDodge: boolean; noAim: boolean } {
  const out = { armor: 0, noDodge: false, noAim: false };
  if (monster.team !== 'monster' || monster.city) return out;
  for (const f of state.familiars) {
    const def = state.familiarDefs.get(f.id);
    const w = def?.effects?.find((e) => e.kind === 'weaken');
    if (!w) continue;
    const near = footprint(monster).some((c) => Math.max(Math.abs(c.x - f.cell.x), Math.abs(c.y - f.cell.y)) <= 1);
    if (!near) continue;
    out.armor += Number(w['armor'] ?? 0);
    out.noDodge ||= !!w['noDodge'];
    out.noAim ||= !!w['noAim'];
  }
  return out;
}

/** Le caselle che i famigli con `summonSight` vedono come un eroe (per l'evocazione): il Signore supremo non ci può evocare. */
export function familiarSightCells(state: GameState, board: Board, visibleFrom: (board: Board, from: Cell) => Iterable<string>): Set<string> {
  const seen = new Set<string>();
  for (const f of state.familiars) {
    if (!familiarHas(state.familiarDefs.get(f.id), 'summonSight')) continue;
    for (const k of visibleFrom(board, f.cell)) seen.add(k);
  }
  return seen;
}


/** Il percorso (caselle una dopo l'altra) fino a `target`, o null se non è raggiungibile. */
export function familiarPath(reach: Map<string, Reach>, target: Cell): Cell[] | null {
  if (!reach.has(cellKey(target))) return null;
  return pathTo(reach, target).map((r) => r.cell);
}
