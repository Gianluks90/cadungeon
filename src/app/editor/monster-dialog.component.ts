import { catalogSource, tr } from '../i18n/catalog-text';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { Loot } from '../game/board/marker';
import type { RuneColor } from '../game/board/door';
import type { DieColor } from '../game/items/item';
import type { MonsterDef } from '../game/monsters/monster';
import { BEHAVIOR_OPTIONS, behaviorDice, behaviorMode, behaviorFrom, behaviorItem, behaviorKind, behaviorTarget, type BehaviorKind } from '../game/pieces/pawn-behavior';
import { PAWN_LOOKS, type PawnLook } from '../game/pieces/pawn-look';
import { CheckboxComponent } from '../ui/checkbox.component';
import { MapSelectComponent } from './map-select.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { IMMUNITY_OPTIONS, immunityName } from './immunities';
import { SelectComponent, SelectOption } from '../ui/select.component';
import { HeartsComponent } from '../ui/hearts.component';
import { IconComponent } from '../ui/icon.component';
import { PictureComponent } from '../ui/picture.component';
import { MonsterEdits } from './tile-editor';

/** Una riga del bottino: cosa è e il suo valore, come si digita (i numeri restano testo finché non si conferma). */
interface LootRow {
  kind: Loot['kind'];
  amount: string;
  color: RuneColor;
  keyId: string;
  itemId: string;
}

const DICE: { color: DieColor; name: string }[] = (['red', 'green', 'blue', 'yellow', 'white', 'black'] as const).map((color) => ({ color, get name() { return t(`die.${color}`); } }));

const LOOT_KINDS: { kind: Loot['kind']; name: string }[] = [
  { kind: 'item', get name() { return t('monsterDialog.loot.item'); } },
  { kind: 'progress', get name() { return t('monsterDialog.loot.progress'); } },
  { kind: 'coins', get name() { return t('monsterDialog.loot.coins'); } },
  { kind: 'rune', get name() { return t('monsterDialog.loot.rune'); } },
  { kind: 'key', get name() { return t('monsterDialog.loot.key'); } },
];

/** Abilità che si possono aggiungere (oltre a quelle che un mostro ha già sulla sua carta): si può scrivere anche altro, e il gioco legge le parole che conosce. */
const ABILITIES = ['Contraccolpo', 'Aura', 'Bruciare', 'Veleno', 'Ragnatela', 'Stordire', 'Presa', 'Immortale', 'Volare', 'Raggiungere', 'Spazzata', 'Soffio', 'Attacco veloce', 'Comando', 'Paura X', 'Perforare X', '+X Danno', '+X Gittata', 'Stregoneria X'];

/** Il segnaposto del livello nelle abilità che ne hanno uno ("Paura X"): chi le aggiunge lo sostituisce con un numero. */
const LEVEL_PLACEHOLDER = /(^|[\s+])x(\s|$)/i;
/** Un'abilità con livello nell'elenco compare una sola volta, col segnaposto: "Paura 2" e "+1 Danno" diventano "Paura X" e "+X Danno". */
const withLevelPlaceholder = (a: string) => a.replace(/^\+\d+/, '+X').replace(/\s\d+$/, ' X');

const toInt = (s: string) => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isInteger(n) ? n : 0;
};

/**
 * La dialog per personalizzare un nemico (strumento "genetica" nella cassetta dei Nemici): renderlo un mostro con un nome (unico), cambiarne i valori, dargli abilità in più e un bottino.
 * I valori non si scrivono assoluti ma come **quanto cambiano** rispetto alla carta (per esempio +4 ferite): le ferite della carta dipendono dal numero di giocatori e il bonus si somma a
 * quelle, quindi con 2 o con 5 eroi il nemico resta più forte della stessa quantità. Un campo a zero o vuoto lascia la carta com'è.
 */
@Component({
  selector: 'app-monster-dialog',
  imports: [CatalogTextPipe, TranslatePipe, MapSelectComponent, NgTemplateOutlet, CheckboxComponent, DialogComponent, FieldComponent, SelectComponent, HeartsComponent, IconComponent, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="title()" width="min(520px, calc(100vw - 24px - 2 * var(--md-side)))" height="min(500px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <!-- Le due carte, inclinate e infilate sotto i bordi del pannello. A destra il nemico (immagine e nome); a sinistra i suoi valori per ogni numero di giocatori, che si aggiornano mentre si scrivono le modifiche. -->
          <figure dialogSide class="card left" [class.enhanced]="enhanced()">
            <ng-container *ngTemplateOutlet="tierList" />
          </figure>
          <figure dialogSide class="card right" [class.enhanced]="enhanced()">
            @if (def(); as d) { <app-picture [src]="d.image + '-portrait.webp'" icon="skull" [iconSize]="56" /> }
            <figcaption>
              <b>{{ cardName() }}</b>
              @if (subtitle()) { <span>{{ subtitle() }}</span> }
            </figcaption>
          </figure>
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'general'" [class.on]="tab() === 'general'" (click)="tab.set('general')">{{ 'monsterDialog.tabGeneral' | t }}</button>
          <button type="button" role="tab" [attr.aria-selected]="tab() === 'advanced'" [class.on]="tab() === 'advanced'" (click)="tab.set('advanced')">{{ 'monsterDialog.tabAdvanced' | t }}</button>
        </div>
        @if (tab() === 'general') {
          <section>
            <app-field [label]="'monsterDialog.name' | t">
              <input type="text" [attr.value]="name()" autocomplete="off" [placeholder]="'monsterDialog.nameHint' | t" (input)="name.set($any($event.target).value)" />
            </app-field>
            <p class="dlg-hint">{{ 'monsterDialog.uniqueHint' | t }}</p>
          </section>
          <hr />
          <section>
            <h3>{{ 'monsterDialog.modifiers' | t }}</h3>
            <p class="dlg-hint">{{ 'monsterDialog.modifiersHint' | t }}</p>
            <div class="dlg-cols three">
              @for (f of numFields; track f.key) {
                <app-field [label]="f.label">
                  <input type="number" step="1" [attr.value]="nums()[f.key]" placeholder="0" (input)="setNum(f.key, $any($event.target).value)" />
                </app-field>
              }
            </div>
            <span class="sub">{{ 'monsterDialog.extraDice' | t }}</span>
            <div class="dice">
              @for (d of dice; track d.color) {
                <span class="die" [style.--tone]="'var(--cad-die-' + d.color + ')'">
                  <button type="button" class="step" [attr.aria-label]="'monsterDialog.dieLess' | t: { name: d.name }" (click)="stepDie(d.color, -1)">−</button>
                  <span class="dn">{{ d.name }} <b>{{ diceCount()[d.color] || 0 }}</b></span>
                  <button type="button" class="step" [attr.aria-label]="'monsterDialog.dieMore' | t: { name: d.name }" (click)="stepDie(d.color, 1)">+</button>
                </span>
              }
            </div>
          </section>
          <hr />
          <section>
            <h3>{{ 'monsterDialog.traits' | t }}</h3>
            <p class="dlg-hint">{{ 'monsterDialog.traitsHint' | t }}</p>
            <div class="dlg-chips">
              @for (a of activeCardAbilities(); track a) {
                <span class="dlg-chip">{{ a | ct }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: a }" (click)="dropCardAbility(a)">×</button></span>
              }
              @for (t of traits(); track $index) {
                <span class="dlg-chip extra">{{ t | ct }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: t }" (click)="removeTrait($index)">×</button></span>
              }
              @for (a of removed(); track a) {
                <span class="dlg-chip gone">{{ a | ct }}<button type="button" [attr.aria-label]="'monsterDialog.restoreNamed' | t: { name: a }" [title]="'monsterDialog.restore' | t" (click)="restoreCardAbility(a)">+</button></span>
              }
              @if (!activeCardAbilities().length && !traits().length && !removed().length) { <small class="dlg-hint">{{ 'monsterDialog.noTraits' | t }}</small> }
            </div>
            @if (removed().length || traits().length) { <button type="button" class="dlg-btn small" (click)="resetAbilities()">{{ 'monsterDialog.restoreFromCard' | t }}</button> }
            <div class="dlg-add">
              <input type="text" list="monster-abilities" [placeholder]="'monsterDialog.chooseTrait' | t" #ability (input)="traitDraft.set(ability.value)" (keydown.enter)="addTrait(ability); $event.preventDefault()" />
              <datalist id="monster-abilities">@for (a of abilityOptions(); track a) { <option [value]="a | ct"></option> }</datalist>
              <button type="button" class="dlg-btn" [attr.aria-disabled]="!canAddTrait()" (click)="addTrait(ability)">{{ 'common.add' | t }}</button>
            </div>
            @if (traitDraft().trim() && !canAddTrait()) { <small class="dlg-hint">{{ (traitDraft().trim().startsWith('+') ? 'monsterDialog.traitNumberHint' : 'monsterDialog.traitLevelHint') | t }}</small> }
          </section>
          <hr />
          <section>
            <h3>{{ 'monsterDialog.loot' | t }}</h3>
            <p class="dlg-hint">{{ 'monsterDialog.lootHint' | t }}</p>
            @for (r of loot(); track $index) {
              <div class="loot">
                <app-select class="block" [options]="lootKindOptions" [value]="r.kind" [label]="'monsterDialog.prizeType' | t" (changed)="setKind($index, $event)" />
                @switch (r.kind) {
                  @case ('item') {
                    <app-select class="block" [options]="itemOptions()" [value]="r.itemId" [placeholder]="'common.chooseItem' | t" [label]="'common.item' | t" (changed)="patch($index, { itemId: $event })" />
                  }
                  @case ('progress') { <input type="number" min="1" step="1" [attr.value]="r.amount" [placeholder]="'monsterDialog.progress' | t" (input)="patch($index, { amount: $any($event.target).value })" /> }
                  @case ('rune') {
                    <app-select class="block" [options]="runeOptions" [value]="r.color" [label]="'common.color' | t" (changed)="patch($index, { color: $any($event) })" />
                  }
                  @case ('key') { <input type="text" [attr.value]="r.keyId" [placeholder]="'monsterDialog.keyIdExample' | t" (input)="patch($index, { keyId: $any($event.target).value })" /> }
                  @default { <span class="note">{{ 'monsterDialog.coinsPerHero' | t }}</span> }
                }
                <button type="button" class="dlg-rm" [attr.aria-label]="'monsterDialog.remove' | t" [title]="'monsterDialog.remove' | t" (click)="removeLoot($index)">×</button>
              </div>
            }
            <button type="button" class="dlg-btn add-loot" (click)="addLoot()">{{ 'monsterDialog.addLoot' | t }}</button>
          </section>
        } @else {
          <section>
            <app-checkbox [checked]="inactive()" (changed)="inactive.set($event)">{{ 'monsterDialog.inactive' | t }}</app-checkbox>
            <p class="dlg-hint">{{ 'monsterDialog.inactiveHint' | t }}</p>
            <app-checkbox [checked]="delayed()" (changed)="delayed.set($event)">{{ 'monsterDialog.delayed' | t }}</app-checkbox>
            <p class="dlg-hint">{{ 'monsterDialog.delayedHint' | t }}</p>
            <app-checkbox [checked]="invincible()" (changed)="setInvincible($event)">{{ 'monsterDialog.invincible' | t }}</app-checkbox>
            <p class="dlg-hint">{{ 'monsterDialog.invincibleHint' | t }}</p>
            <app-field [label]="'monsterDialog.onlyHurtBy' | t">
              <app-select class="block" [options]="onlyHurtByOptions()" [value]="onlyHurtBy()" [placeholder]="'monsterDialog.onlyHurtByNone' | t" [label]="'monsterDialog.onlyHurtBy' | t" (changed)="onlyHurtBy.set($event)" />
            </app-field>
            <p class="dlg-hint">{{ 'monsterDialog.onlyHurtByHint' | t }}</p>
          </section>
          <hr />
          <section>
            <h3>{{ 'common.look' | t }}</h3>
            <app-select class="block" [options]="lookOptions" [value]="look()" [label]="'common.look' | t" (changed)="look.set($any($event))" />
            <p class="dlg-hint">{{ 'monsterDialog.lookHint' | t }}</p>
          </section>
          <hr />
          <section>
            <h3>{{ 'common.behavior' | t }}</h3>
            <app-select class="block" [options]="behaviorOptions" [value]="behavior()" [label]="'common.behavior' | t" (changed)="behavior.set($any($event))" />
            @if (behavior() === 'endNear') {
              <app-map-select kind="obstacle" [options]="obstacles()" [value]="behaviorTarget()" [placeholder]="'monsterDialog.chooseObstacle' | t" [label]="'monsterDialog.obstacle' | t" (changed)="behaviorTarget.set($event)" />
              @if (!obstacles().length) { <p class="dlg-hint">{{ 'monsterDialog.placeObstacleFirst' | t }}</p> }
            }
            @if (behavior() === 'carry') {
              <app-select class="block" [options]="carriedOptions()" [value]="behaviorItem()" [label]="'monsterDialog.itemOptional' | t" (changed)="behaviorItem.set($event)" />
            }
            @if (behavior() === 'useItem') {
              <app-select class="block" [options]="weaponOptions()" [value]="behaviorItem()" [placeholder]="'monsterDialog.chooseWeapon' | t" [label]="'monsterDialog.weapon' | t" (changed)="behaviorItem.set($event)" />
              <div class="dlg-cols">
                @for (f of useDiceFields; track f.key) {
                  <app-field [label]="f.label">
                    <input type="number" min="0" step="1" placeholder="0" [attr.value]="useDice()[f.key]" (input)="setUseDice(f.key, $any($event.target).value)" />
                  </app-field>
                }
              </div>
              <app-field [label]="'monsterDialog.mode' | t">
                <app-select class="block" [options]="useModeOptions" [value]="useMode()" [label]="'monsterDialog.mode' | t" (changed)="useMode.set($any($event))" />
              </app-field>
              @if (useMode()) { <p class="dlg-hint">{{ (useMode() === 'alternate' ? 'monsterDialog.modeAlternateHint' : 'monsterDialog.modeRandomHint') | t }}</p> }
              <p class="dlg-hint">{{ 'monsterDialog.useItemHint' | t }}</p>
            }
            <app-checkbox [checked]="ignoreGlobal()" (changed)="ignoreGlobal.set($event)">{{ 'monsterDialog.ignoreGlobal' | t }}</app-checkbox>
            <p class="dlg-hint">{{ 'monsterDialog.behaviorHint' | t }}</p>
          </section>
          <hr />
          <section>
            <h3>{{ 'common.immunity' | t }}</h3>
            <p class="dlg-hint">{{ 'monsterDialog.immunityHint' | t }}</p>
            <div class="dlg-chips">
              @for (i of immune(); track i) {
                <span class="dlg-chip">{{ immunityLabel(i) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: immunityLabel(i) }" (click)="removeImmunity(i)">×</button></span>
              } @empty { <small class="dlg-hint">{{ 'monsterDialog.noImmunity' | t }}</small> }
            </div>
            <app-select class="block" [options]="freeImmunities()" value="" [placeholder]="'monsterDialog.addImmunity' | t" [label]="'common.immunity' | t" (changed)="addImmunity($event)" />
            @if (immuneChanged()) { <button type="button" class="dlg-btn small" (click)="resetImmunities()">{{ 'monsterDialog.restoreFromCard' | t }}</button> }
          </section>
        }
        <!-- Solo schermi stretti (dove le carte laterali non ci stanno): gli stessi valori, in sola lettura e ripiegabili, in fondo al contenuto. -->
        <details class="summary" [class.enhanced]="enhanced()">
          <summary>{{ 'monsterDialog.enemyValues' | t }}</summary>
          <ng-container *ngTemplateOutlet="tierList" />
        </details>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : ('monsterDialog.fillRequired' | t)" (click)="confirm()">{{ 'common.confirm' | t }}</button></ng-container>
      </app-dialog>
    }
    <ng-template #tierList>
      @for (t of tiers(); track t.key) {
        <section class="tier">
          <h4>{{ 'monsterDialog.players' | t: { n: t.key } }}</h4>
          <div class="line"><app-hearts [wounds]="t.wounds" [max]="t.wounds" [size]="13" /><span class="mono" [title]="'monsterDialog.wounds' | t">({{ t.wounds }})</span></div>
          <div class="line stats"><span class="st speed" [title]="'monsterDialog.speed' | t"><app-icon name="footprint" [size]="15" /><b class="mono">{{ t.speed }}</b></span><span class="st armor" [title]="'monsterDialog.armor' | t"><app-icon name="shield" [size]="15" /><b class="mono">{{ t.armor }}</b></span></div>
          <div class="line cubes">@for (c of t.dice; track $index) { <app-icon name="deployed_code" [size]="16" [style.color]="'var(--cad-die-' + c + ')'" /> } @empty { <small>{{ 'monsterDialog.noDice' | t }}</small> }</div>
          <div class="abil">@for (a of t.abilities; track $index) { <span class="ab" [class.extra]="$index >= t.cardAbilities">{{ a | ct }}</span> } @empty { <small>{{ 'monsterDialog.noTraits' | t }}</small> }</div>
        </section>
      }
    </ng-template>
  `,
  styles: `
    :host { --md-side: 170px; }
    section { display: flex; flex-direction: column; gap: 8px; }
    .tabs { display: flex; position: sticky; top: -16px; z-index: 1; margin: -16px 0 0; padding-top: 16px; background: var(--c-surface); border-bottom: 1px solid var(--c-line-strong); }
    .tabs button { flex: 1; padding: 10px 12px; border: 0; border-bottom: 2px solid transparent; background: none; color: var(--c-text-dim); cursor: pointer; font: 600 13px/1.2 var(--font-ui); transition: color 0.15s, border-color 0.15s; }
    .tabs button:hover, .tabs button:focus-visible { color: var(--c-text); outline: none; }
    .tabs button.on { color: var(--c-interact); border-bottom-color: var(--c-interact); }
    hr { width: 100%; margin: 0; border: 0; border-top: 1px solid var(--c-line-strong); }
    h3 { margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .sub { font: 600 11px/1 var(--font-ui); color: var(--c-text-dim); margin-top: 4px; }
    .dice { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .die { display: flex; align-items: center; justify-content: space-between; gap: 2px; min-width: 0; padding: 2px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--tone); border-radius: var(--radius-1); font-size: 12px; }
    .dn { padding: 0 6px; }
    .dn b { font-family: var(--font-mono); margin-left: 4px; }
    .step { width: 22px; height: 22px; padding: 0; border: 0; background: none; color: var(--c-text); cursor: pointer; font-size: 14px; border-radius: var(--radius-1); }
    .step:hover { color: var(--c-interact); }
    .dlg-chip.extra { border-color: var(--c-interact); color: var(--c-interact); }
    .dlg-chip.gone { color: var(--c-text-dim); text-decoration: line-through; border-style: dashed; }
    .dlg-chip.gone button { text-decoration: none; }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    .loot { display: grid; grid-template-columns: 170px 1fr auto; gap: 8px; align-items: center; }
    .note { color: var(--c-text-dim); font-size: 12px; }
    .add-loot { align-self: flex-start; }
    /* Le carte laterali, come quelle della finestra dell'attacco: inclinate e infilate sotto i bordi del pannello. */
    .card { position: absolute; z-index: 0; top: 8px; bottom: 8px; width: 200px; margin: 0; overflow: hidden; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card.right { left: calc(100% - 30px); transform: rotate(4deg); transform-origin: 30% 100%; }
    .card.left { right: calc(100% - 30px); transform: rotate(-4deg); transform-origin: 70% 100%; display: flex; flex-direction: column; background: var(--c-surface); overflow-y: auto; scrollbar-width: thin; }
    .card.enhanced { border-color: var(--c-faction-evil); }
    .card app-picture { position: absolute; inset: 0; }
    .card figcaption { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 3px; background: var(--c-surface); border-top: 1px solid var(--c-line-strong); padding: 8px 12px 10px 38px; }
    .card figcaption b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .card figcaption > span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    /* Tre sezioni uguali, una per scaglione di giocatori: tutto sta nell'altezza della carta senza traboccare. */
    .tier { flex: 1 0 auto; display: flex; flex-direction: column; gap: 4px; padding: 8px 34px 8px 12px; border-top: 1px solid var(--c-line-strong); }
    .tier:first-child { border-top: 0; }
    .tier h4 { margin: 0; font: 600 10px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .line { display: flex; align-items: center; gap: 8px; min-height: 14px; }
    .line.stats { gap: 12px; font-size: 11px; }
    .line small, .abil small { color: var(--c-text-dim); font-size: 10px; }
    .mono { font-family: var(--font-mono); font-size: 12px; }
    .st { display: inline-flex; align-items: center; gap: 4px; }
    .st.speed app-icon { color: var(--c-move); }
    .st.armor app-icon { color: var(--c-text); }
    .cubes { flex-wrap: wrap; gap: 1px; }
    .abil { display: flex; flex-wrap: wrap; gap: 3px; }
    .ab { padding: 1px 5px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); font-size: 10px; line-height: 1.3; }
    .ab.extra { border-color: var(--c-interact); color: var(--c-interact); }
    .summary { display: none; }
    @media (max-width: 900px) {
      :host { --md-side: 0px; }
      .card, .card.left { display: none; } /* .card.left ha il suo display: senza la regola più specifica restava acceso, fuori dallo schermo */
      .summary { display: block; flex: none; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-surface); }
      .summary.enhanced { border-color: var(--c-faction-evil); }
      .summary summary { padding: 10px 12px; cursor: pointer; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
      .summary .tier { padding: 8px 12px; }
    }
    /* Telefono in verticale: ogni campo a riga intera. */
    @media (max-width: 600px) {
      .dice { grid-template-columns: 1fr; }
      .loot { grid-template-columns: minmax(0, 1fr) auto; }
      .loot > :first-child { grid-column: 1 / -1; }
    }
  `,
})
export class MonsterDialogComponent {
  readonly open = input(false);
  /** Il nome del nemico che si modifica (della carta) e le abilità che ha già: servono al titolo e ai suggerimenti. */
  readonly def = input<MonsterDef | null>(null);
  readonly enhanced = input(false);
  /** Gli oggetti che si possono mettere nel bottino. */
  readonly items = input<{ id: string; name: string; carried?: boolean; weapon?: boolean }[]>([]);
  readonly value = input<MonsterEdits | null>(null);
  readonly confirmed = output<MonsterEdits>();
  readonly cancel = output<void>();

  protected readonly numFields = [{ key: 'wounds', get label() { return t('monsterDialog.woundPoints'); } }, { key: 'speed', get label() { return t('monsterDialog.speed'); } }, { key: 'armor', get label() { return t('monsterDialog.armor'); } }] as const;
  protected readonly dice = DICE;
  protected readonly lootKindOptions: SelectOption[] = LOOT_KINDS.map((k) => ({ value: k.kind, label: k.name }));
  protected readonly runeOptions: SelectOption[] = [{ value: 'red', get label() { return t('monsterDialog.red'); } }, { value: 'blue', get label() { return t('monsterDialog.blue'); } }, { value: 'green', get label() { return t('monsterDialog.green'); } }];
  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((o) => ({ value: o.id, label: o.name })));
  protected readonly title = computed(() => tr('Personalizza: {name}', { name: this.def()?.name ?? tr('Nemico') }));
  protected readonly name = signal('');
  protected readonly inactive = signal(false);
  protected readonly behavior = signal<BehaviorKind | ''>('');
  protected readonly behaviorTarget = signal('');
  /** Solo per "Raccoglie gli oggetti trasportabili": l'oggetto scelto ('' = qualsiasi). */
  protected readonly behaviorItem = signal('');
  /** Solo per "Attacca con un oggetto": i dadi competenza (neri) per mischia, distanza e magia. */
  protected readonly useDice = signal<Record<'melee' | 'ranged' | 'magic', string>>({ melee: '', ranged: '', magic: '' });
  protected readonly useDiceFields: { key: 'melee' | 'ranged' | 'magic'; label: string }[] = [
    { key: 'melee', get label() { return t('monsterDialog.diceMelee'); } },
    { key: 'ranged', get label() { return t('monsterDialog.diceRanged'); } },
    { key: 'magic', get label() { return t('monsterDialog.diceMagic'); } },
  ];
  protected readonly useMode = signal<'' | 'alternate' | 'random'>('');
  protected readonly useModeOptions: SelectOption[] = [
    { value: '', get label() { return t('monsterDialog.modeAlways'); } },
    { value: 'alternate', get label() { return t('monsterDialog.modeAlternate'); } },
    { value: 'random', get label() { return t('monsterDialog.modeRandom'); } },
  ];
  protected readonly tab = signal<'general' | 'advanced'>('general');
  protected readonly weaponOptions = computed<SelectOption[]>(() => this.items().filter((i) => i.weapon).map((i) => ({ value: i.id, label: i.name })));
  protected setUseDice(key: 'melee' | 'ranged' | 'magic', value: string) {
    this.useDice.update((d) => ({ ...d, [key]: value }));
  }
  protected readonly carriedOptions = computed<SelectOption[]>(() => [{ value: '', get label() { return t('monsterDialog.anyCarriable'); } }, ...this.items().filter((i) => i.carried).map((i) => ({ value: i.id, label: i.name }))]);
  /** Ignora i comportamenti globali dell'avventura (pannello Comportamenti), anche se il suo tipo di mostro li segue. */
  protected readonly ignoreGlobal = signal(false);
  protected readonly behaviorOptions: SelectOption[] = BEHAVIOR_OPTIONS.map((b) => ({ value: b.value, label: b.label }));
  /** Gli ostacoli in mappa fra cui scegliere ("Macerie · casella x, y"). */
  readonly obstacles = input<SelectOption[]>([]);
  protected readonly look = signal<PawnLook | ''>('');
  protected readonly lookOptions: SelectOption[] = PAWN_LOOKS.map((l) => ({ value: l.value, label: l.label }));
  protected readonly invincible = signal(false);
  /** L'unica arma che lo ferisce (id oggetto), '' se tutte. */
  protected readonly onlyHurtBy = signal('');
  /** Entra in gioco più tardi (con un evento). */
  protected readonly delayed = signal(false);
  protected readonly onlyHurtByOptions = computed<SelectOption[]>(() => [{ value: '', label: t('monsterDialog.onlyHurtByNone') }, ...this.itemOptions()]);
  /** Le immunità del nemico: parte da quelle della carta. */
  protected readonly immune = signal<string[]>([]);
  protected readonly immunityLabel = immunityName;
  private readonly cardImmune = computed(() => this.tier()?.immune ?? []);
  protected readonly freeImmunities = computed(() => IMMUNITY_OPTIONS.filter((o) => !this.immune().includes(o.value)));
  protected readonly immuneChanged = computed(() => this.immune().length !== this.cardImmune().length || !this.immune().every((x) => this.cardImmune().includes(x)));
  protected readonly nums = signal<Record<'wounds' | 'speed' | 'armor', string>>({ wounds: '', speed: '', armor: '' });
  protected readonly diceCount = signal<Partial<Record<DieColor, number>>>({});
  protected readonly traits = signal<string[]>([]);
  /** Le abilità della carta tolte a questo nemico. */
  protected readonly removed = signal<string[]>([]);
  /** Le abilità della carta che ha ancora. */
  protected readonly activeCardAbilities = computed(() => (this.tier()?.abilities ?? []).filter((a) => !this.removed().includes(a)));
  protected readonly loot = signal<LootRow[]>([]);
  protected readonly abilityOptions = computed(() => [...new Set([...(this.def()?.normal.abilities ?? []), ...(this.def()?.enhanced.abilities ?? []), ...ABILITIES].map(withLevelPlaceholder))].sort((a, b) => a.localeCompare(b, 'it')));
  protected readonly valid = computed(() => this.loot().every((r) => this.rowOk(r)) && (this.behavior() !== 'endNear' || !!behaviorFrom('endNear', this.behaviorTarget())) && (this.behavior() !== 'useItem' || !!this.behaviorItem()));
  /** Con un nome scritto il mostro è unico. */
  protected readonly isUnique = computed(() => !!this.name().trim());
  protected readonly cardName = computed(() => this.name().trim() || this.def()?.name || '');
  private readonly tier = computed(() => (this.enhanced() ? this.def()?.enhanced : this.def()?.normal));

  /** Il sottotitolo della carta: se il mostro ha un nome, "<tipo> <potenziato> unico"; altrimenti solo "Potenziato" se lo è. */
  protected readonly subtitle = computed(() => {
    const type = this.def()?.name ?? '';
    return this.isUnique() ? t(this.enhanced() ? 'monsterDialog.subtitleUniqueEnhanced' : 'monsterDialog.subtitleUnique', { type }) : this.enhanced() ? t('monsterDialog.subtitleEnhanced') : '';
  });

  /** I valori per ogni scaglione di giocatori, con le modifiche già applicate: ferite, velocità, armatura, dadi (della carta e in più) e abilità (della carta e in più, queste ultime in fondo). */
  protected readonly tiers = computed(() => {
    const t = this.tier();
    if (!t) return [];
    const n = this.nums();
    const extraDice = (Object.entries(this.diceCount()) as [DieColor, number][]).flatMap(([c, k]) => Array<DieColor>(k).fill(c));
    return (['2-3', '4', '5'] as const).map((key) => ({
      key,
      wounds: Math.max(1, t.wounds[key] + toInt(n.wounds)),
      speed: Math.max(1, t.speed + toInt(n.speed)),
      armor: Math.max(0, t.armor + toInt(n.armor)),
      dice: [...t.dice, ...extraDice],
      abilities: [...this.activeCardAbilities(), ...this.traits()],
      cardAbilities: this.activeCardAbilities().length,
    }));
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.open() || !v) return;
      this.name.set(v.name);
      this.inactive.set(v.inactive);
      this.look.set(v.look);
      this.behavior.set(behaviorKind(v.behavior));
      this.ignoreGlobal.set(v.ignoreGlobal);
      this.behaviorTarget.set(behaviorTarget(v.behavior));
      this.behaviorItem.set(behaviorItem(v.behavior));
      this.useDice.set(behaviorDice(v.behavior));
      this.useMode.set(behaviorMode(v.behavior));
      this.tab.set('general');
      this.invincible.set(v.invincible);
      this.onlyHurtBy.set(v.onlyHurtBy);
      this.delayed.set(v.delayed);
      this.immune.set([...v.immune]);
      this.nums.set({ wounds: v.bonus.wounds ? String(v.bonus.wounds) : '', speed: v.bonus.speed ? String(v.bonus.speed) : '', armor: v.bonus.armor ? String(v.bonus.armor) : '' });
      const count: Partial<Record<DieColor, number>> = {};
      for (const c of v.bonus.dice) count[c] = (count[c] ?? 0) + 1;
      this.diceCount.set(count);
      this.traits.set([...v.traits]);
      this.removed.set([...v.removedTraits]);
      this.loot.set(v.drop.map((l) => this.rowOf(l)));
    });
  }

  private rowOf(l: Loot): LootRow {
    return { kind: l.kind, amount: l.kind === 'progress' ? String(l.amount) : '', color: l.kind === 'rune' ? l.color : 'red', keyId: l.kind === 'key' ? l.keyId : '', itemId: l.kind === 'item' ? l.itemId : '' };
  }

  /** Una riga del bottino è completa? Oggetto scelto, punti Conquista almeno 1, id della chiave scritto. */
  private rowOk(r: LootRow): boolean {
    return r.kind === 'item' ? !!r.itemId : r.kind === 'progress' ? toInt(r.amount) >= 1 : r.kind === 'key' ? !!r.keyId.trim() : true;
  }

  protected setNum(key: 'wounds' | 'speed' | 'armor', v: string) {
    this.nums.update((n) => ({ ...n, [key]: v }));
  }

  protected stepDie(color: DieColor, delta: number) {
    this.diceCount.update((d) => ({ ...d, [color]: Math.max(0, (d[color] ?? 0) + delta) }));
  }

  /** Il testo scritto nel campo delle abilità. */
  protected readonly traitDraft = signal('');
  /** Si aggiunge solo se non c'è più la X del livello (senza numero e senza X il livello vale 1). */
  protected readonly canAddTrait = computed(() => {
    const v = this.traitDraft().trim();
    return !!v && !LEVEL_PLACEHOLDER.test(v);
  });

  protected addTrait(input: HTMLInputElement) {
    this.traitDraft.set(input.value);
    if (!this.canAddTrait()) return;
    const t = catalogSource(input.value.trim()); // si può scrivere nella lingua di adesso: nei dati resta la parola che il motore conosce
    if (t && !this.traits().includes(t)) this.traits.update((l) => [...l, t]);
    input.value = '';
    this.traitDraft.set('');
  }

  protected removeTrait(i: number) {
    this.traits.update((l) => l.filter((_, k) => k !== i));
  }

  /** Toglie un'abilità della carta a questo nemico. */
  protected dropCardAbility(a: string) {
    if (!this.removed().includes(a)) this.removed.update((l) => [...l, a]);
  }

  protected restoreCardAbility(a: string) {
    this.removed.update((l) => l.filter((x) => x !== a));
  }

  /** Rimette le abilità della carta com'erano nel catalogo: non ne manca nessuna e non ce ne sono di aggiunte. */
  protected resetAbilities() {
    this.removed.set([]);
    this.traits.set([]);
  }

  /** Accendere l'invincibilità aggiunge «Tutti gli stati» alle immunità (che restano se la si spegne). */
  protected setInvincible(on: boolean) {
    this.invincible.set(on);
    if (on && !this.immune().includes('all')) this.immune.update((l) => [...l, 'all']);
  }

  protected addImmunity(v: string) {
    if (v && !this.immune().includes(v)) this.immune.update((l) => [...l, v]);
  }

  protected removeImmunity(v: string) {
    this.immune.update((l) => l.filter((x) => x !== v));
  }

  /** Rimette le immunità che dà la carta del catalogo. */
  protected resetImmunities() {
    this.immune.set([...this.cardImmune()]);
  }

  protected addLoot() {
    this.loot.update((l) => [...l, { kind: 'item', amount: '', color: 'red', keyId: '', itemId: '' }]);
  }

  protected removeLoot(i: number) {
    this.loot.update((l) => l.filter((_, k) => k !== i));
  }

  protected setKind(i: number, kind: string) {
    this.patch(i, { kind: kind as Loot['kind'] });
  }

  protected patch(i: number, p: Partial<LootRow>) {
    this.loot.update((l) => l.map((r, k) => (k === i ? { ...r, ...p } : r)));
  }

  protected confirm() {
    if (!this.valid()) return;
    const n = this.nums();
    const dice = (Object.entries(this.diceCount()) as [DieColor, number][]).flatMap(([c, k]) => Array<DieColor>(k).fill(c));
    const drop = this.loot().map((r): Loot => (r.kind === 'item' ? { kind: 'item', itemId: r.itemId } : r.kind === 'progress' ? { kind: 'progress', amount: toInt(r.amount) } : r.kind === 'rune' ? { kind: 'rune', color: r.color } : r.kind === 'key' ? { kind: 'key', keyId: r.keyId.trim() } : { kind: 'coins' }));
    this.confirmed.emit({ unique: this.isUnique(), name: this.name().trim(), bonus: { wounds: toInt(n.wounds), speed: toInt(n.speed), armor: toInt(n.armor), dice }, traits: this.traits(), removedTraits: this.removed(), drop, inactive: this.inactive(), look: this.look(), ignoreGlobal: this.ignoreGlobal(), ...(behaviorFrom(this.behavior(), this.behaviorTarget(), this.behaviorItem(), this.useDice(), this.useMode()) ? { behavior: behaviorFrom(this.behavior(), this.behaviorTarget(), this.behaviorItem(), this.useDice()) } : {}), invincible: this.invincible(), onlyHurtBy: this.onlyHurtBy(), delayed: this.delayed(), immune: [...this.immune()] });
  }
}
