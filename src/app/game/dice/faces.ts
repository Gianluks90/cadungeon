import { DieColor } from '../items/item';

/** Una faccia di un dado (public/dice/faces.json): cosa dà all'attacco. */
export interface DieFace {
  range: number;
  hearts: number;
  surge: number;
  miss: boolean;
  /** Solo dado potere: gittata e cuore separati da una diagonale; chi tira sceglie quale dei due valori accettare. */
  slash?: boolean;
}

/** Un dado tirato: il colore e la faccia uscita. */
export interface FaceRoll {
  color: DieColor;
  face: DieFace;
}
