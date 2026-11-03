/**
 * I valori nei testi: si scrive `{mov:N}` (punti movimento), `{energy:N}` (energia) o `{hatred:N}` (Odio) e l'interfaccia li mostra come il valore con l'icona, nel colore
 * giusto (impronte gialle, goccia verde, teschio rosso), invece di "N punti movimento" o "N energia". Senza numero (`{energy}`) c'è solo l'icona, da mettere dopo la parola
 * ("l'energia {energy} al massimo"). Dove il testo non può avere icone (un suggerimento col mouse), `plainCostText` li riscrive a parole (e toglie quelle senza numero).
 */
const COST = /\{(mov|energy|hatred)(?::(\d+))?\}/g;

export type CostKind = 'mov' | 'energy' | 'hatred';

/** Un pezzo di testo con valori: testo semplice o un valore (`n` è null se c'è solo l'icona). */
export type CostSegment = { text: string } | { kind: CostKind; n: number | null };

/** Il testo con i valori riscritti a parole ("2 punti movimento", "1 energia", "3 Odio"); le icone senza numero spariscono. */
export function plainCostText(text: string): string {
  return text
    .replace(COST, (_, kind: CostKind, n: string | undefined) => {
      if (n === undefined) return '';
      return kind === 'mov' ? `${n} ${n === '1' ? 'punto' : 'punti'} movimento` : kind === 'energy' ? `${n} energia` : `${n} Odio`;
    })
    .replace(/ {2,}/g, ' ')
    .replace(/ ([.,;:!?)])/g, '$1');
}

/** Il testo a pezzi: pezzi di testo e valori. */
export function costSegments(text: string): CostSegment[] {
  const out: CostSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(COST)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ kind: m[1] as CostKind, n: m[2] === undefined ? null : Number(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}