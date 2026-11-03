import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TrPipe } from '../i18n/tr.pipe';
import { IconComponent } from './icon.component';

/**
 * Il footer del Maligno quando è lui a giocare (`/evil/<mappa>`): una card lunga quanto la pagina meno 12 px per lato, in basso, con il bordo
 * rosso sottile (1 px, come i box degli eroi). A differenza delle card degli eroi, che servono a chi li gioca, qui l'avversario ha uno spazio suo.
 * Da sinistra: ritratto con nome, round e passo del turno; a destra il tasto Passa/Avanti. La Minaccia sta sul bordo sinistro dello schermo (`app-evil-threat`) e la Conquista, che
 * il Maligno non gioca ma tiene d'occhio, nel piccolo footer della barra degli eroi (`app-party-bar`). Lo spazio in mezzo è delle carte (`app-evil-hand`).
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
        <span class="sub">{{ 'Round {n}' | tr: { n: round() } }}@if (phase()) { · <span class="phase">{{ phase() }}</span> }</span>
      </span>
    </div>
    <button type="button" class="pass" [class.off]="passBusy()" [attr.aria-disabled]="passBusy()" [attr.aria-label]="passLabel() || ('Passa il turno' | tr)" [title]="passLabel() || ('Passa il turno (Invio)' | tr)" (click)="pass.emit()"><app-icon name="skip_next" [size]="28" /><span>{{ passLabel() || ('Passa' | tr) }}</span></button>
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
    /* Larghezza fissa (quanto la riga più lunga, "Round 12 · Attivazione"): cambiando fase il testo non cambia le misure del footer. */
    .titles { display: flex; flex-direction: column; gap: 3px; width: 164px; flex: none; }
    .name { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.02em; }
    .sub { color: var(--c-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .phase { color: var(--c-faction-evil); }
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
  /** Il tasto Passa è spento (come quello degli eroi: un clic dice il motivo). */
  readonly passBusy = input(false);
  /** La scritta del tasto (Avanti nei primi passi del turno, Passa nell'ultimo); senza, "Passa". */
  readonly passLabel = input('');
  /** Il passo del turno (Mano, Evocazione, Attivazione), accanto al round; senza, niente. */
  readonly phase = input('');
  readonly pass = output<void>();
}
