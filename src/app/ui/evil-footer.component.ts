import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/**
 * Il footer del Maligno quando è lui a giocare (`/evil/<mappa>`): una card lunga quanto la pagina meno 12 px per lato, in basso, con il bordo
 * rosso sottile (1 px, come i box degli eroi). A differenza delle card degli eroi, che servono a chi li gioca, qui l'avversario ha uno spazio suo.
 * Da sinistra: ritratto con nome e round, poi i contatori Conquista e Minaccia (icona ed etichetta sopra, valore centrato sotto).
 * Il resto si costruisce un pezzo alla volta.
 */
@Component({
  selector: 'app-evil-footer',
  imports: [TrPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="who">
      <span class="avatar"><img src="characters/evil-token.webp" alt="" draggable="false" /></span>
      <span class="titles">
        <span class="name">{{ 'Maligno' | tr }}</span>
        <span class="sub">{{ 'Round {n}' | tr: { n: round() } }}</span>
      </span>
    </div>
    <div class="stat progress" [class.alert]="defeated()">
      <span class="head"><app-icon name="brightness_empty" [size]="16" />{{ 'Conquista' | tr }}</span>
      <span class="value">{{ progress() }}</span>
    </div>
    <div class="stat menace" [title]="'Minaccia: il budget per carte e mostri' | tr">
      <span class="head"><app-icon name="skull" [size]="16" />{{ 'Minaccia' | tr }}</span>
      <span class="value">{{ threat() }}</span>
    </div>
    <button type="button" class="pass" [class.off]="passBusy()" [attr.aria-disabled]="passBusy()" [attr.aria-label]="'Passa il turno' | tr" [title]="'Passa il turno (Invio)' | tr" (click)="pass.emit()"><app-icon name="skip_next" [size]="28" /><span>{{ 'Passa' | tr }}</span></button>
  `,
  styles: `
    @keyframes footer-in { from { transform: translateY(100%); opacity: 0; } }
    :host { animation: footer-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    :host {
      /* Una card lunga quasi quanto la pagina: 12 px dai bordi dello schermo, come le altre interfacce. */
      position: absolute; z-index: 26; left: 12px; right: 12px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px); box-sizing: border-box; display: flex; align-items: center; gap: 28px;
      height: 76px; padding: 0 12px; overflow: hidden;
      background: var(--c-surface); border: 1px solid var(--c-faction-evil); border-radius: var(--radius-1); color: var(--c-text); font: 13px/1.2 var(--font-ui);
    }
    .who { display: flex; align-items: center; gap: 12px; }
    .avatar { flex: none; width: 52px; height: 52px; overflow: hidden; border-radius: var(--radius-1); background: var(--c-tile); box-shadow: 0 0 0 2px var(--c-line); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .titles { display: flex; flex-direction: column; gap: 3px; }
    .name { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.02em; }
    .sub { color: var(--c-text-dim); }
    .stat { display: flex; flex-direction: column; align-items: stretch; gap: 4px; min-width: 72px; color: var(--c-text-dim); }
    .head { display: inline-flex; align-items: center; gap: 4px; }
    .value { text-align: center; color: var(--c-text); font: 600 var(--fs-md)/1.2 var(--font-mono); font-variant-numeric: tabular-nums; }
    .menace .head, .menace .value { color: var(--c-menace); }
    .alert .value { color: var(--c-danger); }
    /* Il tasto Passa è un pezzo del footer: tutto a destra, alto quanto lui (fino al bordo rosso e a quello della pagina), diviso dal resto da una linea. */
    .pass {
      align-self: stretch; margin: 0 -12px 0 auto; box-sizing: border-box; width: 88px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0; cursor: pointer;
      background: none; border: 0; border-left: 1px solid var(--c-faction-evil); border-radius: 0; color: var(--c-faction-evil);
      font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; transition: background 0.15s, opacity 0.15s;
    }
    .pass:hover, .pass:focus-visible { background: color-mix(in srgb, var(--c-faction-evil) 12%, transparent); outline: none; }
    .pass.off { opacity: 0.45; }
  `,
})
export class EvilFooterComponent {
  readonly round = input(1);
  readonly progress = input(0);
  /** Il gruppo ha perso (Conquista a zero o meno): il valore diventa rosso. */
  readonly defeated = input(false);
  readonly threat = input(0);
  /** Il tasto Passa è spento (come quello degli eroi: un clic dice il motivo). */
  readonly passBusy = input(false);
  readonly pass = output<void>();
}
