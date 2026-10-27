import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { KeyLabelsService } from './key-labels.service';

/**
 * L'etichetta di un tasto a pallino: sta nascosta e compare a fianco del tasto (il genitore deve essere `position: relative`) finché si tiene premuto H.
 * `side` è il lato su cui compare: `right` per i tasti sul bordo sinistro, `left` per quelli sul bordo destro, `top` per quelli sul bordo inferiore.
 */
@Component({
  selector: 'app-key-label',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.on]': 'labels.show()', '[class.left]': "side() === 'left'", '[class.right]': "side() === 'right'", '[class.top]': "side() === 'top'", 'aria-hidden': 'true' },
  template: '<ng-content />',
  styles: `
    :host {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 5; padding: 5px 9px; border-radius: var(--radius-1); white-space: nowrap; pointer-events: none;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); font: 600 12px/1.2 var(--font-ui); opacity: 0; transition: opacity 0.12s;
    }
    :host(.left) { right: calc(100% + 8px); }
    :host(.right) { left: calc(100% + 8px); }
    :host(.top) { top: auto; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); }
    :host(.on) { opacity: 1; }
  `,
})
export class KeyLabelComponent {
  readonly side = input<'left' | 'right' | 'top'>('left');
  protected readonly labels = inject(KeyLabelsService);
}
