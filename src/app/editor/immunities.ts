import { translate as t } from '../i18n/i18n.service';
import type { SelectOption } from '../ui/select.component';

/** Le immunità che un nemico può avere (`Piece.immune`): "Tutti gli stati" è una voce a sé (`all`), così toglierla non cancella le immunità specifiche della carta. */
export const IMMUNITY_OPTIONS: SelectOption[] = [
  { value: 'all', get label() { return t('immunity.all'); } },
  { value: 'burn', get label() { return t('immunity.burn'); } },
  { value: 'web', get label() { return t('immunity.web'); } },
  { value: 'stun', get label() { return t('immunity.stun'); } },
  { value: 'poison', get label() { return t('immunity.poison'); } },
  { value: 'aura', get label() { return t('immunity.aura'); } },
  { value: 'fear', get label() { return t('immunity.fear'); } },
  { value: 'grip', get label() { return t('immunity.grapple'); } },
  { value: 'knockback', get label() { return t('immunity.knockback'); } },
];

export const immunityName = (value: string): string => IMMUNITY_OPTIONS.find((o) => o.value === value)?.label ?? value;
