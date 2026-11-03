import { localizeName } from '../../i18n/catalog-text';
/** Il genere di una Carta del Male (docs/cards/evil.md). */
export type EvilCardKind = 'power' | 'event' | 'trap' | 'summon';

/** Chi o cosa prende di mira una trappola quando viene armata. */
export type TrapTarget = 'cell' | 'door' | 'chest' | 'hero';

/** Una carta del Mazzo del Male (public/evil/catalog.json). */
export interface EvilCardDef {
  id: string;
  name: string;
  kind: EvilCardKind;
  /** Quante copie ci sono nel mazzo. */
  copies: number;
  /** Quanto Odio costa giocarla. */
  cost: number;
  /** Quanto Odio si prende scartandola. */
  value: number;
  /** Il testo della carta. */
  text: string;
  /** Le trappole: dove vanno armate. */
  target?: TrapTarget;
  /** Le evocazioni: quali mostri (e quanti) fanno apparire. */
  summon?: { monster: string; count: number; enhanced?: boolean }[];
  /** Vero se la carta ha già i suoi effetti nel gioco: nel mazzo entrano solo queste (le altre arrivano a poco a poco). */
  ready?: boolean;
}

/** Carica il catalogo delle Carte del Male: un solo file, public/evil/catalog.json (`{ cards: [...] }`). Se manca, è vuoto. */
export async function loadEvilCatalog(): Promise<Map<string, EvilCardDef>> {
  const cards = new Map<string, EvilCardDef>();
  try {
    const res = await fetch('evil/catalog.json');
    if (!res.ok) return cards;
    const file: { cards: EvilCardDef[] } = await res.json();
    for (const c of file.cards) cards.set(c.id, localizeName('evil', c));
  } catch {
    console.warn('Catalogo delle Carte del Male non trovato');
  }
  return cards;
}
