import { Pipe, PipeTransform } from '@angular/core';
import { tr } from './catalog-text';

/** Come `tr` nei template: `{{ 'Scegli la casella di partenza' | tr }}`, con segnaposto `{{ 'Turno di {name}' | tr: { name: hero.name } }}`. Non è puro perché segue la lingua. */
@Pipe({ name: 'tr', pure: false })
export class TrPipe implements PipeTransform {
  transform(text: string, params?: Record<string, string | number | undefined>): string {
    return tr(text, params);
  }
}
