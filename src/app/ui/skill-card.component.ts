import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
      </article>
    }
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); }
    .school { flex: none; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    p { margin: 0; font-size: 12px; color: var(--c-text-dim); }
  `,
})
export class SkillCardComponent {
  readonly skill = input<SkillDef | null>(null);

  protected schoolName(s: SkillDef): string {
    return SKILL_SCHOOL_NAMES[s.school];
  }
}
