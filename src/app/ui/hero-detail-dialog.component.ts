import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { SKILL_SCHOOLS, SKILL_SCHOOL_NAMES, SkillSchool } from '../game/skills/skill';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AttackDiceComponent } from './attack-dice.component';
import { DialogComponent } from './dialog.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';
import { HeroFaceComponent } from './hero-face.component';

/**
 * La scheda di un eroe nella scelta della squadra: solo ciò che è fisso, cioè i parametri, i dadi d'attacco extra, l'abilità primaria e gli attributi (i punti nei tre rami) che decidono le
 * 3 abilità secondarie: a inizio partita l'eroe pesca a caso una carta per ogni punto, dal mazzo di quel ramo. Le carte vere non si vedono qui perché non sono ancora state pescate.
 */
@Component({
  selector: 'app-hero-detail-dialog',
  imports: [AttackDiceComponent, CatalogTextPipe, DialogComponent, HeartsComponent, IconComponent, HeroFaceComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <app-dialog [kicker]="h.class | ct" [title]="h.name" (closed)="closed.emit()">
        <!-- A sinistra la carta dell'eroe con i suoi parametri, a destra la sua storia: inclinate e infilate sotto il pannello. -->
        <figure dialogSide class="card left"><app-hero-face [hero]="h" /></figure>
        <figure dialogSide class="card right">
          <figcaption class="head">{{ 'detail.story' | t }}</figcaption>
          <div class="story"><p>{{ h.story || ('detail.storyPlaceholder' | t) }}</p></div>
        </figure>

        <h3>{{ 'detail.params' | t }}</h3>
        <div class="life"><app-hearts [wounds]="h.wounds" [max]="h.wounds" [size]="18" /><span class="dots" aria-hidden="true"></span><span class="health">{{ h.wounds }}</span></div>
        <div class="stats">
          <span class="stat speed" [title]="'stats.speed' | t"><app-icon name="footprint" [size]="18" />{{ h.speed }}<small>{{ 'detail.speed' | t }}</small></span>
          <span class="stat fatigue" [title]="'stats.fatigue' | t"><app-icon name="water_drop" [size]="18" />{{ h.fatigue }}<small>{{ 'stats.fatigue' | t }}</small></span>
          <span class="stat" [title]="'detail.armorHint' | t"><app-icon name="shield" [size]="18" />{{ h.armor }}<small>{{ 'detail.armor' | t }}</small></span>
        </div>

        <h3>{{ 'detail.dice' | t }}</h3>
        <app-attack-dice [dice]="h.dice" />

        <h3>{{ 'detail.primary' | t }}</h3>
        @if (h.ability) { <p class="ability">{{ h.ability | ct }}</p> } @else { <p class="soon">{{ 'detail.soon' | t }}</p> }

        <h3>{{ 'detail.attributes' | t }}</h3>
        <p class="soon">{{ 'detail.attributesHint' | t: { n: total() } }}</p>
        <div class="slots">
          @for (s of slots(); track $index) {
            <div class="slot" [attr.data-school]="s.school"><app-icon name="playing_cards" [size]="22" /><b>{{ s.name }}</b></div>
          }
        </div>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="closed.emit()">{{ 'common.close' | t }}</button></ng-container>
      </app-dialog>
    }
  `,
  styles: `
    h3 { margin: 6px 0 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3:first-of-type { margin-top: 0; }
    .life { display: flex; align-items: center; gap: 10px; }
    .dots { flex: 1; min-width: 12px; border-bottom: 2px dotted color-mix(in srgb, var(--c-text) 12%, transparent); transform: translateY(3px); }
    .health { font: 600 16px/1 var(--font-ui); font-variant-numeric: tabular-nums; }
    .stats { display: flex; flex-wrap: wrap; gap: 8px 18px; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .stat.speed { color: var(--c-speed); }
    .stat.fatigue { color: var(--c-stamina); }
    small { font-weight: 400; color: var(--c-text-dim); }
    .ability { margin: 0; }
    .soon { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .slots { display: flex; gap: 10px; }
    .slot { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 14px 8px; text-align: center; border-radius: var(--radius-1); border: 1px dashed var(--c-line-strong); background: var(--c-bg); color: var(--c-text-dim); }
    .slot b { font: 600 12px/1.2 var(--font-ui); color: var(--c-text); }
    /* Le due carte laterali (alte al massimo 484 px, centrate in verticale), inclinate e infilate di 14 px sotto il pannello. */
    .card { position: absolute; z-index: 0; top: 0; bottom: 0; margin-block: auto; margin-inline: 0; height: min(484px, calc(100% - 16px)); width: 220px; overflow: hidden; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card.left { --face-inset: 14px; right: calc(100% - 14px); transform: rotate(-4deg); transform-origin: 70% 100%; }
    .card.right { left: calc(100% - 14px); transform: rotate(4deg); transform-origin: 30% 100%; display: flex; flex-direction: column; background: var(--c-surface); }
    .card .head { flex: none; padding: 10px 10px 8px 14px; border-bottom: 1px solid var(--c-line-strong); font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .story { flex: 1; min-height: 0; overflow-y: auto; padding: 12px 10px 12px 14px; scrollbar-width: none; }
    .story::-webkit-scrollbar { display: none; }
    .story p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--c-text-dim); }
    @media (max-width: 1000px) { .card { display: none; } }
  `,
})
export class HeroDetailDialogComponent {
  readonly hero = input<HeroSheet | null>(null);
  readonly closed = output<void>();

  protected readonly total = computed(() => SKILL_SCHOOLS.reduce((n, s) => n + (this.hero()?.skills[s] ?? 0), 0));
  /** Una carta segnaposto per ogni punto di attributo, ramo per ramo. */
  protected readonly slots = computed(() => {
    const h = this.hero();
    if (!h) return [];
    return SKILL_SCHOOLS.flatMap((school: SkillSchool) => Array.from({ length: h.skills[school] }, () => ({ school, name: SKILL_SCHOOL_NAMES[school] })));
  });
}
