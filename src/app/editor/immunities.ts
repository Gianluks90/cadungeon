import { translate as t } from '../i18n/i18n.service';
import type { SelectOption } from '../ui/select.component';

/** Le immunità che un nemico può avere (`Piece.immune`): "Tutti gli stati" è una voce a sé (`all`), così toglierla non cancella le immunità specifiche della carta. */
export const IMMUNITY_OPTIONS: SelectOption[] = [
  { value: 'all', get label() { return t('immunity.tuttiGliStati'); } },
  { value: 'burn', get label() { return t('immunity.fiamma'); } },
  { value: 'web', get label() { return t('immunity.rete'); } },
  { value: 'stun', get label() { return t('immunity.stordimento'); } },
  { value: 'poison', get label() { return t('immunity.veleno'); } },
  { value: 'aura', get label() { return t('immunity.aura'); } },
  { value: 'fear', get label() { return t('immunity.paura'); } },
  { value: 'grip', get label() { return t('immunity.presa'); } },
  { value: 'knockback', get label() { return t('immunity.contraccolpo'); } },
];

export const immunityName = (value: string): string => IMMUNITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
