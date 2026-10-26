/** Il genere di una carta del Signore Supremo (docs/cards/overlord.md). */
export type OverlordCardKind = 'power' | 'event' | 'trap' | 'summon';

/** Chi o cosa prende di mira una trappola quando viene armata. */
export type TrapTarget = 'cell' | 'door' | 'chest' | 'hero';

/** Una carta del mazzo dell'Overlord (public/overlord/catalog.json). */
export interface OverlordCardDef {
  id: string;
  name: string;
  kind: OverlordCardKind;
  /** Quante copie ci sono nel mazzo. */
  copies: number;
  /** Quanta Minaccia costa giocarla. */
  cost: number;
  /** Quanta Minaccia si prende scartandola. */
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

/** Carica il catalogo delle carte dell'Overlord: un solo file, public/overlord/catalog.json (`{ cards: [...] }`). Se manca, è vuoto. */
export async function loadOverlordCatalog(): Promise<Map<string, OverlordCardDef>> {
  const cards = new Map<string, OverlordCardDef>();
  try {
    const res = await fetch('overlord/catalog.json');
    if (!res.ok) return cards;
    const file: { cards: OverlordCardDef[] } = await res.json();
    for (const c of file.cards) cards.set(c.id, c);
  } catch {
    console.warn('Catalogo delle carte dell’Overlord non trovato');
  }
  return cards;
}
