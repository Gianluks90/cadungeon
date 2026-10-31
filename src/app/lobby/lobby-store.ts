/** Una partita multiplayer creata dal Signore supremo: il codice da condividere e quanti eroi (giocatori, Signore supremo escluso) ci giocano. */
export interface Lobby {
  /** Il codice unico che gli altri giocatori scrivono in "Unisciti". */
  code: string;
  /** Da 1 a 4: con il Signore supremo i giocatori sono al massimo 5. */
  heroes: number;
  createdAt: number;
}

export const LOBBY_MIN_HEROES = 1;
export const LOBBY_MAX_HEROES = 4;
export const LOBBY_CODE_MIN = 4;
export const LOBBY_CODE_MAX = 8;

/** Senza 0/O e 1/I/L, che si confondono quando il codice si legge a voce o si ricopia. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Un codice casuale di 6 caratteri, facile da dettare. */
export function generateLobbyCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** Solo lettere e numeri, in maiuscolo, al massimo `LOBBY_CODE_MAX`: quello che si scrive nel campo. */
export function cleanLobbyCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LOBBY_CODE_MAX);
}

export function isValidLobbyCode(code: string): boolean {
  return code.length >= LOBBY_CODE_MIN && code.length <= LOBBY_CODE_MAX && cleanLobbyCode(code) === code;
}

/** Dove si tengono le partite multiplayer create: oggi il localStorage, poi la rete (la persistenza sta dietro un'interfaccia). */
export interface LobbyStore {
  list(): Lobby[];
  get(code: string): Lobby | null;
  /** False se il codice esiste già o il browser non lascia scrivere. */
  add(lobby: Lobby): boolean;
  remove(code: string): void;
}

const KEY = 'cad-lobbies';

export class LocalLobbyStore implements LobbyStore {
  list(): Lobby[] {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      if (!Array.isArray(data)) return [];
      return data.filter((l): l is Lobby => typeof l?.code === 'string' && typeof l?.heroes === 'number');
    } catch {
      return [];
    }
  }

  get(code: string): Lobby | null {
    return this.list().find((l) => l.code === code) ?? null;
  }

  add(lobby: Lobby): boolean {
    const all = this.list();
    if (all.some((l) => l.code === lobby.code)) return false;
    try {
      localStorage.setItem(KEY, JSON.stringify([...all, lobby]));
      return true;
    } catch {
      return false;
    }
  }

  remove(code: string) {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.list().filter((l) => l.code !== code)));
    } catch {
      /* niente da fare: resta com'era */
    }
  }
}
