import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DieColor } from '../game/items/item';
import { MonsterDef, MonsterTier } from '../game/monsters/monster';
import { IconComponent } from './icon.component';
import { PictureComponent } from './picture.component';

const ATTACK = { melee: 'Mischia', ranged: 'Distanza', magic: 'Magia' } as const;

/** La card di un mostro nel catalogo: immagine, nome, dimensione, attacco, e le due versioni (normale e potenziata) una sotto l'altra. */
@Component({
  selector: 'app-monster-card',
  imports: [IconComponent, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (monster(); as m) {
      <article class="card">
        <header>
          <span class="pic"><app-picture [src]="m.image + '-token.webp'" icon="skull" [iconSize]="30" /></span>
          <div class="who">
            <h4>{{ m.name }}</h4>
            <span class="meta">Mostro · {{ attack(m) }} · {{ m.size.w }}×{{ m.size.h }}</span>
          </div>
        </header>
        <div class="tiers">
          @for (t of tiers(m); track t.label) {
            <section [class.enh]="t.enhanced">
              <h5>{{ t.label }}</h5>
              <dl>
                <dt title="Ferite con 2-3, 4 e 5 giocatori">Ferite</dt><dd>{{ t.tier.wounds['2-3'] }} / {{ t.tier.wounds['4'] }} / {{ t.tier.wounds['5'] }}</dd>
                <dt>Velocità</dt><dd>{{ t.tier.speed }}</dd>
                <dt>Armatura</dt><dd>{{ t.tier.armor }}</dd>
                <dt>Dadi</dt>
                <dd class="cubes">@for (d of t.tier.dice; track $index) { <app-icon name="deployed_code" [size]="18" [style.color]="'var(--cad-die-' + d + ')'" [title]="dieName(d)" /> }</dd>
              </dl>
              @if (t.tier.abilities.length) { <ul>@for (a of t.tier.abilities; track a) { <li>{{ a }}</li> }</ul> }
            </section>
          }
        </div>
      </article>
    }
  `,
  styles: `
    :host { display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    .card { box-sizing: border-box; height: 100%; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    header { display: flex; align-items: center; gap: 12px; }
    .pic { flex: none; width: 64px; height: 64px; border-radius: var(--radius-1); overflow: hidden; background: var(--c-tile); box-shadow: 0 0 0 1px var(--c-line); }
    .who { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    h4 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .meta { color: var(--c-text-dim); font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .tiers { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    /* I due box si dividono a metà l'altezza che resta nella card */
    section { flex: 1 1 0; padding: 8px 10px; border: 1px solid var(--c-line); border-radius: var(--radius-1); }
    section.enh { border-color: var(--c-danger, #c4472f); }
    h5 { margin: 0 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    dl { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; margin: 0; }
    dt { color: var(--c-text-dim); }
    dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 600; text-align: right; }
    .cubes { display: inline-flex; justify-content: flex-end; gap: 1px; }
    ul { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; color: var(--c-text-dim); font-size: 12px; }
  `,
})
export class MonsterCardComponent {
  readonly monster = input<MonsterDef | null>(null);

  protected attack(m: MonsterDef): string {
    return ATTACK[m.attack];
  }

  protected tiers(m: MonsterDef): { label: string; tier: MonsterTier; enhanced: boolean }[] {
    return [{ label: 'Normale', tier: m.normal, enhanced: false }, { label: 'Potenziato', tier: m.enhanced, enhanced: true }];
  }

  protected dieName(d: DieColor): string {
    return { red: 'dado rosso', green: 'dado verde', blue: 'dado blu', yellow: 'dado giallo', white: 'dado bianco', black: 'dado potere' }[d];
  }
}
