import { tr } from '../i18n/catalog-text';
import { TrPipe } from '../i18n/tr.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ChestTier, PotionKind } from '../game/board/marker';
import { AttackDice } from '../game/heroes/hero-sheet';
import { CityService } from '../game/pieces/piece';
import { SkillSchool } from '../game/skills/skill';
import { HeroDetails } from './hero-sheet.component';
import { IconComponent } from './icon.component';
import { ItemCardComponent } from './item-card.component';

/** Ciò che l'eroe fa in città dal pannello. */
export type CityEvent =
  | { kind: 'service'; service: CityService }
  | { kind: 'potion'; id: PotionKind }
  | { kind: 'treasure'; id: ChestTier }
  | { kind: 'item'; id: string }
  | { kind: 'sell'; id: string }
  | { kind: 'skill'; id: SkillSchool }
  | { kind: 'train'; id: keyof AttackDice }
  | { kind: 'heal' }
  | { kind: 'conclude' };

/**
 * Il pannello "Città" di un eroe (si vede solo quando è in città): le sue monete, i tre servizi (se ne visita uno solo, poi il turno passa),
 * il contenuto del servizio scelto (negozio: pozioni, tesori, oggetti, vendita; campo: abilità e dadi; tempio: ripristino della salute) e il tasto per tornare nel
 * dungeon. Il campo di addestramento vende carte abilità e dadi d'attacco. Esiste solo nel turno dell'arrivo: dal turno dopo il ritorno parte da solo e il pannello non c'è più. È il
 * contenuto della cornice `app-hero-panel`.
 */
@Component({
  selector: 'app-city-panel',
  imports: [TrPipe, IconComponent, ItemCardComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      @if (h.city; as c) {
        <div class="row"><span class="coins" [title]="'Monete dell\\'eroe' | tr"><app-icon name="tokens/gold_pile" [size]="18" />{{ h.coins }}<small>{{ 'Monete' | tr }}</small></span></div>

        @if (!c.service) {
          <h3>{{ 'Servizi' | tr }} <small>{{ 'uno solo per visita' | tr }}</small></h3>
          <div class="list">
            @for (s of c.services; track s.id) {
              <div class="service" [class.off]="!s.enabled">
                <div class="what"><b>{{ s.name }}</b><small>{{ s.blurb }}</small></div>
                @if (s.enabled) { <button type="button" class="act" (click)="cityAction.emit({ kind: 'service', service: s.id })">{{ 'Entra' | tr }}</button> }
                @else { <span class="reason">{{ s.reason }}</span> }
              </div>
            }
          </div>
        }

        @if (c.shop; as shop) {
          <h3>{{ 'Pozioni' | tr }}</h3>
          <div class="list">
            @for (o of shop.potions; track o.id) { <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: o, event: { kind: 'potion', id: o.id }, label: ('Compra' | tr) }" /> }
          </div>
          <h3>{{ 'Tesori' | tr }} <small>{{ 'pescati dal mazzo' | tr }}</small></h3>
          <div class="list">
            @for (o of shop.treasures; track o.id) { <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: o, event: { kind: 'treasure', id: o.id }, label: ('Compra' | tr) }" /> }
          </div>
          <h3>{{ 'Oggetti' | tr }}</h3>
          <div class="cards">
            @for (o of shop.items; track o.id) {
              <app-item-card [def]="o.def" [icon]="o.def.icon ?? 'inventory_2'" [detail]="o.detail">
                <span class="stock" [title]="'Copie rimaste in negozio' | tr">×{{ o.stock }}</span>
                <button type="button" class="act" [class.off]="!o.enabled" [attr.aria-disabled]="!o.enabled" [title]="o.reason ?? ''" (click)="o.enabled ? cityAction.emit({ kind: 'item', id: o.id }) : denied.emit(o.reason ?? notPossible())">{{ 'Compra' | tr }} · {{ o.price }}</button>
              </app-item-card>
            }
          </div>
          <h3>{{ 'Vendi' | tr }} <small>{{ 'metà prezzo, per difetto a 25' | tr }}</small></h3>
          <div class="list">
            @for (o of shop.sell; track o.id) { <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: o, event: { kind: 'sell', id: o.id }, label: ('Vendi' | tr) }" /> }
            @empty { <p class="none">{{ 'Non hai oggetti da vendere' | tr }}</p> }
          </div>
        }

        @if (c.camp; as camp) {
          <h3>{{ 'Nuove abilità' | tr }} <small>{{ 'una carta a caso del ramo' | tr }}</small></h3>
          <div class="list">
            @for (o of camp.skills; track o.id) { <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: o, event: { kind: 'skill', id: o.id }, label: ('Impara' | tr) }" /> }
          </div>
          <h3>{{ 'Dadi d\\'attacco' | tr }} <small>{{ 'fino a 5' | tr }}</small></h3>
          <div class="list">
            @for (o of camp.dice; track o.id) { <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: o, event: { kind: 'train', id: o.id }, label: ('Allena' | tr) }" /> }
          </div>
        }

        @if (c.temple; as t) {
          <h3>{{ 'Tempio' | tr }}</h3>
          <div class="list">
            <ng-container [ngTemplateOutlet]="offer" [ngTemplateOutletContext]="{ $implicit: t, event: { kind: 'heal' }, label: ('Ripristina' | tr) }" />
          </div>
        }

        <h3>{{ 'Torna nel dungeon' | tr }}</h3>
        <p class="note">{{ 'Al tuo prossimo turno scegli il glifo su cui tornare, anche se non visiti niente: quello da cui sei partito è gratis, un altro glifo acceso costa {cost} monete (il teletrasporto).' | tr: { cost: c.teleportCost } }}</p>
        <div class="foot">
          <button type="button" class="act strong" (click)="cityAction.emit({ kind: 'conclude' })">{{ (c.service ? 'Concludi la visita' : 'Passa il turno senza visitare') | tr }}</button>
        </div>
      }
    }

    <ng-template #offer let-o let-event="event" let-label="label">
      <div class="service" [class.off]="!o.enabled">
        <div class="what"><b>{{ o.name }}</b></div>
        <span class="price"><app-icon name="tokens/gold_pile" [size]="14" />{{ o.price }}</span>
        <button type="button" class="act" [class.off]="!o.enabled" [attr.aria-disabled]="!o.enabled" [title]="o.reason ?? ''" (click)="o.enabled ? cityAction.emit(event) : denied.emit(o.reason ?? notPossible())">{{ label }}</button>
      </div>
    </ng-template>
  `,
  styles: `
    :host { counter-reset: sec; display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    h3::before { counter-increment: sec; content: counter(sec, decimal-leading-zero) ' — '; color: var(--c-text-faint); }
    h3 { margin: 14px 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3 small { margin-left: 6px; font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 12px; }
    small { color: var(--c-text-dim); }
    .row { display: flex; align-items: center; gap: 6px; }
    .coins { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cad-coin); }
    .coins small { font-weight: 400; }
    .list, .cards { display: flex; flex-direction: column; gap: 6px; }
    .service { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    .service.off { opacity: 0.6; }
    .service .what { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .price { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--cad-coin); }
    .stock { margin-right: auto; font-size: 12px; color: var(--c-text-dim); font-variant-numeric: tabular-nums; }
    .none, .note, .reason { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px; }
    .act {
      padding: 4px 10px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; white-space: nowrap;
      border: 1px solid var(--c-line-strong); font: 12px/1.2 var(--font-ui); transition: border-color 0.15s, color 0.15s;
    }
    .act.strong { padding: 6px 14px; font-weight: 600; }
    .act:hover:not(.off), .act:focus-visible:not(.off) { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    .act.off { opacity: 0.35; cursor: default; }
  `,
})
export class CityPanelComponent {
  /** Il motivo di riserva quando un'azione spenta non ne dà uno. */
  protected readonly notPossible = () => tr('Non è possibile');
  readonly hero = input<HeroDetails | null>(null);
  readonly cityAction = output<CityEvent>();
  /** Un bottone spento è stato toccato: il motivo per cui non si può (da mostrare come notifica). */
  readonly denied = output<string>();
}
