import { RuneColor } from './board/door';

/** Come è scritto nella mappa cosa ha il gruppo all'inizio. Dati dell'avventura, come le porte. */
export interface PartyData {
  runeKeys?: RuneColor[];
  keys?: string[];
}

/**
 * Ciò che il gruppo degli eroi possiede e serve alle porte: le chiavi normali e le tre chiavi runiche.
 * Le chiavi runiche sono del gruppo (una volta trovate sbloccano quel colore per tutti gli eroi).
 * Il denaro e gli oggetti non sono del gruppo: ogni eroe ha i suoi.
 */
export class Party {
  readonly runeKeys: Set<RuneColor>;
  readonly keys: Set<string>;

  constructor(data: PartyData = {}) {
    this.runeKeys = new Set(data.runeKeys ?? []);
    this.keys = new Set(data.keys ?? []);
  }

  /** Il gruppo come dati puri (per salvarlo). */
  toData(): PartyData {
    return { runeKeys: [...this.runeKeys], keys: [...this.keys] };
  }
}
