import { Piece, PieceStatus, StatusKind, emptyStatus, footprint } from '../pieces/piece';
import { effectsOf } from './effects';
import type { GameState } from './game-state';

/**
 * Gli stati e le parole chiave delle creature (docs/cards/stati.md): quanti segnalini hanno, cosa le rende immuni, e i livelli di Aura, Paura e Presa.
 * Sono regole sullo stato, senza interfaccia: chi le chiama (la scena, lo script) mostra e tira i dadi.
 */

export const STATUS_NAMES: Record<StatusKind, string> = { burn: 'Fiamma', web: 'Rete', stun: 'Stordimento', poison: 'Veleno' };

/** Cosa può rendere immuni (nei dati: `{ kind: 'rule', rule: 'immune', to: [...] }`). */
export type Immunity = StatusKind | 'aura' | 'fear' | 'grip' | 'knockback';

/** I nomi con cui le carte scrivono ciò a cui si è immuni, e cosa sono per il gioco. Per dare un'immunità a una cosa nuova basta una riga qui. */
const IMMUNITY_NAMES: Record<string, Immunity> = {
  aura: 'aura', bruciare: 'burn', fiamma: 'burn', fiamme: 'burn', contraccolpo: 'knockback', paura: 'fear', presa: 'grip',
  ragnatela: 'web', rete: 'web', stordire: 'stun', tramortire: 'stun', stordimento: 'stun', veleno: 'poison',
};

/**
 * Le immunità scritte in una frase di regola: "Sei immune a Presa e Tramortire", "Sei immune alle seguenti abilità: Aura, Bruciare, ..." (le carte), "Immune a Veleno"
 * (le abilità dei mostri). Le parole che il gioco non conosce (Sanguinare) si ignorano. Così un oggetto, una carta o un mostro ha un'immunità solo scrivendola nel
 * suo testo, senza un campo apposta.
 */
export function immunitiesIn(text: string): Immunity[] {
  const m = text.trim().match(/^(?:sei\s+)?immune\s+(?:a|alle\s+seguenti\s+abilità:?|alle?)\s+(.+?)\.?$/i);
  if (!m) return [];
  return m[1].split(/\s*,\s*|\s+e\s+/i).map((w) => IMMUNITY_NAMES[w.trim().toLowerCase()]).filter((x): x is Immunity => !!x);
}

/**
 * L'eroe o il mostro è immune a questo effetto? Viene da: `immune` nella pedina (i mostri), le abilità scritte a parole (di un mostro, di un oggetto
 * equipaggiato: "Sei immune a ..."), la regola `immune` degli effetti di carte abilità e oggetti, e dall'essere un mostro con un nome (non si stordisce).
 */
export function immuneTo(state: GameState, piece: Piece, what: Immunity): boolean {
  if (piece.immune?.includes(what)) return true;
  if (piece.unique && what === 'stun') return true; // i mostri con un nome non si stordiscono
  const texts = [...piece.traits, ...piece.equipped.flatMap((id) => state.items.get(id)?.rules ?? [])];
  if (texts.some((t) => immunitiesIn(t).includes(what))) return true;
  return effectsOf(state, piece).some(({ effect: e }) => e.kind === 'rule' && e.rule === 'immune' && ((e['to'] as string[] | undefined) ?? []).includes(what));
}

/** Piazza `n` segnalini di `kind` su `target` se non è immune. Restituisce quanti ne ha davvero ricevuti. */
export function inflictStatus(state: GameState, target: Piece, kind: StatusKind, n: number): number {
  if (n <= 0 || immuneTo(state, target, kind)) return 0;
  target.status[kind] += n;
  return n;
}

/** Toglie tutti gli stati (alla morte). */
export function clearStatus(piece: Piece): void {
  piece.status = emptyStatus();
  piece.stunned = false;
  piece.webbed = false;
}

/** Ci sono stati? */
export function hasStatus(piece: Piece): boolean {
  const s = piece.status;
  return s.burn + s.web + s.stun + s.poison > 0;
}

/** Gli stati a parole, per i pannelli ("Fiamma ×2"). */
export function describeStatus(s: PieceStatus): string[] {
  return (Object.keys(STATUS_NAMES) as StatusKind[]).filter((k) => s[k] > 0).map((k) => `${STATUS_NAMES[k]} ×${s[k]}`);
}

/**
 * Cura `amount` ferite: i segnalini veleno si tolgono per primi (1 per ferita curata), solo poi si recuperano le ferite, mai oltre il massimo.
 * Restituisce quante ferite ha davvero recuperato (le altre sono andate al veleno).
 */
export function healWounds(piece: Piece, amount: number): { healed: number; curedPoison: number } {
  const curedPoison = Math.min(piece.status.poison, amount);
  piece.status.poison -= curedPoison;
  const healed = Math.min(amount - curedPoison, piece.maxWounds - piece.wounds);
  piece.wounds += healed;
  return { healed, curedPoison };
}

/** Le parole chiave delle abilità e i modi in cui compaiono scritte (le schede usano i nomi italiani, le carte abilità i loro identificativi). */
export type Keyword = 'Aura' | 'Paura' | 'Presa' | 'Volo' | 'Raggiungimento' | 'Colpo veloce' | 'Spazzata' | 'Soffio' | 'Stregoneria' | 'Comando' | 'Esplosione';

const KEYWORD_NAMES: Record<Keyword, string[]> = {
  Aura: ['aura'],
  Paura: ['paura', 'fear'],
  Presa: ['presa', 'grip'],
  Volo: ['volo', 'volare', 'fly'],
  Raggiungimento: ['raggiungimento', 'raggiungere', 'reach'],
  'Colpo veloce': ['colpo veloce', 'attacco veloce', 'quick shot'],
  Spazzata: ['spazzata', 'spazzamento', 'sweep'],
  Soffio: ['soffio', 'breath'],
  Stregoneria: ['stregoneria', 'sorcery'],
  Comando: ['comando', 'command'],
  Esplosione: ['esplosione', 'blast'],
};

/** Il livello di una parola chiave (Aura, Paura, Presa, Stregoneria 2...) di una creatura, 0 se non ce l'ha: per i mostri dalle abilità scritte sulla pedina, per gli eroi dagli oggetti e dalle carte (`grant`). */
export function keywordLevel(state: GameState, piece: Piece, word: Keyword): number {
  let level = 0;
  const names = KEYWORD_NAMES[word];
  const read = (text: string) => {
    const m = text.trim().toLowerCase().match(/^(.+?)(?:\s+(\d+))?$/);
    if (m && names.includes(m[1])) level += m[2] ? +m[2] : 1;
  };
  for (const t of piece.traits) read(t);
  for (const id of piece.equipped) for (const r of state.items.get(id)?.rules ?? []) read(r);
  for (const { effect: e } of effectsOf(state, piece)) if (e.kind === 'grant' && names.includes(String(e['keyword']).toLowerCase())) level += Number(e['level'] ?? 1);
  return level;
}

/** È afferrato: ha accanto un nemico con Presa, quindi non può spendere punti movimento (a meno che sia immune). */
export function isGrappled(state: GameState, piece: Piece): boolean {
  if (immuneTo(state, piece, 'grip')) return false;
  return state.pieces.some((p) => p.team !== piece.team && !p.city && keywordLevel(state, p, 'Presa') > 0 && footprint(p).some((c) => footprint(piece).some((d) => Math.max(Math.abs(c.x - d.x), Math.abs(c.y - d.y)) <= 1)));
}

/** Cosa è successo agli stati di una creatura all'inizio del suo turno. */
export interface TurnStartResult {
  /** I segnalini che aveva e quanti ne restano (dopo i dadi potere). */
  burnBefore: number;
  burnLeft: number;
  webBefore: number;
  webLeft: number;
  /** Ferite per i segnalini fiamma rimasti (l'armatura non le riduce). */
  burnDamage: number;
  /** Aveva un segnalino stordimento: ora lo perde ed è stordita per questo turno. */
  stunned: boolean;
  /** È morta per le ferite della fiamma. */
  killed: boolean;
}

/**
 * Le regole di inizio turno (docs/cards/stati.md): per ogni segnalino fiamma e rete si tira un dado potere e ogni **Scarica** ne toglie uno; per ogni fiamma che resta
 * 1 ferita (non ridotta dall'armatura); se resta della rete la creatura non ha punti movimento in questo turno; un segnalino stordimento si toglie (uno solo) e la creatura
 * è stordita. `surges` sono le Scariche uscite sui dadi dei due gruppi (i dadi li tira chi chiama). Le ferite possono uccidere: chi chiama la gestisce.
 */
export function applyTurnStart(piece: Piece, surges: { burn: number; web: number }): TurnStartResult {
  const s = piece.status;
  const r: TurnStartResult = { burnBefore: s.burn, burnLeft: 0, webBefore: s.web, webLeft: 0, burnDamage: 0, stunned: false, killed: false };
  s.burn -= Math.min(s.burn, surges.burn);
  r.burnLeft = s.burn;
  if (s.burn > 0) {
    piece.wounds = Math.max(0, piece.wounds - s.burn);
    r.burnDamage = s.burn;
  }
  s.web -= Math.min(s.web, surges.web);
  r.webLeft = s.web;
  piece.webbed = s.web > 0;
  if (piece.webbed) piece.points = 0;
  if (s.stun > 0) {
    s.stun -= 1;
    piece.stunned = true;
    r.stunned = true;
  }
  r.killed = piece.wounds <= 0;
  return r;
}
