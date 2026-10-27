import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from './icon.component';

/**
 * Il blocco del Signore supremo (l'Overlord), in alto a destra, in diagonale rispetto al gruppo degli eroi in basso a sinistra: ritratto, nome e contatori. Ha le stesse dimensioni di un tab espanso di un eroe (320 × 76 px, ritratto di 56). Minaccia, Mazzo (carte rimaste) e mano (quante carte ha)
 * li vedono tutti. Un tocco accende e spegne la vista Overlord (provvisorio: poi la vista sarà
 * una scelta di ruolo); con la vista accesa o nel suo turno il bordo è rosso. Vale anche con l'Overlord scriptato: serve a capire cosa sta per succedere.
 */
@Component({
  selector: 'app-overlord-panel',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="block" data-sheet-toggle [class.on]="view()" [class.playing]="playing()" [attr.aria-pressed]="view()" aria-label="Vista Signore supremo" title="Vista Overlord: schede dei mostri" (click)="toggle.emit()">
      <span class="avatar"><img src="characters/overlord.webp" alt="" draggable="false" /></span>
      <span class="info">
        <span class="name">Signore supremo</span>
        <span class="counters">
          <span class="c" title="Minaccia: il budget per carte e mostri"><app-icon name="skull" [size]="16" />{{ threat() }}</span>
          <span class="c deck" title="Carte rimaste nel mazzo"><app-icon name="playing_cards" [size]="16" />{{ deck() }}</span>
          <span class="c" title="Carte in mano"><app-icon name="back_hand" [size]="16" />{{ hand() }}</span>
        </span>
      </span>
    </button>
  `,
  styles: `
    :host { position: absolute; z-index: 26; top: calc(12px + env(safe-area-inset-top)); right: 12px; }
    .block {
      display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: min(320px, calc(100vw - 24px)); height: 76px; padding: 0 7px 0 9px; cursor: pointer; text-align: left;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 13px/1.2 var(--font-ui);
      transition: border-color 0.15s;
    }
    .block:hover, .block:focus-visible { border-color: var(--c-text-dim); outline: none; }
    .block.on, .block.playing { border-color: var(--c-faction-overlord); }
    .avatar { flex: none; width: 56px; height: 56px; overflow: hidden; border-radius: var(--radius-1); background: var(--c-tile); box-shadow: 0 0 0 2px var(--c-line); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .info { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
    .name { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.02em; }
    .counters { display: flex; gap: 12px; }
    /* Su schermi stretti non occupa tutta la larghezza: lascia posto ai contatori a sinistra. */
    @media (max-width: 720px) { .block { width: auto; } }
    .c { display: inline-flex; align-items: center; gap: 4px; color: var(--c-text-dim); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .c.deck { color: var(--c-danger); }
  `,
})
export class OverlordPanelComponent {
  readonly view = input(false);
  /** È il turno dell'Overlord. */
  readonly playing = input(false);
  readonly threat = input(0);
  readonly deck = input(0);
  readonly hand = input(0);
  readonly toggle = output<void>();
}
