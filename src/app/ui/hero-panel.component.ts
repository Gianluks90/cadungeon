import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output } from '@angular/core';

import { PictureComponent } from './picture.component';

/** Ciò che la cornice mostra di chi la apre: un eroe (`HeroDetails`) o un mostro (`MonsterDetails`). */
export interface PanelSubject {
  name: string;
  heroClass?: string;
  portrait?: string;
  portraitFull?: string;
  /** Solo per gli eroi: c'è anche l'etichetta Città. */
  cityPanel?: boolean;
  /** Un mostro potenziato: la sua carta ha il contorno rosso. */
  enhanced?: boolean;
}

/** I pannelli di un eroe: le informazioni, l'inventario e (solo in città) la città. */
export type PanelKind = 'info' | 'inventory' | 'city';

/**
 * La cornice dei due pannelli dell'eroe (informazioni e inventario): un'altezza fissa uguale per tutti e due, e a sinistra l'immagine a figura
 * intera dell'eroe (sempre della stessa misura, ritagliata a riempire), leggermente ruotata e infilata sotto il pannello, che le sta sopra
 * senza restringersi; sul suo piede, un fondo opaco con il nome e il sottotitolo; quando si apre, il pannello sale appena e appare e l'immagine
 * scivola da sotto di lui verso sinistra fino al suo posto; in cima due etichette a cartella, "Informazioni" e "Inventario", che si dividono la larghezza e servono a passare dall'una all'altra. Il contenuto (che scorre se
 * è più lungo) arriva da fuori. Sta appena sopra il gruppo dei tab degli eroi; si chiude con un tocco fuori o con Esc.
 */
@Component({
  selector: 'app-hero-panel',
  imports: [PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(document:keydown.escape)': 'closed.emit()', '[class.right]': "side() === 'right'" },
  template: `
    @if (hero(); as h) {
      <section class="frame" [attr.aria-label]="'Pannello di ' + h.name">
        <figure class="art" [class.enhanced]="h.enhanced">
          <app-picture [src]="h.portraitFull ?? h.portrait" [icon]="h.heroClass?.startsWith('Mostro') ? 'skull' : 'frame_person'" [iconSize]="72" />
          <figcaption>
            <b>{{ h.name }}</b>
            @if (h.heroClass) { <span>{{ h.heroClass }}</span> }
          </figcaption>
        </figure>
        <div class="main">
          <div class="tabs" role="tablist">
            @for (k of tabKinds(); track k) {
              <button type="button" role="tab" class="tab" [class.on]="active() === k" [attr.aria-selected]="active() === k" (click)="switch.emit(k)">{{ labelOf(k) }}</button>
            }
          </div>
          <div class="body"><ng-content /></div>
        </div>
      </section>
    }
  `,
  styles: `
    /* Appena sopra il gruppo degli eroi, lungo quanto l'elenco (i -1px coprono il bordo). */
    :host {
      --art-width: 190px; --art-overlap: 30px; --panel-height: min(460px, calc(100vh - var(--footer-height, 0px) - 76px - 60px));
      position: absolute; z-index: 15; left: -1px; right: -1px; bottom: calc(100% + 14px); display: block;
    }
    /* A destra: lunga come l'elenco degli eroi (tutta la barra meno il tab chiuso dell'Overlord) e allineata al bordo destro del tab dell'Overlord. */
    :host(.right) { left: auto; width: calc(100% - var(--tab-size, 76px) + 3px); }
    /* Su schermi stretti sta a tutta larghezza, sopra la barra. */
    @media (max-width: 640px) {
      :host, :host(.right) { position: fixed; left: 12px; right: 12px; width: auto; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 76px + 14px); }
    }
    @media (max-width: 640px) { .art { display: none; } }
    /* L'apertura: il pannello sale appena e appare, mentre l'immagine scivola da sotto il pannello verso sinistra fino al suo posto. */
    .main { animation: panel-in 0.24s ease-out both; }
    .art { animation: art-in 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes panel-in { from { opacity: 0; transform: translateY(10px); } }
    @keyframes art-in { from { opacity: 0; transform: translateX(52px) rotate(-1deg); } }
    @media (prefers-reduced-motion: reduce) { .main, .art { animation: none; } }
    .frame { position: relative; height: var(--panel-height); color: var(--c-text); font: 13px/1.35 var(--font-ui); user-select: none; }
    /* L'immagine sta a sinistra, fuori dal pannello (che resta largo come il gruppo dei tab), un po' ruotata e infilata sotto il suo bordo. */
    .art {
      position: absolute; z-index: 0; right: calc(100% - var(--art-overlap)); top: 8px; bottom: 8px; width: var(--art-width); margin: 0; overflow: hidden; border-radius: var(--radius-1);
      border: 1px solid var(--c-line-strong); background: var(--c-tile); transform: rotate(-4deg); transform-origin: 70% 100%;
      box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
    }
    .art.enhanced { border-color: var(--c-faction-overlord); }
    /* Il piede dell'immagine: fondo opaco con il nome e il sottotitolo (la classe, in maiuscolo); a destra lascia lo spazio coperto dal pannello. */
    figcaption {
      position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; background: var(--c-surface);
      border-top: 1px solid var(--c-line-strong); padding: 8px calc(var(--art-overlap) + 8px) 9px 12px;
    }
    figcaption b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    figcaption span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .main { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; min-width: 0; }
    .tabs { display: flex; flex: none; }
    /* Etichette a cartella: contornate in alto, a sinistra e a destra; quella aperta si fonde con il corpo del pannello. */
    .tab {
      flex: 1; margin-bottom: -1px; padding: 9px 8px 8px; position: relative; cursor: pointer; background: var(--c-bg);
      border: 1px solid var(--c-line-strong); border-radius: var(--radius-1);
      color: var(--c-text-dim); font: 600 14px/1.2 var(--font-ui); transition: color 0.15s;
    }
    .tab + .tab { margin-left: -1px; }
    .tab:hover, .tab:focus-visible { color: var(--c-text); outline: none; }
    .tab.on { z-index: 1; cursor: default; background: var(--c-surface); color: var(--c-text); border-bottom-color: var(--c-surface); }
    .body {
      flex: 1; min-height: 0; overflow: auto; box-sizing: border-box; padding: 14px 16px 28px;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1);
    }
  `,
})
export class HeroPanelComponent {
  readonly hero = input<PanelSubject | null>(null);
  /** A sinistra (eroi: dal primo tab) o a destra (mostri: dall'ultimo tab, quello dell'Overlord). */
  readonly side = input<'left' | 'right'>('left');
  /** Le etichette in cima; senza, quelle degli eroi (Informazioni, Inventario e, in città, Città). */
  readonly kinds = input<PanelKind[] | null>(null);
  protected readonly tabKinds = computed<PanelKind[]>(() => this.kinds() ?? ['info', 'inventory', ...(this.hero()?.cityPanel ? (['city'] as PanelKind[]) : [])]);
  protected labelOf(k: PanelKind): string {
    return { info: 'Informazioni', inventory: 'Inventario', city: 'Città' }[k];
  }
  /** Quale dei due pannelli è aperto. */
  readonly active = input.required<PanelKind>();
  readonly closed = output<void>();
  readonly switch = output<PanelKind>();

  private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;

  /** Un tocco fuori dal pannello lo chiude (non se è sui tasti del tab in basso, che lo aprono e lo chiudono da sé). */
  protected outside(e: Event) {
    const target = e.target as Element | null;
    if (!this.hero() || target?.closest('[data-sheet-toggle]')) return;
    if (!this.hostEl.contains(target as Node)) this.closed.emit();
  }
}
