import type { GameSnapshot } from './state/game-state';

/** Una partita salvata: lo stato della partita (dati puri) con l'avventura a cui appartiene e quando. */
export interface GameSave {
  version: 1;
  /** Il nome della mappa (`public/maps/<map>.json`): serve per ricaricare le tessere, i disegni e i testi, che non stanno nello stato. */
  map: string;
  savedAt: number;
  /** Salvata dal giocatore (il tasto) o da sola (a fine turno). */
  auto: boolean;
  snapshot: GameSnapshot;
}

/** Dove si tengono le partite salvate: oggi il localStorage, domani Firestore (CLAUDE.md, "Stack": la persistenza sta dietro un'interfaccia). Una per avventura. */
export interface SaveStore {
  /** Restituisce false se il browser non lascia scrivere (archivio pieno o bloccato). */
  save(save: GameSave): boolean;
  load(map: string): GameSave | null;
  /** L'ultima avventura salvata (per il tasto Continua della home), se ce n'è una. */
  last(): { map: string; savedAt: number } | null;
  clear(map: string): void;
}

const KEY = (map: string) => `cad-save:${map}`;
const LAST = 'cad-save-last';

export class LocalSaveStore implements SaveStore {
  save(save: GameSave): boolean {
    try {
      localStorage.setItem(KEY(save.map), JSON.stringify(save));
      localStorage.setItem(LAST, JSON.stringify({ map: save.map, savedAt: save.savedAt }));
      return true;
    } catch {
      return false;
    }
  }

  load(map: string): GameSave | null {
    try {
      const raw = localStorage.getItem(KEY(map));
      const s = raw ? (JSON.parse(raw) as GameSave) : null;
      return s && s.version === 1 && s.map === map && s.snapshot ? s : null;
    } catch {
      return null; // niente storage o dati rovinati: come se non ci fosse un salvataggio
    }
  }

  last(): { map: string; savedAt: number } | null {
    try {
      const raw = localStorage.getItem(LAST);
      const l = raw ? (JSON.parse(raw) as { map: string; savedAt: number }) : null;
      return l && typeof l.map === 'string' && this.load(l.map) ? l : null; // il puntatore vale solo se il salvataggio c'è ancora
    } catch {
      return null;
    }
  }

  clear(map: string): void {
    try {
      localStorage.removeItem(KEY(map));
      const l = localStorage.getItem(LAST);
      if (l && (JSON.parse(l) as { map: string }).map === map) localStorage.removeItem(LAST);
    } catch {
      // niente storage: niente da cancellare
    }
  }
}
