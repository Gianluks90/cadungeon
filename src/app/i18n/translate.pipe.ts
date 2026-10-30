import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService, MessageKey } from './i18n.service';

/**
 * Traduce un testo nei template: `{{ 'home.newGame' | t }}`, con i segnaposto `{{ 'adventures.play' | t: { title } }}`. Non è puro perché deve seguire la lingua, che cambia a pagina aperta;
 * il costo è una ricerca in una tabella. La chiave sbagliata non compila.
 */
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: MessageKey, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
