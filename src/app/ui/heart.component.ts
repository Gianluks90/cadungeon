import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

let nextId = 0;

/** Il contorno del cuore (viewBox 24x24). */
const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';

/**
 * I quattro quarti, tagliati in croce al centro, nell'ordine in cui restano: l'ultimo a sparire è in alto a sinistra.
 * Si svuota a partire dallo spicchio in alto a destra e in senso orario: alto a destra, basso a destra, basso a sinistra, alto a sinistra.
 */
const QUARTERS = [
  { x: 0, y: 0 },
  { x: 0, y: 12 },
  { x: 12, y: 12 },
  { x: 12, y: 0 },
];

/**
 * Un cuore da 4 punti ferita: si spegne a quarti (1 punto = 1 quarto) e resta vuoto se i suoi 4 punti sono finiti.
 * `points` va da 0 a 4; si perdono a partire dallo spicchio in alto a destra, in senso orario. La divisione in quarti non
 * si vede mai: il cuore pieno è un'unica forma, e quello ferito mostra solo il vuoto dello spicchio perso.
 */
@Component({
  selector: 'app-heart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="clamped() + ' quarti su 4'">
      @if (clamped() < 4) { <path class="empty" [attr.d]="heart" /> }
      @if (clamped() === 4) {
        <path class="full" [attr.d]="heart" />
      } @else if (clamped() > 0) {
        <!-- I quarti rimasti sono un unico ritaglio: niente linee di divisione, manca solo lo spicchio perso. -->
        <clipPath [attr.id]="clipId"><path [attr.d]="filled()" /></clipPath>
        <path class="full" [attr.d]="heart" [attr.clip-path]="'url(#' + clipId + ')'" />
      }
    </svg>
  `,
  styles: `
    :host { display: inline-flex; }
    svg { display: block; overflow: visible; }
    .empty { fill: var(--cad-ui-border, #3a352f); opacity: var(--cad-heart-empty-alpha, 0.45); }
    .full { fill: var(--cad-health, #d2504a); }
  `,
})
export class HeartComponent {
  readonly points = input.required<number>();
  readonly size = input(16);
  protected readonly clamped = computed(() => Math.max(0, Math.min(4, Math.round(this.points()))));
  protected readonly clipId = `heart-clip-${nextId++}`;
  protected readonly heart = HEART;
  /** I quarti rimasti come un solo tracciato (rettangoli affiancati, senza spazi): il cuore intero resta senza segni. */
  protected readonly filled = computed(() =>
    QUARTERS.slice(0, this.clamped()).map((q) => `M${q.x} ${q.y}h12v12h-12z`).join(''),
  );
}
