import { translate } from '../../i18n/i18n.service';

/**
 * I nomi delle aree non si salvano nell'avventura: li dà l'app, nella lingua di adesso. L'area di partenza si chiama "Area di partenza" e le altre "Area 1", "Area 2"… nell'ordine
 * dell'elenco (l'area di partenza non conta nel numero).
 */
export function areaNames(areas: readonly { id: string; start?: boolean }[]): Map<string, string> {
  let n = 0;
  return new Map(areas.map((a) => [a.id, a.start ? translate('area.start') : translate('area.numbered', { n: ++n })]));
}
