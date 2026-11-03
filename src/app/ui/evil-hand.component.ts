import { ChangeDetectionStrategy, Component, ElementRef, inject, input, signal } from '@angular/core';
import { EvilCardKind } from '../game/evil/card';
import { tr } from '../i18n/catalog-text';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/** I nomi dei generi di carta, nella lingua di adesso (si traducono al momento dell'uso). */
const KIND_NAMES: Record<EvilCardKind, () => string> = {
  power: () => tr('Potere'),
  event: () => tr('Evento'),
  trap: () => tr('Trappola'),
  summon: () => tr('Evocazione'),
};

/** Una carta della mano del Maligno, come la mostra la mano. */
export interface HandCardView {
  id: string;
  name: string;
  kind: EvilCardKind;
  /** Il testo della carta (dai dati, in italiano: si traduce con `ct`). */
  text: string;
  /** Quanta Minaccia costa giocarla adesso (con ciò che aggiungono gli eroi), e quanta se ne prende consumandola. */
  cost: number;
  value: number;
}

/**
 * La mano del Maligno (vista del Maligno): le carte pescate, nello spazio fra i suoi contatori e il mazzo, in sovraimpressione come il dorso. Hanno la stessa forma e lo stesso
 * margine scuro del dorso, restano per metà sotto il bordo basso dello schermo e si sovrappongono un po' come carte tenute in mano (più sono, più si stringono). Sono tutte uguali:
 * in alto il costo in Minaccia e il genere, poi il titolo (in uno spazio di altezza fissa, centrato), la descrizione (di altezza fissa: se è lunga scorre con la rotellina) e,
 * in fondo, la Minaccia che si prende consumando la carta. Con il mouse la carta sale e si vede intera passandoci sopra; col dito (dove non c'è il passaggio) sale con un tocco,
 * e un altro tocco, su di lei o fuori, la rimette giù.
 */
@Component({
  selector: 'app-evil-hand',
  host: { '[style.--n]': 'cards().length', '(document:pointerdown)': 'outside($event)' },
  imports: [CatalogTextPipe, TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hand" role="list" [attr.aria-label]="'Carte in mano' | tr">
      @for (c of cards(); track $index) {
        <article class="card" role="listitem" tabindex="0" [class.up]="raised() === $index" [attr.data-kind]="c.kind" (pointerdown)="pointerType = $event.pointerType" (click)="tap($index)">
          <div class="face">
            <header>
              <span class="pill cost" [title]="'Costo in Minaccia' | tr"><app-icon name="skull" [size]="14" />{{ c.cost }}</span>
              <span class="kind">{{ kindName(c.kind) }}</span>
            </header>
            <h3><span>{{ c.name }}</span></h3>
            <p>{{ c.text | ct }}</p>
            <footer>
              <span class="pill value" [title]="'Minaccia se consumata' | tr"><app-icon name="skull" [size]="12" />+{{ c.value }}</span>
            </footer>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    /* Una linea sul bordo basso dello schermo, fra i contatori (a sinistra) e il mazzo (a destra): il dorso sta a 112 px dal bordo, largo 178 px, con il pallino che sporge di 19 px a sinistra. */
    :host { position: absolute; z-index: 27; left: 400px; right: 322px; bottom: 0; height: 0; pointer-events: none; container-type: inline-size; }
    .hand { --card: 178px; /* come il dorso */ --step: min(120px, calc((100cqw - var(--card)) / max(1, var(--n) - 1))); display: flex; justify-content: center; align-items: flex-end; height: 0; }
    .card {
      position: relative; flex: none; width: var(--card); aspect-ratio: 1060 / 1484; box-sizing: border-box; padding: 8px; background: #12090a; border: 1px solid var(--c-faction-evil); border-radius: 14px;
      box-shadow: -6px 0 14px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.6); pointer-events: auto; cursor: default; outline: none; -webkit-tap-highlight-color: transparent;
      transform: translateY(50%); transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    .card + .card { margin-left: calc(var(--step) - var(--card)); } /* ognuna copre un po' quella prima */
    /* Sale e si vede intera, sopra le altre: col passaggio del mouse, con la tastiera, o (col dito) dopo un tocco. */
    .card.up, .card:focus-visible { z-index: 5; transform: translateY(-12px); }
    @media (hover: hover) { .card:hover { z-index: 5; transform: translateY(-12px); } }
    @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
    .face {
      height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 6px; padding: 8px; overflow: hidden; border-radius: 8px;
      background: linear-gradient(180deg, #1d1112, #140b0c); border: 1px solid color-mix(in srgb, var(--c-faction-evil) 45%, transparent); color: var(--c-text);
    }
    header { flex: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .pill { display: inline-flex; align-items: center; gap: 3px; height: 22px; padding: 0 7px; box-sizing: border-box; border-radius: 999px; font: 700 13px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
    .cost { background: var(--c-faction-evil); color: #fff; }
    .cost app-icon { color: #fff; }
    .value { height: 20px; border: 1px solid var(--c-line-strong); color: var(--c-text-dim); font-size: 12px; }
    /* Il genere ha tutto lo spazio che resta nella riga in alto. */
    .kind { flex: 1 1 auto; min-width: 0; text-align: right; font: 600 10px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* Il titolo: altezza fissa (due righe), centrato in orizzontale e in verticale. */
    h3 { flex: none; height: 44px; margin: 0; display: flex; align-items: center; justify-content: center; text-align: center; font: 600 15px/1.15 var(--font-display); letter-spacing: 0.02em; }
    h3 span { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    /* La descrizione: occupa lo spazio che resta (uguale per tutte); se è più lunga scorre con la rotellina (o col dito). */
    p {
      flex: 1 1 0; min-height: 0; margin: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: thin; scrollbar-color: var(--c-line-strong) transparent;
      padding-right: 2px; font: 11.5px/1.35 var(--font-ui); color: var(--c-text-dim);
    }
    footer { flex: none; display: flex; justify-content: center; }
  `,
})
export class EvilHandComponent {
  readonly cards = input<HandCardView[]>([]);
  /** La carta alzata da un tocco (col mouse alza il passaggio, non questo). */
  protected readonly raised = signal<number | null>(null);
  /** Il tipo di puntatore dell'ultimo tocco su una carta: col mouse basta il passaggio, il clic non cambia niente. */
  protected pointerType = 'mouse';
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected kindName(kind: EvilCardKind): string {
    return KIND_NAMES[kind]();
  }

  /** Un tocco (o la penna) alza la carta, o la rimette giù se è già alzata. */
  protected tap(index: number) {
    if (this.pointerType === 'mouse') return;
    this.raised.update((cur) => (cur === index ? null : index));
  }

  /** Un tocco fuori dalla mano rimette giù la carta alzata. */
  protected outside(e: Event) {
    if (this.raised() !== null && !this.host.nativeElement.contains(e.target as Node)) this.raised.set(null);
  }
}
