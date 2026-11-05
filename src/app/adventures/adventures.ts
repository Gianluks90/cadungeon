/** Una scheda della scelta dell'avventura: con `map` (il nome del file in `public/maps/`, senza estensione) si può giocare, senza è un posto ancora vuoto. */
export interface AdventureCard {
  map?: string;
  title?: string;
}

/** Le nove avventure base, nell'ordine in cui compaiono: tutte fatte con l'editor (copie di `docs/adventures-editor-created/`). */
export const ADVENTURES: readonly AdventureCard[] = [
  { map: 'nelle-tenebre', title: 'Nelle Tenebre' },
  { map: 'i-fratelli-durnog', title: 'I fratelli Durnog' },
  { map: 'questioni-di-vita-e-di-morte', title: 'Questioni di vita e di morte' },
  { map: 'un-drago-arrogante', title: 'Un drago arrogante' },
  { map: 'gli-ultimi-voleri', title: 'Gli ultimi voleri' },
  { map: 'il-guardiano-eterno', title: 'Il guardiano eterno' },
  { map: 'la-spada-nera', title: 'La spada nera' },
  { map: 'le-rovine-dell-inganno', title: "Le rovine dell'inganno" },
  { map: 'vecchi-amici', title: 'Vecchi amici' },
];
