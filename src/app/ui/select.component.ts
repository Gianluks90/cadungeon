import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/** Una scelta di `app-select`. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Un menu a tendina nello stile dell'app (al posto di quello di sistema, che stona): un bottone con la voce scelta e una freccia, e sotto (o sopra, se non c'è posto) l'elenco delle
 * voci a spigoli secchi con la scelta evidenziata. Si usa anche da tastiera: freccia giù o spazio aprono, frecce e invio scelgono, Esc chiude. Si chiude con un tocco fuori.
 * L'elenco è `fixed`, così non lo taglia il contenuto che scorre di una dialog.
 */
@Component({
  selector: 'app-select',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="trigger" #trigger [class.open]="open()" [attr.aria-expanded]="open()" aria-haspopup="listbox" [attr.aria-label]="label()" (click)="toggle(trigger)" (keydown)="onKey($event, trigger)">
      <span class="current" [class.placeholder]="!current()">{{ current()?.label ?? placeholder() }}</span>
      <app-icon name="expand_more" [size]="18" />
    </button>
    @if (open()) {
      <ul class="options" role="listbox" [style.left.px]="box().left" [style.top.px]="box().top" [style.minWidth.px]="box().width" [style.maxWidth.px]="box().maxWidth" [style.maxHeight.px]="box().maxHeight">
        @for (o of options(); track o.value; let i = $index) {
          <li role="option" [attr.aria-selected]="o.value === value()" [class.on]="o.value === value()" [class.active]="i === active()" (mouseenter)="active.set(i)" (click)="pick(o, $event)">{{ o.label }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: inline-block; min-width: 0; }
    :host(.block) { display: block; }
    .trigger {
      box-sizing: border-box; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 36px; padding: 0 8px 0 10px; cursor: pointer; text-align: left;
      background: var(--c-bg); color: var(--c-text); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); font: 13px/1.3 var(--font-ui); transition: border-color 0.15s;
    }
    /* Come gli altri campi: sul tocco più alto e con il corpo da 16 px (così iPhone non zooma). */
    @media (pointer: coarse) { .trigger { height: 42px; font-size: 16px; } li { padding: 10px; } }
    .trigger:hover, .trigger:focus-visible, .trigger.open { border-color: var(--c-interact); outline: none; }
    .current { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .placeholder { color: var(--c-text-dim); }
    app-icon { flex: none; color: var(--c-text-dim); transition: transform 0.15s; }
    .trigger.open app-icon { transform: rotate(180deg); }
    /* Non si chiama "panel": la classe globale .panel aggiunge gli angoli "quota". Le voci lunghe vanno a capo, senza scorrimento orizzontale. */
    .options {
      position: fixed; z-index: 1200; margin: 0; padding: 3px; list-style: none; overflow-x: hidden; overflow-y: auto; box-sizing: border-box;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
      font: 13px/1.3 var(--font-ui); color: var(--c-text);
    }
    li { padding: 7px 10px; border-radius: var(--radius-1); cursor: pointer; white-space: normal; overflow-wrap: anywhere; }
    li.active { background: color-mix(in srgb, var(--c-text) 8%, transparent); }
    li.on { color: var(--c-interact); }
  `,
})
export class SelectComponent {
  readonly options = input<SelectOption[]>([]);
  readonly value = input('');
  readonly placeholder = input('Scegli…');
  readonly label = input('');
  readonly changed = output<string>();

  protected readonly open = signal(false);
  protected readonly active = signal(0);
  protected readonly box = signal({ left: 0, top: 0, width: 0, maxWidth: 420, maxHeight: 260 });
  protected readonly current = computed(() => this.options().find((o) => o.value === this.value()) ?? null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Apre l'elenco sotto il bottone, o sopra se sotto non c'è posto. */
  protected toggle(trigger: HTMLElement) {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    const r = trigger.getBoundingClientRect();
    const room = window.innerHeight - r.bottom - 8;
    const want = Math.min(260, this.options().length * 34 + 8);
    const below = room >= want || room >= r.top - 8;
    const maxHeight = Math.max(80, Math.min(260, below ? room : r.top - 8));
    // L'elenco è largo almeno quanto il bottone e al massimo 420 px (o lo schermo): resta dentro lo schermo e le voci lunghe vanno a capo.
    const maxWidth = Math.max(r.width, Math.min(420, window.innerWidth - 16));
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, maxWidth)));
    this.box.set({ left, top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - Math.min(want, maxHeight)), width: r.width, maxWidth, maxHeight });
    this.active.set(Math.max(0, this.options().findIndex((o) => o.value === this.value())));
    this.typed = '';
    this.open.set(true);
    this.scrollToActive();
  }

  /** Quello che si è scritto a elenco aperto per cercare una voce (si azzera dopo un attimo che non si scrive). */
  private typed = '';
  private typedTimer: ReturnType<typeof setTimeout> | undefined;

  /** Il testo senza accenti né maiuscole, per confrontare quello che si scrive con le voci. */
  private static readonly plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

  /** Porta l'evidenziazione alla voce che inizia come quello che si è scritto (o, se non c'è, che lo contiene) e la mostra: scrivendo "P" l'elenco scorre alle voci che iniziano per P. */
  private typeAhead(key: string) {
    clearTimeout(this.typedTimer);
    this.typed = key === 'Backspace' ? this.typed.slice(0, -1) : this.typed + key;
    this.typedTimer = setTimeout(() => (this.typed = ''), 900);
    if (!this.typed) return;
    const want = SelectComponent.plain(this.typed);
    const labels = this.options().map((o) => SelectComponent.plain(o.label));
    const i = labels.findIndex((l) => l.startsWith(want));
    const found = i >= 0 ? i : labels.findIndex((l) => l.includes(want));
    if (found >= 0) {
      this.active.set(found);
      this.scrollToActive();
    }
  }

  /** Fa scorrere l'elenco fino alla voce evidenziata, dopo che si è ridisegnato. */
  private scrollToActive() {
    setTimeout(() => this.host.nativeElement.querySelector('li.active')?.scrollIntoView({ block: 'nearest' }));
  }

  protected pick(o: SelectOption, e?: Event) {
    e?.preventDefault(); // dentro un <label> il clic su una voce verrebbe girato al bottone, che riaprirebbe subito l'elenco
    this.open.set(false);
    if (o.value !== this.value()) this.changed.emit(o.value);
  }

  protected onKey(e: KeyboardEvent, trigger: HTMLElement) {
    const n = this.options().length;
    if (!this.open()) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.toggle(trigger);
      }
      return;
    }
    const typing = (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key !== ' ' || !!this.typed)) || (e.key === 'Backspace' && !!this.typed); // lo spazio sceglie, tranne in mezzo a una parola
    if (typing) this.typeAhead(e.key);
    else if (e.key === 'ArrowDown') {
      this.active.update((i) => (i + 1) % n);
      this.scrollToActive();
    } else if (e.key === 'ArrowUp') {
      this.active.update((i) => (i - 1 + n) % n);
      this.scrollToActive();
    } else if (e.key === 'Enter' || e.key === ' ') this.pick(this.options()[this.active()]);
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.stopPropagation(); // chiude solo l'elenco, non la dialog
      this.open.set(false);
      return;
    } else return;
    e.preventDefault();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
