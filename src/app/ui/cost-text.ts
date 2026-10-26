/**
 * I costi nei testi: si scrive `{mov:N}` (punti movimento) o `{fat:N}` (fatica) e l'interfaccia li mostra come il valore con l'icona, nel colore
 * giusto (impronte verdi, goccia arancione), invece di "N punti movimento" o "N fatica". Dove il testo non può avere icone (un suggerimento col
 * mouse), `plainCostText` li riscrive a parole.
 */
const COST = /\{(mov|fat):(\d+)\}/g;

/** Un pezzo di testo con costi: testo semplice o un costo (`mov` punti movimento, `fat` fatica). */
export type CostSegment = { text: string } | { mov: number } | { fat: number };

/** Il testo con i costi riscritti a parole ("2 punti movimento", "1 fatica"). */
export function plainCostText(text: string): string {
  return text.replace(COST, (_, kind: string, n: string) => (kind === 'mov' ? `${n} ${n === '1' ? 'punto' : 'punti'} movimento` : `${n} fatica`));
}

/** Il testo a pezzi: pezzi di testo e costi. */
export function costSegments(text: string): CostSegment[] {
  const out: CostSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(COST)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(m[1] === 'mov' ? { mov: Number(m[2]) } : { fat: Number(m[2]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
