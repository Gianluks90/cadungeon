import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, effect, inject, input, output, signal, untracked } from '@angular/core';
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
  /** Quanto Odio costa giocarla adesso (con ciò che aggiungono gli eroi), e quanto se ne prende consumandola. */
  cost: number;
  value: number;
  /** Si può giocare in questo passo del turno? `null` = non in questo passo (niente tasto Gioca); altrimenti il tasto c'è, spento col motivo se adesso no. */
  play: { enabled: boolean; reason?: string } | null;
}

/** Il passo del turno del Maligno: Mano (pesca, scarto, consumo e carte a inizio turno), Evocazione, Attivazione dei mostri. */
export type EvilStep = 'hand' | 'summon' | 'activate';

/** La larghezza di una carta (come il dorso del mazzo), il passo massimo fra due carte vicine e i tempi dell'arrivo di una carta pescata (millisecondi). */
const CARD_W = 178;
const MAX_STEP = 120;
const DEAL_STAGGER_MS = 180;
const FLIP_AFTER_MS = 650;

/**
 * La mano del Maligno (vista del Maligno): le carte pescate, nello spazio fra il footer e il mazzo, in sovraimpressione come il dorso. Hanno la stessa forma e lo stesso
 * margine scuro del dorso, restano per metà sotto il bordo basso dello schermo e si sovrappongono un po' come carte tenute in mano (più sono, più si stringono). Sono tutte uguali:
 * in alto il costo in Odio e il genere, poi il titolo (in uno spazio di altezza fissa, centrato), la descrizione (di altezza fissa: se è lunga scorre con la rotellina) e,
 * in fondo, l'Odio che si prende consumando la carta. Con il mouse la carta sale e si vede intera passandoci sopra; col dito (dove non c'è il passaggio) sale con un tocco,
 * e un altro tocco, su di lei o fuori, la rimette giù.
 * Una carta pescata arriva dal basso coperta (si vede il dorso) mentre le altre scorrono per farle posto, poi si gira (come un'apertura e chiusura sull'asse verticale) e mostra la faccia.
 */
@Component({
  selector: 'app-evil-hand',
  host: { '(document:pointerdown)': 'outside($event)' },
  imports: [CatalogTextPipe, TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hand" role="list" [attr.aria-label]="'Carte in mano' | tr">
      @for (c of cards(); track $index) {
        <article class="card" role="listitem" tabindex="0" [style.left.px]="left($index)" [style.--z]="$index + 1" [style.--k]="dealOrder($index)" [class.up]="raised() === $index" [class.covered]="covered().has($index)" [attr.data-kind]="c.kind" (pointerdown)="pointerType = $event.pointerType" (click)="tap($index)" (wheel)="scrollText($event)">
          <div class="flip">
            <div class="side front">
              <div class="face">
                <header>
                  <span class="pill cost" [title]="'Costo in Odio' | tr"><app-icon name="skull" [size]="14" />{{ c.cost }}</span>
                  <span class="kind">{{ kindName(c.kind) }}</span>
                </header>
                <h3><span>{{ c.name }}</span></h3>
                <p>{{ c.text | ct }}</p>
                <footer>
                  @if (discarding()) {
                    <!-- Più carte del limite: bisogna scartarne (senza prendere Odio). -->
                    <button type="button" class="act discard" (click)="act($event, discard, $index)">{{ 'Scarta' | tr }}</button>
                  } @else {
                    @if (c.play; as p) {
                      <button type="button" class="act play" [class.off]="!p.enabled" [attr.aria-disabled]="!p.enabled" [title]="p.reason ?? ''" (click)="p.enabled ? act($event, play, $index) : refuse($event, p.reason)">{{ 'Gioca' | tr }}</button>
                    }
                    @if (step() === 'hand') {
                      <button type="button" class="pill value act-pill" [title]="'Odio se consumata' | tr" (click)="act($event, consume, $index)"><app-icon name="skull" [size]="12" />+{{ c.value }}</button>
                    } @else {
                      <span class="pill value" [title]="'Odio se consumata' | tr"><app-icon name="skull" [size]="12" />+{{ c.value }}</span>
                    }
                  }
                </footer>
              </div>
            </div>
            <div class="side rear" aria-hidden="true"><img src="evil/card_back.webp" alt="" draggable="false" /></div>
          </div>
        </article>
      }
    </div>
  `,
  styles: `
    /* Una linea sul bordo basso dello schermo, fra il footer (a sinistra: ritratto e titoli) e il mazzo (a destra): il dorso sta a 112 px dal bordo, largo 178 px, con il pallino che sporge di 19 px a sinistra. */
    :host { position: absolute; z-index: 27; left: 276px; right: 322px; bottom: 0; height: 0; pointer-events: none; }
    .hand { position: relative; width: 100%; height: 0; }
    @keyframes deal { from { transform: translateY(190%); } }
    .card {
      position: absolute; bottom: 0; width: ${CARD_W}px; aspect-ratio: 1060 / 1484; z-index: var(--z); perspective: 900px; pointer-events: auto; cursor: default; outline: none; -webkit-tap-highlight-color: transparent;
      transform: translateY(50%); transition: left 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
      animation: deal 0.55s cubic-bezier(0.2, 0.8, 0.2, 1) backwards; animation-delay: calc(var(--k, 0) * ${DEAL_STAGGER_MS}ms); /* una carta nuova arriva dal basso (una dopo l'altra), le altre scorrono */
    }
    /* Sale e si vede intera, sopra le altre: col passaggio del mouse, con la tastiera, o (col dito) dopo un tocco. */
    .card.up, .card:focus-visible { z-index: 100; transform: translateY(-12px); }
    @media (hover: hover) { .card:hover { z-index: 100; transform: translateY(-12px); } }
    /* La carta si gira su se stessa: coperta (dorso) finché \`covered\`, poi si apre e si richiude mostrando la faccia. */
    .flip { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
    .card.covered .flip { transform: rotateY(180deg); }
    .side {
      position: absolute; inset: 0; box-sizing: border-box; padding: 8px; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: #12090a; border: 1px solid var(--c-faction-evil); border-radius: 14px;
      box-shadow: -6px 0 14px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.6);
    }
    .rear { transform: rotateY(180deg); }
    .rear img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 8px; pointer-events: none; }
    @media (prefers-reduced-motion: reduce) { .card { animation: none; transition: none; } .flip { transition: none; } }
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
    /* Il consumo +X sta sempre a destra; Gioca (se c'è) a sinistra. */
    footer { flex: none; display: flex; justify-content: flex-end; align-items: center; gap: 8px; }
    footer:has(> .play) { justify-content: space-between; }
    /* I tasti della carta: Gioca (pieno rosso), Scarta (contorno rosso) e il consumo +X (il pallino diventa un tasto, rosso al passaggio). */
    .act, .act-pill { cursor: pointer; font-family: var(--font-ui); }
    .act { height: 22px; padding: 0 12px; box-sizing: border-box; border-radius: 999px; font: 700 11px/1 var(--font-ui); letter-spacing: 0.04em; text-transform: uppercase; }
    .play { background: var(--c-faction-evil); border: 1px solid var(--c-faction-evil); color: #fff; }
    .discard { background: none; border: 1px solid var(--c-faction-evil); color: var(--c-faction-evil); }
    .play.off { opacity: 0.45; }
    .act:hover, .act:focus-visible { filter: brightness(1.25); outline: none; }
    .act-pill { background: none; }
    .act-pill:hover, .act-pill:focus-visible { border-color: var(--c-faction-evil); color: var(--c-faction-evil); outline: none; }
    /*
     * Schermi stretti (telefono in verticale): non c'è posto accanto a footer e mazzo, quindi la mano sta su tutta la larghezza, appena sopra il footer, a ventaglio:
     * di ogni carta spunta la parte alta (costo, genere, titolo); il resto è dietro il footer. Un tocco (o il passaggio) la alza e la mostra intera sopra il footer.
     */
    @media (max-width: 760px) {
      :host { left: 12px; right: 12px; z-index: 25; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px); }
      .card { transform: translateY(62%); }
      .card.up, .card:focus-visible { transform: translateY(0); }
    }
    @media (max-width: 760px) and (hover: hover) { .card:hover { transform: translateY(0); } }
  `,
})
export class EvilHandComponent implements OnInit {
  readonly cards = input<HandCardView[]>([]);
  /** Il passo del turno: il consumo (+X) è un tasto solo nel passo Mano. */
  readonly step = input<EvilStep | null>(null);
  /** La mano è oltre il limite: al posto di Gioca e del consumo c'è "Scarta" su ogni carta. */
  readonly discarding = input(false);
  readonly consume = output<number>();
  readonly play = output<number>();
  readonly discard = output<number>();
  /** Un tasto spento è stato toccato: il motivo, da mostrare al giocatore. */
  readonly denied = output<string>();
  /** La carta alzata da un tocco (col mouse alza il passaggio, non questo). */
  protected readonly raised = signal<number | null>(null);
  /** Le carte ancora coperte (si vede il dorso): quelle appena pescate, finché non si girano. */
  protected readonly covered = signal<ReadonlySet<number>>(new Set());
  /** La larghezza dello spazio della mano: da lei dipende dove sta ogni carta. */
  private readonly width = signal(0);
  /** Il tipo di puntatore dell'ultimo tocco su una carta: col mouse basta il passaggio, il clic non cambia niente. */
  protected pointerType = 'mouse';
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private prevCount = 0;
  /** Dall'indice da cui le carte sono appena arrivate (per farle arrivare una dopo l'altra). */
  private newFrom = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    // Le carte che si aggiungono arrivano coperte e dopo un attimo si girano; quando se ne tolgono (giocate, consumate) gli indici si riassestano.
    effect(() => {
      const n = this.cards().length;
      untracked(() => {
        const prev = this.prevCount;
        this.prevCount = n;
        this.covered.update((s) => new Set([...s].filter((i) => i < n)));
        if (n <= prev) return;
        this.newFrom = prev;
        const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) return;
        for (let i = prev; i < n; i++) {
          this.covered.update((s) => new Set(s).add(i));
          const t = setTimeout(() => {
            this.timers.delete(t);
            this.covered.update((s) => { const next = new Set(s); next.delete(i); return next; });
          }, FLIP_AFTER_MS + (i - prev) * DEAL_STAGGER_MS);
          this.timers.add(t);
        }
      });
    });
    this.destroyRef.onDestroy(() => this.timers.forEach(clearTimeout));
  }

  ngOnInit() {
    const el = this.host.nativeElement;
    this.width.set(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => this.width.set(el.clientWidth));
    ro.observe(el);
    this.destroyRef.onDestroy(() => ro.disconnect());
  }

  /** Dove sta la carta `index` (pixel da sinistra): in fila, centrate, ognuna copre un po' la precedente (più sono, più si stringono per restare nello spazio). */
  protected left(index: number): number {
    const n = this.cards().length;
    const step = n > 1 ? Math.min(MAX_STEP, (this.width() - CARD_W) / (n - 1)) : 0;
    return (this.width() - (CARD_W + (n - 1) * step)) / 2 + index * step;
  }

  /** L'ordine di arrivo di una carta appena pescata (0 per la prima), per farle arrivare una dopo l'altra. */
  protected dealOrder(index: number): number {
    return Math.max(0, index - this.newFrom);
  }

  protected kindName(kind: EvilCardKind): string {
    return KIND_NAMES[kind]();
  }

  /** Un tasto della carta: esegue (consumo, gioco, scarto) senza far scattare il tocco sulla carta, e la rimette giù (quella dopo prende il suo posto). */
  protected act(e: Event, out: { emit(index: number): void }, index: number) {
    e.stopPropagation();
    this.release(e);
    this.raised.set(null);
    out.emit(index);
  }

  protected refuse(e: Event, reason?: string) {
    e.stopPropagation();
    this.release(e);
    this.denied.emit(reason ?? tr('Non si può giocare adesso'));
  }

  /**
   * Toglie il fuoco al bottone appena premuto. Altrimenti, consumata la carta, lo stesso elemento passa alla carta dopo e Invio (che nella vista del Maligno
   * è Avanti/Passa) premerebbe di nuovo "+X": una carta consumata a ogni Invio.
   */
  private release(e: Event) {
    (e.currentTarget as HTMLElement | null)?.blur();
  }

  /**
   * La rotella sulla carta fa scorrere la descrizione. Lo si fa a mano perché lo scorrimento del browser dentro la carta che si gira in 3D (`preserve-3d`, `backface-visibility`)
   * non è affidabile: a volte la rotella non arriva al testo. Se il testo sta tutto nello spazio, non si fa niente.
   */
  protected scrollText(e: WheelEvent) {
    const text = (e.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('.front p');
    if (!text || text.scrollHeight <= text.clientHeight) return;
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? text.clientHeight : 1;
    text.scrollTop += e.deltaY * unit;
    e.preventDefault();
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
