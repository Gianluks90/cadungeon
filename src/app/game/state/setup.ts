import { Board, Cell } from '../board/board';
import { Piece, occupies } from '../pieces/piece';
import { GameState } from './game-state';

/**
 * La preparazione della partita, prima del primo round (docs/REGOLE.md, "Inizio della partita"):
 * 1. si legge l'introduzione (se l'avventura ne ha una) e tutti la confermano;
 * 2. si legge l'obiettivo e tutti lo confermano;
 * 2b. se l'avventura ha delle regole speciali, si leggono e tutti le confermano;
 * 3. si mette in campo l'area di partenza: ogni eroe sceglie una delle caselle disponibili; se due scelgono la stessa, chi arriva dopo
 *    viene messo a caso in una casella libera vicina.
 * Le regole non conoscono l'interfaccia: chi conferma e chi sceglie arriva da fuori (nel multigiocatore, dai giocatori all'host).
 */
export type SetupStep = 'intro' | 'objective' | 'rules' | 'placement';

export interface Setup {
  step: SetupStep;
  /** Chi deve confermare la lettura: i giocatori (tutti insieme, per ora uno solo in locale) e, quando sarà umano, il Signore supremo. */
  required: string[];
  /** Chi ha già confermato il passo di lettura corrente. */
  confirmed: string[];
}

/** Chi conferma la lettura quando i giocatori eroe sono su un solo schermo. */
export const SETUP_PLAYERS = 'players';

/** Un'avventura ha una preparazione se ha un'introduzione o delle caselle di partenza; senza, la partita parte subito (le mappe di prova). */
export function hasSetup(data: { intro?: string; start?: unknown[] }): boolean {
  return !!data.intro || !!data.start?.length;
}

/** Il testo lungo dell'obiettivo: la descrizione dell'avventura, o il testo breve con la maiuscola e il punto. */
export function objectiveText(state: GameState): string {
  const o = state.objective;
  if (!o) return '';
  if (o.description) return o.description;
  const t = o.text?.trim() ?? '';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : '';
}

/** Il primo passo da fare a partire da `from` (si saltano i testi che l'avventura non ha). */
function stepFrom(state: GameState, from: SetupStep): SetupStep {
  if (from === 'intro' && state.intro) return 'intro';
  if ((from === 'intro' || from === 'objective') && objectiveText(state)) return 'objective';
  if (from !== 'placement' && state.rules?.trim()) return 'rules'; // le regole speciali vengono dopo l'obiettivo
  return 'placement';
}

/** Comincia la preparazione. */
export function startSetup(state: GameState, required: string[] = [SETUP_PLAYERS]): Setup {
  return { step: stepFrom(state, 'intro'), required, confirmed: [] };
}

/** Qualcuno conferma di aver letto. Quando hanno confermato tutti si passa al passo dopo; restituisce se si è passati. */
export function confirmReading(state: GameState, who: string): boolean {
  const setup = state.setup;
  if (!setup || setup.step === 'placement') return false;
  if (!setup.confirmed.includes(who)) setup.confirmed.push(who);
  if (!setup.required.every((r) => setup.confirmed.includes(r))) return false;
  setup.step = stepFrom(state, setup.step === 'intro' ? 'objective' : setup.step === 'objective' ? 'rules' : 'placement');
  setup.confirmed = [];
  return true;
}

const AROUND: Cell[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

/** Una casella dove un eroe può cominciare: libera da ostacoli, buche e pedine, e senza segnalini (a parte un glifo). */
function usable(state: GameState, board: Board, c: Cell): boolean {
  if (!board.isWalkable(c) || board.blocksMovement(c) || board.isPit(c)) return false;
  const marker = board.markerAt(c);
  if (marker && marker.type !== 'glyph') return false;
  return !state.pieces.some((p) => occupies(p, c));
}

/**
 * Le caselle dell'area di partenza ancora libere: quelle scritte nella mappa (`start`); senza, le caselle accanto o sopra un glifo
 * acceso (come da regolamento).
 */
export function startCells(state: GameState, board: Board): Cell[] {
  let cells = state.startCells;
  if (!cells.length) {
    const glyphs = board.markers.filter((m) => m.type === 'glyph' && m.active);
    cells = glyphs.flatMap((g) => [{ x: g.x, y: g.y }, ...AROUND.map((d) => ({ x: g.x + d.x, y: g.y + d.y }))]);
  }
  return cells.filter((c) => usable(state, board, c));
}

/**
 * Mette `hero` nella casella scelta. Se non è più libera (un altro eroe l'ha presa) lo mette a caso in una casella libera vicina,
 * preferendo quelle dell'area di partenza. Restituisce la casella dove è finito, o null se non c'è posto.
 */
export function placeHero(state: GameState, board: Board, hero: Piece, chosen: Cell): Cell | null {
  let target: Cell | null = usable(state, board, chosen) ? chosen : null;
  if (!target) {
    const start = new Set(startCells(state, board).map((c) => `${c.x},${c.y}`));
    for (let radius = 1; radius <= 4 && !target; radius++) {
      const ring: Cell[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const c = { x: chosen.x + dx, y: chosen.y + dy };
          if (usable(state, board, c)) ring.push(c);
        }
      }
      const preferred = ring.filter((c) => start.has(`${c.x},${c.y}`));
      const pool = preferred.length ? preferred : ring;
      if (pool.length) target = pool[Math.floor(state.random() * pool.length)];
    }
  }
  if (!target) return null;
  hero.cell = target;
  return target;
}
