import { Pipe, PipeTransform } from '@angular/core';
import { catalogText } from './catalog-text';

/** Un testo di un catalogo (regola di un oggetto, abilità di un mostro, testo di una carta abilità…) nella lingua di adesso: `{{ rule | ct }}`. Non è puro perché segue la lingua. */
@Pipe({ name: 'ct', pure: false })
export class CatalogTextPipe implements PipeTransform {
  transform(text: string): string {
    return catalogText(text);
  }
}
