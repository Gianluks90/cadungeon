import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';

/**
 * Il Mazzo del Male nella vista del Maligno: il dorso di una carta (`public/evil/card_back.webp`) in sovraimpressione, a destra, prima del tasto Passa del footer. Non sta
 * nel footer: sporge sopra di lui e per metà esce dal bordo basso dello schermo. La carta ha gli angoli smussati e un bordo scuro interno (la "safe area" del taglio) che
 * tiene l'immagine un po' dentro. Il numero delle carte rimaste nel mazzo è un pallino scuro a cavallo del bordo sinistro, all'altezza del footer.
 */
@Component({
  selector: 'app-evil-deck',
  imports: [TrPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card" role="img" [attr.aria-label]="'Carte rimaste nel mazzo' | tr" [title]="'Carte rimaste nel mazzo' | tr">
      <img src="evil/card_back.webp" alt="" draggable="false" />
      <span class="count">{{ count() }}</span>
    </div>
  `,
  styles: `
    /* Il contenitore è una linea sul bordo basso dello schermo: la carta si sposta di metà della sua altezza sotto di lui. */
    :host { position: absolute; z-index: 27; right: 112px; bottom: 0; width: 178px; height: 0; pointer-events: none; }
    @keyframes deck-in { from { transform: translateY(100%); } }
    .card {
      position: absolute; left: 0; right: 0; bottom: 0; transform: translateY(50%); pointer-events: auto; animation: deck-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-sizing: border-box; padding: 8px; /* il margine scuro del taglio */ background: #12090a; border: 1px solid var(--c-faction-evil); border-radius: 14px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
    }
    @media (prefers-reduced-motion: reduce) { .card { animation: none; } }
    img { display: block; width: 100%; height: auto; border-radius: 8px; pointer-events: none; }
    /* Il numero di carte: un pallino scuro (tondo, larghezza e altezza uguali) a cavallo del bordo sinistro della carta, all'altezza del centro del footer (la carta sporge di 37 px sopra il footer, alto 76 px). */
    .count {
      position: absolute; top: 75px; left: 0; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; box-sizing: border-box;
      border-radius: 50%; background: #12090a; border: 2px solid var(--c-faction-evil); color: #fff; font: 700 15px/1 var(--font-mono); font-variant-numeric: tabular-nums;
    }
  `,
})
export class EvilDeckComponent {
  /** Le carte rimaste nel mazzo: è l'unica cosa del mazzo che tutti sanno. */
  readonly count = input(0);
}
