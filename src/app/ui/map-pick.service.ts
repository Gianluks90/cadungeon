import { Injectable, signal } from '@angular/core';

/** Che cosa si può scegliere con un clic sulla mappa (`TileEditor.pickTargets`). */
export type PickKind = 'monster' | 'encounter' | 'glyph' | 'stairs' | 'pickup' | 'itemMarker' | 'obstacle' | 'area' | 'door' | 'zone';

/** Una richiesta di una dialog all'editor: scegliere un elemento con un clic sulla mappa (`apply` riceve il valore scelto) o, senza `apply`, mostrare dov'è quello di `value`. */
export interface PickRequest {
  kind: PickKind;
  value?: string;
  apply?: (value: string) => void;
}

/**
 * La scelta di un elemento con un clic sulla mappa, fra l'editor (che la esegue) e le dialog (che la chiedono con `app-map-select`). Mentre `picking` non è nulla tutte le dialog si
 * nascondono (senza perdere ciò che c'è scritto, vedi `app-dialog`). Si fornisce nel componente dell'editor: fuori dall'editor non c'è e le dialog funzionano come sempre.
 */
@Injectable()
export class MapPickService {
  /** La richiesta in corso, o null. */
  readonly picking = signal<PickRequest | null>(null);
  /** Chi la esegue (l'editor). */
  handler: ((r: PickRequest) => void) | null = null;

  ask(r: PickRequest) {
    this.handler?.(r);
  }
}
