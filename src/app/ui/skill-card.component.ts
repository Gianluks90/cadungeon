import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SKILL_SCHOOL_NAMES, SkillDef } from '../game/skills/skill';

/** La card di una carta abilità: per ora solo testo (nome, ramo e descrizione), senza grafica. */
@Component({
  selector: 'app-skill-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (skill(); as s) {
      <article class="card">
        <header><h4>{{ s.name }}</h4><span class="school">{{ schoolName(s) }}</span></header>
        <p>{{ s.text }}</p>
        @if (action(); as a) {
          <!-- Un'abilità da usare: il bottone dice il costo; se non si può, resta spento e dice perché. -->
          <footer>
            <button type="button" class="use" [class.off]="!a.enabled" [attr.aria-disabled]="!a.enabled" [title]="a.enabled ? 'Usa questa abilità' : (a.reason ?? '')" (click)="a.enabled ? use.emit() : denied.emit(a.reason ?? 'Non è possibile')">Usa{{ a.cost ? ' · ' + a.cost : '' }}</button>
            @if (!a.enabled && a.reason) { <small>{{ a.reason }}</small> }
          </footer>
        }
      </article>
    }
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); }
    .school { flex: none; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    p { margin: 0; font-size: 12px; color: var(--c-text-dim); }
    footer { margin-top: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    small { color: var(--c-text-dim); font-size: 11px; }
    .use { padding: 4px 12px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-interact); font: 12px/1.2 var(--font-ui); }
    .use:hover:not(.off), .use:focus-visible:not(.off) { color: var(--c-interact); outline: none; }
    .use.off { opacity: 0.45; border-color: var(--c-line-strong); cursor: default; }
  `,
})
export class SkillCardComponent {
  readonly skill = input<SkillDef | null>(null);
  /** Se l'abilità si può usare: il costo a parole, se si può adesso e, se no, il motivo. */
  readonly action = input<{ cost: string; enabled: boolean; reason?: string } | null>(null);
  readonly use = output<void>();
  readonly denied = output<string>();

  protected schoolName(s: SkillDef): string {
    return SKILL_SCHOOL_NAMES[s.school];
  }
}
