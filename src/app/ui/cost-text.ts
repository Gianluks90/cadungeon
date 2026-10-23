/**
 * Il costo in punti movimento nei testi: si scrive `{mov:N}` e l'interfaccia lo mostra come il valore con l'icona delle impronte, in verde (il colore
 * del movimento), invece di "N punti movimento". Dove il testo non può avere icone (un suggerimento col mouse), `plainCostText` lo riscrive a parole.
 */
const COST = /\{mov:(\d+)\}/g;

/** Il testo con i costi riscritti a parole ("2 punti movimento"). */
export function plainCostText(text: string): string {
  return text.replace(COST, (_, n: string) => `${n} ${n === '1' ? 'punto' : 'punti'} movimento`);
}

/** Il testo a pezzi: pezzi di testo e costi. */
export function costSegments(text: string): ({ text: string } | { mov: number })[] {
  const out: ({ text: string } | { mov: number })[] = [];
  let last = 0;
  for (const m of text.matchAll(COST)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ mov: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
