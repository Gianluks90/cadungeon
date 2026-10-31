import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, viewChild } from '@angular/core';
import { EQUIP_HANDS, POTION_LIMIT, POTION_PRICES } from '../game/constants';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { heroStats } from '../game/heroes/hero-stats';
import { Loadout, ShopData, equippedDefs, loadoutCost, placeItems, stockLeft } from '../game/heroes/party-setup';
import { itemDetail } from '../game/items/item';
import { POTION_NAMES } from '../game/markers/marker-rules';
import { PotionKind } from '../game/board/marker';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { SkillDef } from '../game/skills/skill';
import { HeroFaceComponent } from './hero-face.component';
import { SkillCardComponent } from './skill-card.component';
import { AttackDiceComponent } from './attack-dice.component';
import { DialogComponent } from './dialog.component';
import { IconComponent } from './icon.component';
import { ItemCardComponent } from './item-card.component';

const POTIONS: readonly PotionKind[] = ['heal', 'vital'];

/**
 * Il negozio di prima della partita, per un eroe: con le sue monete (300) compra pozioni e oggetti, e può rimettere a posto ciò che ha comprato riavendo tutti i soldi (prima di partire non
 * si perde niente). Le copie in vendita sono comuni a tutta la squadra. Ogni cambiamento esce subito con `changed`; ciò che resta di monete è dell'eroe.
 * Le regole di posto sono quelle della partita: gli oggetti si equipaggiano finché ci stanno (2 mani, 1 armatura, 2 oggetti vari), poi vanno nello zaino (3 posti).
 */
@Component({
  selector: 'app-pregame-shop-dialog',
  imports: [AttackDiceComponent, DialogComponent, HeroFaceComponent, SkillCardComponent, IconComponent, ItemCardComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog [kicker]="'shop.kicker' | t" [title]="hero().name" height="min(520px, calc(100dvh - 24px))" (closed)="closed.emit()">
      <!-- A sinistra la carta dell'eroe con i suoi parametri, a destra le sue abilità secondarie (già assegnate) in una carta che scorre da sola. Sono inclinate e infilate sotto il pannello. -->
      <figure dialogSide class="card left"><app-hero-face [hero]="hero()" [stats]="stats()" /></figure>
      <figure dialogSide class="card right">
        <figcaption class="head">{{ 'detail.secondary' | t }}</figcaption>
        <div class="scroller" #scroller>
          @for (s of skills(); track s.id) { <app-skill-card [skill]="s" [stacked]="true" /> }
          @empty { <p class="none">{{ 'shop.noSkills' | t }}</p> }
        </div>
      </figure>
      <!-- Seconda intestazione fissa: i dadi d'attacco extra dell'eroe, per sapere che armi conviene comprare. -->
      <div dialogSub class="dice">
        <span class="cap">{{ 'detail.dice' | t }}</span>
        <app-attack-dice [dice]="hero().dice" />
      </div>

      <h3>{{ 'shop.potions' | t }} <small>{{ 'shop.potionsHint' | t: { n: potionLimit } }}</small></h3>
      <div class="list">
        @for (k of potionKinds; track k) {
          <div class="row">
            <b>{{ potionName(k) }}</b>
            <span class="price"><app-icon name="tokens/gold_pile" [size]="14" />{{ potionPrice(k) }}</span>
            <button type="button" class="act" [class.off]="!!potionReason(k)" [attr.aria-disabled]="!!potionReason(k)" [title]="potionReason(k)" (click)="buyPotion(k)">{{ 'shop.buy' | t }}</button>
          </div>
        }
      </div>

      <h3>{{ 'shop.items' | t }}</h3>
      <div class="cards">
        @for (o of offers(); track o.id) {
          <app-item-card [def]="o.def" [icon]="o.def.icon ?? 'inventory_2'" [detail]="o.detail">
            <span class="stock" [title]="'shop.stock' | t">×{{ o.left }}</span>
            <button type="button" class="act" [class.off]="!!o.reason" [attr.aria-disabled]="!!o.reason" [title]="o.reason" (click)="buyItem(o.id)">{{ 'shop.buy' | t }} · {{ o.def.price }}</button>
          </app-item-card>
        }
      </div>

      <h3>{{ 'shop.bought' | t }}</h3>
      <div class="list">
        @for (id of loadout().items; track $index) {
          <div class="row">
            <b>{{ itemName(id) }}</b>
            <span class="price"><app-icon name="tokens/gold_pile" [size]="14" />{{ itemPrice(id) }}</span>
            <button type="button" class="act" (click)="removeItem($index)">{{ 'shop.refund' | t }}</button>
          </div>
        }
        @for (k of loadout().potions; track $index) {
          <div class="row">
            <b>{{ potionName(k) }}</b>
            <span class="price"><app-icon name="tokens/gold_pile" [size]="14" />{{ potionPrice(k) }}</span>
            <button type="button" class="act" (click)="removePotion($index)">{{ 'shop.refund' | t }}</button>
          </div>
        }
        @if (!loadout().items.length && !loadout().potions.length) { <p class="none">{{ 'shop.nothing' | t }}</p> }
      </div>
      <!-- Le monete a sinistra del piede, con le due mani (una specchiata): si accendono in base alle mani occupate dalle armi scelte. -->
      <div dialogFooterStart class="coins" [title]="'shop.coins' | t"><app-icon name="tokens/gold_pile" [size]="20" /><b>{{ coinsLeft() }}</b><small>{{ 'shop.coinsOf' | t: { n: hero().coins } }}</small></div>
      <div dialogFooterStart class="hands" [title]="'shop.hands' | t: { used: handsUsed(), max: handsMax }">
        <span class="hand left" [class.on]="handsUsed() >= 1"><app-icon name="back_hand" [size]="22" /></span>
        <span class="hand right" [class.on]="handsUsed() >= 2"><app-icon name="back_hand" [size]="22" /></span>
      </div>
      <ng-container dialogFooter><button type="button" class="dlg-btn primary" (click)="closed.emit()">{{ 'shop.done' | t }}</button></ng-container>
    </app-dialog>
  `,
  styles: `
    :host { display: contents; }
    h3 { margin: 10px 0 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3 small { margin-left: 6px; font-weight: 400; letter-spacing: 0; text-transform: none; font-size: 12px; }
    small { color: var(--c-text-dim); }
    /* Le due carte laterali: inclinate e infilate sotto il pannello, come nella finestra dell'attacco. */
    /* Il margine a sinistra della carta delle abilità (14 px) è tarato a occhio perché risulti uguale a quello di destra (10 px più l'inclinazione). Alte al massimo come la finestra dell'attacco (500 px), centrate in verticale anche se la dialog è più alta. */
    .card { position: absolute; z-index: 0; top: 0; bottom: 0; margin-block: auto; height: min(484px, calc(100% - 16px)); width: 220px; margin-inline: 0; overflow: hidden; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card.left { --face-inset: 14px; right: calc(100% - 14px); transform: rotate(-4deg); transform-origin: 70% 100%; }
    .card.right { left: calc(100% - 14px); transform: rotate(4deg); transform-origin: 30% 100%; display: flex; flex-direction: column; background: var(--c-surface); }
    .card .head { flex: none; padding: 10px 10px 8px 14px; border-bottom: 1px solid var(--c-line-strong); font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .scroller { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding: 10px 10px 10px 14px; scrollbar-width: none; }
    .scroller::-webkit-scrollbar { display: none; }
    @media (max-width: 1000px) { .card { display: none; } }
    .dice { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .dice .cap { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .hands { display: inline-flex; align-items: center; gap: 4px; }
    .hand { display: inline-flex; opacity: 0.25; transition: opacity 0.2s; }
    .hand.right { transform: scaleX(-1); }
    .hand.on { opacity: 1; }
    .coins { display: inline-flex; align-items: center; gap: 8px; color: var(--cad-coin); font-variant-numeric: tabular-nums; }
    .coins b { font-size: 18px; }
    .list, .cards { display: flex; flex-direction: column; gap: 6px; }
    .row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-bg); }
    .row b { flex: 1; min-width: 0; font-weight: 600; }
    .price { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--cad-coin); }
    .stock { margin-right: auto; font-size: 12px; color: var(--c-text-dim); font-variant-numeric: tabular-nums; }
    .none { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .act { padding: 4px 10px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; white-space: nowrap; border: 1px solid var(--c-line-strong); font: 12px/1.2 var(--font-ui); transition: border-color 0.15s, color 0.15s; }
    .act:hover:not(.off), .act:focus-visible:not(.off) { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    .act.off { opacity: 0.35; cursor: default; }
  `,
})
export class PregameShopDialogComponent {
  readonly hero = input.required<HeroSheet>();
  readonly loadout = input.required<Loadout>();
  readonly shop = input.required<ShopData>();
  /** Ciò che hanno comprato gli altri eroi della squadra: le copie in vendita sono comuni. */
  readonly others = input<readonly Loadout[]>([]);
  /** Le carte abilità secondarie già assegnate all'eroe. */
  readonly skills = input<readonly SkillDef[]>([]);
  readonly changed = output<Loadout>();
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  readonly closed = output<void>();

  private readonly i18n = inject(I18nService);
  protected readonly potionKinds = POTIONS;
  /** I parametri che avrà, con le abilità assegnate e gli oggetti comprati (per la carta a sinistra). */
  protected readonly stats = computed(() => heroStats(this.hero(), this.skills(), equippedDefs(this.loadout(), this.shop())));
  protected readonly handsMax = EQUIP_HANDS;
  /** Le mani occupate dagli oggetti che l'eroe riesce a equipaggiare (armi e scudi). */
  protected readonly handsUsed = computed(() => {
    const s = this.shop();
    const placed = placeItems(this.loadout().items, s);
    return (placed?.equipped ?? []).reduce((n, id) => n + (s.items.get(id)?.hands ?? 0), 0);
  });
  protected readonly potionLimit = POTION_LIMIT;
  protected readonly coinsLeft = computed(() => this.hero().coins - loadoutCost(this.loadout(), this.shop()));
  private readonly left = computed(() => stockLeft(this.shop(), [...this.others(), this.loadout()]));

  protected readonly offers = computed(() => {
    const shop = this.shop();
    const l = this.loadout();
    return [...shop.items.values()]
      .filter((i) => i.id in shop.stock)
      .map((def) => {
        const left = this.left()[def.id];
        const reason = left <= 0 ? this.i18n.t('shop.soldOut') : def.price > this.coinsLeft() ? this.i18n.t('shop.noCoins') : placeItems([...l.items, def.id], shop) ? '' : this.i18n.t('shop.noRoom');
        return { id: def.id, def, left, reason, detail: itemDetail(def) };
      })
      .sort((a, b) => a.def.name.localeCompare(b.def.name, 'it'));
  });

  constructor() {
    // La carta delle abilità scorre da sola, su e giù, e si ferma sotto il puntatore (e con la riduzione del movimento sta ferma: si scorre a mano).
    effect((onCleanup) => {
      const el = this.scroller()?.nativeElement;
      if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      let hover = false;
      let dir = 1;
      let wait = 60;
      let pos = 0;
      let raf = 0;
      const enter = () => (hover = true);
      const leave = () => ((hover = false), (pos = el.scrollTop));
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      const step = () => {
        const max = el.scrollHeight - el.clientHeight;
        if (max > 2 && !hover) {
          if (wait > 0) wait--;
          else {
            pos = Math.min(max, Math.max(0, pos + dir * 0.35));
            el.scrollTop = pos;
            if (pos <= 0 || pos >= max) {
              dir = -dir;
              wait = 90;
            }
          }
        }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      onCleanup(() => {
        cancelAnimationFrame(raf);
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
      });
    });
  }

  protected potionName = (k: PotionKind) => POTION_NAMES[k];
  protected potionPrice = (k: PotionKind) => POTION_PRICES[k];
  protected itemName = (id: string) => this.shop().items.get(id)?.name ?? id;
  protected itemPrice = (id: string) => this.shop().items.get(id)?.price ?? 0;

  protected potionReason(k: PotionKind): string {
    if (this.loadout().potions.length >= POTION_LIMIT) return this.i18n.t('shop.potionsFull', { n: POTION_LIMIT });
    return POTION_PRICES[k] > this.coinsLeft() ? this.i18n.t('shop.noCoins') : '';
  }

  protected buyPotion(k: PotionKind) {
    if (!this.potionReason(k)) this.changed.emit({ ...this.loadout(), potions: [...this.loadout().potions, k] });
  }

  protected buyItem(id: string) {
    const o = this.offers().find((x) => x.id === id);
    if (o && !o.reason) this.changed.emit({ ...this.loadout(), items: [...this.loadout().items, id] });
  }

  protected removeItem(i: number) {
    this.changed.emit({ ...this.loadout(), items: this.loadout().items.filter((_, j) => j !== i) });
  }

  protected removePotion(i: number) {
    this.changed.emit({ ...this.loadout(), potions: this.loadout().potions.filter((_, j) => j !== i) });
  }
}
