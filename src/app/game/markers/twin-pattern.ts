/**
 * Come si riconoscono le coppie di glifi gemelli: i quattro cerchietti del glifo (0 in alto a sinistra, poi in senso orario: 1 in alto a destra, 2 in basso a destra, 3 in basso a sinistra)
 * si riempiono in una combinazione che è diversa per ogni coppia. Si parte da un cerchietto pieno, poi due, tre e quattro: le combinazioni sono 15, quante le coppie possibili.
 * L'etichetta della coppia è `gemelli-N` (N da 1): la combinazione è la N-esima di questo elenco, quindi basta l'etichetta, senza altri dati.
 */
export const TWIN_PATTERNS: readonly (readonly number[])[] = [
  [0], [1], [2], [3],
  [0, 1], [1, 2], [2, 3], [3, 0], [0, 2], [1, 3],
  [0, 1, 2], [1, 2, 3], [2, 3, 0], [3, 0, 1],
  [0, 1, 2, 3],
];

/** Quante coppie di gemelli si possono distinguere. */
export const MAX_TWIN_PAIRS = TWIN_PATTERNS.length;

/** I cerchietti pieni di una coppia, dall'etichetta (`gemelli-3` → la terza combinazione). Un'etichetta senza numero (di un'avventura scritta a mano) ne prende una dal suo testo. */
export function twinDots(label: string | undefined): readonly number[] {
  if (!label) return [];
  const m = /(\d+)$/.exec(label);
  let n = m ? Number(m[1]) : 0;
  if (!n) {
    let h = 0;
    for (const ch of label) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
    n = (h % MAX_TWIN_PAIRS) + 1;
  }
  return TWIN_PATTERNS[(n - 1) % MAX_TWIN_PAIRS];
}
