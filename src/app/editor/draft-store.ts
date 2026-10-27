import type { MapData } from '../game/map/map-data';

/** La bozza dell'editor: la mappa (nel formato salvato di sempre) e l'inquadratura, quanto basta per ritrovare tutto dopo un refresh. */
export interface EditorDraft {
  version: 1;
  map: MapData;
  /** Il centro dello schermo in pixel del mondo e lo zoom. */
  view?: { x: number; y: number; zoom: number };
  savedAt: number;
}

/** Dove si tengono le bozze: oggi il localStorage, domani Firestore (CLAUDE.md, "Stack": la persistenza sta dietro un'interfaccia). */
export interface DraftStore {
  save(draft: EditorDraft): boolean;
  load(): EditorDraft | null;
  /** Cancella la bozza: al prossimo avvio l'editor parte da una mappa vuota. Restituisce false se il browser non lo permette. */
  clear(): boolean;
}

const KEY = 'cad-editor-draft';

export class LocalDraftStore implements DraftStore {
  /** Restituisce false se il browser non lascia scrivere (storage pieno o bloccato). */
  save(draft: EditorDraft): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  }

  clear(): boolean {
    try {
      localStorage.removeItem(KEY);
      return true;
    } catch {
      return false;
    }
  }

  load(): EditorDraft | null {
    try {
      const raw = localStorage.getItem(KEY);
      const d = raw ? (JSON.parse(raw) as EditorDraft) : null;
      return d && d.version === 1 && d.map && Array.isArray(d.map.tiles) ? d : null;
    } catch {
      return null; // niente storage o dati rovinati: si parte da una mappa vuota
    }
  }
}
