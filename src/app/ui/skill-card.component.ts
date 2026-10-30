import { tr } from '../i18n/catalog-text';
import { TrPipe } from '../i18n/tr.pipe';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SKILL_SCHOOL_NAMES, SkillDef } from '../game/skills/skill';
import { CostTextComponent } from './cost-text.component';

/** La card di una carta abilità: per ora solo testo (nome, ramo e descrizione), senza grafica. */
@Component({
  selector: 'app-skill-card',
  imports: [TrPipe, CatalogTextPipe, CostTextComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (skill(); as s) {
      <article class="card">
        <header><h4>{{ s.name }}</h4><span class="school">{{ schoolName(s) }}</span></header>
        <p>{{ s.text | ct }}</p>
        @if (action(); as a) {
          <!-- Un'abilità da usare: il bottone dice il costo; se non si può, resta spento e dice perché. -->
          <footer>
            <button type="button" class="use" [class.off]="!a.enabled" [class.fat]="a.cost.includes('{fat:')" [attr.aria-disabled]="!a.enabled" [title]="a.enabled ? ('Usa questa abilità' | tr) : (a.reason ?? '')" (click)="a.enabled ? use.emit() : denied.emit(a.reason ?? notPossible())">@if (costBefore(a.cost)) { <app-cost-text [text]="costBefore(a.cost)" /> }{{ 'Usa' | tr }}{{ costAfter(a.cost) }}</button>
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
    /* Il testo resta bianco: il colore del costo (verde il movimento, arancione la fatica) compare nel bordo e in un fondo appena visibile solo al passaggio. */
    .use { --tone: var(--c-interact); --cost-gap: 6px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 7px 16px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); transition: border-color 0.15s, background-color 0.15s; }
    .use.fat { --tone: var(--c-stamina); }
    .use:hover:not(.off), .use:focus-visible:not(.off) { border-color: var(--tone); background: color-mix(in srgb, var(--tone) 8%, transparent); outline: none; }
    .use.off { opacity: 0.45; border-color: var(--c-line-strong); cursor: default; }
  `,
})
export class SkillCardComponent {
  /** Il motivo di riserva quando un'azione spenta non ne dà uno. */
  protected readonly notPossible = () => tr('Non è possibile');
  readonly skill = input<SkillDef | null>(null);
  /** Se l'abilità si può usare: il costo a parole, se si può adesso e, se no, il motivo. */
  readonly action = input<{ cost: string; enabled: boolean; reason?: string } | null>(null);
  readonly use = output<void>();
  readonly denied = output<string>();

  protected schoolName(s: SkillDef): string {
    return SKILL_SCHOOL_NAMES[s.school];
  }

  /** Il costo in fatica va prima di ciò che sblocca ("💧2 Usa"), senza il puntino di separazione. */
  protected costBefore(cost: string): string {
    const fat = cost.split(' · ').filter((p) => p.startsWith('{fat:'));
    return fat.length ? fat.join(' ') + ' ' : '';
  }

  /** Il resto del costo (per esempio "esaurisci la carta") resta dopo, separato dal puntino. */
  protected costAfter(cost: string): string {
    const rest = cost.split(' · ').filter((p) => p && !p.startsWith('{fat:'));
    return rest.length ? ' · ' + rest.join(' · ') : '';
  }
}
