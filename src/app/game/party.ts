import { RuneColor } from './board/door';

/** Come è scritto nella mappa cosa ha il gruppo all'inizio. Dati dell'avventura, come le porte. */
export interface PartyData {
  runeKeys?: RuneColor[];
  keys?: string[];
  /** Monete che ognuno degli eroi ha già. */
  coins?: number;
}

/**
 * Ciò che il gruppo degli eroi possiede e serve alle porte: le chiavi normali e le tre chiavi runiche.
 * Le chiavi runiche sono del gruppo (una volta trovate sbloccano quel colore per tutti gli eroi).
 * Per ora senza interfaccia: come mostrare l'inventario si deciderà dopo.
 */
export class Party {
  readonly runeKeys: Set<RuneColor>;
  readonly keys: Set<string>;
  /** Il denaro: ogni eroe ne ha questa quantità (il segnalino Denaro lo dà a tutti insieme). */
  coins: number;

  constructor(data: PartyData = {}) {
    this.runeKeys = new Set(data.runeKeys ?? []);
    this.keys = new Set(data.keys ?? []);
    this.coins = data.coins ?? 0;
  }

  /** Il gruppo come dati puri (per salvarlo). */
  toData(): PartyData {
    return { runeKeys: [...this.runeKeys], keys: [...this.keys], coins: this.coins };
  }
}
