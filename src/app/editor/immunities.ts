import type { SelectOption } from '../ui/select.component';

/** Le immunità che un nemico può avere (`Piece.immune`): "Tutti gli stati" è una voce a sé (`all`), così toglierla non cancella le immunità specifiche della carta. */
export const IMMUNITY_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Tutti gli stati' },
  { value: 'burn', label: 'Fiamma' },
  { value: 'web', label: 'Rete' },
  { value: 'stun', label: 'Stordimento' },
  { value: 'poison', label: 'Veleno' },
  { value: 'aura', label: 'Aura' },
  { value: 'fear', label: 'Paura' },
  { value: 'grip', label: 'Presa' },
  { value: 'knockback', label: 'Contraccolpo' },
];

export const immunityName = (value: string): string => IMMUNITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
