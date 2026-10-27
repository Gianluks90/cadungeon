import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { DieFace } from '../game/dice/faces';
import { DieColor } from '../game/items/item';
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
  imports: [HeartComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as v) {
      <div class="backdrop">
        <section class="box" role="dialog" aria-modal="true" [attr.aria-label]="v.title">
          <h2>{{ v.title }}</h2>
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
          <div class="choices">
            <button type="button" class="btn" (click)="finish(null)">{{ v.skip }}</button>
            <button type="button" class="btn primary" [class.off]="!selected().size" [attr.aria-disabled]="!selected().size" (click)="selected().size ? finish([...selected()].sort((a, b) => a - b)) : null">{{ v.confirm }}</button>
          </div>
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 870; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.55); animation: fade 0.2s ease-out; }
    .box { display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; width: min(460px, 100%); padding: 20px 24px; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 14px/1.45 var(--font-ui); }
    h2 { margin: 0; font: 600 var(--fs-lg)/1.2 var(--font-display); letter-spacing: 0.03em; }
    p { margin: 0; color: var(--c-text-dim); }
    .dice { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
    .die { display: inline-flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); transition: border-color 0.15s, background-color 0.15s; }
    .die.on { border-color: var(--c-interact); background: color-mix(in srgb, var(--c-interact) 12%, transparent); }
    .die:hover, .die:focus-visible { border-color: var(--c-interact); outline: none; }
    .face { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .face.miss { color: var(--c-danger); font-family: var(--font-ui); }
    .range { font-weight: 600; }
    .surge { color: var(--c-interact); }
    .choices { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
    .btn { padding: 8px 16px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 600 13px/1.2 var(--font-ui); }
    .btn.primary { border-color: var(--c-interact); }
    .btn.off { opacity: 0.4; cursor: default; }
    .btn:hover:not(.off), .btn:focus-visible:not(.off) { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
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
