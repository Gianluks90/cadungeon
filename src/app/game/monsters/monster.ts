import { AttackType, DieColor } from '../items/item';

/** I valori di un mostro in una delle sue due versioni (la sezione beige e quella rossa della carta). */
export interface MonsterTier {
  /** Le ferite per scaglione di giocatori (eroi + il Signore Supremo): "2-3", "4" o "5". */
  wounds: Record<PlayersKey, number>;
  speed: number;
  armor: number;
  /** I dadi d'attacco, per colore (il nero è il dado potere). */
  dice: DieColor[];
  /** Abilità speciali, a parole (Perforare 1, Veleno...): per ora solo testo. */
  abilities: string[];
}

/** Lo scaglione della carta: 2-3, 4 o 5 giocatori (il Signore Supremo conta come giocatore). */
export type PlayersKey = '2-3' | '4' | '5';

/** Un mostro del catalogo (public/monsters/catalog.json). Si aggiungono mostri solo aggiungendo voci al file. */
export interface MonsterDef {
  id: string;
  name: string;
  /** Il percorso delle immagini senza estensione: `<image>-token.webp` per la pedina e `<image>-portrait.webp` per la scheda. */
  image: string;
  /** Le caselle che occupa (1×1, 1×2, 2×2 o 2×3). */
  size: { w: number; h: number };
  /** Un mostro fa un solo tipo di attacco. */
  attack: AttackType;
  normal: MonsterTier;
  /** La versione potenziata (la sezione rossa della carta). */
  enhanced: MonsterTier;
}

/** Lo scaglione da usare con questo numero di eroi: i giocatori sono gli eroi più il Signore Supremo. */
export function playersKey(heroes: number): PlayersKey {
  const players = heroes + 1;
  return players <= 3 ? '2-3' : players === 4 ? '4' : '5';
}

/** Carica il catalogo dei mostri: un solo file, public/monsters/catalog.json (`{ monsters: [...] }`). Se manca, è vuoto. */
export async function loadMonsterCatalog(): Promise<Map<string, MonsterDef>> {
  const monsters = new Map<string, MonsterDef>();
  try {
    const res = await fetch('monsters/catalog.json');
    if (!res.ok) return monsters;
    const file: { monsters: MonsterDef[] } = await res.json();
    for (const m of file.monsters) monsters.set(m.id, m);
  } catch {
    console.warn('Catalogo dei mostri non trovato');
  }
  return monsters;
}
