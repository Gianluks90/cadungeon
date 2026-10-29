import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import type { Loot } from '../game/board/marker';
import type { RuneColor } from '../game/board/door';
import type { DieColor } from '../game/items/item';
import type { MonsterDef } from '../game/monsters/monster';
import { DialogComponent } from '../ui/dialog.component';
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

const DICE: { color: DieColor; name: string }[] = [
  { color: 'red', name: 'Rosso' },
  { color: 'green', name: 'Verde' },
  { color: 'blue', name: 'Blu' },
  { color: 'yellow', name: 'Giallo' },
  { color: 'white', name: 'Bianco' },
  { color: 'black', name: 'Potere' },
];

const LOOT_KINDS: { kind: Loot['kind']; name: string }[] = [
  { kind: 'item', name: 'Oggetto' },
  { kind: 'progress', name: 'Conquista' },
  { kind: 'coins', name: 'Denaro (100 per eroe)' },
  { kind: 'rune', name: 'Chiave runica' },
  { kind: 'key', name: 'Chiave' },
];

/** Abilità che si possono aggiungere (oltre a quelle che un mostro ha già sulla sua carta): si può scrivere anche altro, e il gioco legge le parole che conosce. */
const ABILITIES = ['Contraccolpo', 'Aura', 'Bruciare', 'Veleno', 'Ragnatela', 'Stordire', 'Presa', 'Immortale', 'Volare', 'Raggiungere', 'Spazzata', 'Soffio', 'Attacco veloce', 'Comando', 'Paura 1', 'Paura 2', 'Perforare 1', 'Perforare 2', 'Perforare 3', '+1 Danno', '+2 Danno', '+1 Gittata', '+2 Gittata', 'Stregoneria 1', 'Stregoneria 2'];

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
  imports: [NgTemplateOutlet, DialogComponent, SelectComponent, HeartsComponent, IconComponent, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [title]="title()" width="min(520px, calc(100vw - 24px - 2 * var(--md-side)))" height="min(500px, calc(100vh - 48px))" (closed)="cancel.emit()">
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
        <section>
          <label>
            <span>Nome (un mostro con un nome è unico)</span>
            <input type="text" [attr.value]="name()" autocomplete="off" placeholder="Lascia vuoto per il mostro della carta; per esempio: Narthak" (input)="name.set($any($event.target).value)" />
          </label>
          <p class="hint">Un mostro con un nome non si stordisce e il suo nome sostituisce quello della carta.</p>
        </section>
        <hr />
        <section>
          <label class="check">
            <input type="checkbox" [checked]="inactive()" (change)="inactive.set($any($event.target).checked)" />
            <span>Inattivo</span>
          </label>
          <p class="hint">Finché un evento non lo attiva non agisce, non si attacca e non ha abilità, ma occupa le sue caselle e blocca movimento e vista come un ostacolo.</p>
          <label class="check">
            <input type="checkbox" [checked]="stone()" (change)="stone.set($any($event.target).checked)" />
            <span>Aspetto di pietra</span>
          </label>
          <p class="hint">Solo grafica: immagine e bordo senza colore. Si può usare anche su un nemico attivo.</p>
        </section>
        <hr />
        <section>
          <h3>Modificatori</h3>
          <p class="hint">Inserisci valori, positivi o negativi, che vanno a modificare i parametri normali del mostro. Ricorda che alcuni parametri cambiano con il numero dei giocatori.</p>
          <div class="nums">
            @for (f of numFields; track f.key) {
              <label>
                <span>{{ f.label }}</span>
                <input type="number" step="1" [attr.value]="nums()[f.key]" placeholder="0" (input)="setNum(f.key, $any($event.target).value)" />
              </label>
            }
          </div>
          <span class="sub">Dadi d'attacco in più</span>
          <div class="dice">
            @for (d of dice; track d.color) {
              <span class="die" [style.--tone]="'var(--cad-die-' + d.color + ')'">
                <button type="button" class="step" [attr.aria-label]="'Un dado ' + d.name + ' in meno'" (click)="stepDie(d.color, -1)">−</button>
                <span class="dn">{{ d.name }} <b>{{ diceCount()[d.color] || 0 }}</b></span>
                <button type="button" class="step" [attr.aria-label]="'Un dado ' + d.name + ' in più'" (click)="stepDie(d.color, 1)">+</button>
              </span>
            }
          </div>
        </section>
        <hr />
        <section>
          <h3>Abilità in più</h3>
          <div class="chips">
            @for (t of traits(); track $index) {
              <span class="chip">{{ t }}<button type="button" [attr.aria-label]="'Togli ' + t" (click)="removeTrait($index)">×</button></span>
            }
          </div>
          <div class="add">
            <input type="text" list="monster-abilities" placeholder="Scegli o scrivi un'abilità" #ability (keydown.enter)="addTrait(ability); $event.preventDefault()" />
            <datalist id="monster-abilities">@for (a of abilityOptions(); track a) { <option [value]="a"></option> }</datalist>
            <button type="button" class="dlg-btn" (click)="addTrait(ability)">Aggiungi</button>
          </div>
        </section>
        <hr />
        <section>
          <h3>Bottino</h3>
          <p class="hint">Quando muore lascia questo. Gli oggetti cadono nella sua casella e, se sono più d'uno, nelle caselle libere vicine (o vanno a chi dà il colpo fatale, se ha posto).</p>
          @for (r of loot(); track $index) {
            <div class="loot">
              <app-select class="block" [options]="lootKindOptions" [value]="r.kind" label="Tipo di premio" (changed)="setKind($index, $event)" />
              @switch (r.kind) {
                @case ('item') {
                  <app-select class="block" [options]="itemOptions()" [value]="r.itemId" placeholder="Scegli un oggetto…" label="Oggetto" (changed)="patch($index, { itemId: $event })" />
                }
                @case ('progress') { <input type="number" min="1" step="1" [attr.value]="r.amount" placeholder="Punti Conquista" (input)="patch($index, { amount: $any($event.target).value })" /> }
                @case ('rune') {
                  <app-select class="block" [options]="runeOptions" [value]="r.color" label="Colore" (changed)="patch($index, { color: $any($event) })" />
                }
                @case ('key') { <input type="text" [attr.value]="r.keyId" placeholder="Id della chiave (per esempio chiave-1)" (input)="patch($index, { keyId: $any($event.target).value })" /> }
                @default { <span class="note">100 monete a ognuno degli eroi</span> }
              }
              <button type="button" class="rm" aria-label="Togli" title="Togli" (click)="removeLoot($index)">×</button>
            </div>
          }
          <button type="button" class="dlg-btn add-loot" (click)="addLoot()">Aggiungi al bottino</button>
        </section>
        <!-- Solo schermi stretti (dove le carte laterali non ci stanno): gli stessi valori, in sola lettura e ripiegabili, in fondo al contenuto. -->
        <details class="summary" [class.enhanced]="enhanced()">
          <summary>Valori del nemico</summary>
          <ng-container *ngTemplateOutlet="tierList" />
        </details>
        <ng-container dialogFooter><button type="button" class="dlg-btn primary" [class.off]="!valid()" [attr.aria-disabled]="!valid()" [title]="valid() ? '' : 'Completa i dati richiesti'" (click)="confirm()">Conferma</button></ng-container>
      </app-dialog>
    }
    <ng-template #tierList>
      @for (t of tiers(); track t.key) {
        <section class="tier">
          <h4>{{ t.key }} giocatori</h4>
          <div class="line"><app-hearts [wounds]="t.wounds" [max]="t.wounds" [size]="13" /><span class="mono" title="Ferite">({{ t.wounds }})</span></div>
          <div class="line stats"><span class="st speed" title="Velocità"><app-icon name="footprint" [size]="15" /><b class="mono">{{ t.speed }}</b></span><span class="st armor" title="Armatura"><app-icon name="shield" [size]="15" /><b class="mono">{{ t.armor }}</b></span></div>
          <div class="line cubes">@for (c of t.dice; track $index) { <app-icon name="deployed_code" [size]="16" [style.color]="'var(--cad-die-' + c + ')'" /> } @empty { <small>Nessun dado</small> }</div>
          <div class="abil">@for (a of t.abilities; track $index) { <span class="ab" [class.extra]="$index >= t.cardAbilities">{{ a }}</span> } @empty { <small>Nessuna abilità</small> }</div>
        </section>
      }
    </ng-template>
  `,
  styles: `
    :host { --md-side: 170px; }
    section { display: flex; flex-direction: column; gap: 8px; }
    hr { width: 100%; margin: 0; border: 0; border-top: 1px solid var(--c-line-strong); }
    h3 { margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .sub { font: 600 11px/1 var(--font-ui); color: var(--c-text-dim); margin-top: 4px; }
    label { display: flex; flex-direction: column; gap: 5px; }
    label span { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    label.check { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; }
    label.check input { margin: 0; accent-color: var(--c-interact); }
    input[type='text'], input[type='number'], select {
      box-sizing: border-box; padding: 8px 10px; border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 13px/1.3 var(--font-ui); min-width: 0;
    }
    input:focus, select:focus { border-color: var(--c-interact); outline: none; }
    input[type='text'] { width: 100%; }
    .nums { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .nums input { width: 100%; font-family: var(--font-mono); }
    .dice { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .die { display: flex; align-items: center; justify-content: space-between; gap: 2px; min-width: 0; padding: 2px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--tone); border-radius: var(--radius-1); font-size: 12px; }
    .dn { padding: 0 6px; }
    .dn b { font-family: var(--font-mono); margin-left: 4px; }
    .step { width: 22px; height: 22px; padding: 0; border: 0; background: none; color: var(--c-text); cursor: pointer; font-size: 14px; border-radius: var(--radius-1); }
    .step:hover { color: var(--c-interact); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 9px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); font-size: 12px; }
    .chip button, .rm { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 4px; }
    .chip button:hover, .rm:hover { color: var(--c-danger); }
    .add { display: flex; gap: 8px; }
    .loot { display: grid; grid-template-columns: 170px 1fr auto; gap: 8px; align-items: center; }
    .loot input { width: 100%; }
    .note { color: var(--c-text-dim); font-size: 12px; }
    .add-loot { align-self: flex-start; }
    .hint { margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .err { color: var(--c-danger); font-size: 12px; }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
    /* Le carte laterali, come quelle della finestra dell'attacco: inclinate e infilate sotto i bordi del pannello. */
    .card { position: absolute; z-index: 0; top: 8px; bottom: 8px; width: 200px; margin: 0; overflow: hidden; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card.right { left: calc(100% - 30px); transform: rotate(4deg); transform-origin: 30% 100%; }
    .card.left { right: calc(100% - 30px); transform: rotate(-4deg); transform-origin: 70% 100%; display: flex; flex-direction: column; background: var(--c-surface); overflow-y: auto; scrollbar-width: thin; }
    .card.enhanced { border-color: var(--c-faction-overlord); }
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
    .st.speed app-icon { color: var(--c-speed); }
    .st.armor app-icon { color: var(--c-text); }
    .cubes { flex-wrap: wrap; gap: 1px; }
    .abil { display: flex; flex-wrap: wrap; gap: 3px; }
    .ab { padding: 1px 5px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); font-size: 10px; line-height: 1.3; }
    .ab.extra { border-color: var(--c-interact); color: var(--c-interact); }
    .summary { display: none; }
    @media (max-width: 900px) {
      :host { --md-side: 0px; }
      .card { display: none; }
      .summary { display: block; flex: none; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-surface); }
      .summary.enhanced { border-color: var(--c-faction-overlord); }
      .summary summary { padding: 10px 12px; cursor: pointer; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
      .summary .tier { padding: 8px 12px; }
    }
    /* Telefono in verticale: ogni campo a riga intera. */
    @media (max-width: 560px) {
      .nums, .dice { grid-template-columns: 1fr; }
      .loot { grid-template-columns: 1fr auto; }
      .loot > :first-child { grid-column: 1 / -1; }
      .add { flex-direction: column; }
      .add .dlg-btn { align-self: flex-start; }
    }
  `,
})
export class MonsterDialogComponent {
  readonly open = input(false);
  /** Il nome del nemico che si modifica (della carta) e le abilità che ha già: servono al titolo e ai suggerimenti. */
  readonly def = input<MonsterDef | null>(null);
  readonly enhanced = input(false);
  /** Gli oggetti che si possono mettere nel bottino. */
  readonly items = input<{ id: string; name: string }[]>([]);
  readonly value = input<MonsterEdits | null>(null);
  readonly confirmed = output<MonsterEdits>();
  readonly cancel = output<void>();

  protected readonly numFields = [{ key: 'wounds', label: 'Punti ferita' }, { key: 'speed', label: 'Velocità' }, { key: 'armor', label: 'Armatura' }] as const;
  protected readonly dice = DICE;
  protected readonly lootKindOptions: SelectOption[] = LOOT_KINDS.map((k) => ({ value: k.kind, label: k.name }));
  protected readonly runeOptions: SelectOption[] = [{ value: 'red', label: 'Rossa' }, { value: 'blue', label: 'Blu' }, { value: 'green', label: 'Verde' }];
  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((o) => ({ value: o.id, label: o.name })));
  protected readonly title = computed(() => `Personalizza: ${this.def()?.name ?? 'Nemico'}`);
  protected readonly name = signal('');
  protected readonly inactive = signal(false);
  protected readonly stone = signal(false);
  protected readonly nums = signal<Record<'wounds' | 'speed' | 'armor', string>>({ wounds: '', speed: '', armor: '' });
  protected readonly diceCount = signal<Partial<Record<DieColor, number>>>({});
  protected readonly traits = signal<string[]>([]);
  protected readonly loot = signal<LootRow[]>([]);
  protected readonly abilityOptions = computed(() => [...new Set([...(this.def()?.normal.abilities ?? []), ...(this.def()?.enhanced.abilities ?? []), ...ABILITIES])].sort((a, b) => a.localeCompare(b, 'it')));
  protected readonly valid = computed(() => this.loot().every((r) => this.rowOk(r)));
  /** Con un nome scritto il mostro è unico. */
  protected readonly isUnique = computed(() => !!this.name().trim());
  protected readonly cardName = computed(() => this.name().trim() || this.def()?.name || '');
  private readonly tier = computed(() => (this.enhanced() ? this.def()?.enhanced : this.def()?.normal));

  /** Il sottotitolo della carta: se il mostro ha un nome, "<tipo> <potenziato> unico"; altrimenti solo "Potenziato" se lo è. */
  protected readonly subtitle = computed(() => {
    const type = this.def()?.name ?? '';
    return this.isUnique() ? `${type}${this.enhanced() ? ' potenziato' : ''} unico` : this.enhanced() ? 'Potenziato' : '';
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
      abilities: [...t.abilities, ...this.traits()],
      cardAbilities: t.abilities.length,
    }));
  });

  constructor() {
    effect(() => {
      const v = this.value();
      if (!this.open() || !v) return;
      this.name.set(v.name);
      this.inactive.set(v.inactive);
      this.stone.set(v.stone);
      this.nums.set({ wounds: v.bonus.wounds ? String(v.bonus.wounds) : '', speed: v.bonus.speed ? String(v.bonus.speed) : '', armor: v.bonus.armor ? String(v.bonus.armor) : '' });
      const count: Partial<Record<DieColor, number>> = {};
      for (const c of v.bonus.dice) count[c] = (count[c] ?? 0) + 1;
      this.diceCount.set(count);
      this.traits.set([...v.traits]);
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

  protected addTrait(input: HTMLInputElement) {
    const t = input.value.trim();
    if (t && !this.traits().includes(t)) this.traits.update((l) => [...l, t]);
    input.value = '';
  }

  protected removeTrait(i: number) {
    this.traits.update((l) => l.filter((_, k) => k !== i));
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
    this.confirmed.emit({ unique: this.isUnique(), name: this.name().trim(), bonus: { wounds: toInt(n.wounds), speed: toInt(n.speed), armor: toInt(n.armor), dice }, traits: this.traits(), drop, inactive: this.inactive(), stone: this.stone() });
  }
}
