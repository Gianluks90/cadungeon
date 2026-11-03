import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';

/** Quanto dura la discesa di una carta pescata e l'intervallo fra una e l'altra (millisecondi), e quante se ne mostrano al massimo insieme. */
const DRAW_MS = 700;
const DRAW_STAGGER_MS = 180;
const DRAW_MAX_GHOSTS = 4;

/**
 * Il Mazzo del Male nella vista del Maligno: il dorso di una carta (`public/evil/card_back.webp`) in sovraimpressione, a destra, prima del tasto Passa del footer. Non sta
 * nel footer: sporge sopra di lui e per metà esce dal bordo basso dello schermo. La carta ha gli angoli smussati e un bordo scuro interno (la "safe area" del taglio) che
 * tiene l'immagine un po' dentro. Il numero delle carte rimaste nel mazzo è un pallino scuro a cavallo del bordo sinistro, all'altezza del footer.
 * Quando il mazzo cala (si pesca) dal dorso scendono, una dopo l'altra, tante carte coperte quante ne sono state pescate: escono dal bordo basso dello schermo, dove le
 * ritrova la mano (`app-evil-hand`), che le fa arrivare dal basso.
 */
@Component({
  selector: 'app-evil-deck',
  imports: [TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (g of drawn(); track g.id) {
      <div class="card ghost" aria-hidden="true" [style.animation-delay.ms]="g.delay"><img src="evil/card_back.webp" alt="" draggable="false" /></div>
    }
    <div class="card top" role="img" [attr.aria-label]="'Carte rimaste nel mazzo' | tr" [title]="'Carte rimaste nel mazzo' | tr">
      <img src="evil/card_back.webp" alt="" draggable="false" />
      <span class="count">{{ count() }}</span>
    </div>
  `,
  styles: `
    /* Il contenitore è una linea sul bordo basso dello schermo: la carta si sposta di metà della sua altezza sotto di lui. */
    :host { position: absolute; z-index: 27; right: 112px; bottom: 0; width: 178px; height: 0; pointer-events: none; }
    @keyframes deck-in { from { transform: translateY(100%); } }
    @keyframes draw { from { transform: translateY(50%); } to { transform: translateY(330%); } }
    .card {
      position: absolute; left: 0; right: 0; bottom: 0; transform: translateY(50%);
      box-sizing: border-box; padding: 8px; /* il margine scuro del taglio */ background: #12090a; border: 1px solid var(--c-faction-evil); border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    }
    .top { pointer-events: auto; animation: deck-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    /* Le carte pescate: partono da sotto la prima e scendono fuori dallo schermo. */
    .ghost { animation: draw ${DRAW_MS}ms cubic-bezier(0.5, 0, 0.9, 0.6) both; }
    @media (prefers-reduced-motion: reduce) { .top { animation: none; } .ghost { display: none; } }
    img { display: block; width: 100%; height: auto; border-radius: 8px; pointer-events: none; }
    /* Il numero di carte: un pallino scuro (tondo, larghezza e altezza uguali) a cavallo del bordo sinistro della carta, all'altezza del centro del footer (la carta sporge di 37 px sopra il footer, alto 76 px). */
    .count {
      position: absolute; top: 75px; left: 0; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; box-sizing: border-box;
      border-radius: 50%; background: #12090a; border: 2px solid var(--c-faction-evil); color: #fff; font: 700 15px/1 var(--font-mono); font-variant-numeric: tabular-nums;
    }
    /* Schermi stretti: il dorso è più piccolo (72 px), un po' staccato dal tasto Avanti (largo 76 px) e rialzato di 14 px; il pallino sta sull'angolo in alto a sinistra. */
    @media (max-width: 760px) {
      :host { right: 104px; bottom: 14px; width: 72px; }
      .card { padding: 4px; border-radius: 9px; }
      img { border-radius: 5px; }
      .count { top: 0; width: 28px; height: 28px; border-width: 1.5px; font-size: 13px; }
    }
  `,
})
export class EvilDeckComponent {
  /** Le carte rimaste nel mazzo: è l'unica cosa del mazzo che tutti sanno. */
  readonly count = input(0);
  /** Le carte coperte che stanno scendendo adesso (ognuna sparisce da sola quando ha finito). */
  protected readonly drawn = signal<{ id: number; delay: number }[]>([]);
  private prev: number | null = null;
  private seq = 0;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const n = this.count();
      untracked(() => {
        const before = this.prev;
        this.prev = n;
        if (before === null || n >= before) return; // la prima volta, o il mazzo si è rimescolato: niente da far scendere
        const draws = Math.min(DRAW_MAX_GHOSTS, before - n);
        const fresh = Array.from({ length: draws }, (_, k) => ({ id: ++this.seq, delay: k * DRAW_STAGGER_MS }));
        this.drawn.update((list) => [...list, ...fresh]);
        for (const g of fresh) {
          const t = setTimeout(() => {
            this.timers.delete(t);
            this.drawn.update((list) => list.filter((x) => x.id !== g.id));
          }, g.delay + DRAW_MS + 100);
          this.timers.add(t);
        }
      });
    });
    inject(DestroyRef).onDestroy(() => this.timers.forEach(clearTimeout));
  }
}
