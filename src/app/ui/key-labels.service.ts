import { Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Le etichette nascoste dei tasti a pallino: si vedono finché si tiene premuto H (`show`). Il servizio ascolta la tastiera una volta sola,
 * e non reagisce mentre si scrive in un campo di testo.
 */
@Injectable({ providedIn: 'root' })
export class KeyLabelsService {
  readonly show = signal(false);

  constructor() {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
    };
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e)) this.show.set(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'h') this.show.set(false);
    };
    const off = () => this.show.set(false); // se la finestra perde il fuoco con H premuto, il tasto non "resta" premuto
    inject(NgZone).runOutsideAngular(() => {
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      window.addEventListener('blur', off);
    });
  }
}
