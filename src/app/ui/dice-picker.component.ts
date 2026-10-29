import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DieFace } from '../game/dice/faces';
import { DieColor } from '../game/items/item';
import { DialogComponent } from './dialog.component';
import { HeartComponent } from './heart.component';
import { IconComponent } from './icon.component';

/** Ciò che la dialog per scegliere i dadi mostra: un titolo e un testo, i dadi tirati (colore e faccia) e i due bottoni. */
export interface DicePickView {
  title: string;
  text: string;
  dice: { color: DieColor; face: DieFace }[];
  confirm: string;
  skip: string;
}

const DIE_NAMES: Record<DieColor, string> = { red: 'dado rosso', green: 'dado verde', blue: 'dado blu', yellow: 'dado giallo', white: 'dado bianco', black: 'dado potere' };

/**
 * Una dialog per scegliere quali dadi ripetere fra quelli di un attacco (Mira: l'eroe ripete i suoi dadi; Schivata: l'eroe fa ripetere quelli dell'attacco nemico).
 * Si toccano i dadi (si accendono) e si conferma; si può anche rinunciare. Non si chiude da sola: bisogna scegliere.
 */
@Component({
  selector: 'app-dice-picker',
  imports: [DialogComponent, HeartComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <app-dialog [title]="v.title" width="min(460px, 100%)" (closed)="finish(null)">
        <p>{{ v.text }}</p>
        <ul class="dice">
          @for (d of v.dice; track $index) {
            <li>
              <button type="button" class="die" [class.on]="selected().has($index)" [attr.aria-pressed]="selected().has($index)" (click)="toggle($index)">
                <app-icon name="deployed_code" [size]="22" [style.color]="'var(--cad-die-' + d.color + ')'" [title]="names[d.color]" />
                @if (d.face.miss) { <span class="face miss">Mancato</span> }
                @else if (d.face.slash) { <span class="face"><span class="range">{{ d.face.range }}</span> / <app-heart [points]="4" [size]="14" /></span> }
                @else {
                  <span class="face">
                    @if (d.color !== 'black') { <span class="range" title="Gittata">{{ d.face.range }}</span> }
                    @for (h of times(d.face.hearts); track h) { <app-heart [points]="4" [size]="14" /> }
                    @for (s of times(d.face.surge); track s) { <app-icon name="bolt" [size]="16" class="surge" title="Scarica" /> }
                  </span>
                }
              </button>
            </li>
          }
        </ul>
        <ng-container dialogFooter>
          <button type="button" class="dlg-btn" (click)="finish(null)">{{ v.skip }}</button>
          <button type="button" class="dlg-btn primary" [class.off]="!selected().size" [attr.aria-disabled]="!selected().size" (click)="selected().size ? finish([...selected()].sort((a, b) => a - b)) : null">{{ v.confirm }}</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    p { margin: 0; color: var(--c-text-dim); }
    .dice { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .die { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); transition: border-color 0.15s, background-color 0.15s; }
    .die.on { border-color: var(--c-interact); background: color-mix(in srgb, var(--c-interact) 12%, transparent); }
    .die:hover, .die:focus-visible { border-color: var(--c-interact); outline: none; }
    .face { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .face.miss { color: var(--c-danger); font-family: var(--font-ui); }
    .range { font-weight: 600; }
    .surge { color: var(--c-interact); }
  `,
})
export class DicePickerComponent {
  readonly view = input<DicePickView | null>(null);
  /** I dadi scelti (le loro posizioni), o null se si rinuncia. */
  readonly done = output<number[] | null>();
  protected readonly names = DIE_NAMES;
  protected readonly selected = signal<ReadonlySet<number>>(new Set());

  protected times(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  protected toggle(i: number) {
    this.selected.update((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  protected finish(picked: number[] | null) {
    this.selected.set(new Set());
    this.done.emit(picked);
  }
}
