/** Una scheda della scelta dell'avventura: con `map` (il nome del file in `public/maps/`, senza estensione) si può giocare, senza è un posto ancora vuoto. */
export interface AdventureCard {
  map?: string;
  title?: string;
}

/** Le nove avventure base, nell'ordine in cui compaiono. Le prime quattro sono quelle fatte con l'editor (copie di `docs/adventures-editor-created/`); gli altri cinque posti arriveranno. */
export const ADVENTURES: readonly AdventureCard[] = [
  { map: 'nelle-tenebre', title: 'Nelle Tenebre' },
  { map: 'i-fratelli-durnog', title: 'I fratelli Durnog' },
  { map: 'questioni-di-vita-e-di-morte', title: 'Questioni di vita e di morte' },
  { map: 'un-drago-arrogante', title: 'Un drago arrogante' },
  {},
  {},
  {},
  {},
  {},
];
